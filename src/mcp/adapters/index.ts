/**
 * Air Flutter - MCP & AI Agent Hub
 * Adapter registry.
 *
 * The wizard iterates this list for agent selection. Order is presentation
 * order: VS Code-native and the most common Flutter agents come first.
 */

import { McpAgentAdapter } from '../types';
import {
  antigravityAdapter,
  clineAdapter,
  cursorAdapter,
  rooCodeAdapter,
  windsurfAdapter
} from './mcpServersAdapters';
import {
  autoGenAdapter,
  autoGptAdapter,
  claudeDesktopAdapter,
  codexAdapter,
  continueAdapter,
  copilotAdapter,
  crewAiAdapter,
  devinAdapter,
  openCodeAdapter
} from './specialAdapters';

export {
  antigravityAdapter,
  clineAdapter,
  cursorAdapter,
  rooCodeAdapter,
  windsurfAdapter,
  autoGenAdapter,
  autoGptAdapter,
  claudeDesktopAdapter,
  codexAdapter,
  continueAdapter,
  copilotAdapter,
  crewAiAdapter,
  devinAdapter,
  openCodeAdapter
};

/** Every supported agent adapter, in wizard display order. */
export const AGENT_ADAPTERS: McpAgentAdapter[] = [
  copilotAdapter,
  cursorAdapter,
  clineAdapter,
  rooCodeAdapter,
  windsurfAdapter,
  antigravityAdapter,
  claudeDesktopAdapter,
  continueAdapter,
  devinAdapter,
  openCodeAdapter,
  codexAdapter,
  crewAiAdapter,
  autoGenAdapter,
  autoGptAdapter
];

/** Look up an adapter by its stable id. */
export function findAdapterById(id: string): McpAgentAdapter | undefined {
  return AGENT_ADAPTERS.find((a) => a.id === id);
}
