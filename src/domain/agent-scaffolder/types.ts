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

export interface AgentScaffoldOptions {
  targetLocationType: 'workspace' | 'external' | 'global' | 'custom';
  targetPath?: string;
  generationMode: GenerationMode;
  role: AgentRole;
  teamRoles?: AgentRole[];
  customRoleName?: string;
  customRoleDescription?: string;
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

