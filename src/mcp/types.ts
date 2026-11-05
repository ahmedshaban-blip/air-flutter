/**
 * Air Flutter - MCP & AI Agent Hub
 * Core type definitions shared by the catalog, adapters, prerequisites
 * engine and the interactive wizard.
 *
 * This module is intentionally decoupled from the rest of `air flutter`.
 * It never mutates existing state owned by other controllers.
 */

/** Installation scope requested by the user. */
export type McpScope = 'workspace' | 'global';

/** How an agent consumes the MCP integration produced by Air Flutter. */
export type McpIntegrationMode =
  | 'native-config'
  | 'global-only'
  | 'code-template'
  | 'setup-guide';

/** Explicit scope and output capabilities surfaced by each adapter. */
export interface McpAgentCapabilities {
  integrationMode: McpIntegrationMode;
  supportedScopes: McpScope[];
  note?: string;
}

/**
 * Transport style of a Model Context Protocol server entry.
 * Mirrors the de-facto conventions used across agent config files.
 */
export type McpTransport = 'stdio' | 'sse' | 'http';

/** How the server process is launched. Drives prerequisite checks. */
export type McpRuntime = 'node' | 'python' | 'dart' | 'binary' | 'remote' | 'docker';

/** A single configurable parameter (secret or setting) for a server. */
export interface McpParameter {
  /** Environment variable / config key, e.g. `SUPABASE_URL`. */
  key: string;
  /** Friendly label shown in the input box prompt. */
  label: string;
  /** Longer description rendered as the prompt detail. */
  description?: string;
  /** Example value used as placeholder. */
  placeholder?: string;
  /** Pre-filled default, offered as the input box value. */
  defaultValue?: string;
  /** When true the input is masked (password style). */
  secret?: boolean;
  /** When true the user must supply a value; validation blocks empty input. */
  required?: boolean;
  /**
   * Optional simple validation. Return an error string to reject,
   * or undefined to accept.
   */
  validate?: (value: string) => string | undefined;
}

/**
 * A Dart/Flutter package the server needs inside the user's app, plus the
 * optional setup code that must be added to `main.dart`.
 */
export interface McpCompanionPackage {
  /** Pub package name, e.g. `marionette_flutter`. */
  packageName: string;
  /** Exact command shown to the user, e.g. `flutter pub add marionette_flutter`. */
  addCommand: string;
  /** Official docs link for the package. */
  docsUrl: string;
  /**
   * Code the user must add to `main.dart`. Rendered verbatim in the guide and
   * offered for automatic insertion.
   */
  mainDartSnippet: string;
  /**
   * Import line required by the snippet. Used by the auto-editor to insert a
   * missing import safely.
   */
  requiredImport: string;
  /**
   * The binding call that must run inside `main()`. The auto-editor looks for
   * this so it does not apply the same change twice.
   */
  bindingCall: string;
  /** Step-by-step setup notes rendered in the guide. */
  setupSteps: string[];
}

/**
 * A ready-made `instructions` template offered when the user chooses to add
 * guidance for a server. Templates are plain text the user can accept, edit
 * or replace entirely.
 */
export interface McpInstructionTemplate {
  /** Short label shown in the template picker, e.g. "Restrict to one schema". */
  label: string;
  /** One-line explanation of when this template helps. */
  description: string;
  /** The instruction text inserted into the config. */
  value: string;
}

/** A single MCP server definition in the catalog. */
export interface McpServerDefinition {
  /** Stable unique id, e.g. `flutter-dart-mcp`. */
  id: string;
  /** Display name shown in the multi-select list. */
  name: string;
  /** Category used to group entries in the QuickPick. */
  category: McpCategory;
  /** Short description shown as the QuickPick detail. */
  description: string;
  /** Star rating style hint rendered in description, e.g. "Official". */
  badge?: string;
  /** Transport used when written into an agent config. */
  transport: McpTransport;
  /** Runtime required to execute the server. */
  runtime: McpRuntime;
  /** Executable command, e.g. `npx`, `uvx`, `dart`, or a remote URL scheme. */
  command: string;
  /** Argument vector passed to the command. */
  args: string[];
  /** Static environment variables merged with collected parameter values. */
  env?: Record<string, string>;
  /** Remote URL for `sse`/`http` transports. */
  url?: string;
  /** Parameters the user is prompted for, in order. */
  parameters?: McpParameter[];
  /**
   * Suggested `instructions` templates for this server. When present the
   * wizard offers them before the free-text editor.
   */
  instructionTemplates?: McpInstructionTemplate[];
  /**
   * Default `instructions` value pre-filled into the editor when the user
   * chooses to customise this server without picking a template.
   */
  defaultInstructions?: string;
  /**
   * When set, the user's Flutter app needs this package plus a small
   * `main.dart` change before the server can drive it. The hub offers to add
   * the dependency and guides the code change.
   */
  companionPackage?: McpCompanionPackage;
  /**
   * Extra config keys some agents require (e.g. Antigravity `serverUrl`).
   * Merged verbatim into the server entry for supported adapters.
   */
  extra?: Record<string, unknown>;
}

/**
 * Per-server values collected by the wizard: parameter values keyed by
 * parameter name, plus the optional free-form `instructions` text.
 */
export interface McpServerValues {
  /** Parameter key → user-supplied value. */
  parameters: Record<string, string>;
  /**
   * Optional per-server instructions written into the config as an
   * `instructions` field. Undefined means "do not add the field".
   */
  instructions?: string;
}

/** Grouping used by the catalog and the wizard QuickPick separators. */
export type McpCategory =
  | 'Flutter & Dart Core'
  | 'Backend & Database'
  | 'Design & UI'
  | 'Device & QA'
  | 'API & Network'
  | 'DevOps & Observability'
  | 'Knowledge & Research'
  | 'Agent Memory';

/**
 * Describes a concrete file an agent reads its MCP configuration from.
 * An adapter may expose several candidates; the first existing one wins,
 * otherwise the first entry is used as the creation target.
 */
export interface McpConfigTarget {
  /** Absolute path resolved at runtime for the requested scope. */
  path: string;
  /** File serialization format. */
  format: 'json' | 'yaml' | 'toml';
  /** Human readable label, e.g. "Workspace .cursor/mcp.json". */
  label: string;
}

/** A generated code example or setup guide rather than an agent config. */
export interface McpTextTarget {
  path: string;
  format: 'text';
  label: string;
}

export type McpOutputTarget = McpConfigTarget | McpTextTarget;

/** Result of writing one or more servers for one agent/scope pair. */
export interface McpWriteResult {
  agentId: string;
  scope: McpScope;
  filePath: string;
  format: 'json' | 'yaml' | 'toml' | 'text';
  /** Server ids that were newly added. */
  added: string[];
  /** Server ids that were updated because they already existed. */
  updated: string[];
  /** Backed up pre-existing file path, when a backup was taken. */
  backupPath?: string;
}

/** Aggregated outcome of a full wizard run. */
export interface McpInstallSummary {
  results: McpWriteResult[];
  /** Non-fatal problems worth surfacing to the user. */
  warnings: string[];
  cancelled: boolean;
}

/** An agent adapter maps catalog servers into an agent-specific file shape. */
export interface McpAgentAdapter {
  /** Stable id, e.g. `cursor`. */
  id: string;
  /** Display name, e.g. "Cursor". */
  name: string;
  /** Short description for the QuickPick. */
  description: string;
  capabilities: McpAgentCapabilities;
  /**
   * Resolve the config file target for the given scope.
   * @param scope workspace or global
   * @param workspaceRoot absolute workspace folder path (when scope is workspace)
   */
  resolveTarget(scope: McpScope, workspaceRoot?: string): McpOutputTarget;
  /**
   * Transform catalog servers + collected values into the agent's on-disk
   * configuration fragment (deep-merged by the writer).
   *
   * Adapters that support per-server `instructions` should include it; the
   * shared builders handle this automatically.
   */
  buildConfigPayload?: (
    servers: McpServerDefinition[],
    values: Record<string, McpServerValues>
  ) => Record<string, unknown>;
  /** Build a code example or setup guide for non-config integrations. */
  buildTextArtifact?: (
    servers: McpServerDefinition[],
    values: Record<string, McpServerValues>
  ) => string;
}

/** Locale-independent OS family used for install guidance. */
export type OsFamily = 'windows' | 'macos' | 'linux';

/** A prerequisite runtime requirement. */
export interface PrerequisiteDefinition {
  /** Stable id, e.g. `node`. */
  id: string;
  /** Display name, e.g. "Node.js". */
  name: string;
  /** Binary probed on PATH, e.g. `node`. */
  probe: string;
  /** Extra args passed to the probe to verify it works. */
  probeArgs?: string[];
  /** Why this is needed, shown in the checklist. */
  purpose: string;
  /** Official download page. */
  downloadUrl: string;
  /** Per-OS one-line install commands. */
  installCommands: Record<OsFamily, string>;
  /** Optional version regex extracted from probe output. */
  versionRegex?: RegExp;
}

/** Outcome of probing a single prerequisite. */
export interface PrerequisiteResult {
  definition: PrerequisiteDefinition;
  installed: boolean;
  version?: string;
  /** Resolved absolute path of the binary when discoverable. */
  resolvedPath?: string;
}

/** The full prerequisite report produced before any file write. */
export interface PrerequisiteReport {
  os: OsFamily;
  results: PrerequisiteResult[];
  /** True when every required runtime is present. */
  satisfied: boolean;
  /** Runtimes that were missing, in catalog-declaration order. */
  missing: PrerequisiteResult[];
}
