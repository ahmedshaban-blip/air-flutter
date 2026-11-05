/**
 * Air Flutter - MCP & AI Agent Hub
 * Prerequisite verification engine.
 *
 * Probes the runtimes required by the selected servers before any file is
 * written, then renders an actionable install guide when something is missing.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import {
  McpRuntime,
  OsFamily,
  PrerequisiteDefinition,
  PrerequisiteReport,
  PrerequisiteResult
} from './types';

/** Detect the OS family in the shape used by install guidance. */
export function detectOsFamily(): OsFamily {
  switch (os.platform()) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}

/** Read the user's configured Flutter path, if any. */
function getConfiguredFlutterPath(): string | undefined {
  const configured = vscode.workspace
    .getConfiguration('airFlutter')
    .get<string>('flutterPath');
  return configured && configured.trim().length > 0 ? configured.trim() : undefined;
}

/** Read the user's configured ADB path, if any (used as a hint only). */
function getConfiguredAdbPath(): string | undefined {
  const configured = vscode.workspace
    .getConfiguration('airFlutter')
    .get<string>('adbPath');
  return configured && configured.trim().length > 0 ? configured.trim() : undefined;
}

/**
 * Every prerequisite the hub can require, keyed by the runtime that needs it.
 * `node` implies both `node` and `npx`; the node probe therefore checks npx.
 */
export const PREREQUISITES: Record<string, PrerequisiteDefinition> = {
  node: {
    id: 'node',
    name: 'Node.js & npx',
    probe: 'node',
    probeArgs: ['--version'],
    purpose:
      'Required by npm-based MCP servers (pub.dev, Firebase, Supabase, Figma, Sentry, GitHub and others).',
    downloadUrl: 'https://nodejs.org/en/download',
    installCommands: {
      windows: 'winget install OpenJS.NodeJS.LTS',
      macos: 'brew install node',
      linux: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs'
    },
    versionRegex: /v?(\d+\.\d+\.\d+)/
  },
  npx: {
    id: 'npx',
    name: 'npx (npm CLI)',
    probe: 'npx',
    probeArgs: ['--version'],
    purpose: 'Launches one-shot npm MCP packages without a global install.',
    downloadUrl: 'https://docs.npmjs.com/cli/v10/commands/npx',
    installCommands: {
      windows: 'npm install -g npm@latest',
      macos: 'npm install -g npm@latest',
      linux: 'sudo npm install -g npm@latest'
    },
    versionRegex: /(\d+\.\d+\.\d+)/
  },
  flutter: {
    id: 'flutter',
    name: 'Flutter SDK',
    probe: 'flutter',
    probeArgs: ['--version'],
    purpose: 'Provides the flutter CLI used by Flutter-aware MCP tooling.',
    downloadUrl: 'https://docs.flutter.dev/get-started/install',
    installCommands: {
      windows: 'winget install --id Google.Flutter',
      macos: 'brew install --cask flutter',
      linux: 'sudo snap install flutter --classic'
    },
    versionRegex: /Flutter\s+(\d+\.\d+\.\d+)/
  },
  dart: {
    id: 'dart',
    name: 'Dart SDK',
    probe: 'dart',
    probeArgs: ['--version'],
    purpose: 'Required by the official Dart & Flutter MCP server.',
    downloadUrl: 'https://dart.dev/get-dart',
    installCommands: {
      windows: 'winget install --id Google.DartSDK',
      macos: 'brew tap dart-lang/dart && brew install dart',
      linux: 'sudo apt-get update && sudo apt-get install -y dart'
    },
    versionRegex: /(\d+\.\d+\.\d+)/
  },
  python: {
    id: 'python',
    name: 'Python',
    probe: process.platform === 'win32' ? 'python' : 'python3',
    probeArgs: ['--version'],
    purpose: 'Runtime for Python-based MCP servers such as SQLite and Fetch.',
    downloadUrl: 'https://www.python.org/downloads/',
    installCommands: {
      windows: 'winget install Python.Python.3.12',
      macos: 'brew install python@3.12',
      linux: 'sudo apt-get install -y python3 python3-pip'
    },
    versionRegex: /Python\s+(\d+\.\d+\.\d+)/
  },
  uvx: {
    id: 'uvx',
    name: 'uv / uvx',
    probe: 'uvx',
    probeArgs: ['--version'],
    purpose: 'Fast Python MCP launcher used by SQLite and Fetch servers.',
    downloadUrl: 'https://docs.astral.sh/uv/getting-started/installation/',
    installCommands: {
      windows: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"',
      macos: 'brew install uv',
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
    },
    versionRegex: /(\d+\.\d+\.\d+)/
  },
  adb: {
    id: 'adb',
    name: 'Android Platform Tools (adb)',
    probe: 'adb',
    probeArgs: ['version'],
    purpose: 'Required by the Android ADB MCP server for device automation.',
    downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
    installCommands: {
      windows: 'winget install --id Google.PlatformTools',
      macos: 'brew install --cask android-platform-tools',
      linux: 'sudo apt-get install -y android-tools-adb'
    },
    versionRegex: /(\d+\.\d+\.\d+)/
  },
  git: {
    id: 'git',
    name: 'Git',
    probe: 'git',
    probeArgs: ['--version'],
    purpose: 'Required by Git-dependent MCP tooling (GitHub, GitLab).',
    downloadUrl: 'https://git-scm.com/downloads',
    installCommands: {
      windows: 'winget install --id Git.Git',
      macos: 'brew install git',
      linux: 'sudo apt-get install -y git'
    },
    versionRegex: /(\d+\.\d+\.\d+)/
  }
};

/**
 * Map a catalog runtime to the prerequisite ids it requires.
 * `node` deliberately pulls both node and npx so either is reported.
 */
export function prerequisitesForRuntime(runtime: McpRuntime): PrerequisiteDefinition[] {
  switch (runtime) {
    case 'node':
      return [PREREQUISITES.node, PREREQUISITES.npx];
    case 'python':
      return [PREREQUISITES.python, PREREQUISITES.uvx];
    case 'dart':
      return [PREREQUISITES.flutter, PREREQUISITES.dart];
    case 'binary':
      return [PREREQUISITES.adb];
    case 'remote':
    case 'docker':
    default:
      return [];
  }
}

/**
 * Run a single probe. Never throws: a failure simply means "not installed".
 */
async function probeOne(
  definition: PrerequisiteDefinition
): Promise<PrerequisiteResult> {
  const configuredOverride =
    definition.id === 'flutter'
      ? getConfiguredFlutterPath()
      : definition.id === 'adb'
        ? getConfiguredAdbPath()
        : undefined;

  const baseCommand = configuredOverride || definition.probe;

  // Resolve Windows shims (.bat/.cmd) up front so both the probe and the
  // reported path point at the real executable.
  const resolved = resolveWindowsExecutable(baseCommand);
  const command = resolved || baseCommand;

  try {
    const { stdout, stderr } = await execCapture(
      command,
      definition.probeArgs ?? [],
      15000
    );
    const combined = `${stdout}\n${stderr}`.trim();
    const match = definition.versionRegex?.exec(combined);

    return {
      definition,
      installed: true,
      version: match ? match[1] : combined.split('\n')[0].slice(0, 60),
      resolvedPath: resolved || configuredOverride
    };
  } catch {
    return { definition, installed: false };
  }
}

/**
 * Windows shim extensions, in the order the OS itself resolves them
 * (PATHEXT). `flutter`, `npx` and `dart` (on some installs) ship as
 * `.bat`/`.cmd` wrappers on Windows, so a bare `execFile('flutter')` would
 * fail with ENOENT even though the tool is correctly installed and on PATH.
 */
const WINDOWS_SHIM_EXTENSIONS = ['.cmd', '.bat', '.exe', '.ps1'];

/** True when the file name already carries an executable extension. */
function hasExecutableExtension(file: string): boolean {
  return /\.(exe|cmd|bat|ps1|com)$/i.test(file);
}

/**
 * Run a probe command with a hard timeout and a hidden window.
 *
 * Modern Node refuses to spawn `.bat`/`.cmd` files directly for security
 * reasons, so on Windows those shims must go through `cmd.exe`. To keep that
 * safe, only the shim name and the fixed catalog argument list are joined; no
 * user-supplied value reaches this function.
 */
function execCapture(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  const { execFile } = require('child_process') as typeof import('child_process');

  const isWindowsShim =
    process.platform === 'win32' && /\.(cmd|bat)$/i.test(file);

  return new Promise((resolve, reject) => {
    const handler = (
      error: Error | null,
      stdout: string,
      stderr: string
    ): void => {
      const hasOutput = Boolean((stdout && stdout.trim()) || (stderr && stderr.trim()));
      if (error && !hasOutput) {
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    };

    if (isWindowsShim) {
      // Hand cmd.exe the bare shim name (extension stripped) and let it
      // resolve through PATH. Passing a quoted absolute path here breaks
      // `.cmd` shims that re-invoke themselves with nested `if` blocks
      // (npm/npx), so the resolved path is deliberately not used.
      const bareName = path.basename(file).replace(/\.(cmd|bat)$/i, '');
      const line = [bareName, ...args].map(quoteForCmd).join(' ');

      execFile(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/c', line],
        { timeout: timeoutMs, windowsHide: true, shell: false },
        handler
      );
      return;
    }

    execFile(
      file,
      args,
      { timeout: timeoutMs, windowsHide: true, shell: false },
      handler
    );
  });
}

/** Quote a token for `cmd.exe`, doubling embedded quotes. */
function quoteForCmd(token: string): string {
  if (/^[A-Za-z0-9._:\\/-]+$/.test(token)) {
    return token;
  }
  // Always wrap, and escape internal quotes the way cmd.exe expects.
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * Resolve a bare executable name to a real file on Windows, trying the
 * PATHEXT shims explicitly. Returns undefined when nothing matches, in which
 * case the caller falls back to the raw command name (correct on POSIX and on
 * Windows when the shim is already on PATH as an `.exe`).
 */
function resolveWindowsExecutable(name: string): string | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  // Already an explicit path or has an extension: use it as-is when present.
  if (path.isAbsolute(name) || hasExecutableExtension(name)) {
    try {
      fs.accessSync(name, fs.constants.F_OK);
      return name;
    } catch {
      return undefined;
    }
  }

  const candidates: string[] = WINDOWS_SHIM_EXTENSIONS.map((ext) => `${name}${ext}`);
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);

  for (const dir of pathEntries) {
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      try {
        fs.accessSync(full, fs.constants.F_OK);
        return full;
      } catch {
        // keep looking
      }
    }
  }

  return undefined;
}

/**
 * Verify every prerequisite demanded by the given runtimes.
 * Results are de-duplicated and returned in first-seen order.
 */
export async function verifyPrerequisites(
  runtimes: McpRuntime[],
  onProgress?: (name: string) => void
): Promise<PrerequisiteReport> {
  const wanted = new Map<string, PrerequisiteDefinition>();

  for (const runtime of runtimes) {
    for (const def of prerequisitesForRuntime(runtime)) {
      if (!wanted.has(def.id)) {
        wanted.set(def.id, def);
      }
    }
  }

  const results: PrerequisiteResult[] = [];
  for (const def of wanted.values()) {
    onProgress?.(def.name);
    results.push(await probeOne(def));
  }

  const missing = results.filter((r) => !r.installed);

  return {
    os: detectOsFamily(),
    results,
    satisfied: missing.length === 0,
    missing
  };
}

/**
 * Render a copy-paste-ready install guide for the missing prerequisites.
 * Returns the plain-text report and the individual command lines so the
 * caller can attach actions to each.
 */
export function buildInstallGuide(report: PrerequisiteReport): {
  text: string;
  commands: Array<{ tool: string; command: string; url: string }>;
} {
  const osLabel =
    report.os === 'windows' ? 'Windows' : report.os === 'macos' ? 'macOS' : 'Linux';

  const lines: string[] = [
    'AIR FLUTTER - MISSING MCP PREREQUISITES',
    '='.repeat(46),
    `Detected OS: ${osLabel}`,
    '',
    'The following tools are required by the MCP servers you selected',
    'but were not found on your system:',
    ''
  ];

  const commands: Array<{ tool: string; command: string; url: string }> = [];

  for (const item of report.missing) {
    const command = item.definition.installCommands[report.os];
    commands.push({
      tool: item.definition.name,
      command,
      url: item.definition.downloadUrl
    });

    lines.push(`  [ MISSING ] ${item.definition.name}`);
    lines.push(`      Why:      ${item.definition.purpose}`);
    lines.push(`      Install:  ${command}`);
    lines.push(`      Docs:     ${item.definition.downloadUrl}`);
    lines.push('');
  }

  lines.push('-'.repeat(46));
  lines.push('After installing, restart VS Code so PATH changes are picked up,');
  lines.push('then re-run: Air Flutter: MCP & AI Agent Hub');

  return { text: lines.join('\n'), commands };
}

/** Short one-line status used in the checklist UI. */
export function formatPrerequisiteLine(result: PrerequisiteResult): string {
  if (result.installed) {
    const version = result.version ? ` (${result.version})` : '';
    return `$(check) ${result.definition.name}${version}`;
  }
  return `$(error) ${result.definition.name} — not found`;
}
