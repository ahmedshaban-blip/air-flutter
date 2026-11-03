import { execFile, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const COMMAND_TIMEOUT_MS = 3000
const LOGCAT_LINE_LIMIT = 150

export interface DeviceDiagnostics {
  manufacturer: string
  model: string
  androidVersion: string
  apiLevel: string
  resolution: string
  battery: string
}

export interface BugReportResult {
  markdown: string
  reportPath: string
  screenshotPath: string
  elapsedMilliseconds: number
}

export interface DiagnosticRunner {
  run(args: string[], timeout?: number): Promise<string>
  captureScreenshot(serial: string, destination: string, timeout?: number): Promise<void>
}

export class AdbDiagnosticRunner implements DiagnosticRunner {
  constructor(private readonly adbExecutable: string) {}

  public run(args: string[], timeout = COMMAND_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbExecutable,
        args,
        { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(String(stderr || stdout || error.message).trim()))
            return
          }
          resolve(String(stdout || ''))
        }
      )
    })
  }

  public captureScreenshot(
    serial: string,
    destination: string,
    timeout = COMMAND_TIMEOUT_MS
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destination, { flags: 'wx' })
      const child = spawn(
        this.adbExecutable,
        ['-s', serial, 'exec-out', 'screencap', '-p'],
        { windowsHide: true }
      )
      let stderr = ''
      let childClosed = false
      let outputFinished = false
      let settled = false

      const timer = setTimeout(() => {
        child.kill()
        finish(new Error('Screenshot capture timed out.'))
      }, timeout)

      const finish = (error?: Error) => {
        if (settled) return
        if (!error && (!childClosed || !outputFinished)) return
        settled = true
        clearTimeout(timer)
        if (error) {
          if (!child.killed) child.kill()
          output.destroy()
          fs.promises.unlink(destination).catch(() => undefined)
          reject(error)
          return
        }
        resolve()
      }

      child.stdout.pipe(output)
      child.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })
      child.on('error', error => finish(error))
      output.on('error', error => finish(error))
      output.on('finish', () => {
        outputFinished = true
        finish()
      })
      child.on('close', code => {
        if (code !== 0) {
          finish(new Error(stderr.trim() || `Screenshot capture failed with code ${code}.`))
          return
        }
        childClosed = true
        finish()
      })
    })
  }
}

export class BugReportPackager {
  constructor(private readonly runner: DiagnosticRunner) {}

  public async create(workspaceRoot: string, serial: string): Promise<BugReportResult> {
    const startedAt = Date.now()
    const timestamp = BugReportPackager.fileTimestamp(new Date())
    const screenshotDirectory = path.join(workspaceRoot, 'screenshots')
    const reportDirectory = path.join(workspaceRoot, '.air-flutter', 'diagnostics')
    const screenshotPath = path.join(screenshotDirectory, `bug_${timestamp}.png`)
    const reportPath = path.join(reportDirectory, `report_${timestamp}.md`)

    await Promise.all([
      fs.promises.mkdir(screenshotDirectory, { recursive: true }),
      fs.promises.mkdir(reportDirectory, { recursive: true })
    ])

    const [, rawLogcat, rawProperties, rawResolution, rawBattery] = await Promise.all([
      this.runner.captureScreenshot(serial, screenshotPath),
      this.captureLogcat(serial),
      this.runner.run(['-s', serial, 'shell', 'getprop']),
      this.runner.run(['-s', serial, 'shell', 'wm', 'size']),
      this.runner.run(['-s', serial, 'shell', 'dumpsys', 'battery'])
    ])

    const diagnostics = BugReportPackager.parseDeviceDiagnostics(
      rawProperties,
      rawResolution,
      rawBattery
    )
    const markdown = BugReportPackager.buildMarkdown(
      diagnostics,
      new Date(),
      timestamp,
      BugReportPackager.redactSensitiveData(rawLogcat)
    )

    await fs.promises.writeFile(reportPath, markdown, { encoding: 'utf8', flag: 'wx' })

    return {
      markdown,
      reportPath,
      screenshotPath,
      elapsedMilliseconds: Date.now() - startedAt
    }
  }

  public static redactSensitiveData(logcat: string): string {
    return logcat
      .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1***')
      .replace(
        /(["']?(?:password|passwd|pwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)["']?\s*[=:]\s*["']?)[^\s,"';&}]+/gi,
        '$1***'
      )
      .replace(/((?:authorization|x-api-key)\s*:\s*)(?!\*\*\*)[^\r\n]+/gi, '$1***')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '***REDACTED_JWT***')
  }

  public static parseDeviceDiagnostics(
    properties: string,
    resolutionOutput: string,
    batteryOutput: string
  ): DeviceDiagnostics {
    const property = (name: string): string => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return properties.match(new RegExp(`\\[${escapedName}\\]: \\[(.*?)\\]`))?.[1]?.trim() || 'Unknown'
    }
    const resolutionMatches = Array.from(
      resolutionOutput.matchAll(/(?:Physical|Override) size:\s*(\d+x\d+)/gi)
    )
    const resolution = resolutionMatches.length
      ? resolutionMatches[resolutionMatches.length - 1][1]
      : resolutionOutput.match(/\b(\d+x\d+)\b/)?.[1] || 'Unknown'

    return {
      manufacturer: property('ro.product.manufacturer'),
      model: property('ro.product.model'),
      androidVersion: property('ro.build.version.release'),
      apiLevel: property('ro.build.version.sdk'),
      resolution,
      battery: this.parseBattery(batteryOutput)
    }
  }

  public static buildMarkdown(
    device: DeviceDiagnostics,
    capturedAt: Date,
    timestamp: string,
    logcat: string
  ): string {
    const cleanLogcat = logcat.trim() || 'No matching Flutter or crash logs were found.'
    const longestFence = Math.max(2, ...Array.from(cleanLogcat.matchAll(/`+/g), match => match[0].length))
    const fence = '`'.repeat(longestFence + 1)
    return `### Bug Report / Diagnostic Summary
- **Device**: ${device.manufacturer} ${device.model} (Android ${device.androidVersion}, API ${device.apiLevel})
- **Screen Resolution**: ${device.resolution}
- **Battery State**: ${device.battery}
- **Date/Time**: ${capturedAt.toISOString()}

#### Screenshot
![Screenshot](./screenshots/bug_${timestamp}.png)

#### Crash / Recent Logcat
${fence}log
${cleanLogcat}
${fence}
`
  }

  public static fileTimestamp(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace('.', '').replace('T', '_')
  }

  private async captureLogcat(serial: string): Promise<string> {
    const output = await this.runner.run([
      '-s', serial, 'logcat', '-d', '-v', 'threadtime', '-t', String(LOGCAT_LINE_LIMIT),
      'Flutter:V', 'flutter:V', 'AndroidRuntime:E', 'DEBUG:E', 'libc:F',
      'crash_dump:E', 'tombstoned:E', '*:S'
    ])
    return output.split(/\r?\n/).filter(Boolean).slice(-LOGCAT_LINE_LIMIT).join('\n')
  }

  private static parseBattery(output: string): string {
    const level = output.match(/^\s*level:\s*(\d+)/im)?.[1]
    const statusCode = output.match(/^\s*status:\s*(\d+)/im)?.[1]
    const statuses: Record<string, string> = {
      '2': 'Charging',
      '3': 'Discharging',
      '4': 'Not charging',
      '5': 'Full'
    }
    const status = statusCode ? statuses[statusCode] || 'Unknown' : 'Unknown'
    return level ? `${level}% (${status})` : status
  }
}
