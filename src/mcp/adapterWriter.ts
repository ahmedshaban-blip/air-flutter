import { mergeConfigFile, writeTextArtifact } from './configWriter';
import {
  McpAgentAdapter,
  McpConfigTarget,
  McpScope,
  McpServerDefinition,
  McpServerValues,
  McpTextTarget
} from './types';

export function supportsScope(adapter: McpAgentAdapter, scope: McpScope): boolean {
  return adapter.capabilities.supportedScopes.includes(scope);
}

export function commonScopes(adapters: McpAgentAdapter[]): McpScope[] {
  const scopes: McpScope[] = ['workspace', 'global'];
  return scopes.filter((scope) => adapters.every((adapter) => supportsScope(adapter, scope)));
}

export async function writeAdapterOutput(
  adapter: McpAgentAdapter,
  scope: McpScope,
  workspaceRoot: string | undefined,
  servers: McpServerDefinition[],
  values: Record<string, McpServerValues>
) {
  if (!supportsScope(adapter, scope)) {
    throw new Error(`${adapter.name} does not support ${scope} MCP integration.`);
  }

  const target = adapter.resolveTarget(scope, workspaceRoot);
  if (target.format === 'text') {
    if (!adapter.buildTextArtifact) {
      throw new Error(`${adapter.name} does not provide an artifact generator.`);
    }
    const result = await writeTextArtifact(
      target as McpTextTarget,
      adapter.buildTextArtifact(servers, values)
    );
    return { target, result };
  }

  if (!adapter.buildConfigPayload) {
    throw new Error(`${adapter.name} does not provide a configuration builder.`);
  }
  const result = await mergeConfigFile(
    target as McpConfigTarget,
    adapter.buildConfigPayload(servers, values)
  );
  return { target, result };
}
