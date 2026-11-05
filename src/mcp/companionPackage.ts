/**
 * Air Flutter - MCP & AI Agent Hub
 * Companion package installer.
 *
 * Some MCP servers only work when the user's own Flutter app cooperates. The
 * clearest example is Marionette: the app must depend on `marionette_flutter`
 * and initialise `MarionetteBinding` inside `main()`.
 *
 * This module:
 *   1. Detects whether the package is already a dependency of the workspace.
 *   2. Runs `flutter pub add <package>` in a visible terminal when it is not.
 *   3. Inspects `lib/main.dart` and, only with explicit confirmation, inserts
 *      the import and rewrites `main()` while preserving the user's own
 *      `runApp` call and any existing initialisation lines.
 *
 * It never rewrites `main.dart` blindly: an unrecognised `main()` is reported
 * to the user with the exact snippet to paste instead.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { McpCompanionPackage } from './types';

/** Outcome of checking whether a companion package is already present. */
export interface CompanionPackageStatus {
  packageName: string;
  /** True when the package already appears in pubspec.yaml. */
  installed: boolean;
  /** Absolute path to the project's pubspec.yaml, when found. */
  pubspecPath?: string;
  /** Absolute path to lib/main.dart, when found. */
  mainDartPath?: string;
}

/** Result of attempting to wire a `main.dart` file. */
export interface MainDartEditResult {
  /** How the edit resolved. */
  outcome: 'edited' | 'already-configured' | 'unsupported' | 'no-main' | 'declined';
  /** New file contents when an edit was produced. */
  newContent?: string;
  /** Human-readable explanation shown to the user. */
  message: string;
  /** Lines that could not be placed automatically, if any. */
  unplaced?: string[];
}

/** Locate pubspec.yaml and lib/main.dart for a workspace folder. */
export function inspectCompanionProject(
  workspaceRoot: string,
  pkg: McpCompanionPackage
): CompanionPackageStatus {
  const pubspecPath = path.join(workspaceRoot, 'pubspec.yaml');
  const mainDartPath = path.join(workspaceRoot, 'lib', 'main.dart');

  const pubspecExists = fs.existsSync(pubspecPath);
  const mainExists = fs.existsSync(mainDartPath);

  let installed = false;
  if (pubspecExists) {
    const contents = fs.readFileSync(pubspecPath, 'utf8');
    installed = isDependencyDeclared(contents, pkg.packageName);
  }

  return {
    packageName: pkg.packageName,
    installed,
    pubspecPath: pubspecExists ? pubspecPath : undefined,
    mainDartPath: mainExists ? mainDartPath : undefined
  };
}

/**
 * True when `packageName` is declared anywhere in pubspec.yaml.
 *
 * Matches both the modern form (`  marionette_flutter: ^0.7.0`) and the git /
 * path forms that omit a version, while ignoring commented-out lines.
 */
export function isDependencyDeclared(pubspecContents: string, packageName: string): boolean {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s{2,}${escaped}\\s*:`, 'm');
  const lines = pubspecContents.split(/\r?\n/);

  for (const line of lines) {
    if (/^\s*#/.test(line)) {
      continue; // commented out
    }
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Run `flutter pub add <package>` in a visible terminal so the user watches
 * the real resolver output rather than a silent background process.
 */
export async function addCompanionPackage(
  workspaceRoot: string,
  pkg: McpCompanionPackage
): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: `Air Flutter: pub add ${pkg.packageName}`,
    cwd: workspaceRoot
  });
  terminal.show(true);
  terminal.sendText(pkg.addCommand, true);
}

/**
 * Analyse `main.dart` and produce the wired version, or explain why it could
 * not be edited automatically.
 *
 * The transform is deliberately conservative:
 *  - already contains the binding call  → nothing to do
 *  - a simple `void main() { ... }`     → insert the import and replace the
 *    binding line, keeping the user's `runApp(...)` argument
 *  - anything more complex              → report 'unsupported' with the snippet
 */
export function wireMainDart(
  source: string,
  pkg: McpCompanionPackage
): MainDartEditResult {
  if (source.includes(pkg.bindingCall)) {
    return {
      outcome: 'already-configured',
      message: `main.dart already initialises ${pkg.bindingCall}.`
    };
  }

  const hasImport = source.includes(pkg.requiredImport);
  const mainMatch = findMainFunction(source);

  if (!mainMatch) {
    return {
      outcome: 'unsupported',
      message:
        'Could not locate a simple `void main()` in main.dart, so it was left untouched. Add the snippet manually.'
    };
  }

  const { start, end, body } = mainMatch;

  // Only handle a body we can reason about: it must call runApp with a single
  // argument we can preserve.
  const runAppArg = extractRunAppArgument(body);
  if (runAppArg === undefined) {
    return {
      outcome: 'unsupported',
      message:
        'main() does not contain a simple `runApp(...)` call, so it was left untouched. Add the snippet manually.'
    };
  }

  const newBody = buildMainBody(pkg, runAppArg);

  let updated = source.slice(0, start) + newBody + source.slice(end);

  if (!hasImport) {
    updated = insertImport(updated, pkg.requiredImport);
  }

  return {
    outcome: 'edited',
    newContent: updated,
    message: `Updated main.dart: added the ${pkg.packageName} import and initialised ${pkg.bindingCall} in debug mode.`
  };
}

/**
 * Extract the argument text of the first `runApp(...)` call in `body`.
 *
 * Uses balanced-parenthesis scanning rather than a naive character class,
 * because realistic arguments contain nested parentheses such as
 * `runApp(const MyApp(home: Home()))`.
 */
export function extractRunAppArgument(body: string): string | undefined {
  const callIndex = body.search(/\brunApp\s*\(/);
  if (callIndex === -1) {
    return undefined;
  }

  const openIndex = body.indexOf('(', callIndex);
  if (openIndex === -1) {
    return undefined;
  }

  let depth = 0;
  let inString: string | null = null;

  for (let i = openIndex; i < body.length; i++) {
    const char = body[i];

    if (inString) {
      if (char === '\\') {
        i++;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      inString = char;
      continue;
    }

    if (char === '(') depth++;
    if (char === ')') {
      depth--;
      if (depth === 0) {
        const arg = body.slice(openIndex + 1, i).trim();
        return arg.length > 0 ? arg : 'const MyApp()';
      }
    }
  }

  return undefined;
}

/**
 * Find the `main()` function and return the span of its full declaration
 * (signature through the closing brace), plus the body text.
 *
 * Understands `void main() {...}`, `Future<void> main() async {...}` and
 * `void main() => runApp(...);`.
 */
function findMainFunction(
  source: string
): { start: number; end: number; body: string } | undefined {
  const signature = /(?:Future\s*<void>|void)\s+main\s*\(\s*\)\s*(?:async\s*)?/g;
  const match = signature.exec(source);
  if (!match) {
    return undefined;
  }

  const start = match.index;
  let cursor = signature.lastIndex;

  // Skip whitespace to find what follows the signature.
  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor++;
  }

  // Arrow form: void main() => runApp(...);
  if (source.startsWith('=>', cursor)) {
    const semi = source.indexOf(';', cursor);
    if (semi === -1) {
      return undefined;
    }
    return {
      start,
      end: semi + 1,
      body: source.slice(cursor + 2, semi)
    };
  }

  // Block form: match the balanced braces.
  if (source[cursor] !== '{') {
    return undefined;
  }

  let depth = 0;
  let index = cursor;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index++;
      }
      continue;
    }
    if (inString) {
      if (char === '\\') {
        index++;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index++;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      index++;
      continue;
    }
    if (char === "'" || char === '"') {
      inString = char;
      continue;
    }

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return {
          start,
          end: index + 1,
          body: source.slice(cursor + 1, index)
        };
      }
    }
  }

  return undefined;
}

/** Build the replacement `main()` declaration. */
function buildMainBody(pkg: McpCompanionPackage, runAppArg: string): string {
  return `void main() {
  if (kDebugMode) {
    ${pkg.bindingCall};
  } else {
    WidgetsFlutterBinding.ensureInitialized();
  }
  runApp(${runAppArg});
}`;
}

/**
 * Insert an import after the last existing `import` line, preserving the
 * blank line that conventionally separates imports from declarations.
 * Falls back to the top of the file when there are no imports yet.
 */
export function insertImport(source: string, importLine: string): string {
  if (source.includes(importLine)) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  let lastImport = -1;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }

    if (/^import\s+['"]/.test(trimmed)) {
      lastImport = i;
    }
  }

  if (lastImport === -1) {
    // Place after any leading comment block, before the first declaration.
    let insertAt = 0;
    while (insertAt < lines.length && lines[insertAt].trim().startsWith('//')) {
      insertAt++;
    }
    lines.splice(insertAt, 0, importLine, '');
    return lines.join('\n');
  }

  lines.splice(lastImport + 1, 0, importLine);
  return lines.join('\n');
}

/** The `kDebugMode` import that the generated snippet depends on. */
export const FLUTTER_FOUNDATION_IMPORT =
  "import 'package:flutter/foundation.dart';";

/**
 * The snippet requires `kDebugMode`, which is declared in
 * `package:flutter/foundation.dart`.
 *
 * Verified against the Flutter SDK: `material.dart` re-exports `widgets.dart`,
 * and `widgets.dart` re-exports only `Brightness` and `UniqueKey` from
 * foundation — **not** `kDebugMode`. So `material.dart` alone is not enough
 * and the foundation import must be added whenever it is absent.
 *
 * Returns the imports still missing from `source`.
 */
export function requiredImports(source: string, pkg: McpCompanionPackage): string[] {
  const missing: string[] = [];

  if (!source.includes(pkg.requiredImport)) {
    missing.push(pkg.requiredImport);
  }
  if (!/package:flutter\/foundation\.dart/.test(source)) {
    missing.push(FLUTTER_FOUNDATION_IMPORT);
  }

  return missing;
}

/**
 * Apply the pending imports and the `main()` rewrite, then write the file.
 * Always backs the original up first.
 */
export async function applyMainDartEdit(
  mainDartPath: string,
  result: MainDartEditResult,
  pkg: McpCompanionPackage
): Promise<{ backupPath?: string }> {
  if (result.outcome !== 'edited' || !result.newContent) {
    return {};
  }

  const original = await fs.promises.readFile(mainDartPath, 'utf8');

  let content = result.newContent;
  for (const importLine of requiredImports(content, pkg)) {
    content = insertImport(content, importLine);
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const backupPath = `${mainDartPath}.airflutter-backup-${stamp}`;
  await fs.promises.copyFile(mainDartPath, backupPath);

  await fs.promises.writeFile(mainDartPath, content, 'utf8');

  void original;
  return { backupPath };
}
