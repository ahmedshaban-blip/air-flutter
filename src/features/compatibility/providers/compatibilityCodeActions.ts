import * as vscode from 'vscode'
import { SuggestedFix } from '../models/types'

export class CompatibilityCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  private fixes: SuggestedFix[] = []

  public updateFixes(fixes: SuggestedFix[]): void {
    this.fixes = fixes
  }

  public clear(): void {
    this.fixes = []
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []
    const docPath = document.uri.fsPath.replace(/\\/g, '/').toLowerCase()

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'Air Flutter Compatibility') {
        continue
      }

      // Find matching fix
      const matchingFix = this.fixes.find(fix => {
        const fixPath = fix.filePath.replace(/\\/g, '/').toLowerCase()
        if (fixPath !== docPath) return false

        const fixRange = new vscode.Range(
          fix.range.startLine,
          fix.range.startChar,
          fix.range.endLine,
          fix.range.endChar
        )
        return fixRange.intersection(diagnostic.range) !== undefined ||
               fixRange.contains(range.start) ||
               diagnostic.range.isEqual(fixRange)
      })

      if (matchingFix) {
        const action = new vscode.CodeAction(
          `Air Flutter: ${matchingFix.description}`,
          vscode.CodeActionKind.QuickFix
        )
        const edit = new vscode.WorkspaceEdit()
        const targetRange = new vscode.Range(
          matchingFix.range.startLine,
          matchingFix.range.startChar,
          matchingFix.range.endLine,
          matchingFix.range.endChar
        )

        edit.replace(document.uri, targetRange, matchingFix.newText)
        action.edit = edit
        action.isPreferred = true
        action.diagnostics = [diagnostic]
        actions.push(action)
      }
    }

    return actions
  }
}

