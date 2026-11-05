/**
 * Air Flutter - MCP & AI Agent Hub
 * Interactive wizard orchestration.
 *
 * Flow:
 *   1. Select target agent(s)          (multi-select QuickPick)
 *   2. Select installation scope       (QuickPick)
 *   3. Select MCP servers from catalog (grouped multi-select QuickPick)
 *   4. Collect parameters per server   (sequential input boxes)
 *   5. Verify prerequisites            (progress + guide when missing)
 *   6. Confirm and write               (deep-merge, backup, notify)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  McpAgentAdapter,
  McpCategory,
  McpInstallSummary,
  McpScope,
  McpServerDefinition,
  McpServerValues,
  McpWriteResult,
  PrerequisiteReport
} from './types';
import { AGENT_ADAPTERS } from './adapters';
import { commonScopes, writeAdapterOutput } from './adapterWriter';
import { getCatalogCategories, getRequiredRuntimes, MCP_CATALOG } from './catalog';
import {
  buildInstallGuide,
  formatPrerequisiteLine,
  verifyPrerequisites
} from './prerequisites';
import { ConfigParseError } from './configWriter';

/** QuickPick item carrying an adapter payload. */
interface AgentPickItem extends vscode.QuickPickItem {
  adapter: McpAgentAdapter;
}

/** QuickPick item carrying a catalog server payload. */
interface ServerPickItem extends vscode.QuickPickItem {
  server: McpServerDefinition;
}

/** QuickPick item carrying a scope payload. */
interface ScopePickItem extends vscode.QuickPickItem {
  scope: McpScope;
}

/** Recorded outcome of the secrets plaintext notice. */
const SECRET_NOTICE_KEY = 'airFlutter.mcp.secretNoticeAcknowledged';

export class McpWizard {
  private output: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('Air Flutter MCP Hub');
    context.subscriptions.push(this.output);
  }

  /** Entry point invoked by the registered command. */
  public async run(): Promise<McpInstallSummary> {
    const cancelled: McpInstallSummary = {
      results: [],
      warnings: [],
      cancelled: true
    };

    try {
      // Step 1: target agents -------------------------------------------------
      const adapters = await this.pickAgents();
      if (!adapters) return cancelled;

      // Step 2: scope ---------------------------------------------------------
      const scope = await this.pickScope(adapters);
      if (!scope) return cancelled;

      const workspaceRoot = await this.resolveWorkspaceRoot(scope);
      if (scope === 'workspace' && !workspaceRoot) {
        vscode.window.showWarningMessage(
          'No workspace folder is open. Choose Global scope or open a Flutter project first.'
        );
        return cancelled;
      }

      // Step 3: servers -------------------------------------------------------
      const servers = await this.pickServers();
      if (!servers || servers.length === 0) return cancelled;

      // Step 4: parameters ----------------------------------------------------
      const values = await this.collectParameters(servers);
      if (!values) return cancelled;

      // Step 5: prerequisites -------------------------------------------------
      const report = await this.checkPrerequisites(servers);
      if (!report.satisfied) {
        const proceed = await this.handleMissingPrerequisites(report);
        if (!proceed) return cancelled;
      }

      // Step 6: confirm + write ----------------------------------------------
      return await this.confirmAndWrite(adapters, scope, servers, values, workspaceRoot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[ERROR] ${message}`);
      if (error instanceof Error && error.stack) {
        this.output.appendLine(error.stack);
      }
      vscode.window.showErrorMessage(`Air Flutter MCP Hub failed: ${message}`);
      return { results: [], warnings: [message], cancelled: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1: agents
  // ---------------------------------------------------------------------------
  private async pickAgents(): Promise<McpAgentAdapter[] | undefined> {
    const items: AgentPickItem[] = AGENT_ADAPTERS.map((adapter) => ({
      label: adapter.name,
      description: `${adapter.description} · ${adapter.capabilities.integrationMode}`,
      detail: adapter.capabilities.note,
      // Pre-select the most common Flutter agents for a smoother first run.
      picked: adapter.id === 'copilot' || adapter.id === 'cursor',
      adapter
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: 'Air Flutter: MCP Hub — Step 1 of 6 · Choose AI Agent(s)',
      placeHolder: 'Select one or more AI agents to configure with MCP servers',
      ignoreFocusOut: true
    });

    if (!selected || selected.length === 0) return undefined;
    return selected.map((s) => s.adapter);
  }

  // ---------------------------------------------------------------------------
  // Step 2: scope
  // ---------------------------------------------------------------------------
  private async pickScope(
    adapters: McpAgentAdapter[]
  ): Promise<McpScope | undefined> {
    const supported = commonScopes(adapters);
    if (supported.length === 0) {
      vscode.window.showErrorMessage(
        'The selected agents do not share a compatible scope. Configure global-only agents separately from workspace code templates.'
      );
      return undefined;
    }

    if (supported.length === 1) {
      const scope = supported[0];
      vscode.window.showInformationMessage(
        `The selected integration(s) support ${scope} scope only. Continuing with ${scope} scope.`
      );
      return scope;
    }

    const items: ScopePickItem[] = [
      {
        label: '$(folder) Project level (workspace)',
        description: 'Write config into the current workspace folder; commit or gitignore it',
        picked: true,
        scope: 'workspace'
      },
      {
        label: '$(globe) Global level (user / machine)',
        description: 'Write config into your OS user directories; applies to every project',
        scope: 'global'
      }
    ];

    const selected = await vscode.window.showQuickPick(items, {
      title: 'Air Flutter: MCP Hub — Step 2 of 6 · Choose Installation Scope',
      placeHolder: 'Where should the MCP configuration be written?',
      ignoreFocusOut: true
    });

    return selected?.scope;
  }

  /** Resolve the workspace root, or undefined in an empty window. */
  private async resolveWorkspaceRoot(scope: McpScope): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return scope === 'global' ? undefined : undefined;
    }

    if (folders.length === 1) {
      return folders[0].uri.fsPath;
    }

    // Multiple folders: make the user pick explicitly.
    const pick = await vscode.window.showQuickPick(
      folders.map((f) => ({ label: f.name, description: f.uri.fsPath, folder: f })),
      {
        title: 'Air Flutter: MCP Hub · Select Workspace Folder',
        placeHolder: 'Which workspace folder should receive the configuration?',
        ignoreFocusOut: true
      }
    );
    return pick?.folder.uri.fsPath;
  }

  // ---------------------------------------------------------------------------
  // Step 3: servers
  // ---------------------------------------------------------------------------
  private async pickServers(): Promise<McpServerDefinition[] | undefined> {
    const categories = getCatalogCategories();
    const items: Array<ServerPickItem | vscode.QuickPickItem> = [];

    for (const category of categories) {
      // Category separator (non-pickable).
      items.push({
        label: category,
        kind: vscode.QuickPickItemKind.Separator
      });

      for (const server of MCP_CATALOG.filter((s) => s.category === category)) {
        items.push({
          label: `$(server) ${server.name}`,
          description: server.badge ?? '',
          detail: server.description,
          picked: false,
          server
        });
      }
    }

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: 'Air Flutter: MCP Hub — Step 3 of 6 · Select MCP Servers',
      placeHolder:
        'Check one or more servers (type to filter). Secrets are collected next.',
      matchOnDetail: true,
      ignoreFocusOut: true
    });

    if (!selected) return undefined;

    // Separators are never returned when canPickMany is true, but guard anyway.
    return selected
      .filter((item): item is ServerPickItem => 'server' in item)
      .map((item) => item.server);
  }

  // ---------------------------------------------------------------------------
  // Step 4: parameters + instructions
  // ---------------------------------------------------------------------------
  private async collectParameters(
    servers: McpServerDefinition[]
  ): Promise<Record<string, McpServerValues> | undefined> {
    const values: Record<string, McpServerValues> = {};

    for (const server of servers) {
      const params = server.parameters ?? [];
      const collected: Record<string, string> = {};

      const ok = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Air Flutter: Configuring ${server.name}`,
          cancellable: false
        },
        async () => {
          // 4a. Parameter prompts.
          for (const param of params) {
            const value = await vscode.window.showInputBox({
              title: `${server.name} — ${param.label}`,
              prompt: param.description,
              placeHolder: param.placeholder,
              value: param.defaultValue ?? '',
              password: param.secret === true,
              ignoreFocusOut: true,
              validateInput: (input) => {
                const trimmed = input ?? '';
                if (param.required && trimmed.trim().length === 0) {
                  return `${param.label} is required.`;
                }
                if (trimmed.trim().length === 0) {
                  return undefined;
                }
                return param.validate?.(trimmed);
              }
            });

            if (value === undefined) {
              // User pressed Escape: abort the whole wizard cleanly.
              return false;
            }

            collected[param.key] = value;
          }

          // 4b. Optional instructions for this server.
          const instructions = await this.collectInstructions(server);
          if (instructions === undefined) {
            // Escape during the instructions step also aborts the wizard.
            return false;
          }
          if (instructions.length > 0) {
            values[server.id] = { parameters: collected, instructions };
          }
          return true;
        }
      );

      if (!ok) return undefined;

      // Ensure an entry exists even when no instructions were added.
      if (!values[server.id]) {
        values[server.id] = { parameters: collected };
      }

      this.output.appendLine(
        `[INFO] Collected ${params.length} parameter(s) for ${server.name}${
          values[server.id].instructions ? ' + instructions' : ''
        }.`
      );
    }

    // One-time plaintext-secret notice (per machine).
    if (servers.some((s) => (s.parameters ?? []).some((p) => p.secret))) {
      const acknowledged = this.context.globalState.get<boolean>(SECRET_NOTICE_KEY);
      if (!acknowledged) {
        const choice = await vscode.window.showWarningMessage(
          'Secrets such as API keys will be written in plaintext into your agent configuration files.',
          { modal: true, detail:
            'Air Flutter will also create a timestamped backup before writing. ' +
            'To switch to environment-variable references instead, choose Review and edit the files manually after this run.' },
          'I understand',
          'Cancel'
        );
        if (choice !== 'I understand') return undefined;
        await this.context.globalState.update(SECRET_NOTICE_KEY, true);
      }
    }

    return values;
  }

  /**
   * Ask whether to attach `instructions` to a server, then collect the text.
   *
   * @returns the instruction text (possibly empty), or undefined when the
   *          user pressed Escape to abandon the wizard.
   */
  private async collectInstructions(
    server: McpServerDefinition
  ): Promise<string | undefined> {
    const templates = server.instructionTemplates ?? [];

    const choice = await vscode.window.showQuickPick(
      [
        {
          label: '$(add) Add instructions',
          description: 'Give the agent project-specific guidance for this server',
          action: 'add' as const
        },
        {
          label: '$(skip) Skip',
          description: 'Do not add an instructions field for this server',
          action: 'skip' as const
        }
      ],
      {
        title: `${server.name} — Add instructions?`,
        placeHolder: 'Instructions tell the agent how to use this server in your project',
        ignoreFocusOut: true
      }
    );

    if (!choice) return undefined;
    if (choice.action === 'skip') return '';

    // Offer ready-made templates first, when the server ships any.
    if (templates.length > 0) {
      const templatePick = await vscode.window.showQuickPick(
        [
          ...templates.map((t) => ({
            label: `$(file) ${t.label}`,
            detail: t.value,
            description: t.description,
            value: t.value
          })),
          {
            label: '$(edit) Write my own',
            detail: 'Type a custom instruction from scratch',
            description: '',
            value: ''
          }
        ],
        {
          title: `${server.name} — Choose an instruction template`,
          placeHolder: 'Pick a template to start from, or write your own',
          matchOnDetail: true,
          ignoreFocusOut: true
        }
      );

      if (!templatePick) return undefined;
      if (templatePick.value.length > 0) {
        // Let the user tweak the template before it is written.
        const edited = await vscode.window.showInputBox({
          title: `${server.name} — Edit instructions`,
          prompt: 'Adjust the template for your project, then press Enter to accept.',
          value: templatePick.value,
          ignoreFocusOut: true
        });
        return edited === undefined ? undefined : edited.trim();
      }
    }

    // Free-text entry.
    const typed = await vscode.window.showInputBox({
      title: `${server.name} — Instructions`,
      prompt:
        'Describe how the agent should use this server in your project. Leave empty to skip.',
      placeHolder: server.defaultInstructions
        ? `Example: ${server.defaultInstructions.slice(0, 80)}…`
        : 'Example: Always operate strictly within the truck_store schema.',
      value: server.defaultInstructions ?? '',
      ignoreFocusOut: true
    });

    return typed === undefined ? undefined : typed.trim();
  }

  // ---------------------------------------------------------------------------
  // Step 5: prerequisites
  // ---------------------------------------------------------------------------
  private async checkPrerequisites(
    servers: McpServerDefinition[]
  ): Promise<PrerequisiteReport> {
    const runtimes = getRequiredRuntimes(servers);

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Air Flutter: Verifying MCP prerequisites',
        cancellable: false
      },
      async (progress) => {
        return verifyPrerequisites(runtimes, (name) => {
          progress.report({ message: `Checking ${name}…` });
        });
      }
    );
  }

  /**
   * Present the prerequisite checklist and offer to proceed anyway.
   * @returns true when the user wants to continue writing configs.
   */
  private async handleMissingPrerequisites(
    report: PrerequisiteReport
  ): Promise<boolean> {
    const guide = buildInstallGuide(report);
    this.output.appendLine(guide.text);
    this.output.show(true);

    const missingNames = report.missing.map((m) => m.definition.name);
    const checklist = report.results.map(formatPrerequisiteLine).join('   ');

    const choice = await vscode.window.showWarningMessage(
      `Missing prerequisite(s): ${missingNames.join(', ')}. Configs can still be written, but those servers will not start until installed.`,
      { modal: true, detail: `${checklist}\n\nSee the Air Flutter MCP Hub output channel for copy-paste install commands.` },
      'View Install Guide',
      'Continue anyway'
    );

    if (choice === 'View Install Guide') {
      await this.showInstallGuideQuickPick(report);
      const after = await vscode.window.showWarningMessage(
        'Install the missing tools, then restart VS Code. Continue writing configs now anyway?',
        { modal: true },
        'Continue anyway',
        'Cancel'
      );
      return after === 'Continue anyway';
    }

    return choice === 'Continue anyway';
  }

  /** Offer each install command via a QuickPick with copy support. */
  private async showInstallGuideQuickPick(report: PrerequisiteReport): Promise<void> {
    const guide = buildInstallGuide(report);

    interface InstallItem extends vscode.QuickPickItem {
      command: string;
    }

    const items: InstallItem[] = guide.commands.map((c) => ({
      label: `$(cloud-download) ${c.tool}`,
      description: c.command,
      detail: `Docs: ${c.url}`,
      command: c.command
    }));

    const pick = await vscode.window.showQuickPick(items, {
      title: 'Air Flutter: Install Missing Prerequisites',
      placeHolder: 'Select a tool to copy its install command to the clipboard',
      ignoreFocusOut: true
    });

    if (pick) {
      await vscode.env.clipboard.writeText(pick.command);
      vscode.window.showInformationMessage(
        `Copied to clipboard: ${pick.command}`,
        'Open Docs'
      ).then((choice) => {
        if (choice === 'Open Docs') {
          const found = guide.commands.find((c) => c.tool === pick.label.replace('$(cloud-download) ', ''));
          if (found) {
            void vscode.env.openExternal(vscode.Uri.parse(found.url));
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Step 6: confirm + write
  // ---------------------------------------------------------------------------
  private async confirmAndWrite(
    adapters: McpAgentAdapter[],
    scope: McpScope,
    servers: McpServerDefinition[],
    values: Record<string, McpServerValues>,
    workspaceRoot: string | undefined
  ): Promise<McpInstallSummary> {
    // Build a preview of every file that will be touched.
    const previewLines: string[] = ['Files to be created or updated:', ''];
    for (const adapter of adapters) {
      const target = adapter.resolveTarget(scope, workspaceRoot);
      previewLines.push(`  · ${adapter.name}: ${target.path}  (${target.format})`);
    }
    previewLines.push('');
    previewLines.push(`${servers.length} server(s): ${servers.map((s) => s.name).join(', ')}`);

    const withInstructions = servers.filter(
      (s) => (values[s.id]?.instructions ?? '').trim().length > 0
    );
    if (withInstructions.length > 0) {
      previewLines.push('');
      previewLines.push(
        `Instructions attached to ${withInstructions.length} server(s): ${withInstructions
          .map((s) => s.name)
          .join(', ')}`
      );
    }

    previewLines.push('');
    previewLines.push('A timestamped backup is created before any existing file is modified.');

    const confirm = await vscode.window.showInformationMessage(
      'Air Flutter: MCP Hub — Step 6 of 6 · Review & Write',
      { modal: true, detail: previewLines.join('\n') },
      'Write integration files',
      'Cancel'
    );

    if (confirm !== 'Write integration files') {
      return { results: [], warnings: [], cancelled: true };
    }

    const results: McpWriteResult[] = [];
    const warnings: string[] = [];

    for (const adapter of adapters) {
      const target = adapter.resolveTarget(scope, workspaceRoot);
      try {
        const { result } = await writeAdapterOutput(
          adapter,
          scope,
          workspaceRoot,
          servers,
          values
        );
        const { added, updated, backupPath } = result;
        results.push({
          agentId: adapter.id,
          scope,
          filePath: target.path,
          format: target.format,
          added,
          updated,
          backupPath
        });
        this.output.appendLine(
          `[OK] ${adapter.name}: +${added.length} added, ~${updated.length} updated → ${target.path}`
        );
      } catch (error) {
        if (error instanceof ConfigParseError) {
          const message = `${adapter.name}: existing file could not be parsed, so it was left untouched. ${error.message}`;
          warnings.push(message);
          this.output.appendLine(`[SKIP] ${message}`);

          const action = await vscode.window.showErrorMessage(
            `Skipped ${adapter.name}: its config file is not valid ${target.format.toUpperCase()}.`,
            'Open File',
            'Ignore'
          );
          if (action === 'Open File') {
            const doc = await vscode.workspace.openTextDocument(target.path);
            await vscode.window.showTextDocument(doc);
          }
        } else {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`${adapter.name}: ${message}`);
          this.output.appendLine(`[FAIL] ${adapter.name}: ${message}`);
          vscode.window.showErrorMessage(`Failed to write ${adapter.name} config: ${message}`);
        }
      }
    }

    if (results.length > 0) {
      await this.offerGitignoreProtection(scope, workspaceRoot, results);
      this.reportSuccess(results, warnings, servers.length);
    }

    return { results, warnings, cancelled: false };
  }

  /**
   * In workspace scope, offer to add the written config files to .gitignore
   * so collected secrets are not committed accidentally.
   */
  private async offerGitignoreProtection(
    scope: McpScope,
    workspaceRoot: string | undefined,
    results: McpWriteResult[]
  ): Promise<void> {
    if (scope !== 'workspace' || !workspaceRoot) return;

    const filePaths = results.map((r) => r.filePath);
    const relativePaths = filePaths.map((p) =>
      path.relative(workspaceRoot, p).replace(/\\/g, '/')
    );

    const choice = await vscode.window.showInformationMessage(
      `These configs may contain secrets. Add them to .gitignore?`,
      { modal: false, detail: relativePaths.join('\n') },
      'Add to .gitignore',
      'Skip'
    );

    if (choice !== 'Add to .gitignore') return;

    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    try {
      let contents = '';
      try {
        contents = await require('fs').promises.readFile(gitignorePath, 'utf8');
      } catch {
        contents = '';
      }

      const missing = relativePaths.filter((rel) => !contents.split(/\r?\n/).includes(rel));
      if (missing.length === 0) {
        vscode.window.showInformationMessage('All MCP config paths are already ignored.');
        return;
      }

      const header = '\n# Air Flutter MCP Hub — keep local agent secrets out of git\n';
      const addition = `${header}${missing.join('\n')}\n`;
      await require('fs').promises.writeFile(gitignorePath, contents + addition, 'utf8');

      vscode.window.showInformationMessage(
        `Added ${missing.length} path(s) to .gitignore.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`Could not update .gitignore: ${message}`);
    }
  }

  /** Final summary notification. */
  private reportSuccess(
    results: McpWriteResult[],
    warnings: string[],
    serverCount: number
  ): void {
    const fileCount = results.length;
    const summary = `✅ Prepared ${serverCount} MCP server(s) across ${fileCount} integration file(s).`;

    this.output.appendLine('');
    this.output.appendLine('='.repeat(60));
    this.output.appendLine(summary);
    for (const r of results) {
      this.output.appendLine(`  ${r.filePath}`);
      if (r.backupPath) {
        this.output.appendLine(`    backup: ${r.backupPath}`);
      }
    }
    if (warnings.length > 0) {
      this.output.appendLine('');
      this.output.appendLine('Warnings:');
      for (const w of warnings) this.output.appendLine(`  ! ${w}`);
    }
    this.output.appendLine('='.repeat(60));

    vscode.window
      .showInformationMessage(summary, 'View Details', 'Open Folder')
      .then((choice) => {
        if (choice === 'View Details') {
          this.output.show(true);
        } else if (choice === 'Open Folder' && results[0]) {
          void vscode.commands.executeCommand(
            'revealFileInOS',
            vscode.Uri.file(results[0].filePath)
          );
        }
      });
  }
}

/** Category helper re-exported for potential external tooling. */
export type { McpCategory };
