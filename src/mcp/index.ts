/**
 * Air Flutter - MCP & AI Agent Hub
 * Module entry point.
 *
 * Mirrors the self-contained `CompatibilityModule` pattern: a single static
 * `activate(context)` registers every command this module owns. It imports
 * only its own `src/mcp/*` files and never mutates state owned by other
 * controllers, so it can be removed by deleting this directory plus the two
 * lines in `main.ts` and `package.json`.
 */

import * as vscode from 'vscode';
import { McpWizard } from './wizard';
import { AGENT_ADAPTERS } from './adapters';
import { MCP_CATALOG, getCatalogCategories } from './catalog';
import { PREREQUISITES, buildInstallGuide, verifyPrerequisites } from './prerequisites';
import { getRequiredRuntimes } from './catalog';

export class McpHubModule {
  private static wizard: McpWizard;
  private static output: vscode.OutputChannel;

  /** Register commands and initialize the wizard. */
  public static activate(context: vscode.ExtensionContext): void {
    this.wizard = new McpWizard(context);
    this.output = vscode.window.createOutputChannel('Air Flutter MCP Hub');
    context.subscriptions.push(this.output);

    context.subscriptions.push(
      vscode.commands.registerCommand('airFlutter.openMcpHubWizard', async () => {
        await this.wizard.run();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('airFlutter.showMcpCatalog', async () => {
        await this.showCatalog();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('airFlutter.checkMcpPrerequisites', async () => {
        await this.runPrerequisiteCheck();
      })
    );

    console.log('✅ Air Flutter MCP & AI Agent Hub registered');
  }

  /** Read-only catalog explorer, useful as a discovery surface. */
  private static async showCatalog(): Promise<void> {
    interface CatalogItem extends vscode.QuickPickItem {
      serverId: string;
    }

    const items: Array<CatalogItem | vscode.QuickPickItem> = [];
    for (const category of getCatalogCategories()) {
      items.push({ label: category, kind: vscode.QuickPickItemKind.Separator });
      for (const server of MCP_CATALOG.filter((s) => s.category === category)) {
        items.push({
          label: `$(server) ${server.name}`,
          description: server.badge ?? '',
          detail: `${server.description}\n  command: ${server.command} ${server.args.join(' ')}`.trim(),
          serverId: server.id
        });
      }
    }

    const pick = await vscode.window.showQuickPick(items, {
      title: `Air Flutter: MCP Catalog (${MCP_CATALOG.length} servers · ${AGENT_ADAPTERS.length} agents supported)`,
      placeHolder: 'Select any server to see its full configuration details',
      matchOnDetail: true,
      ignoreFocusOut: true
    });

    if (!pick || !('serverId' in pick)) return;

    const server = MCP_CATALOG.find((s) => s.id === pick.serverId);
    if (!server) return;

    this.output.clear();
    this.output.appendLine(`Server:      ${server.name}`);
    this.output.appendLine(`Id:          ${server.id}`);
    this.output.appendLine(`Category:    ${server.category}`);
    this.output.appendLine(`Badge:       ${server.badge ?? '—'}`);
    this.output.appendLine(`Transport:   ${server.transport}`);
    this.output.appendLine(`Runtime:     ${server.runtime}`);
    this.output.appendLine(`Command:     ${server.command} ${server.args.join(' ')}`);
    if (server.url) {
      this.output.appendLine(`URL:         ${server.url}`);
    }
    this.output.appendLine('');
    this.output.appendLine('Parameters:');
    if (!server.parameters || server.parameters.length === 0) {
      this.output.appendLine('  (none required)');
    } else {
      for (const p of server.parameters) {
        this.output.appendLine(
          `  - ${p.key}${p.required ? ' [required]' : ' [optional]'}${p.secret ? ' [secret]' : ''}`
        );
        if (p.description) this.output.appendLine(`      ${p.description}`);
      }
    }
    this.output.show(true);
  }

  /** Standalone prerequisite check across every runtime the catalog uses. */
  private static async runPrerequisiteCheck(): Promise<void> {
    const allRuntimes = getRequiredRuntimes(MCP_CATALOG);

    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Air Flutter: Checking MCP prerequisites',
        cancellable: false
      },
      async (progress) =>
        verifyPrerequisites(allRuntimes, (name) =>
          progress.report({ message: `Checking ${name}…` })
        )
    );

    const guide = buildInstallGuide(report);
    this.output.clear();
    this.output.appendLine('AIR FLUTTER - MCP PREREQUISITE STATUS');
    this.output.appendLine('='.repeat(46));
    for (const r of report.results) {
      const mark = r.installed ? 'OK    ' : 'MISSING';
      const version = r.version ? ` ${r.version}` : '';
      this.output.appendLine(`  [${mark}] ${r.definition.name}${version}`);
    }
    if (!report.satisfied) {
      this.output.appendLine('');
      this.output.appendLine(guide.text);
    }
    this.output.show(true);

    if (report.satisfied) {
      vscode.window.showInformationMessage(
        '✅ All MCP prerequisites are installed.',
        'View Details'
      ).then((c) => {
        if (c === 'View Details') this.output.show(true);
      });
    } else {
      vscode.window
        .showWarningMessage(
          `⚠️ ${report.missing.length} MCP prerequisite(s) missing: ${report.missing
            .map((m) => m.definition.name)
            .join(', ')}`,
          'View Install Guide'
        )
        .then((c) => {
          if (c === 'View Install Guide') this.output.show(true);
        });
    }
  }

  /** Exposed for tests and future programmatic integration. */
  public static getPrerequisiteDefinitions(): typeof PREREQUISITES {
    return PREREQUISITES;
  }
}
