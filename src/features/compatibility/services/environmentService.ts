import { execFile } from 'child_process'
import { EnvironmentInfo } from '../models/types'

export class EnvironmentService {
  /**
   * Detects local Java and CocoaPods environment.
   */
  public static async detect(): Promise<EnvironmentInfo> {
    const isWindows = process.platform === 'win32'
    const notes: string[] = []

    const javaResult = await this.detectJava()
    const podResult = await this.detectCocoaPods(isWindows)

    if (javaResult.version) {
      notes.push(`Detected Java Runtime version: JDK ${javaResult.version}`)
    } else {
      notes.push('Java Runtime (JDK) not found on PATH or JAVA_HOME.')
    }

    if (isWindows) {
      notes.push('CocoaPods inspection skipped on Windows (requires macOS for iOS builds).')
    } else if (podResult.version) {
      notes.push(`Detected CocoaPods version: ${podResult.version}`)
    } else {
      notes.push('CocoaPods (pod) not found on PATH.')
    }

    return {
      javaVersion: javaResult.version,
      rawJavaOutput: javaResult.raw,
      cocoapodsVersion: podResult.version,
      isWindows,
      notes
    }
  }

  private static detectJava(): Promise<{ version: number | null; raw: string }> {
    return new Promise(resolve => {
      execFile('java', ['-version'], { timeout: 8000, windowsHide: true }, (error, stdout, stderr) => {
        const raw = (stderr || stdout || '').trim()
        if (error && !raw) {
          resolve({ version: null, raw: error.message })
          return
        }

        // Patterns:
        // openjdk version "17.0.2" -> 17
        // java version "1.8.0_312" -> 8
        // java version "21" -> 21
        let version: number | null = null

        const legacyMatch = raw.match(/version\s+["']1\.([0-9]+)/)
        if (legacyMatch && legacyMatch[1]) {
          version = parseInt(legacyMatch[1], 10)
        } else {
          const modernMatch = raw.match(/version\s+["']([0-9]+)(?:\.[0-9]+)*/)
          if (modernMatch && modernMatch[1]) {
            version = parseInt(modernMatch[1], 10)
          }
        }

        resolve({ version, raw })
      })
    })
  }

  private static detectCocoaPods(isWindows: boolean): Promise<{ version: string | null }> {
    if (isWindows) {
      return Promise.resolve({ version: null })
    }

    return new Promise(resolve => {
      execFile('pod', ['--version'], { timeout: 8000 }, (error, stdout) => {
        if (error || !stdout) {
          resolve({ version: null })
        } else {
          resolve({ version: stdout.trim() })
        }
      })
    })
  }
}

