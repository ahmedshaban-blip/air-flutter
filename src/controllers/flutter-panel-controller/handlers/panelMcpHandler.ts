/**
 * Air Flutter — MCP & AI Agent Hub panel handler.
 *
 * Bridges the in-panel modal with the `src/mcp` engine. The modal drives the
 * same wizard data (agents, scope, catalog, instructions) but renders it as a
 * stepper instead of QuickPick prompts.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PanelHandlerContext } from './panelCompatHandler';
import { AGENT_ADAPTERS, findAdapterById } from '../../../mcp/adapters';
import { supportsScope, writeAdapterOutput } from '../../../mcp/adapterWriter';
import { MCP_CATALOG, findServerById } from '../../../mcp/catalog';
import { getRequiredRuntimes } from '../../../mcp/catalog';
import {
  buildInstallGuide,
  formatPrerequisiteLine,
  verifyPrerequisites
} from '../../../mcp/prerequisites';
import { ConfigParseError } from '../../../mcp/configWriter';
import {
  addCompanionPackage,
  applyMainDartEdit,
  inspectCompanionProject,
  wireMainDart
} from '../../../mcp/companionPackage';
import { McpCompanionPackage, McpScope, McpServerValues } from '../../../mcp/types';

/** Shape of the payload the webview posts back for a write request. */
interface McpWriteRequest {
  agentIds: string[];
  scope: McpScope;
  serverIds: string[];
  /** serverId → parameter key → value. */
  parameters: Record<string, Record<string, string>>;
  /** serverId → instruction text (omitted when the user skipped it). */
  instructions: Record<string, string>;
  workspaceRoot?: string;
}

export class PanelMcpHandler {
  constructor(private readonly ctx: PanelHandlerContext) {}

  /** Open the modal and push the agent + catalog data into the webview. */
  public async openMcpHubModal(workspaceRoot?: string): Promise<void> {
    await this.ctx.openFlutterPanel();

    const root = workspaceRoot || this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();

    if (!panel) {
      return;
    }

    panel.webview.postMessage({
      command: 'openMcpHubModal',
      workspaceRoot: root
    });

    this.pushCatalogData(root);
  }

  /**
   * Send only the catalog payload, without asking the webview to open the
   * modal. Used when the modal is already open and requests a refresh, which
   * avoids an open/request loop.
   */
  public pushCatalogData(workspaceRoot?: string): void {
    const root = workspaceRoot || this.ctx.getInitialProjectPath();
    const panel = this.ctx.getPanel();

    if (!panel) {
      return;
    }

    // Push the static catalog data after the modal has mounted.
    panel.webview.postMessage({
      command: 'mcpHubData',
      agents: AGENT_ADAPTERS.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        capabilities: a.capabilities
      })),
      servers: MCP_CATALOG.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        badge: s.badge ?? '',
        description: s.description,
        transport: s.transport,
        runtime: s.runtime,
        parameters: (s.parameters ?? []).map((p) => ({
          key: p.key,
          label: p.label,
          description: p.description ?? '',
          placeholder: p.placeholder ?? '',
          defaultValue: p.defaultValue ?? '',
          secret: p.secret === true,
          required: p.required === true
        })),
        defaultInstructions: s.defaultInstructions ?? '',
        instructionTemplates: (s.instructionTemplates ?? []).map((t) => ({
          label: t.label,
          description: t.description,
          value: t.value
        })),
        companionPackage: s.companionPackage
          ? {
              packageName: s.companionPackage.packageName,
              addCommand: s.companionPackage.addCommand,
              docsUrl: s.companionPackage.docsUrl,
              mainDartSnippet: s.companionPackage.mainDartSnippet,
              setupSteps: s.companionPackage.setupSteps
            }
          : undefined
      }))
    });
  }

  /**
   * Report whether a companion package is already a dependency, so the modal
   * can show the right call to action on first open.
   */
  public async handleCompanionStatus(
    serverId: string,
    workspaceRoot?: string
  ): Promise<void> {
    const server = findServerById(serverId);
    const panel = this.ctx.getPanel();

    if (!server?.companionPackage || !panel) {
      return;
    }

    const root = workspaceRoot || this.ctx.getInitialProjectPath();
    if (!root) {
      panel.webview.postMessage({
        command: 'mcpCompanionStatus',
        serverId,
        installed: false,
        reason: 'No workspace folder detected.'
      });
      return;
    }

    const status = inspectCompanionProject(root, server.companionPackage);

    panel.webview.postMessage({
      command: 'mcpCompanionStatus',
      serverId,
      installed: status.installed,
      hasMainDart: Boolean(status.mainDartPath),
      pubspecPath: status.pubspecPath,
      mainDartPath: status.mainDartPath
    });
  }

  /**
   * Install the companion package and, with explicit confirmation, wire up
   * `main.dart`. Returns nothing: all outcomes are reported to the webview.
   */
  public async handleCompanionInstall(
    serverId: string,
    workspaceRoot?: string
  ): Promise<void> {
    const server = findServerById(serverId);
    const panel = this.ctx.getPanel();
    const pkg = server?.companionPackage;

    if (!pkg || !panel) {
      return;
    }

    const root = workspaceRoot || this.ctx.getInitialProjectPath();
    if (!root) {
      this.ctx.showErrorMessage('Open a Flutter project before installing a companion package.');
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: false });
      return;
    }

    const status = inspectCompanionProject(root, pkg);

    // Step 1: dependency.
    if (!status.installed) {
      const choice = await vscode.window.showInformationMessage(
        `Add ${pkg.packageName} to this project?`,
        { modal: true, detail: `Air Flutter will run: ${pkg.addCommand}` },
        'Run flutter pub add'
      );
      if (choice !== 'Run flutter pub add') {
        panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: false, declined: true });
        return;
      }
      await addCompanionPackage(root, pkg);
      this.ctx.postStatus(`📦 Running ${pkg.addCommand}…`, 'info');
    }

    // Step 2: main.dart wiring.
    if (!status.mainDartPath) {
      vscode.window.showWarningMessage(
        `Could not find lib/main.dart. The dependency was added; add the binding manually.`,
        'Show setup guide'
      ).then((c) => {
        if (c === 'Show setup guide') {
          panel.webview.postMessage({ command: 'mcpShowCompanionGuide', serverId });
        }
      });
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: true, mainDartSkipped: true });
      return;
    }

    const original = await fs.promises.readFile(status.mainDartPath, 'utf8');
    const result = wireMainDart(original, pkg);

    if (result.outcome === 'already-configured') {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: true, alreadyWired: true });
      return;
    }

    if (result.outcome === 'unsupported') {
      vscode.window
        .showWarningMessage(result.message, 'Show setup guide')
        .then((c) => {
          if (c === 'Show setup guide') {
            panel.webview.postMessage({ command: 'mcpShowCompanionGuide', serverId });
          }
        });
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: true, mainDartSkipped: true });
      return;
    }

    // An edit is available: show the exact diff and ask for confirmation.
    const confirm = await vscode.window.showInformationMessage(
      `Update lib/main.dart to initialise ${pkg.bindingCall}?`,
      {
        modal: true,
        detail:
          'Air Flutter will insert the required imports and rewrite main() to initialise the binding only in debug builds. A timestamped backup is created first.'
      },
      'Update main.dart',
      'Just show me the code'
    );

    if (confirm === 'Just show me the code') {
      panel.webview.postMessage({ command: 'mcpShowCompanionGuide', serverId });
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: true, mainDartSkipped: true });
      return;
    }

    if (confirm !== 'Update main.dart') {
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: false, declined: true });
      return;
    }

    try {
      const { backupPath } = await applyMainDartEdit(status.mainDartPath, result, pkg);

      const doc = await vscode.workspace.openTextDocument(status.mainDartPath);
      await vscode.window.showTextDocument(doc);

      this.ctx.postStatus(`✅ ${result.message}`, 'success');
      vscode.window.showInformationMessage(
        `✅ ${result.message}${backupPath ? ' A backup was created next to the file.' : ''}`
      );

      panel.webview.postMessage({
        command: 'mcpCompanionDone',
        serverId,
        ok: true,
        mainDartEdited: true,
        backupPath
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Failed to update main.dart: ${msg}`);
      panel.webview.postMessage({ command: 'mcpCompanionDone', serverId, ok: false, error: msg });
    }
  }

  /** Write the full setup guide as a Markdown file and open it. */
  public async handleCompanionGuideFile(
    serverId: string,
    workspaceRoot?: string
  ): Promise<void> {
    const server = findServerById(serverId);
    const pkg = server?.companionPackage;
    if (!server || !pkg) {
      return;
    }

    const root = workspaceRoot || this.ctx.getInitialProjectPath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      this.ctx.showErrorMessage('Open a folder to save the setup guide.');
      return;
    }

    const guidePath = path.join(root, `.airflutter-${pkg.packageName}-setup.md`);

    try {
      await fs.promises.writeFile(guidePath, buildCompanionGuideMarkdown(server.name, pkg), 'utf8');
      const doc = await vscode.workspace.openTextDocument(guidePath);
      await vscode.window.showTextDocument(doc);
      this.ctx.postStatus(`📄 Setup guide written to ${path.basename(guidePath)}`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`Could not write the setup guide: ${msg}`);
    }
  }

  /** Resolve the workspace root for the write, honouring the chosen scope. */
  private async resolveWorkspaceRoot(explicit?: string): Promise<string | undefined> {
    if (explicit && explicit.trim().length > 0) {
      return explicit.trim();
    }

    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }

    // Let the user pick a folder when the window has none open.
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: 'Select Workspace Folder for MCP Configuration'
    });

    return picked && picked[0] ? picked[0].fsPath : undefined;
  }

  /** Run the prerequisite check for the selected servers and report back. */
  public async handleMcpCheckPrerequisites(serverIds: string[]): Promise<void> {
    const servers = serverIds
      .map((id) => findServerById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const runtimes = getRequiredRuntimes(servers);

    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Air Flutter: Checking MCP prerequisites',
        cancellable: false
      },
      async (progress) =>
        verifyPrerequisites(runtimes, (name) => {
          progress.report({ message: `Checking ${name}…` });
        })
    );

    const guide = buildInstallGuide(report);

    this.ctx.getPanel()?.webview.postMessage({
      command: 'mcpPrereqResult',
      satisfied: report.satisfied,
      lines: report.results.map(formatPrerequisiteLine),
      missing: report.missing.map((m) => ({
        name: m.definition.name,
        purpose: m.definition.purpose,
        command: m.definition.installCommands[report.os],
        url: m.definition.downloadUrl
      }))
    });

    if (!report.satisfied) {
      // Also surface the full guide in the output channel for copy/paste.
      const channel = vscode.window.createOutputChannel('Air Flutter MCP Hub');
      channel.appendLine(guide.text);
      channel.show(true);
      vscode.window.showWarningMessage(
        `⚠️ ${report.missing.length} MCP prerequisite(s) missing: ${report.missing
          .map((m) => m.definition.name)
          .join(', ')}`
      );
    } else {
      vscode.window.showInformationMessage('✅ All MCP prerequisites are installed.');
    }
  }

  /** Perform the actual write for every selected agent. */
  public async handleMcpWrite(request: McpWriteRequest): Promise<void> {
    const panel = this.ctx.getPanel();

    try {
      const root =
        request.scope === 'workspace'
          ? await this.resolveWorkspaceRoot(request.workspaceRoot)
          : undefined;

      if (request.scope === 'workspace' && !root) {
        this.ctx.showErrorMessage(
          'No workspace folder selected. Choose Global scope or open a project first.'
        );
        panel?.webview.postMessage({ command: 'mcpWriteDone', cancelled: true });
        return;
      }

      const servers = request.serverIds
        .map((id) => findServerById(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      if (servers.length === 0) {
        this.ctx.showErrorMessage('No MCP servers were selected.');
        panel?.webview.postMessage({ command: 'mcpWriteDone', cancelled: true });
        return;
      }

      // Fold the flat request maps into the engine's McpServerValues shape.
      const values: Record<string, McpServerValues> = {};
      for (const server of servers) {
        const params = request.parameters[server.id] ?? {};
        const instruction = (request.instructions[server.id] ?? '').trim();
        values[server.id] = instruction.length > 0
          ? { parameters: params, instructions: instruction }
          : { parameters: params };
      }

      const written: Array<{ agent: string; filePath: string; added: number; updated: number }> = [];
      const warnings: string[] = [];

      for (const agentId of request.agentIds) {
        const adapter = findAdapterById(agentId);
        if (!adapter) {
          warnings.push(`Unknown agent: ${agentId}`);
          continue;
        }

        if (!supportsScope(adapter, request.scope)) {
          warnings.push(`${adapter.name} does not support ${request.scope} MCP integration.`);
          continue;
        }

        const target = adapter.resolveTarget(request.scope, root);
        try {
          const { result } = await writeAdapterOutput(
            adapter,
            request.scope,
            root,
            servers,
            values
          );
          written.push({
            agent: adapter.name,
            filePath: target.path,
            added: result.added.length,
            updated: result.updated.length
          });
        } catch (error) {
          if (error instanceof ConfigParseError) {
            warnings.push(
              `${adapter.name}: existing file is not valid ${target.format.toUpperCase()} — left untouched.`
            );
          } else {
            const msg = error instanceof Error ? error.message : String(error);
            warnings.push(`${adapter.name}: ${msg}`);
          }
        }
      }

      this.ctx.getPanel()?.webview.postMessage({
        command: 'mcpWriteDone',
        cancelled: false,
        written,
        warnings,
        serverCount: servers.length
      });

      if (written.length > 0) {
        const summary = `✅ Prepared ${servers.length} MCP server(s) across ${written.length} integration file(s).`;
        this.ctx.postStatus(summary, 'success');

        vscode.window
          .showInformationMessage(
            summary,
            'Open Config',
            warnings.length > 0 ? 'View Warnings' : 'Dismiss'
          )
          .then(async (choice) => {
            if (choice === 'Open Config' && written[0]) {
              const doc = await vscode.workspace.openTextDocument(written[0].filePath);
              await vscode.window.showTextDocument(doc);
            } else if (choice === 'View Warnings') {
              vscode.window.showWarningMessage(warnings.join('  •  '));
            }
          });
      } else {
        this.ctx.showErrorMessage('No MCP configuration files were written.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.showErrorMessage(`MCP Hub failed: ${msg}`);
      this.ctx.getPanel()?.webview.postMessage({
        command: 'mcpWriteDone',
        cancelled: false,
        written: [],
        warnings: [msg],
        serverCount: 0
      });
    }
  }
}

/** Render the full companion-package setup guide as Markdown. */
export function buildCompanionGuideMarkdown(
  serverName: string,
  pkg: McpCompanionPackage
): string {
  const steps = pkg.setupSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');

  return `# ${serverName} — setup guide

This MCP server can only drive your app once \`${pkg.packageName}\` is present and
the Flutter binding is initialised in \`main()\`.

## 1. Add the package

\`\`\`bash
${pkg.addCommand}
\`\`\`

## 2. Update \`lib/main.dart\`

Add the import:

\`\`\`dart
${pkg.requiredImport}
\`\`\`

Initialise the binding inside \`main()\`. The \`kDebugMode\` guard keeps this out
of release builds:

\`\`\`dart
${pkg.mainDartSnippet}
\`\`\`

> \`kDebugMode\` comes from \`package:flutter/foundation.dart\`. If your
> \`main.dart\` does not import it yet, add:
> \`\`\`dart
> import 'package:flutter/foundation.dart';
> \`\`\`

## 3. Activate the bridge

\`\`\`bash
dart pub global activate marionette_mcp
\`\`\`

## 4. Run and connect

Start the app in debug mode, copy the VM service URI it prints, and ask your
agent to connect using that URI.

## Checklist

${steps}

## Documentation

- ${pkg.docsUrl}
`;
}
