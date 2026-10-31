import { AgentRole, ToolAccessLevel, AgentFramework, CustomAgentDetails } from './types';

export interface RoleDefinition {
  title: string;
  id: string;
  llm: string;
  purpose: string;
  prompt: string;
  inputs: string;
  processing: string;
  handoff: string;
  rules: string[];
  verification: string;
}

export interface AntigravityToolMeta {
  name: string;
  category: string;
  scope: string;
  description: string;
}

/**
 * Official Google Antigravity supported tools dictionary (strictly matching Antigravity component registry).
 */
export const ANTIGRAVITY_SUPPORTED_TOOLS: Record<string, AntigravityToolMeta> = {
  read_file: {
    name: 'read_file',
    category: 'File Operations',
    scope: 'Read-Only (Workspace)',
    description: 'Reads contents of a file within the workspace with optional line ranges.',
  },
  write_file: {
    name: 'write_file',
    category: 'File Operations',
    scope: 'Write / Create (Workspace)',
    description: 'Creates a new file or completely writes over an existing file.',
  },
  replace_file_content: {
    name: 'replace_file_content',
    category: 'File Operations',
    scope: 'Edit / Mutation (Workspace)',
    description: 'Performs precise, targeted replacements of code blocks or lines inside an existing file.',
  },
  list_dir: {
    name: 'list_dir',
    category: 'File Operations',
    scope: 'Read-Only (Workspace)',
    description: 'Lists files and subdirectories within a specified workspace path.',
  },
  find_by_name: {
    name: 'find_by_name',
    category: 'Search & Discovery',
    scope: 'Read-Only (Pattern Match)',
    description: 'Searches for file paths matching a glob pattern or file name within the project.',
  },
  grep_search: {
    name: 'grep_search',
    category: 'Search & Discovery',
    scope: 'Read-Only (Codebase Search)',
    description: 'Fast regex or literal text search across all files in the project workspace.',
  },
  run_command: {
    name: 'run_command',
    category: 'Execution & Terminal',
    scope: 'Terminal Shell Execution',
    description: 'Executes terminal shell commands for compilation, testing, static analysis, and git workflows.',
  },
  search_web: {
    name: 'search_web',
    category: 'Web & Browser',
    scope: 'External Web Query',
    description: 'Performs online web searches for up-to-date documentation, API references, and libraries.',
  },
  read_url_content: {
    name: 'read_url_content',
    category: 'Web & Browser',
    scope: 'External HTTP Read',
    description: 'Fetches and reads documentation or external web resources.',
  },
  invoke_subagent: {
    name: 'invoke_subagent',
    category: 'Subagent Orchestration',
    scope: 'Subagent Lifecycle',
    description: 'Spawns and executes an isolated, specialized subagent in the background.',
  },
  send_message: {
    name: 'send_message',
    category: 'Subagent Orchestration',
    scope: 'Inter-Agent Communication',
    description: 'Sends deliverables, operational directives, or feedback messages between agents.',
  },
  manage_subagents: {
    name: 'manage_subagents',
    category: 'Subagent Orchestration',
    scope: 'Process Management',
    description: 'Lists, inspects live state, or terminates active background subagent processes.',
  },
};

/**
 * Normalization map for common aliases to canonical Antigravity registry tool names.
 */
export const ANTIGRAVITY_TOOL_ALIASES: Record<string, string> = {
  view_file: 'read_file',
  read: 'read_file',
  write: 'write_file',
  write_to_file: 'write_file',
  edit_file: 'replace_file_content',
  edit: 'replace_file_content',
  list_directory: 'list_dir',
  dir: 'list_dir',
  search_files: 'find_by_name',
  find: 'find_by_name',
  code_search: 'grep_search',
  execute_command: 'run_command',
  terminal_command: 'run_command',
  git_operations: 'run_command',
  run_tests: 'run_command',
  flutter_test: 'run_command',
  dart_analyze: 'run_command',
  web_search: 'search_web',
  fetch_web_page: 'read_url_content',
  browse_web: 'read_url_content',
  delete_file: 'run_command',
  spawn_subagent: 'invoke_subagent',
  message_agent: 'send_message',
  kill_subagent: 'manage_subagents',
  search_marketplace: 'search_web',
};

/**
 * Normalizes and filters custom tools strictly to supported Antigravity tools.
 */
export function sanitizeAntigravityTools(rawTools: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawTools) {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned) continue;

    const mapped = ANTIGRAVITY_TOOL_ALIASES[cleaned] || cleaned;
    if (ANTIGRAVITY_SUPPORTED_TOOLS[mapped] && !seen.has(mapped)) {
      seen.add(mapped);
      result.push(mapped);
    }
  }

  return result.length > 0
    ? result
    : [
        'read_file',
        'write_file',
        'replace_file_content',
        'list_dir',
        'grep_search',
        'find_by_name',
        'run_command'
      ];
}

/**
 * Returns list of tools based on access level, framework, and role.
 */
export function getToolList(
  level: ToolAccessLevel,
  customTools?: string,
  framework: AgentFramework = 'antigravity',
  role?: AgentRole,
  agentToolsMap?: Record<string, string[]>
): string[] {
  if (role && agentToolsMap && agentToolsMap[role] && agentToolsMap[role].length > 0) {
    return sanitizeAntigravityTools(agentToolsMap[role]);
  }

  if (framework === 'antigravity') {
    switch (level) {
      case 'read_only':
        return [
          'read_file',
          'list_dir',
          'grep_search',
          'find_by_name',
          'search_web',
          'read_url_content'
        ];

      case 'standard':
        switch (role) {
          case 'planner':
            return [
              'read_file',
              'list_dir',
              'grep_search',
              'find_by_name',
              'search_web',
              'read_url_content'
            ];
          case 'architect':
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'search_web',
              'read_url_content'
            ];
          case 'developer':
          case 'qa':
          case 'flutter_state':
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'run_command'
            ];
          case 'flutter_ui':
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'run_command'
            ];
          case 'custom':
          default:
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'run_command'
            ];
        }

      case 'full':
        // Tailored strictly by role responsibilities (worker subagents should never be assigned orchestrator tools)
        switch (role) {
          case 'planner':
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'search_web',
              'read_url_content'
            ];
          case 'architect':
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'search_web',
              'read_url_content'
            ];
          case 'developer':
          case 'qa':
          case 'flutter_state':
          case 'flutter_ui':
          case 'custom':
          default:
            return [
              'read_file',
              'write_file',
              'replace_file_content',
              'list_dir',
              'grep_search',
              'find_by_name',
              'run_command',
              'search_web',
              'read_url_content'
            ];
        }

      case 'custom':
        if (customTools && customTools.trim().length > 0) {
          const raw = customTools
            .split(/[\n,]/)
            .map(t => t.trim())
            .filter(t => t.length > 0);
          return sanitizeAntigravityTools(raw);
        }
        return [
          'read_file',
          'write_file',
          'replace_file_content',
          'list_dir',
          'grep_search',
          'find_by_name',
          'run_command'
        ];
    }
  }

  // Non-Antigravity frameworks (CrewAI, Herdr, Generic)
  switch (level) {
    case 'read_only':
      return ['read_file', 'search_files', 'list_directory'];
    case 'standard':
      return ['read_file', 'write_file', 'replace_file_content', 'search_files', 'list_directory', 'run_command'];
    case 'full':
      return [
        'read_file',
        'write_file',
        'replace_file_content',
        'delete_file',
        'search_files',
        'list_directory',
        'run_command'
      ];
    case 'custom':
      if (customTools && customTools.trim().length > 0) {
        return customTools
          .split(/[\n,]/)
          .map(t => t.trim())
          .filter(t => t.length > 0);
      }
      return ['read_file', 'write_file', 'replace_file_content'];
  }
}

/**
 * Generates role definition metadata and instructions.
 */
export function getRoleDefinition(
  role: AgentRole,
  customName?: string,
  customDesc?: string,
  customDetails?: CustomAgentDetails
): RoleDefinition {
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
    default: {
      const title = customDetails?.name || customName || 'Custom Domain Agent';
      const rawId = customDetails?.id || customDetails?.name || customName || 'custom_agent';
      const id = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const llm = customDetails?.model || 'Gemini 1.5 Pro / Claude 3.5 Sonnet';
      const purpose = customDetails?.purpose || customDesc || 'Specialized AI sub-agent configured for custom project workflows.';
      const prompt = customDetails?.systemPrompt || `You are the ${title}.\n${purpose}\nFollow the operational loop, respect tool permissions, and ensure deterministic outputs.`;
      const inputs = customDetails?.inputs || 'Project domain inputs and orchestrator prompts.';
      const processing = customDetails?.processing || '1. Parse input artifacts; 2. Apply domain logic; 3. Generate verified outputs.';
      const handoff = customDetails?.handoff || 'Hands verified artifacts back to the primary orchestrator.';
      const rules = (customDetails?.rules && customDetails.rules.length > 0)
        ? customDetails.rules
        : [
            'Adhere strictly to designated tool boundaries.',
            'Validate all assumptions before executing mutating operations.'
          ];
      const verification = customDetails?.verification || 'Perform self-verification against domain rules prior to completion.';

      return {
        title,
        id,
        llm,
        purpose,
        prompt,
        inputs,
        processing,
        handoff,
        rules,
        verification
      };
    }
  }
}

/**
 * Generates formatted Markdown tool permission table rows.
 */
export function generateToolsTable(
  toolsOrLevel: string[] | ToolAccessLevel,
  customTools?: string,
  framework: AgentFramework = 'antigravity',
  role?: AgentRole
): string {
  const tools: string[] = Array.isArray(toolsOrLevel)
    ? toolsOrLevel
    : getToolList(toolsOrLevel, customTools, framework, role);

  const header = [
    '| Tool Name | Category | Scope / Access Level | Purpose & Responsibility |',
    '| :--- | :--- | :--- | :--- |'
  ];

  const rows = tools.map(t => {
    const meta = ANTIGRAVITY_SUPPORTED_TOOLS[t];
    if (meta) {
      return `| \`${meta.name}\` | ${meta.category} | ${meta.scope} | ${meta.description} |`;
    }
    return `| \`${t}\` | General Operation | Allowed | Operational tool capability |`;
  });

  return [...header, ...rows].join('\n');
}

