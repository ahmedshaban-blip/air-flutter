import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { GradleParser } from './parsers/gradleParser'
import { PodfileParser } from './parsers/podfileParser'
import { EnvironmentService } from './services/environmentService'
import { CompatibilityEngine } from './services/compatibilityEngine'
import { CompatibilityDiagnosticsManager } from './providers/compatibilityDiagnostics'
import { CompatibilityCodeActionProvider } from './providers/compatibilityCodeActions'
import { CompatibilityReport, StackDiffItem, SuggestedFix } from './models/types'

export class CompatibilityModule {
  private static diagnosticsManager: CompatibilityDiagnosticsManager
  private static codeActionProvider: CompatibilityCodeActionProvider
  private static outputChannel: vscode.OutputChannel
  private static latestReport: CompatibilityReport | null = null

  public static activate(context: vscode.ExtensionContext): void {
    this.diagnosticsManager = new CompatibilityDiagnosticsManager()
    this.codeActionProvider = new CompatibilityCodeActionProvider()
    this.outputChannel = vscode.window.createOutputChannel('Air Flutter Compatibility Doctor')

    context.subscriptions.push(this.diagnosticsManager)
    context.subscriptions.push(this.outputChannel)

    // Register CodeAction Provider for build scripts
    const selector: vscode.DocumentSelector = [
      { scheme: 'file', pattern: '**/android/gradle/wrapper/gradle-wrapper.properties' },
      { scheme: 'file', pattern: '**/android/build.gradle' },
      { scheme: 'file', pattern: '**/android/build.gradle.kts' },
      { scheme: 'file', pattern: '**/android/settings.gradle' },
      { scheme: 'file', pattern: '**/android/settings.gradle.kts' },
      { scheme: 'file', pattern: '**/ios/Podfile' },
      { scheme: 'file', language: 'groovy' },
      { scheme: 'file', language: 'properties' },
      { scheme: 'file', language: 'ruby' }
    ]

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        selector,
        this.codeActionProvider,
        {
          providedCodeActionKinds: CompatibilityCodeActionProvider.providedCodeActionKinds
        }
      )
    )

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('airFlutter.runCompatDoctor', async (targetPath?: string) => {
        return await this.runCompatDoctorCommand(targetPath)
      })
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('airFlutter.upgradeBuildStack', async (targetPath?: string) => {
        return await this.upgradeBuildStackCommand(targetPath)
      })
    )

    // Listen to document changes to refresh diagnostics
    const refreshDiagnosticsDebounced = this.debounce(async (doc: vscode.TextDocument) => {
      const fileName = path.basename(doc.fileName)
      if (
        fileName === 'gradle-wrapper.properties' ||
        fileName === 'build.gradle' ||
        fileName === 'build.gradle.kts' ||
        fileName === 'settings.gradle' ||
        fileName === 'settings.gradle.kts' ||
        fileName === 'Podfile'
      ) {
        await this.runScan()
      }
    }, 800)

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(doc => refreshDiagnosticsDebounced(doc))
    )
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(doc => refreshDiagnosticsDebounced(doc))
    )

    // Run initial scan non-blockingly
    this.runScan().catch(err => {
      console.warn('Air Flutter Compatibility: Initial scan skipped or failed:', err)
    })
  }

  public static getLatestReport(): CompatibilityReport | null {
    return this.latestReport
  }

  public static resolveTargetProjectPath(specifiedPath?: string): string | null {
    if (specifiedPath && fs.existsSync(specifiedPath)) {
      return specifiedPath
    }

    if (vscode.window.activeTextEditor) {
      const folder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
      if (folder) return folder.uri.fsPath
    }

    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        if (fs.existsSync(path.join(folder.uri.fsPath, 'pubspec.yaml'))) {
          return folder.uri.fsPath
        }
      }
      return workspaceFolders[0].uri.fsPath
    }

    return null
  }

  public static async runScan(targetPath?: string): Promise<CompatibilityReport | null> {
    const projectPath = this.resolveTargetProjectPath(targetPath)
    if (!projectPath) {
      return null
    }

    try {
      const gradle = await GradleParser.parse(projectPath)
      const podfile = await PodfileParser.parse(projectPath)
      const env = await EnvironmentService.detect()
      const report = CompatibilityEngine.evaluate(projectPath, gradle, podfile, env)

      this.latestReport = report
      this.diagnosticsManager.updateDiagnostics(report)

      const fixes: SuggestedFix[] = []
      for (const issue of report.issues) {
        if (issue.suggestedFix) {
          fixes.push(issue.suggestedFix)
        }
      }
      this.codeActionProvider.updateFixes(fixes)

      return report
    } catch (error) {
      console.error('Air Flutter Compatibility: Scan error:', error)
      return null
    }
  }

  public static async runCompatDoctorCommand(targetPath?: string): Promise<CompatibilityReport | null> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Air Flutter: Compatibility Doctor',
        cancellable: false
      },
      async progress => {
        progress.report({ message: 'Analyzing project build stack & environment...' })
        const report = await this.runScan(targetPath)
        if (!report) {
          vscode.window.showWarningMessage('No active Flutter project found for Compatibility Doctor.')
          return null
        }

        this.printReportToOutput(report)
        this.outputChannel.show(true)

        const errors = report.issues.filter(i => i.type === 'error')
        const warnings = report.issues.filter(i => i.type === 'warning')

        if (report.isHealthy) {
          vscode.window.showInformationMessage('✅ Flutter build stack is healthy and up-to-date!')
        } else if (errors.length > 0) {
          const action = await vscode.window.showErrorMessage(
            `❌ Compatibility Doctor found ${errors.length} error(s) and ${warnings.length} warning(s).`,
            'View Report',
            report.canAutoUpgrade ? 'Upgrade Stack' : 'Dismiss'
          )
          if (action === 'Upgrade Stack') {
            await this.upgradeBuildStackCommand(targetPath)
          }
        } else {
          const action = await vscode.window.showWarningMessage(
            `⚠️ Compatibility Doctor found ${warnings.length} warning(s) or outdated configuration(s).`,
            'View Report',
            report.canAutoUpgrade ? 'Upgrade Stack' : 'Dismiss'
          )
          if (action === 'Upgrade Stack') {
            await this.upgradeBuildStackCommand(targetPath)
          }
        }

        return report
      }
    )
  }

  public static async upgradeBuildStackCommand(targetPath?: string): Promise<boolean> {
    const report = await this.runScan(targetPath)
    if (!report) {
      vscode.window.showWarningMessage('No Flutter project found to upgrade.')
      return false
    }

    const fixableIssues = report.issues.filter(i => i.suggestedFix)
    if (fixableIssues.length === 0) {
      vscode.window.showInformationMessage('✅ Build stack is already up to date. No upgrades required.')
      return false
    }

    interface UpgradeQuickPickItem extends vscode.QuickPickItem {
      fix: SuggestedFix
    }

    const items: UpgradeQuickPickItem[] = fixableIssues.map(issue => {
      const fix = issue.suggestedFix!
      const relPath = path.relative(report.projectPath, fix.filePath)
      return {
        label: `$(wrench) ${fix.description}`,
        description: relPath,
        detail: `Replace with: "${fix.newText}"`,
        picked: true,
        fix
      }
    })

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: 'Air Flutter: Select Upgrades to Apply',
      placeHolder: 'Select all recommended build upgrades you wish to apply'
    })

    if (!selected || selected.length === 0) {
      return false
    }

    const wsEdit = new vscode.WorkspaceEdit()
    for (const item of selected) {
      const fix = item.fix
      const targetRange = new vscode.Range(
        fix.range.startLine,
        fix.range.startChar,
        fix.range.endLine,
        fix.range.endChar
      )
      wsEdit.replace(vscode.Uri.file(fix.filePath), targetRange, fix.newText)
    }

    const applied = await vscode.workspace.applyEdit(wsEdit)
    if (applied) {
      // Auto-save the touched documents
      for (const item of selected) {
        const doc = vscode.workspace.textDocuments.find(d => d.fileName === item.fix.filePath)
        if (doc) {
          await doc.save()
        }
      }

      // Re-scan to verify resolution
      const updatedReport = await this.runScan(targetPath)
      if (updatedReport) {
        this.printReportToOutput(updatedReport)
      }

      vscode.window
        .showInformationMessage(
          `🚀 Successfully applied ${selected.length} upgrade(s)! (Undo anytime with Ctrl+Z)`,
          'View Output Report'
        )
        .then(res => {
          if (res === 'View Output Report') {
            this.outputChannel.show(true)
          }
        })
      return true
    } else {
      vscode.window.showErrorMessage('Failed to apply workspace edits for build stack upgrade.')
      return false
    }
  }

  public static async applyCustomDiffs(diffs: StackDiffItem[], targetPath?: string): Promise<boolean> {
    if (!diffs || diffs.length === 0) {
      return false
    }

    const wsEdit = new vscode.WorkspaceEdit()
    for (const diff of diffs) {
      if (!diff.range) continue
      const targetRange = new vscode.Range(
        diff.range.startLine,
        diff.range.startChar,
        diff.range.endLine,
        diff.range.endChar
      )
      wsEdit.replace(vscode.Uri.file(diff.filePath), targetRange, diff.targetValue)
    }

    const applied = await vscode.workspace.applyEdit(wsEdit)
    if (applied) {
      // Auto-save the touched documents
      for (const diff of diffs) {
        const doc = vscode.workspace.textDocuments.find(d => d.fileName === diff.filePath)
        if (doc) {
          await doc.save()
        }
      }

      // Re-scan
      const updatedReport = await this.runScan(targetPath)
      if (updatedReport) {
        this.printReportToOutput(updatedReport)
      }

      vscode.window
        .showInformationMessage(
          `🚀 Successfully applied ${diffs.length} custom build stack modification(s)! (Undo anytime with Ctrl+Z)`,
          'View Output Report'
        )
        .then(res => {
          if (res === 'View Output Report') {
            this.outputChannel.show(true)
          }
        })
      return true
    } else {
      vscode.window.showErrorMessage('Failed to apply workspace edits for custom build stack.')
      return false
    }
  }

  private static printReportToOutput(report: CompatibilityReport): void {
    const ch = this.outputChannel
    ch.clear()
    ch.appendLine('========================================================================')
    ch.appendLine('           AIR FLUTTER COMPATIBILITY DOCTOR & AUTO-FIXER               ')
    ch.appendLine('========================================================================')
    ch.appendLine(`Target Project: ${report.projectPath}`)
    ch.appendLine(`Scanned At:     ${report.scannedAt}`)
    ch.appendLine('------------------------------------------------------------------------')

    ch.appendLine('\n[1. Runtime Environment]')
    ch.appendLine(`  - Java Runtime (JDK): ${report.environment.javaVersion ? `JDK ${report.environment.javaVersion}` : 'Not Detected'}`)
    ch.appendLine(`  - CocoaPods:          ${report.environment.cocoapodsVersion || (report.environment.isWindows ? 'Skipped (Windows)' : 'Not Found')}`)
    for (const note of report.environment.notes) {
      ch.appendLine(`    * ${note}`)
    }

    ch.appendLine('\n[2. Android Build Stack]')
    ch.appendLine(`  - Gradle Wrapper:  ${report.gradle.gradleVersion || 'Not detected'}`)
    ch.appendLine(`    Location:        ${report.gradle.wrapperPath || 'N/A'}`)
    ch.appendLine(`  - AGP Version:     ${report.gradle.agpVersion || 'Not detected'}`)
    ch.appendLine(`  - Kotlin Version:  ${report.gradle.kotlinVersion || 'Not detected'}`)
    ch.appendLine(`  - Build Script:    ${report.gradle.buildGradlePath || 'N/A'} (DSL: ${report.gradle.isKotlinDsl ? 'Kotlin' : 'Groovy'})`)

    ch.appendLine('\n[3. iOS Build Stack]')
    ch.appendLine(`  - Podfile:         ${report.podfile.exists ? 'Present' : 'Not found'}`)
    ch.appendLine(`  - Min iOS Target:  ${report.podfile.deploymentTarget || 'Not specified'}`)
    ch.appendLine(`  - Podfile Path:    ${report.podfile.podfilePath || 'N/A'}`)

    ch.appendLine('\n[4. Diagnostics & Recommendations]')
    if (report.issues.length === 0) {
      ch.appendLine('  ✅ All configurations are compatible and up to date with modern standards!')
    } else {
      for (const issue of report.issues) {
        const icon = issue.type === 'error' ? '❌ [ERROR]' : '⚠️ [WARNING]'
        ch.appendLine(`  ${icon} [${issue.code}] ${issue.message}`)
        if (issue.filePath) {
          ch.appendLine(`     File: ${issue.filePath}`)
        }
        if (issue.migrationUrl) {
          ch.appendLine(`     Migration Guide: ${issue.migrationUrl}`)
        }
        if (issue.suggestedFix) {
          ch.appendLine(`     Quick Fix Available: "${issue.suggestedFix.description}" -> "${issue.suggestedFix.newText}"`)
        }
        ch.appendLine('')
      }
    }

    const rec = CompatibilityEngine.getMatrix().android.recommended
    const iosRec = CompatibilityEngine.getMatrix().ios.recommended
    ch.appendLine('------------------------------------------------------------------------')
    ch.appendLine(`Latest Verified Stable Target: AGP ${rec.agp} | Gradle ${rec.gradle} | JDK ${rec.java} | Kotlin ${rec.kotlin} | iOS ${iosRec.minDeploymentTarget}+`)
    ch.appendLine('========================================================================\n')
  }

  private static debounce(fn: (...args: any[]) => void, delayMs: number) {
    let timer: NodeJS.Timeout | null = null
    return (...args: any[]) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delayMs)
    }
  }
}

