/**
 * Air Flutter - MCP & AI Agent Hub
 * Shared helpers used by every agent adapter.
 */

import * as os from 'os';
import * as path from 'path';
import { McpScope, McpServerDefinition, McpServerValues } from '../types';

/** Home directory shorthand. */
export function home(): string {
  return os.homedir();
}

/** Resolve a workspace-relative path against the workspace root. */
export function inWorkspace(
  workspaceRoot: string | undefined,
  ...segments: string[]
): string {
  const root = workspaceRoot || process.cwd();
  return path.join(root, ...segments);
}

/** Resolve a path under the user's home directory. */
export function inHome(...segments: string[]): string {
  return path.join(home(), ...segments);
}

/** Windows APPDATA root, falling back to a home-relative guess. */
export function appData(): string {
  return process.env.APPDATA ?? path.join(home(), 'AppData', 'Roaming');
}

/** macOS Application Support root. */
export function macOSAppSupport(): string {
  return path.join(home(), 'Library', 'Application Support');
}

/**
 * Pick the platform-appropriate path from a per-OS map.
 * Used by adapters whose config location differs across operating systems.
 */
export function platformPath(map: {
  windows: string;
  macos: string;
  linux: string;
}): string {
  switch (os.platform()) {
    case 'win32':
      return map.windows;
    case 'darwin':
      return map.macos;
    default:
      return map.linux;
  }
}

/**
 * Convert collected parameter values for a server into an environment map.
 * Parameter keys double as environment variable names for stdio servers.
 */
export function toEnvMap(
  server: McpServerDefinition,
  values: McpServerValues | undefined
): Record<string, string> {
  const env: Record<string, string> = { ...(server.env ?? {}) };
  const params = values?.parameters;
  if (!params) {
    return env;
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      env[key] = String(value);
    }
  }
  return env;
}

/**
 * Attach the optional `instructions` field to a server entry, when the user
 * supplied non-empty guidance. This is the single choke point through which
 * every adapter gains instructions support, so behaviour stays consistent.
 *
 * The `instructions` key is a valid extra property in the MCP server entry
 * object. Clients that understand it (Cursor, Claude Desktop, Cline and
 * others) surface it to the model; clients that do not simply ignore an
 * unknown key, so writing it is always safe.
 */
export function withInstructions(
  entry: Record<string, unknown>,
  values: McpServerValues | undefined
): Record<string, unknown> {
  const text = values?.instructions?.trim();
  if (text && text.length > 0) {
    entry.instructions = text;
  }
  return entry;
}

/**
 * Standard MCP stdio entry used by Cursor, Cline, Roo, Windsurf, Cline-style
 * agents: { command, args, env }.
 *
 * @param includeType when true, adds an explicit `"type": "stdio"` field
 *                    (required by VS Code native MCP / Copilot).
 */
export function buildStdioEntry(
  server: McpServerDefinition,
  values: McpServerValues | undefined,
  includeType = false
): Record<string, unknown> {
  const entry: Record<string, unknown> = {};

  if (includeType) {
    entry.type = server.transport === 'stdio' ? 'stdio' : server.transport;
  }

  if (server.transport === 'stdio') {
    entry.command = server.command;
    if (server.args.length > 0) {
      entry.args = [...server.args];
    }
    const env = toEnvMap(server, values);
    if (Object.keys(env).length > 0) {
      entry.env = env;
    }
  } else {
    // Remote transports expose a URL plus optional auth headers/env.
    entry.url = server.url;
    const env = toEnvMap(server, values);
    if (Object.keys(env).length > 0) {
      entry.env = env;
    }
  }

  return withInstructions(entry, values);
}

/** Scope label helper for QuickPick descriptions. */
export function describeScope(scope: McpScope): string {
  return scope === 'workspace' ? 'Project (workspace)' : 'Global (user / machine)';
}
