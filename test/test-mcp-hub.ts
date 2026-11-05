/**
 * MCP & AI Agent Hub — test suite.
 *
 * Covers, in order:
 *   1. Catalog integrity (21 servers, unique ids, `-y` on every npx command)
 *   2. Instruction metadata (templates + defaults are well-formed)
 *   3. Adapter coverage and config shapes
 *   4. Instructions propagation into every adapter's payload
 *   5. Non-destructive merge + array union for JSON / JSONC / YAML / TOML
 *   6. Corruption safety (unparseable files are never clobbered)
 *   7. Idempotency and user-key preservation across repeated runs
 *
 * The `vscode` module is stubbed below because the writer reads a setting
 * from it; everything else runs against the real compiled sources.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('module');

// -----------------------------------------------------------------------------
// vscode stub — must be installed before requiring any source that imports it.
// -----------------------------------------------------------------------------
const vscodeStubPath = path.join(__dirname, '__vscode_stub__.js');
fs.writeFileSync(
  vscodeStubPath,
  `module.exports = {
     workspace: {
       getConfiguration: () => ({ get: (_key, fallback) => fallback }),
       workspaceFolders: undefined
     },
     window: {},
     commands: {},
     Uri: {},
     QuickPickItemKind: { Separator: -1, Default: 0 }
   };\n`
);

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'vscode') {
    return vscodeStubPath;
  }
  return originalResolve.call(this, request, ...rest);
};

// Imports must come after the stub is registered.
import { MCP_CATALOG, findServerById, getCatalogCategories, getRequiredRuntimes } from '../src/mcp/catalog';
import { AGENT_ADAPTERS, findAdapterById } from '../src/mcp/adapters';
import { commonScopes, writeAdapterOutput } from '../src/mcp/adapterWriter';
import {
  deepMerge,
  mergeConfigFile,
  parseConfig,
  serializeConfig,
  ConfigParseError
} from '../src/mcp/configWriter';
import { PREREQUISITES, prerequisitesForRuntime, buildInstallGuide, verifyPrerequisites } from '../src/mcp/prerequisites';
import {
  extractRunAppArgument,
  insertImport,
  isDependencyDeclared,
  wireMainDart
} from '../src/mcp/companionPackage';
import { McpServerValues } from '../src/mcp/types';

console.log('🧪 Running Air Flutter MCP Hub test suite...\n');

let passed = 0;
const pendingChecks: Array<{ label: string; promise: Promise<void> }> = [];

/**
 * Register and run a check. Synchronous checks are reported immediately;
 * async checks are queued and awaited before the suite reports success, so a
 * late assertion failure can never be masked by an early ✅.
 */
function check(label: string, fn: () => void | Promise<void>): void {
  const result = fn();
  if (result && typeof (result as Promise<void>).then === 'function') {
    pendingChecks.push({ label, promise: result as Promise<void> });
    return;
  }
  passed++;
  console.log(`  ✅ ${label}`);
}

/** Await every queued async check and report a truthful final result. */
async function settleChecks(): Promise<void> {
  const results = await Promise.allSettled(pendingChecks.map((c) => c.promise));
  let failed = 0;
  results.forEach((result, index) => {
    const label = pendingChecks[index].label;
    if (result.status === 'fulfilled') {
      passed++;
      console.log(`  ✅ ${label}`);
    } else {
      failed++;
      console.error(`  ❌ ${label}`);
      console.error(`     ${result.reason}`);
    }
  });
  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n❌ ${failed} check(s) failed.`);
  }
}

// Temp scratch directory for all file-based tests.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'airflutter-mcp-'));

process.on('exit', () => {
  try {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(vscodeStubPath, { force: true });
  } catch {
    /* best effort cleanup */
  }
});

// =============================================================================
// 1. Catalog integrity
// =============================================================================
console.log('[1] Catalog integrity');

check('catalog contains exactly 21 servers', () => {
  assert.strictEqual(MCP_CATALOG.length, 21, `expected 21 servers, got ${MCP_CATALOG.length}`);
});

check('mobile-mcp and marionette-mcp are both present and distinct', () => {
  const marionette = findServerById('marionette-mcp');
  const mobile = findServerById('mobile-mcp');
  assert.ok(marionette, 'marionette-mcp must exist');
  assert.ok(mobile, 'mobile-mcp must exist');
  assert.notStrictEqual(marionette!.id, mobile!.id);
});

check('mobile-mcp uses the official package with -y', () => {
  const mobile = findServerById('mobile-mcp')!;
  assert.strictEqual(mobile.command, 'npx');
  assert.ok(mobile.args.includes('-y'), 'must pass -y');
  assert.ok(
    mobile.args.includes('@mobilenext/mobile-mcp@latest'),
    `expected the official package, got ${mobile.args.join(' ')}`
  );
});

check('marionette uses the Dart bridge binary, not an npm package', () => {
  const marionette = findServerById('marionette-mcp')!;
  assert.strictEqual(marionette.runtime, 'dart');
  assert.strictEqual(marionette.command, 'marionette_mcp');
});

check('marionette declares a well-formed companion package', () => {
  const marionette = findServerById('marionette-mcp')!;
  const pkg = marionette.companionPackage;
  assert.ok(pkg, 'marionette must declare a companion package');
  assert.strictEqual(pkg!.packageName, 'marionette_flutter');
  assert.ok(pkg!.addCommand.includes('flutter pub add'), 'addCommand must use flutter pub add');
  assert.ok(pkg!.docsUrl.startsWith('https://'), 'docsUrl must be a link');
  assert.ok(pkg!.mainDartSnippet.includes('MarionetteBinding.ensureInitialized()'), 'snippet must init the binding');
  assert.ok(pkg!.mainDartSnippet.includes('kDebugMode'), 'snippet must guard with kDebugMode');
  assert.ok(pkg!.requiredImport.includes('marionette_flutter'), 'import must reference the package');
  assert.ok(pkg!.setupSteps.length >= 3, 'should list the setup steps');
});

check('every companion package across the catalog is complete', () => {
  for (const server of MCP_CATALOG) {
    const pkg = server.companionPackage;
    if (!pkg) continue;
    assert.ok(pkg.packageName.length > 0, `${server.id} companion has no package name`);
    assert.ok(pkg.addCommand.includes(pkg.packageName), `${server.id} addCommand must name the package`);
    assert.ok(pkg.requiredImport.includes(pkg.packageName), `${server.id} import must name the package`);
    assert.ok(pkg.bindingCall.trim().length > 0, `${server.id} must declare a binding call`);
    assert.ok(pkg.mainDartSnippet.includes(pkg.bindingCall), `${server.id} snippet must contain the binding call`);
  }
});

check('every server id is unique', () => {
  const ids = MCP_CATALOG.map((s) => s.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate server ids found');
});

check('every npx server passes -y to skip the install prompt', () => {
  const npxServers = MCP_CATALOG.filter((s) => s.command === 'npx');
  assert.ok(npxServers.length > 0, 'expected at least one npx server');
  for (const s of npxServers) {
    assert.ok(
      s.args.includes('-y'),
      `server "${s.id}" uses npx without -y, which would prompt in the terminal`
    );
  }
});

check('every server declares transport, runtime, command and category', () => {
  for (const s of MCP_CATALOG) {
    assert.ok(s.transport, `${s.id} missing transport`);
    assert.ok(s.runtime, `${s.id} missing runtime`);
    assert.ok(s.category, `${s.id} missing category`);
    if (s.transport === 'stdio') {
      assert.ok(s.command.length > 0, `${s.id} is stdio but has no command`);
    } else {
      assert.ok(s.url && s.url.startsWith('http'), `${s.id} is remote but has no http url`);
    }
  }
});

check('findServerById resolves and categories are ordered uniquely', () => {
  assert.ok(findServerById('supabase-mcp'), 'supabase-mcp should exist');
  assert.strictEqual(findServerById('does-not-exist'), undefined);
  const cats = getCatalogCategories();
  assert.strictEqual(new Set(cats).size, cats.length, 'categories should be unique');
});

check('getRequiredRuntimes excludes remote servers', () => {
  const postman = findServerById('postman-mcp')!;
  const pubdev = findServerById('pubdev-mcp')!;
  const runtimes = getRequiredRuntimes([postman, pubdev]);
  assert.ok(!runtimes.includes('remote'), 'remote should not require a local runtime');
  assert.ok(runtimes.includes('node'), 'node should be required');
});

// =============================================================================
// 2. Instruction metadata
// =============================================================================
console.log('\n[2] Instruction metadata');

check('instruction templates are well-formed everywhere they exist', () => {
  let templateCount = 0;
  for (const s of MCP_CATALOG) {
    for (const t of s.instructionTemplates ?? []) {
      templateCount++;
      assert.ok(t.label.length > 0, `${s.id} has a template with an empty label`);
      assert.ok(t.description.length > 0, `${s.id}/${t.label} has an empty description`);
      assert.ok(t.value.trim().length > 0, `${s.id}/${t.label} has empty value text`);
    }
    if (s.defaultInstructions) {
      assert.ok(
        s.defaultInstructions.trim().length > 0,
        `${s.id} has whitespace-only defaultInstructions`
      );
    }
  }
  assert.ok(templateCount >= 20, `expected a healthy template count, got ${templateCount}`);
});

check('supabase ships the schema-restriction template from the request', () => {
  const supa = findServerById('supabase-mcp')!;
  const t = (supa.instructionTemplates ?? []).find((x) => /schema/i.test(x.label));
  assert.ok(t, 'supabase should offer a schema restriction template');
  assert.ok(/schema/i.test(t!.value), 'template should mention the schema');
});

console.log(`     (${MCP_CATALOG.filter((s) => (s.instructionTemplates ?? []).length > 0).length}/${MCP_CATALOG.length} servers ship templates)`);

// =============================================================================
// 3. Adapter coverage
// =============================================================================
console.log('\n[3] Adapter coverage');

check('14 agent adapters are registered with unique ids', () => {
  assert.strictEqual(AGENT_ADAPTERS.length, 14, `expected 14 adapters, got ${AGENT_ADAPTERS.length}`);
  const ids = AGENT_ADAPTERS.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate adapter ids');
});

check('every adapter resolves only its declared scopes to a concrete target', () => {
  const validFormats = ['json', 'yaml', 'toml', 'text'];
  for (const a of AGENT_ADAPTERS) {
    assert.ok(a.capabilities.supportedScopes.length > 0, `${a.id} has no supported scope`);
    for (const scope of a.capabilities.supportedScopes) {
      const target = a.resolveTarget(scope, 'D:\\fake\\workspace');
      assert.ok(target.path.length > 0, `${a.id}/${scope} produced an empty path`);
      assert.ok(path.isAbsolute(target.path), `${a.id}/${scope} path must be absolute: ${target.path}`);
      assert.ok(validFormats.includes(target.format), `${a.id}/${scope} bad format ${target.format}`);
      assert.ok(target.label.length > 0, `${a.id}/${scope} missing label`);
    }
  }
});

check('workspace paths and unsupported agents match official capabilities', () => {
  const workspace = 'D:\\fake\\workspace';
  const expected: Record<string, string> = {
    copilot: path.join(workspace, '.mcp.json'),
    cursor: path.join(workspace, '.cursor', 'mcp.json'),
    'roo-code': path.join(workspace, '.roo', 'mcp.json'),
    antigravity: path.join(workspace, '.agents', 'mcp_config.json'),
    continue: path.join(workspace, '.continue', 'mcpServers', 'air-flutter.yaml'),
    devin: path.join(workspace, '.devin', 'mcp_config.json'),
    opencode: path.join(workspace, 'opencode.json'),
    codex: path.join(workspace, '.codex', 'config.toml')
  };
  for (const [id, expectedPath] of Object.entries(expected)) {
    assert.strictEqual(findAdapterById(id)!.resolveTarget('workspace', workspace).path, expectedPath);
  }
  for (const id of ['cline', 'windsurf', 'claude-desktop']) {
    assert.deepStrictEqual(findAdapterById(id)!.capabilities.supportedScopes, ['global']);
  }
  assert.strictEqual(findAdapterById('aider'), undefined);
  assert.strictEqual(findAdapterById('autoclaw'), undefined);
  assert.strictEqual(findAdapterById('multi-agent'), undefined);
});

check('adapter lookup by id works for every registered adapter', () => {
  for (const a of AGENT_ADAPTERS) {
    assert.strictEqual(findAdapterById(a.id)?.id, a.id);
  }
});

check('mixed capability selections expose only genuinely common scopes', () => {
  assert.deepStrictEqual(commonScopes([findAdapterById('cursor')!]), ['workspace', 'global']);
  assert.deepStrictEqual(commonScopes([findAdapterById('cursor')!, findAdapterById('cline')!]), ['global']);
  assert.deepStrictEqual(commonScopes([findAdapterById('cursor')!, findAdapterById('crewai')!]), ['workspace']);
  assert.deepStrictEqual(commonScopes([findAdapterById('cline')!, findAdapterById('crewai')!]), []);
});

// =============================================================================
// 4. Instructions propagation
// =============================================================================
console.log('\n[4] Instructions propagation');

const INSTRUCTION_TEXT = 'Always operate strictly within the truck_store schema.';
const sharedValues: Record<string, McpServerValues> = {
  'supabase-mcp': {
    parameters: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ACCESS_TOKEN: 'sbp_x' },
    instructions: INSTRUCTION_TEXT
  },
  'pubdev-mcp': { parameters: {} } // deliberately no instructions
};

/** Depth-first search for a value under an arbitrary key. */
function findByKey(node: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (n && typeof n === 'object') {
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (k === key) found.push(v);
        walk(v);
      }
    }
  };
  walk(node);
  return found;
}

check('every native config adapter writes instructions when provided', () => {
  const servers = [findServerById('supabase-mcp')!, findServerById('pubdev-mcp')!];
  for (const adapter of AGENT_ADAPTERS.filter((a) => a.buildConfigPayload)) {
    const payload = adapter.buildConfigPayload!(servers, sharedValues);
    const instructions = findByKey(payload, 'instructions');
    assert.strictEqual(
      instructions.length,
      1,
      `${adapter.id} should carry one instructions field, found ${instructions.length}`
    );
    assert.ok(
      instructions.every((value) => value === INSTRUCTION_TEXT),
      `${adapter.id} corrupted the instruction text`
    );
  }
});

check('no native config adapter writes instructions when none were provided', () => {
  const servers = [findServerById('pubdev-mcp')!];
  for (const adapter of AGENT_ADAPTERS.filter((a) => a.buildConfigPayload)) {
    const payload = adapter.buildConfigPayload!(servers, sharedValues);
    assert.strictEqual(
      findByKey(payload, 'instructions').length,
      0,
      `${adapter.id} added an instructions field the user did not ask for`
    );
  }
});

check('whitespace-only instructions are treated as absent', () => {
  const servers = [findServerById('pubdev-mcp')!];
  const blank: Record<string, McpServerValues> = {
    'pubdev-mcp': { parameters: {}, instructions: '   \n  ' }
  };
  for (const adapter of AGENT_ADAPTERS.filter((a) => a.buildConfigPayload)) {
    const payload = adapter.buildConfigPayload!(servers, blank);
    assert.strictEqual(
      findByKey(payload, 'instructions').length,
      0,
      `${adapter.id} wrote a blank instructions field`
    );
  }
});

check('instructions land next to command/args on the same server entry', () => {
  const servers = [findServerById('supabase-mcp')!];
  const payload = AGENT_ADAPTERS.find((a) => a.id === 'cursor')!
    .buildConfigPayload!(servers, sharedValues) as any;
  const entry = payload.mcpServers['supabase-mcp'];
  assert.strictEqual(entry.instructions, INSTRUCTION_TEXT);
  assert.strictEqual(entry.command, 'npx');
  assert.ok(entry.args.includes('-y'), 'args should still contain -y');
  assert.strictEqual(entry.env.SUPABASE_ACCESS_TOKEN, 'sbp_x');
});

check('continue MCP block carries instructions on the named entry', () => {
  const servers = [
    findServerById('supabase-mcp')!,
    findServerById('pubdev-mcp')!,
    findServerById('postman-mcp')!
  ];
  const payload = findAdapterById('continue')!.buildConfigPayload!(servers, sharedValues) as any;
  assert.strictEqual(payload.schema, 'v1');
  const supa = payload.mcpServers.find((e: any) => e.name === 'supabase-mcp');
  const pubdev = payload.mcpServers.find((e: any) => e.name === 'pubdev-mcp');
  const postman = payload.mcpServers.find((e: any) => e.name === 'postman-mcp');
  assert.strictEqual(supa.instructions, INSTRUCTION_TEXT);
  assert.strictEqual(pubdev.instructions, undefined);
  assert.strictEqual(postman.url, 'https://mcp.postman.com/mcp');
  assert.strictEqual(postman.command, undefined);
});

check('copilot uses the portable mcpServers shape with instructions', () => {
  const servers = [findServerById('supabase-mcp')!];
  const payload = findAdapterById('copilot')!
    .buildConfigPayload!(servers, sharedValues) as any;
  assert.ok(payload.mcpServers, 'copilot must use the portable mcpServers key');
  assert.strictEqual(payload.mcpServers['supabase-mcp'].instructions, INSTRUCTION_TEXT);
});

check('SDK and UI integrations generate explicit workspace artifacts', () => {
  const servers = [findServerById('pubdev-mcp')!];
  const crew = findAdapterById('crewai')!.buildTextArtifact!(servers, sharedValues);
  const autogen = findAdapterById('autogen')!.buildTextArtifact!(servers, sharedValues);
  const autogpt = findAdapterById('autogpt')!.buildTextArtifact!(servers, sharedValues);
  assert.ok(crew.includes('MCPServerAdapter'));
  assert.ok(autogen.includes('StdioServerParams'));
  assert.ok(autogpt.includes('Settings → Integrations'));
});

check('codex writes instructions into the TOML table', () => {
  const servers = [findServerById('supabase-mcp')!];
  const payload = findAdapterById('codex')!
    .buildConfigPayload!(servers, sharedValues) as any;
  assert.strictEqual(payload.mcp_servers['supabase-mcp'].instructions, INSTRUCTION_TEXT);
});

// =============================================================================
// 5. Non-destructive merge
// =============================================================================
console.log('\n[5] Non-destructive merge');

check('deepMerge unions arrays of named entries instead of replacing', () => {
  const existing = { mcpServers: [{ name: 'existing', command: 'keep' }] };
  const incoming = { mcpServers: [{ name: 'new', command: 'add' }] };
  const merged = deepMerge(existing, incoming);
  const list = merged.mcpServers as any[];
  assert.strictEqual(list.length, 2, 'both entries should survive');
  assert.ok(list.some((e) => e.name === 'existing'));
  assert.ok(list.some((e) => e.name === 'new'));
});

check('deepMerge updates a named array entry in place rather than duplicating', () => {
  const existing = { mcpServers: [{ name: 'a', command: 'old' }] };
  const incoming = { mcpServers: [{ name: 'a', command: 'new' }] };
  const merged = deepMerge(existing, incoming);
  const list = merged.mcpServers as any[];
  assert.strictEqual(list.length, 1, 'should not duplicate the entry');
  assert.strictEqual(list[0].command, 'new', 'incoming value should win');
});

check('JSON merge preserves a pre-existing server and unrelated top-level keys', async () => {
  const file = path.join(scratch, 'json', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ mcpServers: { myExisting: { command: 'foo' } }, customKey: 'keep' })
  );

  const adapter = findAdapterById('cursor')!;
  const servers = [findServerById('supabase-mcp')!];
  await mergeConfigFile(
    { path: file, format: 'json', label: 'test' },
    adapter.buildConfigPayload!(servers, sharedValues)
  );

  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(after.mcpServers.myExisting, 'existing server must survive');
  assert.strictEqual(after.customKey, 'keep', 'unrelated key must survive');
  assert.strictEqual(after.mcpServers['supabase-mcp'].instructions, INSTRUCTION_TEXT);
});

check('JSONC files with comments and trailing commas parse safely', () => {
  const parsed = parseConfig(
    '{\n  // a comment\n  "mcpServers": { "a": { "command": "a" } },\n}',
    'json',
    'inline'
  );
  assert.ok((parsed as any).mcpServers.a, 'comment-laden JSON should parse');
});

check('YAML merge preserves unrelated keys and existing list entries', async () => {
  const file = path.join(scratch, 'yaml', 'config.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    'name: Air Flutter MCP servers\nversion: 1.0.0\nschema: v1\ncustomKey: keep\nmcpServers:\n  - name: existing\n    command: keepme\n'
  );

  const adapter = findAdapterById('continue')!;
  const servers = [findServerById('supabase-mcp')!];
  await mergeConfigFile(
    { path: file, format: 'yaml', label: 'test' },
    adapter.buildConfigPayload!(servers, sharedValues)
  );

  const doc = yaml.load(fs.readFileSync(file, 'utf8')) as any;
  assert.strictEqual(doc.customKey, 'keep', 'unrelated top-level key must survive');
  const names = doc.mcpServers.map((s: any) => s.name);
  assert.ok(names.includes('existing'), 'pre-existing YAML server must survive');
  assert.ok(names.includes('supabase-mcp'), 'new server must be added');
  const supa = doc.mcpServers.find((s: any) => s.name === 'supabase-mcp');
  assert.strictEqual(supa.instructions, INSTRUCTION_TEXT);
});

check('TOML merge preserves existing tables and adds new ones', async () => {
  const file = path.join(scratch, 'toml', 'config.toml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'model = "o3"\n\n[mcp_servers.existing]\ncommand = "keepme"\n');

  const adapter = findAdapterById('codex')!;
  const servers = [findServerById('supabase-mcp')!];
  await mergeConfigFile(
    { path: file, format: 'toml', label: 'test' },
    adapter.buildConfigPayload!(servers, sharedValues)
  );

  const text = fs.readFileSync(file, 'utf8');
  assert.ok(/model = "o3"/.test(text), 'unrelated TOML key must survive');
  assert.ok(text.includes('mcp_servers.existing'), 'existing table must survive');
  assert.ok(text.includes('mcp_servers.supabase-mcp'), 'new table must be added');
  assert.ok(text.includes(INSTRUCTION_TEXT), 'instructions must be written to TOML');
});

check('a backup file is created when overwriting an existing config', async () => {
  const file = path.join(scratch, 'backup', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"mcpServers":{}}');

  const result = await mergeConfigFile(
    { path: file, format: 'json', label: 'test' },
    { mcpServers: { x: { command: 'x' } } }
  );
  assert.ok(result.backupPath, 'a backup path should be returned');
  assert.ok(fs.existsSync(result.backupPath!), 'the backup file should exist on disk');
});

check('no backup is attempted when creating a brand new file', async () => {
  const file = path.join(scratch, 'fresh', 'mcp.json');
  const result = await mergeConfigFile(
    { path: file, format: 'json', label: 'test' },
    { mcpServers: { x: { command: 'x' } } }
  );
  assert.strictEqual(result.backupPath, undefined, 'nothing to back up for a new file');
  assert.ok(fs.existsSync(file), 'the new file should be created');
});

check('code-template adapters write text artifacts instead of fake MCP configs', async () => {
  const adapter = findAdapterById('crewai')!;
  const server = findServerById('pubdev-mcp')!;
  const { target } = await writeAdapterOutput(
    adapter,
    'workspace',
    scratch,
    [server],
    sharedValues
  );
  assert.strictEqual(target.format, 'text');
  assert.ok(fs.readFileSync(target.path, 'utf8').includes('MCPServerAdapter'));
});

// =============================================================================
// 6. Corruption safety
// =============================================================================
console.log('\n[6] Corruption safety');

check('an unparseable JSON file throws ConfigParseError and is left untouched', async () => {
  const file = path.join(scratch, 'bad', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const original = '{ this is definitely not json ';
  fs.writeFileSync(file, original);

  let caught: unknown;
  try {
    await mergeConfigFile(
      { path: file, format: 'json', label: 'test' },
      { mcpServers: { x: {} } }
    );
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof ConfigParseError, 'expected a ConfigParseError');
  assert.strictEqual(
    fs.readFileSync(file, 'utf8'),
    original,
    'the corrupt file must be byte-for-byte untouched'
  );
});

check('an unparseable YAML file throws rather than being rewritten', async () => {
  const file = path.join(scratch, 'badyaml', 'config.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'key: [unclosed\n  bad: indent');

  let threw = false;
  try {
    await mergeConfigFile({ path: file, format: 'yaml', label: 'test' }, { a: 1 });
  } catch (error) {
    threw = error instanceof ConfigParseError;
  }
  assert.ok(threw, 'invalid YAML should be rejected');
});

// =============================================================================
// 7. Idempotency
// =============================================================================
console.log('\n[7] Idempotency');

check('re-running merges without duplicating servers', async () => {
  const file = path.join(scratch, 'idem', '.cursor', 'mcp.json');
  const target = { path: file, format: 'json' as const, label: 'test' };
  const adapter = findAdapterById('cursor')!;

  const pubdev = findServerById('pubdev-mcp')!;
  const figma = findServerById('figma-mcp')!;

  await mergeConfigFile(target, adapter.buildConfigPayload!([pubdev], sharedValues));
  await mergeConfigFile(target, adapter.buildConfigPayload!([figma], sharedValues));

  let doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(
    Object.keys(doc.mcpServers).sort(),
    ['figma-mcp', 'pubdev-mcp'],
    'both servers should co-exist'
  );

  // Re-apply the same server: must update in place, not duplicate.
  const result = await mergeConfigFile(
    target,
    adapter.buildConfigPayload!([pubdev], sharedValues)
  );
  doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(Object.keys(doc.mcpServers).length, 2, 'no duplication on re-run');
  assert.deepStrictEqual(result.added, [], 're-run should report no additions');
  assert.ok(result.updated.includes('mcpServers'), 're-run should report an update');
});

check('a third-party edit made between runs survives the next run', async () => {
  const file = path.join(scratch, 'manual', 'mcp.json');
  const target = { path: file, format: 'json' as const, label: 'test' };
  const adapter = findAdapterById('cursor')!;
  const pubdev = findServerById('pubdev-mcp')!;

  await mergeConfigFile(target, adapter.buildConfigPayload!([pubdev], sharedValues));

  // Simulate the user hand-editing the file.
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.userNote = 'do not delete me';
  doc.mcpServers.handWritten = { command: 'custom', args: ['--flag'] };
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));

  await mergeConfigFile(target, adapter.buildConfigPayload!([pubdev], sharedValues));

  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(after.userNote, 'do not delete me', 'user key must survive');
  assert.ok(after.mcpServers.handWritten, 'hand-written server must survive');
});

check('serialize → parse round-trips instructions across all formats', () => {
  const payload = { mcpServers: { s: { command: 'npx', args: ['-y', 'x'], instructions: INSTRUCTION_TEXT } } };
  for (const format of ['json', 'yaml', 'toml'] as const) {
    const text = serializeConfig(payload, format);
    const back = parseConfig(text, format, 'roundtrip');
    const found = findByKey(back, 'instructions');
    assert.strictEqual(found.length, 1, `${format} lost the instructions field`);
    assert.strictEqual(found[0], INSTRUCTION_TEXT, `${format} corrupted the instructions text`);
  }
});

// =============================================================================
// 8. Prerequisites
// =============================================================================
console.log('\n[8] Prerequisites');

check('node runtime requires both node and npx', () => {
  const ids = prerequisitesForRuntime('node').map((d) => d.id);
  assert.ok(ids.includes('node') && ids.includes('npx'));
});

check('python runtime requires python and uvx', () => {
  const ids = prerequisitesForRuntime('python').map((d) => d.id);
  assert.ok(ids.includes('python') && ids.includes('uvx'));
});

check('remote runtime requires nothing local', () => {
  assert.deepStrictEqual(prerequisitesForRuntime('remote'), []);
});

check('every prerequisite defines install commands for all three OSes', () => {
  for (const def of Object.values(PREREQUISITES)) {
    for (const osFamily of ['windows', 'macos', 'linux'] as const) {
      assert.ok(
        def.installCommands[osFamily]?.trim().length > 0,
        `${def.id} is missing a ${osFamily} install command`
      );
    }
    assert.ok(def.downloadUrl.startsWith('http'), `${def.id} download url must be http`);
  }
});

check('install guide lists exactly the missing tools', () => {
  const guide = buildInstallGuide({
    os: 'windows',
    satisfied: false,
    results: [],
    missing: [
      { definition: PREREQUISITES.node, installed: false },
      { definition: PREREQUISITES.git, installed: false }
    ]
  });
  assert.ok(guide.text.includes('Node.js'), 'guide should mention Node.js');
  assert.ok(guide.text.includes('Git'), 'guide should mention Git');
  assert.strictEqual(guide.commands.length, 2, 'one command per missing tool');
  assert.ok(guide.commands.every((c) => c.command.length > 0), 'commands must be non-empty');
});

check('regression: Windows shims (.cmd/.bat) are detected, not just .exe', async () => {
  // This is the bug that reported "Flutter SDK missing" on a machine running
  // Flutter: `flutter` and `npx` ship as `.bat`/`.cmd` shims on Windows, and a
  // naive `execFile` probe fails with ENOENT. Probing npx is the sharpest
  // guard, because npx is *always* a `.cmd` shim on Windows while node is a
  // real `.exe` — so a broken resolver still reports node OK and only npx wrong.
  if (process.platform !== 'win32') {
    return; // shim behaviour is Windows-specific
  }

  const report = await verifyPrerequisites(['node']);
  const npx = report.results.find((r) => r.definition.id === 'npx');
  const node = report.results.find((r) => r.definition.id === 'node');

  assert.ok(node, 'node must be probed');
  assert.ok(npx, 'npx must be probed alongside node');

  // If node resolves, npx is virtually guaranteed to exist too (it ships with
  // npm). So node-OK + npx-MISSING is precisely the shim-resolution failure.
  if (node!.installed) {
    assert.ok(
      npx!.installed,
      'npx is a .cmd shim on Windows; reporting it missing while node is present means shim resolution is broken'
    );
    assert.ok(npx!.version, 'npx should report a version once detected');
  }
});

check('regression: a real probe detects installed tools on this machine', async () => {
  // Guards the Windows `.bat`/`.cmd` shim bug: `flutter` and `npx` ship as
  // shims on Windows, and a naive execFile probe reports them missing even
  // though they are on PATH. This test runs the real engine, so it fails if
  // shim resolution regresses.
  const report = await verifyPrerequisites(['node', 'dart']);
  assert.ok(report.results.length > 0, 'the probe should return results');

  const node = report.results.find((r) => r.definition.id === 'node');
  assert.ok(node, 'node must be probed');
  assert.ok(
    node!.installed,
    'Node.js should be detected on a machine running this test suite'
  );
  assert.ok(node!.version, 'a detected tool should report a version');

  for (const result of report.results) {
    assert.ok(
      !result.installed || Boolean(result.definition.name),
      'an installed result must carry its definition'
    );
  }
});

check('regression: probeOne never throws and always returns a result', async () => {
  // A bogus runtime should produce a graceful "not installed" rather than
  // propagating an exception out of the engine.
  const report = await verifyPrerequisites(['remote']);
  assert.strictEqual(report.results.length, 0, 'remote needs no local probes');
  assert.ok(report.satisfied, 'a runtime with no prerequisites is always satisfied');
});

// =============================================================================
// 9. Panel integration wiring
// =============================================================================
console.log('\n[9] Panel integration wiring');

const repoRoot = path.join(__dirname, '..', '..');

function readRepoFile(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

check('panel injects the MCP modal markup, css and script', () => {
  const html = readRepoFile(path.join('src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts'));
  assert.ok(html.includes("getMcpHubModalHtml()"), 'modal markup must be injected');
  assert.ok(html.includes('mcpHubCssUri'), 'modal css must be linked');
  assert.ok(html.includes('mcpHubModuleUri'), 'modal script must be loaded');
  assert.ok(html.includes("airFlutter.openMcpHubModal"), 'button must call openMcpHubModal');
});

check('panel has a visible MCP Hub button in the commands grid', () => {
  const html = readRepoFile(path.join('src', 'controllers', 'flutter-panel-controller', 'views', 'panelHtml.ts'));
  assert.ok(html.includes('data-command="mcpHubModal"'), 'a command button must exist');
  assert.ok(/cmd-label">MCP Hub</.test(html), 'the button must be labelled "MCP Hub"');
});

check('sidebar exposes an MCP Hub tool button wired to the command', () => {
  const sidebarHtml = readRepoFile(path.join('src', 'controllers', 'sidebar-controller', 'sidebarHtml.ts'));
  assert.ok(sidebarHtml.includes('id="toolMcpHub"'), 'sidebar must render the tool button');

  const sidebarJs = readRepoFile(path.join('media', 'sidebar.js'));
  assert.ok(sidebarJs.includes("['toolMcpHub', 'mcpHub']"), 'button must be wired to the mcpHub command');
  assert.ok(sidebarJs.includes('mcpHub:'), 'a busy label must exist for the tool');

  const sidebarController = readRepoFile(path.join('src', 'controllers', 'sidebar-controller', 'index.ts'));
  assert.ok(sidebarController.includes("case 'mcpHub'"), 'sidebar controller must handle the mcpHub message');
  assert.ok(
    sidebarController.includes("airFlutter.openMcpHub"),
    'sidebar handler must execute the MCP Hub command'
  );
});

check('every command the modal sends is handled by the extension host', () => {
  const modal = readRepoFile(path.join('media', 'modules', 'mcpHubModule.js'));
  const controller = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'FlutterPanelController.ts')
  );

  const sent = new Set<string>();
  const sendRe = /sendMessage\('([a-zA-Z]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = sendRe.exec(modal)) !== null) {
    sent.add(m[1]);
  }
  assert.ok(sent.size > 0, 'the modal should send at least one message');

  for (const command of sent) {
    assert.ok(
      controller.includes(`case '${command}'`),
      `the host does not handle the modal's "${command}" message`
    );
  }
});

check('every message the host posts is handled by the webview', () => {
  const handler = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'handlers', 'panelMcpHandler.ts')
  );
  const webview = readRepoFile(path.join('media', 'air-flutter.js'));

  const posted = new Set<string>();
  const postRe = /command: '([a-zA-Z]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = postRe.exec(handler)) !== null) {
    posted.add(m[1]);
  }
  assert.ok(posted.size > 0, 'the handler should post at least one message');

  for (const command of posted) {
    assert.ok(
      webview.includes(`case '${command}'`),
      `the webview does not handle the host's "${command}" message`
    );
  }
});

check('the modal module is registered as a mixin and initialised', () => {
  const webview = readRepoFile(path.join('media', 'air-flutter.js'));
  assert.ok(
    webview.includes('mixinModule(AirFlutterWebview, window.AirFlutterMcpModule)'),
    'the MCP module must be mixed into the webview class'
  );
  assert.ok(webview.includes('this.initMcpModal()'), 'the modal must be initialised on load');
});

check('modal stepper uses the existing is-completed class, not a new one', () => {
  const modal = readRepoFile(path.join('media', 'modules', 'mcpHubModule.js'));
  assert.ok(modal.includes("'is-completed'"), 'must use the shared stepper class');
  assert.ok(!modal.includes("'is-done'"), 'must not invent a new stepper class');
});

check('no duplicate command id is registered for the MCP hub', () => {
  const panelController = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'FlutterPanelController.ts')
  );
  const mcpModule = readRepoFile(path.join('src', 'mcp', 'index.ts'));

  const panelOwns = panelController.includes("registerCommand('airFlutter.openMcpHub'");
  const moduleOwns = mcpModule.includes("registerCommand('airFlutter.openMcpHub'");

  assert.ok(
    !(panelOwns && moduleOwns),
    'airFlutter.openMcpHub must be registered by exactly one owner'
  );
  assert.ok(panelOwns, 'the panel controller should own airFlutter.openMcpHub');
  assert.ok(
    mcpModule.includes("airFlutter.openMcpHubWizard"),
    'the QuickPick wizard should keep its own distinct command id'
  );
});

check('companion messages are handled end to end', () => {
  const controller = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'FlutterPanelController.ts')
  );
  const handler = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'handlers', 'panelMcpHandler.ts')
  );
  const webview = readRepoFile(path.join('media', 'air-flutter.js'));
  const modal = readRepoFile(path.join('media', 'modules', 'mcpHubModule.js'));

  // webview -> host
  for (const command of ['mcpCompanionStatus', 'mcpCompanionInstall', 'mcpCompanionGuideFile']) {
    assert.ok(
      modal.includes(`'${command}'`),
      `the modal should send ${command}`
    );
    assert.ok(
      controller.includes(`case '${command}'`),
      `the host must handle ${command}`
    );
  }

  // host -> webview
  for (const command of ['mcpCompanionStatus', 'mcpCompanionDone', 'mcpShowCompanionGuide']) {
    assert.ok(
      handler.includes(`command: '${command}'`),
      `the handler should post ${command}`
    );
    assert.ok(
      webview.includes(`case '${command}'`),
      `the webview must handle ${command}`
    );
  }
});

check('the companion guide modal exists with all its controls', () => {
  const html = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'views', 'modals', 'mcpHubModalHtml.ts')
  );
  for (const id of [
    'mcpCompanionGuide',
    'mcpGuideAddCmd',
    'mcpGuideSnippet',
    'mcpGuideSteps',
    'mcpGuideInstallBtn',
    'mcpGuideFileBtn',
    'closeMcpGuideBtn'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `the guide modal is missing #${id}`);
  }
});

check('the handler writes a Markdown setup guide', () => {
  const handler = readRepoFile(
    path.join('src', 'controllers', 'flutter-panel-controller', 'handlers', 'panelMcpHandler.ts')
  );
  assert.ok(handler.includes('buildCompanionGuideMarkdown'), 'a markdown builder must exist');
  assert.ok(handler.includes('.airflutter-'), 'the guide file must be namespaced');
});

check('the app-side package flow backs up main.dart before writing', () => {
  const companion = readRepoFile(path.join('src', 'mcp', 'companionPackage.ts'));
  assert.ok(
    companion.includes('airflutter-backup-'),
    'main.dart must be backed up before modification'
  );
  assert.ok(
    companion.includes("outcome: 'unsupported'"),
    'unrecognised main() files must be reported, not rewritten'
  );
});

check('no module defines a constructor (mixins never call it)', () => {
  // The webview mixes modules in by copying prototype methods only, so a
  // `constructor()` is dead code and any state initialised there is undefined
  // at runtime. This guard exists because the MCP module shipped that bug.
  const modulesDir = path.join(repoRoot, 'media', 'modules');
  const files = fs.readdirSync(modulesDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const source = fs.readFileSync(path.join(modulesDir, file), 'utf8');
    assert.ok(
      !/^\s{4}constructor\s*\(/m.test(source),
      `${file} defines a constructor(), which the mixin pattern never invokes — initialise state in initXxx() instead`
    );
  }
});

check('every module method referenced by air-flutter.js exists on a module', () => {
  // Guards the "button does nothing" bug: a host-message case called
  // `this.openMcpHub(...)` while the method lived on the host class instead of
  // a mixed-in module, so the call threw and the handler aborted silently.
  const webview = readRepoFile(path.join('media', 'air-flutter.js'));
  const modulesDir = path.join(repoRoot, 'media', 'modules');
  const moduleSource = fs
    .readdirSync(modulesDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(modulesDir, f), 'utf8'))
    .join('\n');

  // Collect `this.<name>(` calls inside handleMessage's MCP cases.
  const mcpCases = webview.match(/case 'mcp[A-Za-z]+':[\s\S]*?break;/g) ?? [];
  assert.ok(mcpCases.length > 0, 'expected MCP cases in handleMessage');

  for (const block of mcpCases) {
    const calls = [...block.matchAll(/this\.([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map((m) => m[1]);
    for (const name of calls) {
      const onModule = new RegExp(`^\\s{4}${name}\\s*\\(`, 'm').test(moduleSource);
      const onHostClass = new RegExp(`^\\s{4}${name}\\s*\\(`, 'm').test(webview);
      assert.ok(
        onModule || onHostClass,
        `handleMessage calls this.${name}() but it is defined nowhere`
      );
    }
  }
});

// =============================================================================
// 10. Companion package (app-side setup)
// =============================================================================
console.log('\n[10] Companion package');

const companion = findServerById('marionette-mcp')!.companionPackage!;

check('pubspec detection handles every dependency form', () => {
  assert.ok(isDependencyDeclared('dependencies:\n  marionette_flutter: ^0.7.0\n', 'marionette_flutter'), 'versioned');
  assert.ok(isDependencyDeclared('dependencies:\n  marionette_flutter:\n', 'marionette_flutter'), 'unversioned');
  assert.ok(!isDependencyDeclared('# marionette_flutter: ^0.7.0\n', 'marionette_flutter'), 'commented out');
  assert.ok(!isDependencyDeclared('  marionette_flutter_extra: ^1.0.0\n', 'marionette_flutter'), 'prefix collision');
});

check('runApp argument extraction survives nested parentheses', () => {
  assert.strictEqual(extractRunAppArgument('  runApp(const MyApp());'), 'const MyApp()');
  assert.strictEqual(
    extractRunAppArgument('  runApp(const MyApp(home: Home()));'),
    'const MyApp(home: Home())'
  );
  assert.strictEqual(extractRunAppArgument('  doSomething();'), undefined);
});

check('wiring the canonical main.dart produces the documented snippet', () => {
  const src = `import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n`;
  const result = wireMainDart(src, companion);

  assert.strictEqual(result.outcome, 'edited');
  const out = result.newContent!;
  assert.ok(out.includes('if (kDebugMode)'), 'must guard with kDebugMode');
  assert.ok(out.includes('MarionetteBinding.ensureInitialized();'), 'must init the binding');
  assert.ok(out.includes('WidgetsFlutterBinding.ensureInitialized();'), 'must keep the release branch');
  assert.ok(out.includes('runApp(const MyApp());'), 'must preserve the user runApp');
  assert.ok(out.includes(companion.requiredImport), 'must add the package import');
});

check('wiring is idempotent', () => {
  const src = `import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n`;
  const once = wireMainDart(src, companion).newContent!;
  const twice = wireMainDart(once, companion);
  assert.strictEqual(twice.outcome, 'already-configured');
});

check('a custom runApp target is preserved verbatim', () => {
  const src = `Future<void> main() async {\n  WidgetsFlutterBinding.ensureInitialized();\n  runApp(const MyApp(home: Home()));\n}\n`;
  const result = wireMainDart(src, companion);
  assert.strictEqual(result.outcome, 'edited');
  assert.ok(
    result.newContent!.includes('runApp(const MyApp(home: Home()));'),
    'the nested runApp argument must survive'
  );
});

check('an unrecognised main() is never mangled', () => {
  const noMain = wireMainDart(`import 'package:flutter/material.dart';\nclass X {}\n`, companion);
  assert.strictEqual(noMain.outcome, 'unsupported');
  assert.strictEqual(noMain.newContent, undefined, 'no content may be produced');

  const noRunApp = wireMainDart(`void main() {\n  boot();\n}\n`, companion);
  assert.strictEqual(noRunApp.outcome, 'unsupported');
});

check('imports are inserted after the last import, never duplicated', () => {
  const src = `import 'package:flutter/material.dart';\nimport 'dart:async';\n\nvoid main() {}\n`;
  const added = insertImport(src, companion.requiredImport);
  const lines = added.split('\n');
  assert.strictEqual(lines[2], companion.requiredImport, 'must land directly after the last import');
  assert.strictEqual(
    insertImport(added, companion.requiredImport),
    added,
    'inserting twice must be a no-op'
  );
});

// =============================================================================
settleChecks().then(() => {
  if (process.exitCode !== 1) {
    console.log(`\n🎉 All ${passed} MCP Hub tests passed successfully!`);
  }
});
