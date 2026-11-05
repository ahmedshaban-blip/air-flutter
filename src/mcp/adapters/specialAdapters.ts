/**
 * Air Flutter - MCP & AI Agent Hub
 * Adapters for VS Code-native MCP hosts and other specialized agents.
 */

import {
  McpAgentAdapter,
  McpScope,
  McpServerDefinition,
  McpServerValues
} from '../types';
import {
  appData,
  buildStdioEntry,
  inHome,
  inWorkspace,
  macOSAppSupport,
  platformPath,
  toEnvMap,
  withInstructions
} from './shared';

// -----------------------------------------------------------------------------
// GitHub Copilot (VS Code native MCP)
// -----------------------------------------------------------------------------
export const copilotAdapter: McpAgentAdapter = {
  id: 'copilot',
  name: 'GitHub Copilot',
  description: 'Workspace .mcp.json  ·  Global ~/.copilot/mcp-config.json',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.mcp.json'),
          format: 'json',
          label: 'Workspace .mcp.json'
        }
      : {
          path: inHome('.copilot', 'mcp-config.json'),
          format: 'json',
          label: 'Global ~/.copilot/mcp-config.json'
        };
  },
  buildConfigPayload(servers, values) {
    // Portable Copilot configuration uses the mcpServers convention.
    const config: Record<string, unknown> = {};
    for (const server of servers) {
      config[server.id] = buildStdioEntry(server, values[server.id]);
    }
    return { mcpServers: config };
  }
};

// -----------------------------------------------------------------------------
// Devin
// -----------------------------------------------------------------------------
export const devinAdapter: McpAgentAdapter = {
  id: 'devin',
  name: 'Devin',
  description:
    'Workspace .devin/mcp_config.json  ·  Global ~/.config/devin/mcp_config.json',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.devin', 'mcp_config.json'),
          format: 'json',
          label: 'Workspace .devin/mcp_config.json'
        }
      : {
          path: platformPath({
            windows: `${appData()}\\devin\\mcp_config.json`,
            macos: inHome('.config', 'devin', 'mcp_config.json'),
            linux: inHome('.config', 'devin', 'mcp_config.json')
          }),
          format: 'json',
          label: 'Global ~/.config/devin/mcp_config.json'
        };
  },
  buildConfigPayload(servers, values) {
    const mcpServers: Record<string, unknown> = {};
    for (const server of servers) {
      mcpServers[server.id] = buildStdioEntry(server, values[server.id]);
    }
    return { mcpServers };
  }
};

// -----------------------------------------------------------------------------
// Claude Desktop (global only)
// -----------------------------------------------------------------------------
export const claudeDesktopAdapter: McpAgentAdapter = {
  id: 'claude-desktop',
  name: 'Claude Desktop',
  description: 'Global only: claude_desktop_config.json (macOS / Windows / Linux)',
  capabilities: {
    integrationMode: 'global-only',
    supportedScopes: ['global'],
    note: 'Claude Desktop has no project-specific MCP configuration.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    // Claude Desktop is a machine-wide app; both scopes resolve to its
    // single global config. A note is surfaced by the wizard.
    void scope;
    void workspaceRoot;
    const target = platformPath({
      windows: `${appData()}\\Claude\\claude_desktop_config.json`,
      macos: `${macOSAppSupport()}/Claude/claude_desktop_config.json`,
      linux: inHome('.config', 'Claude', 'claude_desktop_config.json')
    });
    return {
      path: target,
      format: 'json',
      label: 'Global claude_desktop_config.json'
    };
  },
  buildConfigPayload(servers, values) {
    const mcpServers: Record<string, unknown> = {};
    for (const server of servers) {
      mcpServers[server.id] = buildStdioEntry(server, values[server.id]);
    }
    return { mcpServers };
  }
};

// -----------------------------------------------------------------------------
// Continue (YAML)
// -----------------------------------------------------------------------------
export const continueAdapter: McpAgentAdapter = {
  id: 'continue',
  name: 'Continue',
  description: 'Workspace .continue/mcpServers/air-flutter.yaml  ·  Global ~/.continue/mcpServers/air-flutter.yaml',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.continue', 'mcpServers', 'air-flutter.yaml'),
          format: 'yaml',
          label: 'Workspace .continue/mcpServers/air-flutter.yaml'
        }
      : {
          path: inHome('.continue', 'mcpServers', 'air-flutter.yaml'),
          format: 'yaml',
          label: 'Global ~/.continue/mcpServers/air-flutter.yaml'
        };
  },
  buildConfigPayload(servers, values) {
    // Continue models MCP servers as a top-level list of named entries.
    const mcpServers = servers.map((server) => {
      const entry: Record<string, unknown> = {
        name: server.id,
        ...buildStdioEntry(server, values[server.id])
      };
      return withInstructions(entry, values[server.id]);
    });
    return {
      name: 'Air Flutter MCP servers',
      version: '1.0.0',
      schema: 'v1',
      mcpServers
    };
  }
};

// -----------------------------------------------------------------------------
// OpenCode (JSON)
// -----------------------------------------------------------------------------
export const openCodeAdapter: McpAgentAdapter = {
  id: 'opencode',
  name: 'OpenCode',
  description: 'Workspace opencode.json  ·  Global ~/.config/opencode/opencode.json',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, 'opencode.json'),
          format: 'json',
          label: 'Workspace opencode.json'
        }
      : {
          path: inHome('.config', 'opencode', 'opencode.json'),
          format: 'json',
          label: 'Global ~/.config/opencode/opencode.json'
        };
  },
  buildConfigPayload(servers, values) {
    // OpenCode nests servers under an `mcp` key; local entries carry a
    // `type: local` discriminator and full command array.
    const mcp: Record<string, unknown> = {};
    for (const server of servers) {
      const env = toEnvMap(server, values[server.id]);
      if (server.transport === 'stdio') {
        mcp[server.id] = withInstructions({
          type: 'local',
          command: [server.command, ...server.args],
          enabled: true,
          ...(Object.keys(env).length > 0 ? { environment: env } : {})
        }, values[server.id]);
      } else {
        mcp[server.id] = withInstructions({
          type: 'remote',
          url: server.url,
          enabled: true,
          ...(Object.keys(env).length > 0 ? { environment: env } : {})
        }, values[server.id]);
      }
    }
    return { mcp };
  }
};

// -----------------------------------------------------------------------------
// OpenAI Codex CLI / ChatGPT Desktop (TOML)
// -----------------------------------------------------------------------------
export const codexAdapter: McpAgentAdapter = {
  id: 'codex',
  name: 'OpenAI Codex CLI',
  description: 'Workspace .codex/config.toml  ·  Global ~/.codex/config.toml',
  capabilities: { integrationMode: 'native-config', supportedScopes: ['workspace', 'global'] },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    return scope === 'workspace'
      ? {
          path: inWorkspace(workspaceRoot, '.codex', 'config.toml'),
          format: 'toml',
          label: 'Workspace .codex/config.toml'
        }
      : {
          path: inHome('.codex', 'config.toml'),
          format: 'toml',
          label: 'Global ~/.codex/config.toml'
        };
  },
  buildConfigPayload(servers, values) {
    // Codex uses [mcp_servers.<name>] tables with command/args/env.
    const mcp_servers: Record<string, unknown> = {};
    for (const server of servers) {
      const entry: Record<string, unknown> = {
        command: server.command,
        args: server.args
      };
      const env = toEnvMap(server, values[server.id]);
      if (Object.keys(env).length > 0) {
        entry.env = env;
      }
      mcp_servers[server.id] = withInstructions(entry, values[server.id]);
    }
    return { mcp_servers };
  }
};

// -----------------------------------------------------------------------------
// SDK and UI integrations (generated artifacts, not auto-loaded config files)
// -----------------------------------------------------------------------------
export const crewAiAdapter: McpAgentAdapter = {
  id: 'crewai',
  name: 'CrewAI',
  description: 'Generates .air-flutter/mcp/crewai_mcp.py for project integration',
  capabilities: {
    integrationMode: 'code-template',
    supportedScopes: ['workspace'],
    note: 'CrewAI consumes MCP integrations from application code, not a reserved config file.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    return {
      path: inWorkspace(workspaceRoot, '.air-flutter', 'mcp', 'crewai_mcp.py'),
      format: 'text',
      label: 'CrewAI Python integration template'
    };
  },
  buildTextArtifact(servers, values) {
    const params = servers.map((server) => {
      const env = toEnvMap(server, values[server.id]);
      return server.transport === 'stdio'
        ? { command: server.command, args: server.args, ...(Object.keys(env).length ? { env } : {}) }
        : { url: server.url, transport: server.transport, ...(Object.keys(env).length ? { env } : {}) };
    });
    return `"""Generated by Air Flutter. Review before importing into your CrewAI app."""

from crewai_tools import MCPServerAdapter

server_params = ${JSON.stringify(params, null, 2)}

# Example:
# with MCPServerAdapter(server_params) as tools:
#     agent = Agent(role="MCP Agent", goal="Use project tools", tools=tools)
`;
  }
};

export const autoGenAdapter: McpAgentAdapter = {
  id: 'autogen',
  name: 'Microsoft AutoGen',
  description: 'Generates .air-flutter/mcp/autogen_mcp.py for project integration',
  capabilities: {
    integrationMode: 'code-template',
    supportedScopes: ['workspace'],
    note: 'AutoGen consumes MCP integrations through autogen-ext code or component configuration.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    return {
      path: inWorkspace(workspaceRoot, '.air-flutter', 'mcp', 'autogen_mcp.py'),
      format: 'text',
      label: 'AutoGen Python integration template'
    };
  },
  buildTextArtifact(servers, values) {
    const declarations = servers.map((server, index) => {
      const env = toEnvMap(server, values[server.id]);
      const variable = `server_${index + 1}`;
      if (server.transport === 'stdio') {
        return `${variable} = StdioServerParams(command=${JSON.stringify(server.command)}, args=${JSON.stringify(server.args)}, env=${JSON.stringify(env)})`;
      }
      const type = server.transport === 'sse' ? 'SseServerParams' : 'StreamableHttpServerParams';
      return `${variable} = ${type}(url=${JSON.stringify(server.url)})`;
    });
    const variables = servers.map((_, index) => `server_${index + 1}`).join(', ');
    return `"""Generated by Air Flutter. Review before importing into your AutoGen app."""

from autogen_ext.tools.mcp import (
    SseServerParams,
    StdioServerParams,
    StreamableHttpServerParams,
    mcp_server_tools,
)

${declarations.join('\n')}

async def load_air_flutter_mcp_tools():
    tools = []
    for server in [${variables}]:
        tools.extend(await mcp_server_tools(server))
    return tools
`;
  }
};

export const autoGptAdapter: McpAgentAdapter = {
  id: 'autogpt',
  name: 'AutoGPT Platform',
  description: 'Generates a project setup guide for Settings → Integrations',
  capabilities: {
    integrationMode: 'setup-guide',
    supportedScopes: ['workspace'],
    note: 'AutoGPT integrations are configured in its UI, not through a workspace MCP file.'
  },
  resolveTarget(scope: McpScope, workspaceRoot?: string) {
    void scope;
    return {
      path: inWorkspace(workspaceRoot, '.air-flutter', 'mcp', 'autogpt-setup.md'),
      format: 'text',
      label: 'AutoGPT integration setup guide'
    };
  },
  buildTextArtifact(servers, values) {
    const sections = servers.map((server) => {
      const env = toEnvMap(server, values[server.id]);
      const launch = server.transport === 'stdio'
        ? `Command: \`${server.command} ${server.args.join(' ')}\``
        : `URL: \`${server.url}\``;
      const envLines = Object.entries(env).map(([key, value]) => `- \`${key}\`: \`${value}\``);
      return `## ${server.name}\n\n${launch}${envLines.length ? `\n\nEnvironment:\n${envLines.join('\n')}` : ''}`;
    });
    return `# AutoGPT MCP integration guide

AutoGPT Platform does not load a project MCP configuration file. Add each service through **Settings → Integrations**.

${sections.join('\n\n')}

Official guide: https://github.com/Significant-Gravitas/AutoGPT/blob/master/docs/platform/integrations-and-credentials.md
`;
  }
};
