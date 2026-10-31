export type AgentRole =
  | 'planner'
  | 'architect'
  | 'developer'
  | 'qa'
  | 'flutter_ui'
  | 'flutter_state'
  | 'custom';

export type AgentFramework = 'antigravity' | 'herdr' | 'crewai' | 'generic';

export type ToolAccessLevel = 'read_only' | 'standard' | 'full' | 'custom';

export type ScaffoldContentMode = 'fully_populated' | 'blank_template';

export type GenerationMode = 'single' | 'team';

export interface CustomAgentDetails {
  name?: string;
  id?: string;
  model?: string;
  purpose?: string;
  systemPrompt?: string;
  inputs?: string;
  processing?: string;
  handoff?: string;
  rules?: string[];
  verification?: string;
  tools?: string[];
}

export interface AgentScaffoldOptions {
  targetLocationType: 'workspace' | 'external' | 'global' | 'custom';
  targetPath?: string;
  generationMode: GenerationMode;
  role: AgentRole;
  teamRoles?: AgentRole[];
  pipelineOrder?: AgentRole[];
  agentToolsMap?: Record<string, string[]>;
  customRoleName?: string;
  customRoleDescription?: string;
  customAgentDetails?: CustomAgentDetails;
  framework: AgentFramework;
  toolLevel: ToolAccessLevel;
  customTools?: string;
  contentMode: ScaffoldContentMode;
}

export interface AgentScaffoldResult {
  targetDir: string;
  createdFiles: string[];
  summary: string;
}

