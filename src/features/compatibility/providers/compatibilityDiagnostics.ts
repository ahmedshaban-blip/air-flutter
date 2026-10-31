import * as vscode from 'vscode'
import { CompatibilityReport } from '../models/types'

export class CompatibilityDiagnosticsManager {
  private collection: vscode.DiagnosticCollection

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('airFlutterCompatibility')
  }

  public updateDiagnostics(report: CompatibilityReport): void {
    // Group issues by file URI
    const fileMap = new Map<string, vscode.Diagnostic[]>()

    for (const issue of report.issues) {
      if (!issue.filePath || !issue.range) {
        continue
      }

      const fileUri = vscode.Uri.file(issue.filePath).toString()
      const list = fileMap.get(fileUri) || []

      const severity =
        issue.type === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning

      const diagRange = new vscode.Range(
        issue.range.startLine,
        issue.range.startChar,
        issue.range.endLine,
        issue.range.endChar
      )

      const diagnostic = new vscode.Diagnostic(diagRange, issue.message, severity)
      diagnostic.source = 'Air Flutter Compatibility'
      diagnostic.code = issue.code

      if (issue.migrationUrl) {
        diagnostic.code = {
          value: issue.code,
          target: vscode.Uri.parse(issue.migrationUrl)
        }
      }

      list.push(diagnostic)
      fileMap.set(fileUri, list)
    }

    // Clear previous diagnostics and apply fresh ones
    this.collection.clear()
    for (const [uriString, diagnostics] of fileMap.entries()) {
      this.collection.set(vscode.Uri.parse(uriString), diagnostics)
    }
  }

  public clear(): void {
    this.collection.clear()
  }

  public dispose(): void {
    this.collection.dispose()
  }
}

