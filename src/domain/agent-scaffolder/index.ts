import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type AgentRole =
  | 'planner'
  | 'architect'
  | 'developer'
  | 'qa'
  | 'flutter_ui'
  | 'flutter_state'
  | 'custom'

export type AgentFramework = 'antigravity' | 'herdr' | 'crewai' | 'generic'

export type ToolAccessLevel = 'read_only' | 'standard' | 'full' | 'custom'

export type ScaffoldContentMode = 'fully_populated' | 'blank_template'

export type GenerationMode = 'single' | 'team'

export interface AgentScaffoldOptions {
  targetLocationType: 'workspace' | 'external' | 'global' | 'custom'
  targetPath?: string
  generationMode: GenerationMode
  role: AgentRole
  teamRoles?: AgentRole[]
  customRoleName?: string
  customRoleDescription?: string
  framework: AgentFramework
  toolLevel: ToolAccessLevel
  customTools?: string
  contentMode: ScaffoldContentMode
}

export interface AgentScaffoldResult {
  targetDir: string
  createdFiles: string[]
  summary: string
}

interface RoleDefinition {
  title: string
  id: string
  llm: string
  purpose: string
  prompt: string
  inputs: string
  processing: string
  handoff: string
  rules: string[]
  verification: string
}

export class AgentScaffolder {
  /**
   * Resolves the target directory on disk based on chosen location type.
   */
  public static resolveTargetDirectory(
    options: AgentScaffoldOptions,
    workspaceRoot?: string
  ): string {
    const root = workspaceRoot || process.cwd()

    switch (options.targetLocationType) {
      case 'global':
        if (options.framework === 'antigravity') {
          return path.join(os.homedir(), '.gemini', 'config', 'agents')
        }
        return path.join(os.homedir(), '.agents', 'agents')
      case 'external':
        if (!options.targetPath) {
          throw new Error('Target path must be specified for external project location.')
        }
        const resolvedExternal = path.resolve(options.targetPath)
        // If the selected folder is a project root (contains pubspec.yaml or .git), place inside .agents/agents
        if (
          fs.existsSync(path.join(resolvedExternal, 'pubspec.yaml')) ||
          fs.existsSync(path.join(resolvedExternal, '.git'))
        ) {
          return path.join(resolvedExternal, '.agents', 'agents')
        }
        return resolvedExternal
      case 'custom':
        if (!options.targetPath) {
          throw new Error('Target path must be specified for custom locations.')
        }
        return path.resolve(options.targetPath)
      case 'workspace':
      default:
        return path.join(root, '.agents', 'agents')
    }
  }

  /**
   * Returns list of tools based on access level.
   */
  public static getToolList(level: ToolAccessLevel, customTools?: string): string[] {
    switch (level) {
      case 'read_only':
        return ['read_file', 'list_dir', 'web_search']
      case 'standard':
        return ['read_file', 'write_file', 'replace_file_content', 'run_tests']
      case 'full':
        return ['read_file', 'write_file', 'replace_file_content', 'execute_command', 'git_operations']
      case 'custom':
      default:
        return (customTools || 'read_file, write_file')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
    }
  }

  /**
   * Predefined roles metadata and high-density system prompts
   */
  private static getRoleDefinition(role: AgentRole, customName?: string, customDesc?: string): RoleDefinition {
    switch (role) {
      case 'planner':
        return {
          title: 'Planner & Business Analyst Agent',
          id: 'planner',
          llm: 'Gemini 1.5 Pro / Claude 3.5 Sonnet',
          purpose: 'Decomposes complex requirements, PRDs, and user requests into structured epics, executable tasks, and technical scopes.',
          prompt: `You are the Lead Technical Planner & Business Analyst Agent.
Your mission is to examine incoming feature requests, identify system boundaries, surface architectural ambiguities, and break requirements down into rigorous, atomic, and testable work packages.
Maintain absolute clarity: do not write application code. Focus entirely on user-journey mapping, state transitions, API contract drafts, edge cases, and dependency orderings.`,
          inputs: 'PRD documents, user stories, feature requests, and domain glossaries.',
          processing: '1. Ingest requirements; 2. Identify external dependencies; 3. Perform edge-case analysis; 4. Split into phased atomic tasks with clear acceptance criteria.',
          handoff: 'Outputs structured specification markdown files to the Architect and Developer agents.',
          rules: [
            'Never emit implementation code; focus purely on specs and task trees.',
            'Always define explicit negative scenarios (error handling, rate limits, empty states).',
            'Order tasks strictly by topological dependency.'
          ],
          verification: 'Verify that every acceptance criterion has a matching verification test plan.'
        }

      case 'architect':
        return {
          title: 'System Architect & Designer Agent',
          id: 'architect',
          llm: 'Claude 3.5 Sonnet / GPT-4o',
          purpose: 'Designs resilient system schemas, API contracts, entity-relationship diagrams, and component seams.',
          prompt: `You are the Lead Software Architect Agent.
You govern high-level module architecture, data flows, persistence schemas, and API boundaries.
You ensure modularity, low coupling, high cohesion, and strict adherence to Clean Architecture and domain-driven design principles.`,
          inputs: 'Planner specifications, domain requirements, and existing repository call-graphs.',
          processing: '1. Model domain entities; 2. Define repository & service interfaces; 3. Generate OpenAPI/gRPC schemas; 4. Document architectural decision records (ADRs).',
          handoff: 'Delivers technical contracts and architecture diagrams to the Developer Agent.',
          rules: [
            'Enforce unidirectional data flow and clean separation of concerns.',
            'Avoid leaky abstractions: keep domain entities independent of third-party frameworks.'
          ],
          verification: 'Check interfaces for exhaustiveness and backward compatibility.'
        }

      case 'developer':
        return {
          title: 'Senior Full-Stack Developer Agent',
          id: 'developer',
          llm: 'Claude 3.5 Sonnet / Gemini 1.5 Pro',
          purpose: 'Implements production-grade, highly maintainable, and type-safe features following architectural contracts.',
          prompt: `You are the Senior Implementer & Coder Agent.
You translate architecture blueprints into idiomatic, secure, performant, and maintainable source code.
You adhere strictly to project conventions, minimize boilerplate, handle errors gracefully, and write testable code without regressions.`,
          inputs: 'Architect blueprints, API schemas, and task requirements.',
          processing: '1. Create domain models & entities; 2. Implement logic with strict typing; 3. Integrate persistence/network layers; 4. Ensure zero compilation warnings.',
          handoff: 'Delivers code changes and diffs to the QA & Reviewer Agent.',
          rules: [
            'Never leave stubbed TODOs without functional implementations.',
            'Preserve existing comments, docstrings, and style standards.',
            'Do not bypass lint rules or security checks.'
          ],
          verification: 'Run local static analysis and ensure code builds with zero errors.'
        }

      case 'qa':
        return {
          title: 'QA, Testing & Code Review Agent',
          id: 'qa',
          llm: 'Gemini 1.5 Pro / GPT-4o',
          purpose: 'Reviews code diffs, stress-tests edge cases, writes automated unit and integration tests, and validates regressions.',
          prompt: `You are the Lead QA & Code Reviewer Agent.
Your objective is to guarantee software reliability, security, and specification compliance.
You inspect code diffs with an adversarial mindset, spot subtle bugs, check race conditions, and write rigorous unit, widget, and integration tests.`,
          inputs: 'Source code changes, architectural specifications, and PR diffs.',
          processing: '1. Perform static code inspection; 2. Validate against acceptance criteria; 3. Generate unit and integration tests; 4. Measure code coverage.',
          handoff: 'Emits a signed Verification Report to the user or orchestrator.',
          rules: [
            'Do not approve code that lacks automated test coverage for happy and sad paths.',
            'Identify and report security flaws, unbounded loops, or memory leaks immediately.'
          ],
          verification: 'Execute full test suite; confirm 100% pass rate before greenlighting release.'
        }

      case 'flutter_ui':
        return {
          title: 'Flutter UI & Widget Specialist Agent',
          id: 'flutter_ui',
          llm: 'Claude 3.5 Sonnet / Gemini 1.5 Pro',
          purpose: 'Designs and implements pixel-perfect, responsive, and accessible Flutter widgets with fluid animations.',
          prompt: `You are the Lead Flutter UI & Widget Engineer Agent.
You master the Flutter widget tree, custom painters, responsive layouts (LayoutBuilder, MediaQuery), RTL localization, and Material 3 design systems.
You avoid anti-patterns like build-method side effects, oversized widget files, and unconstrained render overflows.`,
          inputs: 'Figma designs, UX requirements, theme tokens, and component contracts.',
          processing: '1. Break UI into reusable widget components; 2. Implement responsive layout constraints; 3. Wire animations and RTL support; 4. Profile widget build performance.',
          handoff: 'Supplies widget components to the Flutter State Management Agent.',
          rules: [
            'Always extract complex widget trees into dedicated const stateless/stateful widgets.',
            'Ensure full RTL and localization compatibility using Intl or AppLocalizations.'
          ],
          verification: 'Verify zero RenderFlex overflow warnings across multiple screen dimensions.'
        }

      case 'flutter_state':
        return {
          title: 'Flutter Architecture & Bloc/Cubit Specialist Agent',
          id: 'flutter_state',
          llm: 'Claude 3.5 Sonnet / Gemini 1.5 Pro',
          purpose: 'Architects robust Flutter business logic, Bloc/Cubit state management, and Clean Architecture layers.',
          prompt: `You are the Lead Flutter Architecture & State Management Agent.
You govern Clean Architecture for Flutter: Presentation (Bloc/Cubit/View), Domain (UseCases/Entities), and Data (Repositories/DataSources).
You ensure deterministic state transitions, reactive streams, offline caching, and immaculate error handling.`,
          inputs: 'Domain entities, API endpoints, and Flutter UI views.',
          processing: '1. Model immutable state events & states; 2. Implement Cubit/Bloc handlers; 3. Bind dependency injection (GetIt/Injectable); 4. Write mock-based bloc tests.',
          handoff: 'Delivers robust state controllers to UI widgets and test suites.',
          rules: [
            'Never mutate state directly; always emit fresh immutable state copies via copyWith.',
            'Keep business logic strictly out of UI widget classes.'
          ],
          verification: 'Verify that state transitions are verified with 100% unit test coverage using bloc_test.'
        }

      case 'custom':
      default:
        return {
          title: customName || 'Custom Domain Agent',
          id: (customName || 'custom_agent').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          llm: 'Gemini 1.5 Pro / Claude 3.5 Sonnet',
          purpose: customDesc || 'Specialized AI sub-agent configured for custom project workflows.',
          prompt: `You are the ${customName || 'Custom AI Agent'}.
${customDesc || 'Perform specialized domain operations with precision and adherence to project conventions.'}
Follow the operational loop, respect tool permissions, and ensure deterministic outputs.`,
          inputs: 'Project domain inputs and orchestrator prompts.',
          processing: '1. Parse input artifacts; 2. Apply domain logic; 3. Generate verified outputs.',
          handoff: 'Hands verified artifacts back to the primary orchestrator.',
          rules: [
            'Adhere strictly to designated tool boundaries.',
            'Validate all assumptions before executing mutating operations.'
          ],
          verification: 'Perform self-verification against domain rules prior to completion.'
        }
    }
  }

  /**
   * Generates tool permission table rows based on selected permission level.
   */
  private static generateToolsTable(level: ToolAccessLevel, customTools?: string): string {
    switch (level) {
      case 'read_only':
        return `| Tool Name | Scope / Access Level | Reason |
|---|---|---|
| \`read_file\` | Project workspace | Read requirements, specs, and source code safely |
| \`list_dir\` | Project workspace | Explore directory hierarchies without modifications |
| \`web_search\` | Global web | Research documentation and best practices |`

      case 'standard':
        return `| Tool Name | Scope / Access Level | Reason |
|---|---|---|
| \`read_file\` | Project workspace | Read specs, configs, and source files |
| \`write_file\` | Project workspace | Scaffold and write implementation files |
| \`replace_file_content\` | Project workspace | Apply targeted, non-destructive file edits |
| \`run_tests\` | Local test harness | Verify functionality and catch regressions |`

      case 'full':
        return `| Tool Name | Scope / Access Level | Reason |
|---|---|---|
| \`read_file\` | Full workspace | Inspect project state and configuration files |
| \`write_file\` | Full workspace | Emit source code, tests, and documentation |
| \`execute_command\` | Project shell | Run build commands, linters, and compiler checks |
| \`git_operations\` | Project repository | Branch, stage, commit, and inspect git diffs |`

      case 'custom':
      default:
        const customLines = (customTools || 'read_file, write_file')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => `| \`${t}\` | Project scope | Custom domain requirement |`)
          .join('\n')
        return `| Tool Name | Scope / Access Level | Reason |\n|---|---|---|\n${customLines}`
    }
  }

  /**
   * Generates a single production-ready Agent Markdown specification file.
   */
  public static generateAgentMarkdown(
    role: AgentRole,
    options: AgentScaffoldOptions,
    customName?: string,
    customDesc?: string
  ): { filename: string; content: string } {
    const roleDef = this.getRoleDefinition(role, customName, customDesc)
    const filename = `${roleDef.id}.md`
    const toolsTable = this.generateToolsTable(options.toolLevel, options.customTools)
    const toolsList = this.getToolList(options.toolLevel, options.customTools)
    const toolsYaml = toolsList.map(t => `  - ${t}`).join('\n')

    const frontmatter = `---
name: ${roleDef.id}
description: ${roleDef.purpose}
model: inherit
workspace: inherit
tools:
${toolsYaml}
---`

    if (options.contentMode === 'blank_template') {
      const fillPrompt = `${frontmatter}

<!--
================================================================================
SELF-FILLING PROMPT FOR AI ARCHITECT:
"You are an expert AI agent architect. Read the project PRD and the tech stack.
Fill out the template below for the '${roleDef.title}' agent.
Ensure the system prompt includes strict negative constraints, specifies the input
schema for task execution, and maps out the handoff to the next agent.
Output the result directly into this markdown file preserving the YAML frontmatter above."
================================================================================
-->

# Agent: ${roleDef.title}
> **File Purpose:** [Explain what this file does, how the orchestrator reads it, and why it is essential for the multi-agent workflow].

## 1. Identity & System Prompt
- **Role:** ${roleDef.title}
- **Target LLM:** [e.g., Gemini 1.5 Pro, Claude 3.5 Sonnet, GPT-4o]
- **System Prompt:**
"""
[High-density, imperative system instructions defining role, boundaries, tone, and operational loop]
"""

## 2. Core Responsibilities & Workflow
1. **Input Phase:** [What exact artifacts/files does it accept?]
2. **Processing Phase:** [What step-by-step logic does it execute?]
3. **Handoff Phase:** [What does it produce, and which agent receives the output?]

## 3. Tool Permissions & Access Control
${toolsTable}

## 4. Execution Rules & Quality Gates
- Rule 1: [Critical operational constraint]
- Rule 2: [Negative constraint: what NOT to do]
- Verification Gate: [How the agent verifies its work before handing off]
`
      return { filename, content: fillPrompt }
    }

    // Fully Populated Mode
    const rulesList = roleDef.rules.map(r => `- Rule: ${r}`).join('\n')
    const fullContent = `${frontmatter}

# Agent: ${roleDef.title}
> **File Purpose:** ${roleDef.purpose}

## 1. Identity & System Prompt
- **Role:** ${roleDef.title}
- **Target LLM:** ${roleDef.llm}
- **System Prompt:**
"""
${roleDef.prompt}
"""

## 2. Core Responsibilities & Workflow
1. **Input Phase:** ${roleDef.inputs}
2. **Processing Phase:** ${roleDef.processing}
3. **Handoff Phase:** ${roleDef.handoff}

## 3. Tool Permissions & Access Control
${toolsTable}

## 4. Execution Rules & Quality Gates
${rulesList}
- **Verification Gate:** ${roleDef.verification}
`
    return { filename, content: fullContent }
  }

  /**
   * Generates a complete Multi-Agent Team Pipeline with an Orchestration descriptor.
   */
  public static generateTeamWorkflow(options: AgentScaffoldOptions): Array<{ filename: string; content: string }> {
    const files: Array<{ filename: string; content: string }> = []

    const selectedRoles: AgentRole[] =
      options.teamRoles && options.teamRoles.length > 0
        ? options.teamRoles
        : ['planner', 'architect', 'developer', 'qa']

    const roleDefs: RoleDefinition[] = []

    for (const role of selectedRoles) {
      const def = this.getRoleDefinition(role, options.customRoleName, options.customRoleDescription)
      roleDefs.push(def)
      files.push(this.generateAgentMarkdown(role, options, options.customRoleName, options.customRoleDescription))
    }

    // Add Framework-specific Orchestrator
    if (options.framework === 'crewai') {
      const crewAgentsPy = roleDefs.map(def => `
${def.id}_agent = Agent(
    role="${def.title}",
    goal="${def.purpose.replace(/"/g, '\\"')}",
    backstory="Specialist dedicated to ${def.title} domain operations.",
    verbose=True
)`).join('\n')

      const crewTasksPy = roleDefs.map(def => `
task_${def.id} = Task(
    description="Execute ${def.title} responsibilities: ${def.processing.replace(/"/g, '\\"')}",
    agent=${def.id}_agent,
    expected_output="Verified deliverables for ${def.title}."
)`).join('\n')

      const crewAgentsList = roleDefs.map(def => `${def.id}_agent`).join(', ')
      const crewTasksList = roleDefs.map(def => `task_${def.id}`).join(', ')

      files.push({
        filename: 'crew.py',
        content: `"""
Production CrewAI Multi-Agent Workflow (${roleDefs.length} Agents)
Generated by Air Flutter AI Agent Architect & Scaffolding Engine
"""
from crewai import Agent, Crew, Process, Task
${crewAgentsPy}
${crewTasksPy}

crew = Crew(
    agents=[${crewAgentsList}],
    tasks=[${crewTasksList}],
    process=Process.sequential,
    verbose=True
)

if __name__ == "__main__":
    result = crew.kickoff()
    print("Workflow executed successfully:\\n", result)
`
      })
    } else if (options.framework === 'herdr') {
      const herdrPipelineYaml = roleDefs.map((def, idx) => {
        const nextDef = roleDefs[idx + 1]
        const onFinish = nextDef ? nextDef.id : 'complete'
        return `    - name: "${def.id}"
      file: "${def.id}.md"
      on_finish: "${onFinish}"`
      }).join('\n')

      files.push({
        filename: 'herdr.yaml',
        content: `# Herdr Multi-Agent Pipeline Configuration (${roleDefs.length} Agents)
# Generated by Air Flutter AI Agent Architect & Scaffolding Engine
version: "1.0"
pipeline:
  name: "custom-agent-pipeline"
  mode: "sequential"
  agents:
${herdrPipelineYaml}
`
      })
    } else {
      // Antigravity / Generic Markdown Orchestrator
      const mermaidNodes = roleDefs.map((def, idx) => `node${idx}["${def.title}"]`).join(' --> ')
      const mermaidChart = `\`\`\`mermaid\nflowchart LR\n    ${mermaidNodes}\n\`\`\``

      const invocationStages = roleDefs.map((def, idx) => {
        const stageNum = idx + 1
        const isFirst = idx === 0
        const prevDef = roleDefs[idx - 1]
        const inputDesc = isFirst ? 'initial project PRD and requirements' : `verified deliverables emitted by ${prevDef.title}`

        return `### Stage ${stageNum}: Asynchronous Invocation of \`${def.id}\`
- **Subagent Type:** \`${def.id}\`
- **Execution Tool Call:**
\`\`\`json
{
  "tool": "invoke_subagent",
  "arguments": {
    "TypeName": "${def.id}",
    "Role": "${def.title}",
    "Prompt": "Execute stage ${stageNum}. Ingest ${inputDesc}. Perform core logic: ${def.processing.replace(/"/g, '\\"')}. Deliver verified output.",
    "Model": "inherit",
    "Workspace": "inherit"
  }
}
\`\`\`
- **Reactive Wakeup:** Subagent executes in the background. When notification arrives, inspect output and proceed to the next stage.`
      }).join('\n\n')

      const handoffSteps = roleDefs.map((def, idx) => {
        const nextDef = roleDefs[idx + 1]
        if (nextDef) {
          return `${idx + 1}. **${def.title}**: Processes inputs and hands off verified deliverables to **${nextDef.title}**.`
        } else {
          return `${idx + 1}. **${def.title}**: Final pipeline stage. Performs quality gate verification and completes release.`
        }
      }).join('\n')

      files.push({
        filename: 'orchestrator.md',
        content: `---
name: orchestrator
description: Master multi-agent orchestrator managing the asynchronous execution pipeline across ${roleDefs.length} subagents.
model: inherit
workspace: inherit
tools:
  - invoke_subagent
  - send_message
  - manage_subagents
  - read_file
---

# Agent: Team Orchestrator & Asynchronous Workflow Controller
> **File Purpose:** Orchestrates the multi-agent asynchronous pipeline across ${roleDefs.length} specialized subagents in accordance with Google Antigravity Subagents specifications.

## 1. Pipeline Execution Flow
${mermaidChart}

## 2. Asynchronous Subagents Invocation Guide
In Google Antigravity, subagents run in isolated background contexts. Call \`invoke_subagent\` for each stage in sequence. **Do not poll in a loop**; Antigravity will notify you automatically when a subagent finishes or sends a message.

${invocationStages}

## 3. Dynamic Handoff Protocol
${handoffSteps}

## 4. Quality Gate & Error Feedback
- If any subagent reports test failures, missing criteria, or unhandled edge cases, the orchestrator routes the feedback message directly back via \`send_message(Recipient: conversationId, Message: errorDetails)\` before progressing to the next stage.
`
      })
    }

    return files
  }

  /**
   * Scaffolds the files non-destructively onto the file system.
   */
  public static async scaffold(
    options: AgentScaffoldOptions,
    workspaceRoot?: string
  ): Promise<AgentScaffoldResult> {
    const targetDir = this.resolveTargetDirectory(options, workspaceRoot)

    // Ensure directory exists non-destructively
    await fs.promises.mkdir(targetDir, { recursive: true })

    const filesToGenerate: Array<{ filename: string; content: string }> =
      options.generationMode === 'team'
        ? this.generateTeamWorkflow(options)
        : [this.generateAgentMarkdown(options.role, options, options.customRoleName, options.customRoleDescription)]

    const createdFiles: string[] = []

    for (const item of filesToGenerate) {
      const filePath = path.join(targetDir, item.filename)
      await fs.promises.writeFile(filePath, item.content, 'utf8')
      createdFiles.push(item.filename)
    }

    return {
      targetDir,
      createdFiles,
      summary: `Successfully generated ${createdFiles.length} agent file(s) in: ${targetDir}`
    }
  }
}

