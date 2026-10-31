import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

export interface FlavorInfo {
  name: string
  entrypoint?: string // e.g. 'lib/main_dev.dart'
}

export interface FlavorDetectionResult {
  hasFlavors: boolean
  flavors: FlavorInfo[]
  gradlePath?: string
  error?: string
}

export class FlavorManager {
  /**
   * Detects configured productFlavors in a Flutter project.
   */
  public static async detectFlavors(projectPath: string): Promise<FlavorDetectionResult> {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { hasFlavors: false, flavors: [], error: 'Project path does not exist.' }
    }

    const pubspec = path.join(projectPath, 'pubspec.yaml')
    if (!fs.existsSync(pubspec)) {
      return { hasFlavors: false, flavors: [], error: 'Not a Flutter project (pubspec.yaml missing).' }
    }

    const groovyGradle = path.join(projectPath, 'android', 'app', 'build.gradle')
    const ktsGradle = path.join(projectPath, 'android', 'app', 'build.gradle.kts')

    let gradlePath: string | undefined
    let content = ''

    if (fs.existsSync(groovyGradle)) {
      gradlePath = groovyGradle
      content = await fs.promises.readFile(groovyGradle, 'utf8')
    } else if (fs.existsSync(ktsGradle)) {
      gradlePath = ktsGradle
      content = await fs.promises.readFile(ktsGradle, 'utf8')
    } else {
      return { hasFlavors: false, flavors: [], error: 'No android/app/build.gradle found.' }
    }

    const flavorNames = new Set<string>()

    // Check for Kotlin DSL: create("flavor") or register("flavor")
    const ktsMatches = content.matchAll(/(?:create|register)\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g)
    for (const match of ktsMatches) {
      if (match[1] && !['release', 'debug', 'profile'].includes(match[1].toLowerCase())) {
        flavorNames.add(match[1])
      }
    }

    // Check for Groovy: productFlavors { dev { ... } prod { ... } }
    const productFlavorsIndex = content.indexOf('productFlavors')
    if (productFlavorsIndex !== -1) {
      const openBrace = content.indexOf('{', productFlavorsIndex)
      if (openBrace !== -1) {
        // Find closing brace of productFlavors
        let depth = 1
        let closeBrace = -1
        for (let i = openBrace + 1; i < content.length; i++) {
          if (content[i] === '{') depth++
          else if (content[i] === '}') {
            depth--
            if (depth === 0) {
              closeBrace = i
              break
            }
          }
        }

        if (closeBrace !== -1) {
          const flavorsBlock = content.substring(openBrace + 1, closeBrace)
          // Match identifiers before `{`
          const blockMatches = flavorsBlock.matchAll(/([a-zA-Z0-9_]+)\s*\{/g)
          for (const match of blockMatches) {
            const name = match[1]
            if (!['create', 'register', 'dimension', 'release', 'debug'].includes(name)) {
              flavorNames.add(name)
            }
          }
        }
      }
    }

    const flavors: FlavorInfo[] = []
    const libDir = path.join(projectPath, 'lib')

    for (const name of flavorNames) {
      let entrypoint: string | undefined
      const candidate1 = path.join(libDir, `main_${name}.dart`)
      const candidate2 = path.join(libDir, `main-${name}.dart`)
      const candidate3 = path.join(libDir, `${name}.dart`)

      if (fs.existsSync(candidate1)) {
        entrypoint = `lib/main_${name}.dart`
      } else if (fs.existsSync(candidate2)) {
        entrypoint = `lib/main-${name}.dart`
      } else if (fs.existsSync(candidate3)) {
        entrypoint = `lib/${name}.dart`
      } else if (fs.existsSync(path.join(libDir, 'main.dart'))) {
        entrypoint = 'lib/main.dart'
      }

      flavors.push({ name, entrypoint })
    }

    return {
      hasFlavors: flavors.length > 0,
      flavors,
      gradlePath
    }
  }

  /**
   * Generates and injects flavor configurations into an existing Flutter project.
   */
  public static async setupFlavors(
    projectPath: string,
    flavorNames: string[] = ['dev', 'staging', 'prod']
  ): Promise<{ gradleModified: boolean; createdFiles: string[] }> {
    const groovyGradle = path.join(projectPath, 'android', 'app', 'build.gradle')
    const ktsGradle = path.join(projectPath, 'android', 'app', 'build.gradle.kts')

    let gradlePath = ''
    let isKts = false

    if (fs.existsSync(groovyGradle)) {
      gradlePath = groovyGradle
      isKts = false
    } else if (fs.existsSync(ktsGradle)) {
      gradlePath = ktsGradle
      isKts = true
    } else {
      throw new Error('android/app/build.gradle not found in the selected project.')
    }

    let content = await fs.promises.readFile(gradlePath, 'utf8')
    let gradleModified = false

    if (!content.includes('flavorDimensions') && !content.includes('productFlavors')) {
      if (isKts) {
        const ktsSnippet = `
    flavorDimensions += "default"
    productFlavors {
${flavorNames
  .map(
    f => `        create("${f}") {
            dimension = "default"
            ${f !== 'prod' ? `applicationIdSuffix = ".${f}"` : ''}
            resValue("string", "app_name", "App (${f})")
        }`
  )
  .join('\n')}
    }
`
        // Inject inside android { ... }
        const lastBrace = content.lastIndexOf('}')
        if (lastBrace !== -1) {
          content = content.substring(0, lastBrace) + ktsSnippet + '\n}\n'
          await fs.promises.writeFile(gradlePath, content, 'utf8')
          gradleModified = true
        }
      } else {
        const groovySnippet = `
    flavorDimensions "default"
    productFlavors {
${flavorNames
  .map(
    f => `        ${f} {
            dimension "default"
            ${f !== 'prod' ? `applicationIdSuffix ".${f}"` : ''}
            resValue "string", "app_name", "App (${f})"
        }`
  )
  .join('\n')}
    }
`
        const lastBrace = content.lastIndexOf('}')
        if (lastBrace !== -1) {
          content = content.substring(0, lastBrace) + groovySnippet + '\n}\n'
          await fs.promises.writeFile(gradlePath, content, 'utf8')
          gradleModified = true
        }
      }
    }

    const createdFiles: string[] = []
    const libDir = path.join(projectPath, 'lib')
    await fs.promises.mkdir(libDir, { recursive: true })

    for (const flavor of flavorNames) {
      const entrypointPath = path.join(libDir, `main_${flavor}.dart`)
      if (!fs.existsSync(entrypointPath)) {
        const dartContent = `import 'main.dart' as app;

/// Entrypoint for ${flavor.toUpperCase()} flavor
void main() {
  // Add ${flavor} environment configurations here (e.g. Base URL, API Keys)
  app.main();
}
`
        await fs.promises.writeFile(entrypointPath, dartContent, 'utf8')
        createdFiles.push(`lib/main_${flavor}.dart`)
      }
    }

    return { gradleModified, createdFiles }
  }

  /**
   * Spawns a build process for a single flavor.
   */
  public static runBuildFlavor(
    projectPath: string,
    flavor: string,
    targetFile: string | undefined,
    mode: 'release' | 'debug' = 'release'
  ): Promise<{ code: number; stdout: string }> {
    return new Promise((resolve, reject) => {
      const args = ['build', 'apk', `--flavor=${flavor}`, `--${mode}`]
      if (targetFile) {
        args.push(`-t`, targetFile)
      }

      const proc = spawn('flutter', args, {
        cwd: projectPath,
        shell: true
      })

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })
      proc.stderr.on('data', data => {
        output += data.toString()
      })

      proc.on('close', code => {
        if (code === 0) {
          resolve({ code: code ?? 0, stdout: output })
        } else {
          reject(new Error(output || `Build failed with exit code ${code}`))
        }
      })
    })
  }
}

