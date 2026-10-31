import * as fs from 'fs'
import * as path from 'path'
import { ParsedPodfileInfo } from '../models/types'

export class PodfileParser {
  /**
   * Parses the iOS Podfile for deployment target version.
   */
  public static async parse(projectPath: string): Promise<ParsedPodfileInfo> {
    const podfilePath = path.join(projectPath, 'ios', 'Podfile')
    if (!fs.existsSync(podfilePath)) {
      return { exists: false }
    }

    const content = await fs.promises.readFile(podfilePath, 'utf8')
    const lines = content.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Skip commented-out platform lines
      if (trimmed.startsWith('#')) {
        continue
      }

      // Match: platform :ios, '12.0' or platform :ios, "13.0"
      const match = line.match(/platform\s+:ios\s*,\s*['"]([0-9]+(?:\.[0-9]+)?)['"]/)
      if (match && match[1]) {
        const versionStr = match[1]
        const startChar = line.indexOf(versionStr)
        return {
          exists: true,
          podfilePath,
          deploymentTarget: versionStr,
          targetRange: {
            startLine: i,
            startChar,
            endLine: i,
            endChar: startChar + versionStr.length
          }
        }
      }
    }

    return {
      exists: true,
      podfilePath
    }
  }
}

