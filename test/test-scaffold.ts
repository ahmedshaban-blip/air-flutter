import * as assert from 'assert';
import { AgentScaffolder, AgentRole, ToolAccessLevel } from '../src/domain/agent-scaffolder';
import { ANTIGRAVITY_SUPPORTED_TOOLS } from '../src/domain/agent-scaffolder/roles';

console.log('🧪 Running Agent Scaffolder Antigravity Compliance Tests...');

// 1. Verify that all standard & full tools for all roles are in ANTIGRAVITY_SUPPORTED_TOOLS
const roles: AgentRole[] = ['planner', 'architect', 'developer', 'qa', 'flutter_ui', 'flutter_state', 'custom'];
const levels: ToolAccessLevel[] = ['read_only', 'standard', 'full'];

for (const role of roles) {
  for (const level of levels) {
    const tools = AgentScaffolder.getToolList(level, undefined, 'antigravity', role);
    for (const tool of tools) {
      assert.ok(
        ANTIGRAVITY_SUPPORTED_TOOLS[tool],
        `Tool "${tool}" for role "${role}" at level "${level}" is not a recognized Antigravity tool!`
      );
    }
  }
}
console.log('✅ All role and level tool sets map to valid Antigravity tools!');

// 2. Test Planner toolset (read-only inspection & web, no code mutations or terminal commands)
const plannerTools = AgentScaffolder.getToolList('standard', undefined, 'antigravity', 'planner');
assert.ok(!plannerTools.includes('run_command'), 'Planner should not have run_command');
assert.ok(!plannerTools.includes('write_file'), 'Planner should not have write_file in standard mode');
assert.ok(plannerTools.includes('read_file'));
assert.ok(plannerTools.includes('list_dir'));
assert.ok(plannerTools.includes('search_web'));
assert.ok(plannerTools.includes('read_url_content'));
console.log('✅ Planner toolset verified (safe inspection only)');

// 3. Test Architect toolset (spec writing & web, NO terminal execution)
const archTools = AgentScaffolder.getToolList('standard', undefined, 'antigravity', 'architect');
assert.ok(archTools.includes('read_file'));
assert.ok(archTools.includes('write_file'));
assert.ok(archTools.includes('replace_file_content'));
assert.ok(archTools.includes('search_web'));
assert.ok(!archTools.includes('run_command'), 'Architect must not have terminal run_command');
console.log('✅ Architect toolset verified');

// 4. Test Developer toolset (code writing, refactoring, building)
const devTools = AgentScaffolder.getToolList('standard', undefined, 'antigravity', 'developer');
assert.ok(devTools.includes('run_command'), 'Developer must have run_command');
assert.ok(devTools.includes('write_file'), 'Developer must have write_file');
assert.ok(devTools.includes('replace_file_content'), 'Developer must have replace_file_content');
assert.ok(devTools.includes('list_dir'), 'Developer must have list_dir');
assert.ok(devTools.includes('grep_search'), 'Developer must have grep_search');
assert.ok(!devTools.includes('invoke_subagent'), 'Developer worker agent must not have invoke_subagent');
console.log('✅ Developer toolset verified');

// 5. Test QA toolset (test writing, code search, test execution via run_command)
const qaTools = AgentScaffolder.getToolList('standard', undefined, 'antigravity', 'qa');
assert.ok(qaTools.includes('run_command'), 'QA must have run_command');
assert.ok(qaTools.includes('write_file'), 'QA must have write_file for tests');
assert.ok(qaTools.includes('replace_file_content'), 'QA must have replace_file_content');
assert.ok(qaTools.includes('list_dir'), 'QA must have list_dir');
assert.ok(qaTools.includes('find_by_name'), 'QA must have find_by_name');
assert.ok(!qaTools.includes('invoke_subagent'), 'QA worker agent must not have invoke_subagent');
console.log('✅ QA toolset verified');

// 6. Test Custom tool aliases sanitization
const customRaw = 'list_directory, execute_command, run_tests, edit_file, view_file, fake_tool_xyz';
const sanitized = AgentScaffolder.getToolList('custom', customRaw, 'antigravity');
assert.deepStrictEqual(sanitized, [
  'list_dir',
  'run_command',
  'replace_file_content',
  'read_file'
]);
console.log('✅ Custom tool alias mapping & non-antigravity tool filtration verified!');

// 7. Test Agent Markdown YAML Frontmatter compliance
const agentDoc = AgentScaffolder.generateAgentMarkdown('qa', {
  targetLocationType: 'workspace',
  generationMode: 'single',
  role: 'qa',
  framework: 'antigravity',
  toolLevel: 'standard',
  contentMode: 'fully_populated'
});

assert.ok(agentDoc.filename === 'qa.md');
assert.ok(agentDoc.content.startsWith('---\nname: "qa"\ndescription: "'));
assert.ok(agentDoc.content.includes('model: "inherit"\nworkspace: "inherit"\ntools:\n  - read_file\n  - write_file\n  - replace_file_content\n  - list_dir\n  - grep_search\n  - find_by_name\n  - run_command\n---'));
assert.ok(agentDoc.content.includes('| Tool Name | Category | Scope / Access Level | Purpose & Responsibility |'));
assert.ok(agentDoc.content.includes('| `run_command` | Execution & Terminal | Terminal Shell Execution | Executes terminal shell commands'));
console.log('✅ Agent Markdown YAML frontmatter and table verified!');

// 8. Test Team Workflow generation & Custom Pipeline Ordering
const teamDocs = AgentScaffolder.generateTeamWorkflow({
  targetLocationType: 'workspace',
  generationMode: 'team',
  role: 'developer',
  teamRoles: ['planner', 'architect', 'developer', 'qa'],
  pipelineOrder: ['qa', 'developer', 'architect', 'planner'], // Custom user-defined order
  framework: 'antigravity',
  toolLevel: 'standard',
  contentMode: 'fully_populated'
});

const orchestrator = teamDocs.find(d => d.filename === 'orchestrator.md');
assert.ok(orchestrator, 'orchestrator.md must be generated');
assert.ok(orchestrator.content.startsWith('---\nname: "orchestrator"\ndescription: "Master multi-agent orchestrator'));
assert.ok(orchestrator.content.includes('tools:\n  - invoke_subagent\n  - send_message\n  - manage_subagents\n  - read_file\n  - list_dir\n  - run_command\n---'));

// Verify that Stage 1 in orchestrator is 'qa' due to pipelineOrder
assert.ok(orchestrator.content.includes('### Stage 1: Asynchronous Invocation of `qa`'));
assert.ok(orchestrator.content.includes('### Stage 2: Asynchronous Invocation of `developer`'));
assert.ok(orchestrator.content.includes('### Stage 3: Asynchronous Invocation of `architect`'));
assert.ok(orchestrator.content.includes('### Stage 4: Asynchronous Invocation of `planner`'));
console.log('✅ Team workflow custom pipeline ordering verified!');

// 9. Test Per-Agent Custom Tools Map
const perAgentDocs = AgentScaffolder.generateTeamWorkflow({
  targetLocationType: 'workspace',
  generationMode: 'team',
  role: 'developer',
  pipelineOrder: ['planner', 'qa'],
  agentToolsMap: {
    planner: ['read_file', 'list_dir', 'search_web'],
    qa: ['read_file', 'write_file', 'run_command']
  },
  framework: 'antigravity',
  toolLevel: 'standard',
  contentMode: 'fully_populated'
});

const plannerDoc = perAgentDocs.find(d => d.filename === 'planner.md');
assert.ok(plannerDoc?.content.includes('tools:\n  - read_file\n  - list_dir\n  - search_web\n---'));
const qaDoc = perAgentDocs.find(d => d.filename === 'qa.md');
assert.ok(qaDoc?.content.includes('tools:\n  - read_file\n  - write_file\n  - run_command\n---'));
console.log('✅ Per-Agent Tools Map successfully reflected in generated specifications!');

// 10. Test Full Custom Agent Builder
const customDoc = AgentScaffolder.generateAgentMarkdown('custom', {
  targetLocationType: 'workspace',
  generationMode: 'single',
  role: 'custom',
  customAgentDetails: {
    name: 'Security Auditor Agent',
    id: 'security_auditor',
    model: 'Gemini 1.5 Pro',
    purpose: 'Audits authentication flows and prevents OWASP vulnerabilities.',
    systemPrompt: 'You are the Lead Security Auditor. Inspect source code for vulnerabilities.',
    inputs: 'PR diffs and authentication tokens.',
    processing: '1. Scan code; 2. Verify auth boundaries; 3. Emit report.',
    handoff: 'Outputs signed security report.',
    rules: [
      'Never allow unencrypted tokens in storage.',
      'Flag any SQL or NoSQL injection vulnerabilities.'
    ],
    verification: 'Confirm zero high-severity CVEs before release.'
  },
  framework: 'antigravity',
  toolLevel: 'standard',
  contentMode: 'fully_populated'
});

assert.ok(customDoc.filename === 'security_auditor.md');
assert.ok(customDoc.content.includes('name: "security_auditor"'));
assert.ok(customDoc.content.includes('Target LLM:** Gemini 1.5 Pro'));
assert.ok(customDoc.content.includes('Never allow unencrypted tokens in storage.'));
assert.ok(customDoc.content.includes('Confirm zero high-severity CVEs before release.'));
console.log('✅ Full Custom Agent Builder with all sections verified!');

console.log('🎉 All 10 Agent Scaffolder Antigravity tests passed successfully!');
