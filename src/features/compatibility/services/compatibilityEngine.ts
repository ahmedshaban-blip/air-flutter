import * as matrixData from '../data/compatibility-matrix.json'
import {
  AndroidRule,
  AvailableVersions,
  CompatibilityIssue,
  CompatibilityMatrix,
  CompatibilityReport,
  CustomStackConfig,
  EnvironmentInfo,
  ParsedGradleInfo,
  ParsedPodfileInfo,
  StackDiffItem
} from '../models/types'

export class VersionComparator {
  /**
   * Normalizes version string to [major, minor, patch] numbers.
   */
  public static parse(v: string): number[] {
    const clean = v.replace(/^[^0-9]+/, '').split('-')[0]
    const parts = clean.split('.').map(n => parseInt(n, 10) || 0)
    while (parts.length < 3) {
      parts.push(0)
    }
    return parts.slice(0, 3)
  }

  /**
   * Compares two version strings: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  public static compare(v1: string, v2: string): number {
    const p1 = this.parse(v1)
    const p2 = this.parse(v2)
    for (let i = 0; i < 3; i++) {
      if (p1[i] < p2[i]) return -1
      if (p1[i] > p2[i]) return 1
    }
    return 0
  }

  /**
   * Evaluates if a version satisfies a range like ">=8.5.0 <8.6.0" or ">=8.7"
   */
  public static satisfies(version: string, rangeExpr: string): boolean {
    const clauses = rangeExpr.trim().split(/\s+/)
    for (const clause of clauses) {
      if (!clause) continue
      const opMatch = clause.match(/^([><=]+)?(.+)$/)
      if (!opMatch) continue
      const op = opMatch[1] || '='
      const targetVersion = opMatch[2]
      const cmp = this.compare(version, targetVersion)

      if (op === '>=' && cmp < 0) return false
      if (op === '>' && cmp <= 0) return false
      if (op === '<=' && cmp > 0) return false
      if (op === '<' && cmp >= 0) return false
      if ((op === '=' || op === '==') && cmp !== 0) return false
    }
    return true
  }
}

export class CompatibilityEngine {
  private static matrix: CompatibilityMatrix = matrixData as CompatibilityMatrix

  public static getMatrix(): CompatibilityMatrix {
    return this.matrix
  }

  /**
   * Audits parsed project information and environment against the compatibility matrix.
   */
  public static evaluate(
    projectPath: string,
    gradle: ParsedGradleInfo,
    podfile: ParsedPodfileInfo,
    env: EnvironmentInfo
  ): CompatibilityReport {
    const issues: CompatibilityIssue[] = []
    const rec = this.matrix.android.recommended

    // 1. Android AGP & Gradle Evaluation
    if (gradle.agpVersion && gradle.gradleVersion) {
      const activeRule = this.matrix.android.rules.find(r =>
        VersionComparator.satisfies(gradle.agpVersion!, r.agpRange)
      )

      if (activeRule) {
        // Check Gradle compatibility
        const isGradleCompatible = VersionComparator.satisfies(
          gradle.gradleVersion,
          activeRule.compatibleGradle
        )

        if (!isGradleCompatible) {
          issues.push({
            type: 'error',
            code: 'AGP_GRADLE_MISMATCH',
            message: `AGP ${gradle.agpVersion} requires Gradle ${activeRule.compatibleGradle}, but current Gradle version is ${gradle.gradleVersion}.`,
            filePath: gradle.wrapperPath,
            range: gradle.gradleRange,
            migrationUrl: activeRule.migrationUrl,
            suggestedFix: gradle.wrapperPath && gradle.gradleRange
              ? {
                  description: `Upgrade Gradle to ${activeRule.recommendedGradle}`,
                  filePath: gradle.wrapperPath,
                  range: gradle.gradleRange,
                  newText: activeRule.recommendedGradle
                }
              : undefined
          })
        }

        // Check Java Runtime compatibility
        if (env.javaVersion !== null && env.javaVersion < activeRule.minJava) {
          issues.push({
            type: 'error',
            code: 'JAVA_AGP_MISMATCH',
            message: `AGP ${gradle.agpVersion} requires minimum JDK ${activeRule.minJava}, but local environment runs JDK ${env.javaVersion}.`,
            filePath: gradle.buildGradlePath,
            range: gradle.agpRange,
            migrationUrl: activeRule.migrationUrl
          })
        }
      }

      // Check if build stack is outdated compared to recommended latest stable
      const isOutdated =
        VersionComparator.compare(gradle.agpVersion, rec.agp) < 0 ||
        VersionComparator.compare(gradle.gradleVersion, rec.gradle) < 0

      if (isOutdated && !issues.some(i => i.code === 'AGP_GRADLE_MISMATCH')) {
        issues.push({
          type: 'warning',
          code: 'OUTDATED_STACK',
          message: `Project uses AGP ${gradle.agpVersion} and Gradle ${gradle.gradleVersion}. Recommended latest stable is AGP ${rec.agp} + Gradle ${rec.gradle} (JDK ${rec.java}).`,
          filePath: gradle.buildGradlePath,
          range: gradle.agpRange,
          suggestedFix: gradle.buildGradlePath && gradle.agpRange
            ? {
                description: `Bump AGP to ${rec.agp}`,
                filePath: gradle.buildGradlePath,
                range: gradle.agpRange,
                newText: rec.agp
              }
            : undefined
        })
      }
    }

    // 2. iOS Deployment Target Evaluation
    if (podfile.exists && podfile.deploymentTarget) {
      const iosRec = this.matrix.ios.recommended.minDeploymentTarget
      const isDeprecated = this.matrix.ios.deprecatedTargets.includes(podfile.deploymentTarget)
      const isOutdatedTarget = VersionComparator.compare(podfile.deploymentTarget, iosRec) < 0

      if (isDeprecated || isOutdatedTarget) {
        issues.push({
          type: 'warning',
          code: isDeprecated ? 'DEPRECATED_IOS_TARGET' : 'OUTDATED_IOS_TARGET',
          message: `iOS deployment target '${podfile.deploymentTarget}' is ${isDeprecated ? 'deprecated' : 'outdated'}. Flutter and modern plugins require at least iOS ${iosRec}.`,
          filePath: podfile.podfilePath,
          range: podfile.targetRange,
          migrationUrl: this.matrix.ios.migrationUrl,
          suggestedFix: podfile.podfilePath && podfile.targetRange
            ? {
                description: `Bump iOS deployment target to ${iosRec}`,
                filePath: podfile.podfilePath,
                range: podfile.targetRange,
                newText: iosRec
              }
            : undefined
        })
      }
    }

    const hasErrors = issues.some(i => i.type === 'error')

    return {
      projectPath,
      scannedAt: new Date().toISOString(),
      gradle,
      podfile,
      environment: env,
      issues,
      isHealthy: issues.length === 0,
      canAutoUpgrade: issues.some(i => i.suggestedFix !== undefined)
    }
  }

  public static getAvailableVersions(): AvailableVersions {
    return this.matrix.availableVersions
  }

  public static getRuleForAgp(agpVersion: string): AndroidRule | undefined {
    return this.matrix.android.rules.find(r =>
      VersionComparator.satisfies(agpVersion, r.agpRange)
    )
  }

  public static getCompatibleGradlesForAgp(agpVersion: string): string[] {
    const rule = this.getRuleForAgp(agpVersion)
    if (!rule) {
      return this.matrix.availableVersions.gradle
    }
    return this.matrix.availableVersions.gradle.filter(g =>
      VersionComparator.satisfies(g, rule.compatibleGradle)
    )
  }

  /**
   * Generates diff preview items for a target custom configuration against the current report.
   */
  public static computeDiffItems(
    report: CompatibilityReport,
    target: CustomStackConfig
  ): StackDiffItem[] {
    const diffs: StackDiffItem[] = []

    // 1. Gradle Wrapper
    if (report.gradle.wrapperPath && report.gradle.gradleRange) {
      if (report.gradle.gradleVersion !== target.gradle) {
        diffs.push({
          id: 'gradle',
          title: 'Gradle Wrapper',
          filePath: report.gradle.wrapperPath,
          currentValue: report.gradle.gradleVersion || 'unknown',
          targetValue: target.gradle,
          description: `Update distributionUrl in gradle-wrapper.properties to Gradle ${target.gradle}`,
          range: report.gradle.gradleRange,
          selected: true
        })
      }
    }

    // 2. Android Gradle Plugin (AGP)
    if (report.gradle.buildGradlePath && report.gradle.agpRange) {
      if (report.gradle.agpVersion !== target.agp) {
        diffs.push({
          id: 'agp',
          title: 'Android Gradle Plugin (AGP)',
          filePath: report.gradle.buildGradlePath,
          currentValue: report.gradle.agpVersion || 'unknown',
          targetValue: target.agp,
          description: `Update AGP version in build script to ${target.agp}`,
          range: report.gradle.agpRange,
          selected: true
        })
      }
    }

    // 3. Kotlin Version
    if (report.gradle.buildGradlePath && report.gradle.kotlinRange && target.kotlin) {
      if (report.gradle.kotlinVersion !== target.kotlin) {
        diffs.push({
          id: 'kotlin',
          title: 'Kotlin Plugin / Extension',
          filePath: report.gradle.buildGradlePath,
          currentValue: report.gradle.kotlinVersion || 'unknown',
          targetValue: target.kotlin,
          description: `Update Kotlin version in build script to ${target.kotlin}`,
          range: report.gradle.kotlinRange,
          selected: true
        })
      }
    }

    // 4. Java / CompileOptions in app/build.gradle
    if (report.gradle.javaConfig && report.gradle.javaConfig.appBuildGradlePath) {
      const appBuildGradlePath = report.gradle.javaConfig.appBuildGradlePath
      const jc = report.gradle.javaConfig
      const targetJavaVer = target.java === 17 ? 'JavaVersion.VERSION_17' : 'JavaVersion.VERSION_11'
      const targetJvm = target.java === 17 ? '17' : '11'

      if (jc.sourceCompatibilityRange && jc.sourceCompatibility && jc.sourceCompatibility !== targetJavaVer) {
        diffs.push({
          id: 'javaSource',
          title: 'Java sourceCompatibility',
          filePath: appBuildGradlePath,
          currentValue: jc.sourceCompatibility,
          targetValue: targetJavaVer,
          description: `Update sourceCompatibility in app/build.gradle to ${targetJavaVer}`,
          range: jc.sourceCompatibilityRange,
          selected: true
        })
      }

      if (jc.targetCompatibilityRange && jc.targetCompatibility && jc.targetCompatibility !== targetJavaVer) {
        diffs.push({
          id: 'javaTarget',
          title: 'Java targetCompatibility',
          filePath: appBuildGradlePath,
          currentValue: jc.targetCompatibility,
          targetValue: targetJavaVer,
          description: `Update targetCompatibility in app/build.gradle to ${targetJavaVer}`,
          range: jc.targetCompatibilityRange,
          selected: true
        })
      }

      if (jc.jvmTargetRange && jc.jvmTarget && jc.jvmTarget !== targetJvm) {
        diffs.push({
          id: 'jvmTarget',
          title: 'Kotlin jvmTarget',
          filePath: appBuildGradlePath,
          currentValue: jc.jvmTarget,
          targetValue: targetJvm,
          description: `Update jvmTarget in app/build.gradle to "${targetJvm}"`,
          range: jc.jvmTargetRange,
          selected: true
        })
      }
    }

    // 5. iOS Deployment Target
    if (report.podfile.exists && report.podfile.podfilePath && report.podfile.targetRange && target.iosTarget) {
      if (report.podfile.deploymentTarget !== target.iosTarget) {
        diffs.push({
          id: 'iosTarget',
          title: 'iOS Deployment Target',
          filePath: report.podfile.podfilePath,
          currentValue: report.podfile.deploymentTarget || 'unknown',
          targetValue: target.iosTarget,
          description: `Update platform :ios in ios/Podfile to '${target.iosTarget}'`,
          range: report.podfile.targetRange,
          selected: true
        })
      }
    }

    return diffs
  }
}

