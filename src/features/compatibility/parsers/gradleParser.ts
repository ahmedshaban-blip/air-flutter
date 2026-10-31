import * as fs from 'fs'
import * as path from 'path'
import { ParsedGradleInfo, ParsedJavaConfig, TextRange } from '../models/types'

export class GradleParser {
  /**
   * Parses Gradle wrapper properties and project build scripts.
   */
  public static async parse(projectPath: string): Promise<ParsedGradleInfo> {
    const result: ParsedGradleInfo = {
      isKotlinDsl: false
    }

    // 1. Parse gradle-wrapper.properties
    const wrapperPath = path.join(projectPath, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties')
    if (fs.existsSync(wrapperPath)) {
      result.wrapperPath = wrapperPath
      const content = await fs.promises.readFile(wrapperPath, 'utf8')
      const lines = content.split(/\r?\n/)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Example: distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-all.zip
        const match = line.match(/gradle-([0-9]+\.[0-9]+(?:\.[0-9]+)?)-(?:all|bin)\.zip/)
        if (match && match[1]) {
          result.gradleVersion = match[1]
          const startChar = line.indexOf(match[1])
          result.gradleRange = {
            startLine: i,
            startChar: startChar !== -1 ? startChar : 0,
            endLine: i,
            endChar: startChar !== -1 ? startChar + match[1].length : line.length
          }
          break
        }
      }
    }

    // 2. Parse build.gradle / settings.gradle (Groovy & Kotlin DSL)
    const androidDir = path.join(projectPath, 'android')
    if (fs.existsSync(androidDir)) {
      await this.parseBuildScripts(androidDir, result)
      await this.parseAppBuildGradle(androidDir, result)
    }

    return result
  }

  private static async parseBuildScripts(androidDir: string, result: ParsedGradleInfo): Promise<void> {
    // Candidates to search for AGP & Kotlin
    const candidateFiles = [
      'settings.gradle',
      'settings.gradle.kts',
      'build.gradle',
      'build.gradle.kts'
    ]

    for (const filename of candidateFiles) {
      const filePath = path.join(androidDir, filename)
      if (!fs.existsSync(filePath)) {
        continue
      }

      if (filename.endsWith('.kts')) {
        result.isKotlinDsl = true
      }

      const content = await fs.promises.readFile(filePath, 'utf8')
      const lines = content.split(/\r?\n/)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Skip comments
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          continue
        }

        // --- Check AGP in plugins block ---
        // e.g. id "com.android.application" version "8.5.2" apply false
        // or id("com.android.application") version "8.5.2"
        if (!result.agpVersion) {
          const agpPluginMatch = line.match(/id\s*\(?['"]com\.android\.(?:application|library)['"]\)?\s+version\s+['"]([0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?)/)
          if (agpPluginMatch && agpPluginMatch[1]) {
            result.agpVersion = agpPluginMatch[1]
            result.buildGradlePath = filePath
            const startChar = line.indexOf(agpPluginMatch[1])
            result.agpRange = {
              startLine: i,
              startChar,
              endLine: i,
              endChar: startChar + agpPluginMatch[1].length
            }
          }
        }

        // --- Check AGP in buildscript classpath ---
        // e.g. classpath 'com.android.tools.build:gradle:8.5.2'
        if (!result.agpVersion) {
          const agpClasspathMatch = line.match(/classpath\s*\(?['"]com\.android\.tools\.build:gradle:([0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?)/)
          if (agpClasspathMatch && agpClasspathMatch[1]) {
            result.agpVersion = agpClasspathMatch[1]
            result.buildGradlePath = filePath
            const startChar = line.indexOf(agpClasspathMatch[1])
            result.agpRange = {
              startLine: i,
              startChar,
              endLine: i,
              endChar: startChar + agpClasspathMatch[1].length
            }
          }
        }

        // --- Check Kotlin in plugins block ---
        // e.g. id "org.jetbrains.kotlin.android" version "1.9.24" apply false
        if (!result.kotlinVersion) {
          const kotlinPluginMatch = line.match(/id\s*\(?['"]org\.jetbrains\.kotlin\.android['"]\)?\s+version\s+['"]([0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?)/)
          if (kotlinPluginMatch && kotlinPluginMatch[1]) {
            result.kotlinVersion = kotlinPluginMatch[1]
            const startChar = line.indexOf(kotlinPluginMatch[1])
            result.kotlinRange = {
              startLine: i,
              startChar,
              endLine: i,
              endChar: startChar + kotlinPluginMatch[1].length
            }
          }
        }

        // --- Check Kotlin in ext.kotlin_version ---
        // e.g. ext.kotlin_version = '1.9.24'
        if (!result.kotlinVersion) {
          const kotlinExtMatch = line.match(/ext\.kotlin_version\s*=\s*['"]([0-9]+\.[0-9]+\.[0-9]+)/)
          if (kotlinExtMatch && kotlinExtMatch[1]) {
            result.kotlinVersion = kotlinExtMatch[1]
            const startChar = line.indexOf(kotlinExtMatch[1])
            result.kotlinRange = {
              startLine: i,
              startChar,
              endLine: i,
              endChar: startChar + kotlinExtMatch[1].length
            }
          }
        }
      }
    }
  }

  private static async parseAppBuildGradle(androidDir: string, result: ParsedGradleInfo): Promise<void> {
    const candidates = [
      path.join(androidDir, 'app', 'build.gradle'),
      path.join(androidDir, 'app', 'build.gradle.kts')
    ]

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue

      const content = await fs.promises.readFile(filePath, 'utf8')
      const lines = content.split(/\r?\n/)
      const javaConfig: ParsedJavaConfig = {
        appBuildGradlePath: filePath
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue

        const sourceMatch = line.match(/sourceCompatibility(?:\s*=\s*|\s+)(JavaVersion\.VERSION_[0-9_]+)/)
        if (sourceMatch && sourceMatch[1]) {
          javaConfig.sourceCompatibility = sourceMatch[1]
          const startChar = line.indexOf(sourceMatch[1])
          javaConfig.sourceCompatibilityRange = {
            startLine: i,
            startChar,
            endLine: i,
            endChar: startChar + sourceMatch[1].length
          }
        }

        const targetMatch = line.match(/targetCompatibility(?:\s*=\s*|\s+)(JavaVersion\.VERSION_[0-9_]+)/)
        if (targetMatch && targetMatch[1]) {
          javaConfig.targetCompatibility = targetMatch[1]
          const startChar = line.indexOf(targetMatch[1])
          javaConfig.targetCompatibilityRange = {
            startLine: i,
            startChar,
            endLine: i,
            endChar: startChar + targetMatch[1].length
          }
        }

        const jvmMatch = line.match(/jvmTarget\s*=\s*['"]([0-9.]+)['"]/)
        if (jvmMatch && jvmMatch[1]) {
          javaConfig.jvmTarget = jvmMatch[1]
          const startChar = line.indexOf(jvmMatch[1])
          javaConfig.jvmTargetRange = {
            startLine: i,
            startChar,
            endLine: i,
            endChar: startChar + jvmMatch[1].length
          }
        }
      }

      if (javaConfig.sourceCompatibility || javaConfig.targetCompatibility || javaConfig.jvmTarget) {
        result.javaConfig = javaConfig
        break
      }
    }
  }
}

