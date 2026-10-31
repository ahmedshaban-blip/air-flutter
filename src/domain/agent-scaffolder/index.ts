import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export * from './types';
import {
  AgentRole,
  AgentScaffoldOptions,
  AgentScaffoldResult,
  ToolAccessLevel
} from './types';
import { getToolList } from './roles';
import { generateAgentMarkdown, generateTeamWorkflow } from './generators';

export class AgentScaffolder {
  /**
   * Resolves the target directory on disk based on chosen location type.
   */
  public static resolveTargetDirectory(
    options: AgentScaffoldOptions,
    workspaceRoot?: string
  ): string {
    const root = workspaceRoot || process.cwd();

    switch (options.targetLocationType) {
      case 'global':
        if (options.framework === 'antigravity') {
          return path.join(os.homedir(), '.gemini', 'config', 'agents');
        }
        return path.join(os.homedir(), '.agents', 'agents');
      case 'external':
        if (!options.targetPath) {
          throw new Error('Target path must be specified for external project location.');
        }
        const resolvedExternal = path.resolve(options.targetPath);
        // If the selected folder is a project root (contains pubspec.yaml or .git), place inside .agents/agents
        if (
          fs.existsSync(path.join(resolvedExternal, 'pubspec.yaml')) ||
          fs.existsSync(path.join(resolvedExternal, '.git'))
        ) {
          return path.join(resolvedExternal, '.agents', 'agents');
        }
        return resolvedExternal;
      case 'custom':
        if (!options.targetPath) {
          throw new Error('Target path must be specified for custom locations.');
        }
        return path.resolve(options.targetPath);
      case 'workspace':
      default:
        return path.join(root, '.agents', 'agents');
    }
  }

  /**
   * Returns list of tools based on access level.
   */
  public static getToolList(level: ToolAccessLevel, customTools?: string): string[] {
    return getToolList(level, customTools);
  }

  /**
   * Generates single agent Markdown specification.
   */
  public static generateAgentMarkdown(
    role: AgentRole,
    options: AgentScaffoldOptions,
    customName?: string,
    customDesc?: string
  ): { filename: string; content: string } {
    return generateAgentMarkdown(role, options, customName, customDesc);
  }

  /**
   * Generates a complete Multi-Agent Team Pipeline with an Orchestration descriptor.
   */
  public static generateTeamWorkflow(
    options: AgentScaffoldOptions
  ): Array<{ filename: string; content: string }> {
    return generateTeamWorkflow(options);
  }

  /**
   * Scaffolds the files non-destructively onto the file system.
   */
  public static async scaffold(
    options: AgentScaffoldOptions,
    workspaceRoot?: string
  ): Promise<AgentScaffoldResult> {
    const targetDir = this.resolveTargetDirectory(options, workspaceRoot);

    // Ensure directory exists non-destructively
    await fs.promises.mkdir(targetDir, { recursive: true });

    const filesToGenerate: Array<{ filename: string; content: string }> =
      options.generationMode === 'team'
        ? this.generateTeamWorkflow(options)
        : [this.generateAgentMarkdown(options.role, options, options.customRoleName, options.customRoleDescription)];

    const createdFiles: string[] = [];

    for (const item of filesToGenerate) {
      const filePath = path.join(targetDir, item.filename);
      await fs.promises.writeFile(filePath, item.content, 'utf8');
      createdFiles.push(item.filename);
    }

    return {
      targetDir,
      createdFiles,
      summary: `Successfully generated ${createdFiles.length} agent file(s) in: ${targetDir}`
    };
  }
}
