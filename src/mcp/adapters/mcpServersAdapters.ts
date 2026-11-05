/**
 * Air Flutter - MCP & AI Agent Hub
 * Adapters for agents that use the `mcpServers` object convention.
 *
 * Cursor, Cline, Roo Code, Windsurf/Cascade and Anti-Gravity all read a
 * `mcpServers` map of { command, args, env } entries, differing only in the
 * file location.
 */

import { McpAgentAdapter, McpScope, McpServerDefinition, McpServerValues } from '../types';
import {
  appData,
  buildStdioEntry,
  inHome,
  inWorkspace,
  platformPath,
  toEnvMap,
  withInstructions
} from './shared';

/** Shared payload builder for every `mcpServers`-style agent. */
function buildMcpServersPayload(
  servers: McpServerDefinition[],
  values: Record<string, McpServerValues>
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const server of servers) {
    mcpServers[server.id] = buildStdioEntry(server, values[server.id]);
  }
  return { mcpServers };
}

// -----------------------------------------------------------------------------
// Cursor
// -----------------------------------------------------------------------------
export const cursorAdapter: McpAgentAdapter = {
  id: 'cursor',
  name: 'Cursor',
  description: 'Workspace .cursor/mcp.json  ·  Global ~/.cursor/mcp.json',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.cursor', 'mcp.json'),
          format: 'json',
          label: 'Workspace .cursor/mcp.json'
        }
      : {
          path: inHome('.cursor', 'mcp.json'),
          format: 'json',
          label: 'Global ~/.cursor/mcp.json'
        };
  },
  buildConfigPayload: buildMcpServersPayload
};

// -----------------------------------------------------------------------------
// Cline
// -----------------------------------------------------------------------------
export const clineAdapter: McpAgentAdapter = {
  id: 'cline',
  name: 'Cline',
  description: 'Global only: ~/.cline/data/settings/cline_mcp_settings.json',
  capabilities: {
    integrationMode: 'global-only',
    supportedScopes: ['global'],
    note: 'Cline does not document a native workspace MCP file.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    void workspaceRoot;
    return {
      path: inHome('.cline', 'data', 'settings', 'cline_mcp_settings.json'),
      format: 'json',
      label: 'Global ~/.cline/data/settings/cline_mcp_settings.json'
    };
  },
  buildConfigPayload: buildMcpServersPayload
};

// -----------------------------------------------------------------------------
// Roo Code
// -----------------------------------------------------------------------------
export const rooCodeAdapter: McpAgentAdapter = {
  id: 'roo-code',
  name: 'Roo Code',
  description: 'Workspace .roo/mcp.json  ·  Global MCP is managed through Roo Code UI',
  capabilities: {
    integrationMode: 'native-config',
    supportedScopes: ['workspace'],
    note: 'Roo Code global storage is editor-managed and not portable across VS Code variants.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    return {
      path: inWorkspace(workspaceRoot, '.roo', 'mcp.json'),
      format: 'json',
      label: 'Workspace .roo/mcp.json'
    };
  },
  buildConfigPayload: buildMcpServersPayload
};

// -----------------------------------------------------------------------------
// Windsurf / Cascade
// -----------------------------------------------------------------------------
export const windsurfAdapter: McpAgentAdapter = {
  id: 'windsurf',
  name: 'Windsurf / Cascade',
  description: 'Global only: Cascade mcp_config.json in the OS user config directory',
  capabilities: {
    integrationMode: 'global-only',
    supportedScopes: ['global'],
    note: 'Windsurf does not document a native workspace MCP file.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    void workspaceRoot;
    return {
      path: platformPath({
        windows: inWorkspace(appData(), 'devin', 'mcp_config.json'),
        macos: inHome('.config', 'devin', 'mcp_config.json'),
        linux: inHome('.config', 'devin', 'mcp_config.json')
      }),
      format: 'json',
      label: 'Global Cascade mcp_config.json'
    };
  },
  buildConfigPayload: buildMcpServersPayload
};

// -----------------------------------------------------------------------------
// Anti-Gravity
// -----------------------------------------------------------------------------
export const antigravityAdapter: McpAgentAdapter = {
  id: 'antigravity',
  name: 'Anti-Gravity',
  description:
    'Workspace .agents/mcp_config.json  ·  Global ~/.gemini/config/mcp_config.json',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.agents', 'mcp_config.json'),
          format: 'json',
          label: 'Workspace .agents/mcp_config.json'
        }
      : {
          path: inHome('.gemini', 'config', 'mcp_config.json'),
          format: 'json',
          label: 'Global ~/.gemini/config/mcp_config.json'
        };
  },
  buildConfigPayload(servers, values) {
    // Anti-Gravity uses the same mcpServers shape; remote servers are
    // expressed with a serverUrl field rather than `url`.
    const mcpServers: Record<string, unknown> = {};
    for (const server of servers) {
      if (server.transport === 'stdio') {
        mcpServers[server.id] = buildStdioEntry(server, values[server.id]);
      } else {
        const entry: Record<string, unknown> = {
          serverUrl: server.url,
          type: server.transport
        };
        const env = toEnvMap(server, values[server.id]);
        if (Object.keys(env).length > 0) {
          entry.env = env;
        }
        mcpServers[server.id] = withInstructions(entry, values[server.id]);
      }
    }
    return { mcpServers };
  }
};
