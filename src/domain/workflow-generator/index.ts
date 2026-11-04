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
  enableCache: boolean
  publishToReleases?: boolean
  retentionDays?: number
  timeoutMinutes?: number
  javaVersion?: string
  flutterVersion?: string
}

export class WorkflowGenerator {
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
    const mode = options.buildMode || 'release'
    const retentionDays = this.getIntegerOption(options.retentionDays, 14, 1, undefined, 'Retention days')
    const timeoutMinutes = this.getIntegerOption(options.timeoutMinutes, 60, 1, 360, 'Timeout minutes')

    let buildSteps = ''
    let artifactSteps = ''

    if (options.buildTarget === 'universal_apk') {
      buildSteps = `      - name: Build Android APK (${mode})
        run: flutter build apk --${mode}`
      artifactSteps = `      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: flutter-${mode}-apk
          path: build/app/outputs/flutter-apk/*.apk
          retention-days: ${retentionDays}`
    } else if (options.buildTarget === 'split_apk') {
      buildSteps = `      - name: Build Split-per-ABI APKs (${mode})
        run: flutter build apk --${mode} --split-per-abi`
      artifactSteps = `      - name: Upload Split APK Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: flutter-${mode}-split-apks
          path: build/app/outputs/flutter-apk/*.apk
          retention-days: ${retentionDays}`
    } else if (options.buildTarget === 'appbundle') {
      buildSteps = `      - name: Build Android App Bundle (${mode})
        run: flutter build appbundle --${mode}`
      artifactSteps = `      - name: Upload App Bundle Artifact
        uses: actions/upload-artifact@v4
        with:
          name: App Bundle
          path: build/app/outputs/bundle/${mode}/*.aab
          retention-days: ${retentionDays}`
    } else {
      buildSteps = `      - name: Build Android APK (${mode})
        run: flutter build apk --${mode}

      - name: Build Android App Bundle (${mode})
        run: flutter build appbundle --${mode}`
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
      signingSteps = `      # App Signing: Decode Keystore & create key.properties from GitHub Secrets
      - name: Decode Android Keystore
        run: |
          echo "\${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/upload-keystore.jks

      - name: Create key.properties
        run: |
          cat <<EOF > android/key.properties
          storePassword=\${{ secrets.KEYSTORE_PASSWORD }}
          keyPassword=\${{ secrets.KEY_PASSWORD }}
          keyAlias=\${{ secrets.KEY_ALIAS }}
          storeFile=upload-keystore.jks
          EOF
`
    }

    let cacheStep = ''
    if (options.enableCache) {
      cacheStep = `      - name: Setup Gradle Cache
        uses: gradle/actions/setup-gradle@v3
`
    }

    const workflowLabel = this.getWorkflowLabel(options.buildTarget)

    return `name: Flutter ${workflowLabel} CI (${mode.toUpperCase()})

on:
${triggers.join('\n')}

${options.publishToReleases ? `permissions:
  contents: write

` : ''}jobs:
  build:
    name: Build Android (${mode})
    runs-on: ubuntu-latest
    timeout-minutes: ${timeoutMinutes}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Java (${javaVer})
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '${javaVer}'

      - name: Set up Flutter (${flutterVer})
        uses: subosito/flutter-action@v2
        with:
          channel: '${flutterVer}'
          cache: true

${cacheStep}${signingSteps}      - name: Install dependencies
        run: flutter pub get

${buildSteps}

${artifactSteps}${releaseStep}
`
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
  }> {
    const validation = this.validateProject(options.projectPath)
    if (!validation.valid) {
      throw new Error(validation.error)
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

    return { workflowPath: workflowPaths[0], workflowPaths, secretsGuidePath }
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
