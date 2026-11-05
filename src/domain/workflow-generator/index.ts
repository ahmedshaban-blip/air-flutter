import * as fs from 'fs'
import * as path from 'path'

export interface WorkflowOptions {
  projectPath: string
  workflowFileName?: string
  branch: string
  triggerOnPush: boolean
  triggerOnPr: boolean
  triggerManual: boolean
  buildTarget: 'universal_apk' | 'split_apk' | 'appbundle' | 'both'
  workflowLayout?: 'single' | 'separate'
  buildMode: 'release' | 'debug'
  enableSigning: boolean
  enableCache?: boolean
  flutterCache?: boolean
  gradleCacheProvider?: 'setup-gradle' | 'setup-java' | 'none'
  limitGradleMemory?: boolean
  gradleHeapMb?: number
  gradleMetaspaceMb?: number
  gradleWorkers?: number
  disableGradleParallel?: boolean
  disableGradleDaemon?: boolean
  publishToReleases?: boolean
  retentionDays?: number
  timeoutMinutes?: number
  javaVersion?: string
  flutterVersion?: string
  usePreinstalledNdk?: boolean
  installAndroidTools?: boolean
  ndkVersion?: string
  cmakeVersion?: string
}

export class WorkflowGenerator {
  private static readonly defaultNdkVersion = '27.3.13750724'
  private static readonly defaultInstalledNdkVersion = '28.2.13676358'
  private static readonly defaultCmakeVersion = '3.22.1'

  public static validateProject(projectPath: string): { valid: boolean; error?: string } {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { valid: false, error: 'Selected path does not exist.' }
    }
    const pubspec = path.join(projectPath, 'pubspec.yaml')
    if (!fs.existsSync(pubspec)) {
      return { valid: false, error: 'Path is not a valid Flutter project (pubspec.yaml not found).' }
    }
    return { valid: true }
  }

  public static generateWorkflowYaml(options: WorkflowOptions): string {
    const triggers: string[] = []

    if (options.triggerOnPush) {
      triggers.push(`  push:
    branches:
      - ${options.branch}`)
    }
    if (options.triggerOnPr) {
      triggers.push(`  pull_request:
    branches:
      - ${options.branch}`)
    }
    if (options.triggerManual || triggers.length === 0) {
      triggers.push(`  workflow_dispatch:`)
    }

    const javaVer = options.javaVersion || '17'
    const flutterVer = options.flutterVersion || 'stable'
    const androidTools = this.getAndroidToolsConfig(options)
    const mode = options.buildMode || 'release'
    const retentionDays = this.getIntegerOption(options.retentionDays, 14, 1, undefined, 'Retention days')
    const timeoutMinutes = this.getIntegerOption(options.timeoutMinutes, 60, 1, 360, 'Timeout minutes')

    let buildSteps = ''
    let artifactSteps = ''

    if (options.buildTarget === 'universal_apk') {
      buildSteps = `      - name: Build Android APK (${mode})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-apk-build" flutter build apk --${mode}`
      artifactSteps = `      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: flutter-${mode}-apk
          path: build/app/outputs/flutter-apk/*.apk
          retention-days: ${retentionDays}`
    } else if (options.buildTarget === 'split_apk') {
      buildSteps = `      - name: Build Split-per-ABI APKs (${mode})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-split-apk-build" flutter build apk --${mode} --split-per-abi`
      artifactSteps = `      - name: Upload Split APK Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: flutter-${mode}-split-apks
          path: build/app/outputs/flutter-apk/*.apk
          retention-days: ${retentionDays}`
    } else if (options.buildTarget === 'appbundle') {
      buildSteps = `      - name: Build Android App Bundle (${mode})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-appbundle-build" flutter build appbundle --${mode}`
      artifactSteps = `      - name: Upload App Bundle Artifact
        uses: actions/upload-artifact@v4
        with:
          name: App Bundle
          path: build/app/outputs/bundle/${mode}/*.aab
          retention-days: ${retentionDays}`
    } else {
      buildSteps = `      - name: Build Android APK (${mode})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-apk-build" flutter build apk --${mode}

      - name: Build Android App Bundle (${mode})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-appbundle-build" flutter build appbundle --${mode}`
      artifactSteps = `      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: flutter-${mode}-apk
          path: build/app/outputs/flutter-apk/*.apk
          retention-days: ${retentionDays}

      - name: Upload App Bundle Artifact
        uses: actions/upload-artifact@v4
        with:
          name: App Bundle
          path: build/app/outputs/bundle/${mode}/*.aab
          retention-days: ${retentionDays}`
    }

    let releaseStep = ''
    if (options.publishToReleases) {
      const releaseFiles = options.buildTarget === 'appbundle'
        ? `build/app/outputs/bundle/${mode}/*.aab`
        : options.buildTarget === 'both'
          ? `build/app/outputs/flutter-apk/*.apk
            build/app/outputs/bundle/${mode}/*.aab`
          : 'build/app/outputs/flutter-apk/*.apk'

      releaseStep = `

      - name: Publish GitHub Release
        if: github.event_name != 'pull_request'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: build-\${{ github.run_number }}-\${{ github.run_attempt }}
          name: Flutter Build #\${{ github.run_number }}
          generate_release_notes: true
          files: |
            ${releaseFiles}`
    }

    let signingSteps = ''
    if (options.enableSigning) {
      signingSteps = `      - name: Validate and configure Android signing
        env:
          KEYSTORE_BASE64: \${{ secrets.KEYSTORE_BASE64 }}
          KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: \${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: \${{ secrets.KEY_PASSWORD }}
        run: |
          mkdir -p "$RUNNER_TEMP/air-flutter-logs"
          exec > >(tee "$RUNNER_TEMP/air-flutter-logs/android-signing.log") 2>&1
          for secret_name in KEYSTORE_BASE64 KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
            if [ -z "\${!secret_name}" ]; then
              echo "::error title=Missing signing secret::\${secret_name} is empty. Add it under Repository Settings > Secrets and variables > Actions."
              exit 1
            fi
          done
          if ! printf '%s' "$KEYSTORE_BASE64" | base64 --decode > android/app/upload-keystore.jks; then
            echo "::error title=Invalid keystore::KEYSTORE_BASE64 is not valid Base64 data."
            exit 1
          fi
          cat <<EOF > android/key.properties
          storePassword=$KEYSTORE_PASSWORD
          keyPassword=$KEY_PASSWORD
          keyAlias=$KEY_ALIAS
          storeFile=upload-keystore.jks
          EOF
`
    }

    const gradleCacheProvider = this.getGradleCacheProvider(options)
    let cacheStep = ''
    if (gradleCacheProvider === 'setup-gradle') {
      cacheStep = `      - name: Setup Gradle Cache
        uses: gradle/actions/setup-gradle@v3
`
    }

    const flutterCache = options.flutterCache !== false
    const gradleMemoryStep = this.generateGradleMemoryStep(options)

    const workflowLabel = this.getWorkflowLabel(options.buildTarget)
    const androidToolsEnv = androidTools.ndkVersion
      ? `    env:
      CI_NDK_VERSION: '${androidTools.ndkVersion}'
${androidTools.cmakeVersion ? `      CI_CMAKE_VERSION: '${androidTools.cmakeVersion}'
` : ''}`
      : ''
    const androidToolsStep = androidTools.installAndroidTools
      ? `      - name: Install Android NDK (\${{ env.CI_NDK_VERSION }}) and CMake (\${{ env.CI_CMAKE_VERSION }})
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "android-licenses" bash -c 'yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses'
          run_with_diagnostics "android-tools-install" "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --install "ndk;\${CI_NDK_VERSION}" "cmake;\${CI_CMAKE_VERSION}"
          if [ ! -d "$ANDROID_SDK_ROOT/ndk/\${CI_NDK_VERSION}" ] || [ ! -d "$ANDROID_SDK_ROOT/cmake/\${CI_CMAKE_VERSION}" ]; then
            echo "::error title=Android tools installation incomplete::The requested NDK or CMake directory was not created by sdkmanager."
            exit 1
          fi
`
      : androidTools.usePreinstalledNdk
        ? `      - name: Verify preinstalled Android NDK (${androidTools.ndkVersion})
        run: |
          mkdir -p "$RUNNER_TEMP/air-flutter-logs"
          exec > >(tee "$RUNNER_TEMP/air-flutter-logs/ndk-verification.log") 2>&1
          if [ ! -d "$ANDROID_SDK_ROOT/ndk/\${CI_NDK_VERSION}" ]; then
            echo "::error title=NDK not preinstalled::NDK \${CI_NDK_VERSION} is not available on this runner. Select an available version or enable Install NDK and CMake before building."
            echo "Available NDK versions:"
            find "$ANDROID_SDK_ROOT/ndk" -mindepth 1 -maxdepth 1 -type d -printf '%f\\n' 2>/dev/null | sort || true
            exit 1
          fi
`
        : ''
    const diagnosticsSetupStep = this.generateDiagnosticsSetupStep()
    const failureDiagnosticsSteps = this.generateFailureDiagnosticsSteps()

    return `name: Flutter ${workflowLabel} CI (${mode.toUpperCase()})

on:
${triggers.join('\n')}

${options.publishToReleases ? `permissions:
  contents: write

` : ''}jobs:
  build:
    name: Build Android (${mode})
    runs-on: ubuntu-24.04
    timeout-minutes: ${timeoutMinutes}
${androidToolsEnv}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

${diagnosticsSetupStep}
      - name: Set up Java (${javaVer})
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '${javaVer}'
${gradleCacheProvider === 'setup-java' ? "          cache: 'gradle'\n" : ''}

      - name: Set up Flutter (${flutterVer})
        uses: subosito/flutter-action@v2
        with:
          channel: '${flutterVer}'
          cache: ${flutterCache}
          pub-cache: ${flutterCache}

${androidToolsStep}
${gradleMemoryStep}${cacheStep}${signingSteps}      - name: Install dependencies
        run: |
          source "$RUNNER_TEMP/air-flutter-diagnose.sh"
          run_with_diagnostics "flutter-pub-get" flutter pub get

${buildSteps}

${artifactSteps}${releaseStep}

${failureDiagnosticsSteps}
`
  }

  private static generateGradleMemoryStep(options: WorkflowOptions): string {
    if (!options.limitGradleMemory) return ''

    const heapMb = this.getIntegerOption(options.gradleHeapMb, 2048, 512, 6144, 'Gradle heap')
    const metaspaceMb = this.getIntegerOption(options.gradleMetaspaceMb, 512, 256, 2048, 'Gradle Metaspace')
    const workers = this.getIntegerOption(options.gradleWorkers, 2, 1, 4, 'Gradle workers')
    const parallel = options.disableGradleParallel !== false ? 'false' : 'true'
    const daemon = options.disableGradleDaemon !== false ? 'false' : 'true'

    return `      - name: Apply CI Gradle memory limits
        run: |
          mkdir -p "$RUNNER_TEMP/air-flutter-logs"
          exec > >(tee "$RUNNER_TEMP/air-flutter-logs/gradle-memory-configuration.log") 2>&1
          if [ ! -f android/gradle.properties ]; then
            echo "::error title=Gradle configuration missing::android/gradle.properties was not found."
            exit 1
          fi
          cat <<'EOF' >> android/gradle.properties

          # Air Flutter CI-only resource limits
          org.gradle.jvmargs=-Xmx${heapMb}m -XX:MaxMetaspaceSize=${metaspaceMb}m
          org.gradle.workers.max=${workers}
          org.gradle.parallel=${parallel}
          org.gradle.daemon=${daemon}
          EOF
          echo "Applied CI-only Gradle limits: heap=${heapMb}MB, Metaspace=${metaspaceMb}MB, workers=${workers}, parallel=${parallel}, daemon=${daemon}."

`
  }

  private static generateDiagnosticsSetupStep(): string {
    return `      - name: Prepare CI diagnostics
        run: |
          mkdir -p "$RUNNER_TEMP/air-flutter-logs"
          cat > "$RUNNER_TEMP/air-flutter-diagnose.sh" <<'AIR_FLUTTER_DIAGNOSTICS'
          run_with_diagnostics() {
            local label="$1"
            shift
            local log_file="$RUNNER_TEMP/air-flutter-logs/$label.log"
            set +e
            "$@" 2>&1 | tee "$log_file"
            local status=\${PIPESTATUS[0]}
            set -e
            if [ "$status" -eq 0 ]; then
              return 0
            fi

            if grep -Eqi 'OutOfMemoryError|Java heap space|Metaspace|exit code 137|(^|[^a-z])Killed([^a-z]|$)' "$log_file"; then
              echo "::error title=Runner memory exhausted::Gradle or a native compiler exceeded available memory. Enable Limit Gradle memory usage; start with 2048 MB heap and 2 workers."
            elif grep -Eqi 'requires Android NDK|NDK.*not found|No version of NDK matched|source.properties.*NDK' "$log_file"; then
              echo "::error title=Android NDK mismatch::Copy the required NDK version from this log, then choose a matching preinstalled NDK or install it in Build Troubleshooting."
            elif grep -Eqi 'CMake.*not found|Could not find CMake|CXX[0-9]+' "$log_file"; then
              echo "::error title=CMake configuration failed::Copy the requested CMake version from this log and enable Install NDK and CMake before building."
            elif grep -Eqi 'No space left on device|ENOSPC' "$log_file"; then
              echo "::error title=Runner disk full::The GitHub runner ran out of disk space. Remove unnecessary generated files or use a larger runner."
            elif grep -Eqi 'keystore|signingConfig|key.properties|Failed to read key' "$log_file"; then
              echo "::error title=Android signing failed::Verify the four signing secrets, keystore Base64 content, alias, and passwords."
            elif grep -Eqi 'Could not resolve|Connection timed out|SocketException|pub.dev|Temporary failure in name resolution' "$log_file"; then
              echo "::error title=Dependency or network failure::A dependency could not be resolved. Check package availability, repository configuration, and retry transient network failures."
            else
              echo "::error title=Command failed::$label exited with code $status. Download the flutter-build-diagnostics artifact for the complete log."
            fi
            return "$status"
          }
          AIR_FLUTTER_DIAGNOSTICS
          chmod +x "$RUNNER_TEMP/air-flutter-diagnose.sh"

`
  }

  private static generateFailureDiagnosticsSteps(): string {
    return `      - name: Diagnose workflow failure
        if: failure()
        run: |
          mkdir -p "$RUNNER_TEMP/air-flutter-logs"
          {
            echo "Air Flutter runner diagnostics"
            echo "Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
            echo
            echo "=== Memory ==="
            free -h || true
            echo
            echo "=== Disk ==="
            df -h || true
            echo
            echo "=== Java ==="
            java -version || true
            echo
            echo "=== Flutter ==="
            flutter --version || true
            echo
            echo "=== Gradle ==="
            (cd android && ./gradlew --version) || true
            echo
            echo "=== Safe Gradle resource settings ==="
            grep -E '^org\.gradle\.(jvmargs|workers\.max|parallel|daemon)=' android/gradle.properties 2>/dev/null || true
            echo
            echo "=== Installed NDK versions ==="
            find "$ANDROID_SDK_ROOT/ndk" -mindepth 1 -maxdepth 1 -type d -printf '%f\\n' 2>/dev/null | sort || true
            echo
            echo "=== Installed CMake versions ==="
            find "$ANDROID_SDK_ROOT/cmake" -mindepth 1 -maxdepth 1 -type d -printf '%f\\n' 2>/dev/null | sort || true
          } | tee "$RUNNER_TEMP/air-flutter-logs/runner-diagnostics.txt"
          echo "::error title=Workflow failed::Review the failing step annotation and download the flutter-build-diagnostics artifact for complete logs."

      - name: Upload failure diagnostics
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: flutter-build-diagnostics-\${{ github.run_number }}-\${{ github.run_attempt }}
          path: \${{ runner.temp }}/air-flutter-logs
          if-no-files-found: warn
          retention-days: 7`
  }

  private static getNdkVersion(value?: string): string {
    const ndkVersion = value || this.defaultNdkVersion
    if (!/^\d+\.\d+\.\d+$/.test(ndkVersion)) {
      throw new Error('NDK version must use the numeric format major.minor.build.')
    }
    return ndkVersion
  }

  private static getCmakeVersion(value?: string): string {
    const cmakeVersion = value || this.defaultCmakeVersion
    if (!/^\d+\.\d+\.\d+$/.test(cmakeVersion)) {
      throw new Error('CMake version must use the numeric format major.minor.patch.')
    }
    return cmakeVersion
  }

  private static getGradleCacheProvider(options: WorkflowOptions): 'setup-gradle' | 'setup-java' | 'none' {
    const provider = options.gradleCacheProvider || (options.enableCache === false ? 'none' : 'setup-gradle')
    if (!['setup-gradle', 'setup-java', 'none'].includes(provider)) {
      throw new Error('Gradle cache provider must be setup-gradle, setup-java, or none.')
    }
    return provider
  }

  private static getAndroidToolsConfig(options: WorkflowOptions): {
    usePreinstalledNdk: boolean
    installAndroidTools: boolean
    ndkVersion?: string
    cmakeVersion?: string
  } {
    const installAndroidTools = options.installAndroidTools === true
    const usePreinstalledNdk = options.usePreinstalledNdk ?? !installAndroidTools
    if (usePreinstalledNdk && installAndroidTools) {
      throw new Error('Choose either a preinstalled NDK or Android tools installation, not both.')
    }
    const ndkVersion = usePreinstalledNdk || installAndroidTools
      ? this.getNdkVersion(options.ndkVersion || (installAndroidTools ? this.defaultInstalledNdkVersion : undefined))
      : undefined
    const cmakeVersion = installAndroidTools ? this.getCmakeVersion(options.cmakeVersion) : undefined
    return { usePreinstalledNdk, installAndroidTools, ndkVersion, cmakeVersion }
  }

  private static async configureCiNdkVersion(projectPath: string): Promise<string> {
    const groovyPath = path.join(projectPath, 'android', 'app', 'build.gradle')
    const kotlinPath = path.join(projectPath, 'android', 'app', 'build.gradle.kts')
    const buildFilePath = fs.existsSync(kotlinPath) ? kotlinPath : groovyPath

    if (!fs.existsSync(buildFilePath)) {
      throw new Error('Android app build file not found (expected android/app/build.gradle or build.gradle.kts).')
    }

    const originalContent = await fs.promises.readFile(buildFilePath, 'utf8')
    const newline = originalContent.includes('\r\n') ? '\r\n' : '\n'
    const ndkDeclaration = 'ndkVersion = System.getenv("CI_NDK_VERSION") ?: flutter.ndkVersion'
    const existingNdkPattern = /^(\s*)ndkVersion\b[^\r\n]*$/m
    let updatedContent: string

    if (existingNdkPattern.test(originalContent)) {
      updatedContent = originalContent.replace(existingNdkPattern, (_match, indent: string) => `${indent}${ndkDeclaration}`)
    } else {
      const androidBlockPattern = /^(\s*)android\s*\{\s*$/m
      const androidBlockMatch = androidBlockPattern.exec(originalContent)
      if (!androidBlockMatch) {
        throw new Error(`Could not find the android { ... } block in ${path.basename(buildFilePath)}.`)
      }
      const insertionPoint = androidBlockMatch.index + androidBlockMatch[0].length
      const indentation = `${androidBlockMatch[1]}    `
      updatedContent = `${originalContent.slice(0, insertionPoint)}${newline}${indentation}${ndkDeclaration}${originalContent.slice(insertionPoint)}`
    }

    if (updatedContent !== originalContent) {
      await fs.promises.writeFile(buildFilePath, updatedContent, 'utf8')
    }
    return buildFilePath
  }

  private static async removeCiNdkVersion(projectPath: string): Promise<void> {
    const groovyPath = path.join(projectPath, 'android', 'app', 'build.gradle')
    const kotlinPath = path.join(projectPath, 'android', 'app', 'build.gradle.kts')
    const buildFilePath = fs.existsSync(kotlinPath) ? kotlinPath : groovyPath
    if (!fs.existsSync(buildFilePath)) return

    const originalContent = await fs.promises.readFile(buildFilePath, 'utf8')
    const ciNdkDeclaration = /ndkVersion\s*=\s*System\.getenv\(["']CI_NDK_VERSION["']\)\s*\?:\s*flutter\.ndkVersion/
    const updatedContent = originalContent.replace(ciNdkDeclaration, 'ndkVersion = flutter.ndkVersion')
    if (updatedContent !== originalContent) {
      await fs.promises.writeFile(buildFilePath, updatedContent, 'utf8')
    }
  }

  private static getIntegerOption(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number | undefined,
    label: string
  ): number {
    const resolvedValue = value ?? fallback
    if (!Number.isInteger(resolvedValue) || resolvedValue < min || (max !== undefined && resolvedValue > max)) {
      const range = max === undefined ? `at least ${min}` : `between ${min} and ${max}`
      throw new Error(`${label} must be an integer ${range}.`)
    }
    return resolvedValue
  }

  public static generateSecretsGuide(): string {
    return `# 🔐 GitHub Secrets Setup Guide for Android App Signing

To build a signed release APK or App Bundle in GitHub Actions, add these **4 Repository Secrets** to your GitHub repository.

---

## 📌 Step 1: Open GitHub Secrets Settings
1. Open your repository on GitHub.
2. Navigate to **Settings** (tab at the top of the repo).
3. In the left sidebar, click **Secrets and variables** ➡️ **Actions**.
4. Click the green button: **New repository secret**.

---

## 🔑 Step 2: Add the 4 Required Secrets

### 1. \`KEYSTORE_BASE64\`
The full binary content of your \`.jks\` or \`.keystore\` file encoded as a Base64 string.

* **On Windows (PowerShell):**
  \`\`\`powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\\to\\your-keystore.jks")) | Set-Clipboard
  \`\`\`
  *(The base64 string is now in your clipboard! Paste it directly into the Secret value).*

* **On macOS / Linux (Terminal):**
  \`\`\`bash
  base64 -w 0 path/to/your-keystore.jks | pbcopy
  # or:
  base64 -w 0 path/to/your-keystore.jks
  \`\`\`

---

### 2. \`KEYSTORE_PASSWORD\`
The master password used to protect your keystore file.

---

### 3. \`KEY_ALIAS\`
The alias name given to your key when you generated it (e.g. \`upload\` or \`key0\`).

---

### 4. \`KEY_PASSWORD\`
The private key password (often identical to the keystore password).

---

## 🛠️ Step 3: Ensure your \`android/app/build.gradle\` reads \`key.properties\`
Make sure your \`android/app/build.gradle\` (or \`build.gradle.kts\`) configures release signing from \`key.properties\`:

\`\`\`groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias = keystoreProperties['keyAlias']
            keyPassword = keystoreProperties['keyPassword']
            storeFile = keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword = keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.release
            ...
        }
    }
}
\`\`\`

> 💡 **Security Tip:** Ensure that \`key.properties\` and \`*.jks\` are listed in your \`.gitignore\` so private keys are never committed to your public/private repo!
`
  }

  public static async writeWorkflowFiles(options: WorkflowOptions): Promise<{
    workflowPath: string
    workflowPaths: string[]
    secretsGuidePath?: string
    androidBuildFilePath?: string
  }> {
    const validation = this.validateProject(options.projectPath)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const androidTools = this.getAndroidToolsConfig(options)
    const usesCiNdk = androidTools.usePreinstalledNdk || androidTools.installAndroidTools
    const androidBuildFilePath = usesCiNdk
      ? await this.configureCiNdkVersion(options.projectPath)
      : undefined
    if (!usesCiNdk) {
      await this.removeCiNdkVersion(options.projectPath)
    }
    const workflowsDir = path.join(options.projectPath, '.github', 'workflows')
    await fs.promises.mkdir(workflowsDir, { recursive: true })

    const workflowFiles = options.buildTarget === 'both' && options.workflowLayout === 'separate'
      ? [
          { fileName: 'build_apk.yml', buildTarget: 'universal_apk' as const },
          { fileName: 'build_android.yml', buildTarget: 'appbundle' as const }
        ]
      : [{ fileName: options.workflowFileName || this.getDefaultWorkflowFileName(options.buildTarget), buildTarget: options.buildTarget }]

    const workflowPaths: string[] = []
    for (const workflowFile of workflowFiles) {
      const workflowPath = path.join(workflowsDir, workflowFile.fileName)
      const yamlContent = this.generateWorkflowYaml({
        ...options,
        buildTarget: workflowFile.buildTarget
      })
      await fs.promises.writeFile(workflowPath, yamlContent, 'utf8')
      workflowPaths.push(workflowPath)
    }

    let secretsGuidePath: string | undefined
    if (options.enableSigning) {
      const githubDir = path.join(options.projectPath, '.github')
      secretsGuidePath = path.join(githubDir, 'SECRETS_SETUP.md')
      const guideContent = this.generateSecretsGuide()
      await fs.promises.writeFile(secretsGuidePath, guideContent, 'utf8')
    }

    return { workflowPath: workflowPaths[0], workflowPaths, secretsGuidePath, androidBuildFilePath }
  }

  private static getDefaultWorkflowFileName(buildTarget: WorkflowOptions['buildTarget']): string {
    return buildTarget === 'appbundle' || buildTarget === 'both'
      ? 'build_android.yml'
      : 'build_apk.yml'
  }

  private static getWorkflowLabel(buildTarget: WorkflowOptions['buildTarget']): string {
    if (buildTarget === 'appbundle') return 'AAB'
    if (buildTarget === 'both') return 'Android'
    return 'APK'
  }
}
