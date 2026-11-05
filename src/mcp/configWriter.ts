/**
 * Air Flutter - MCP & AI Agent Hub
 * Safe, non-destructive configuration file writer.
 *
 * Guarantees:
 *  - Never deletes or overwrites pre-existing keys in a user's config file.
 *  - Validates that an existing file parses before attempting a merge; if it
 *    does not parse, the file is backed up and the user is warned rather than
 *    silently corrupted.
 *  - Takes a timestamped backup next to the target on every modification.
 *  - Serializes JSON, YAML and TOML through the correct library.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { McpConfigTarget, McpTextTarget } from './types';

/** Thrown when an existing config file cannot be parsed safely. */
export class ConfigParseError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly format: McpConfigTarget['format'],
    cause: unknown
  ) {
    super(
      `Could not parse existing ${format.toUpperCase()} file at ${filePath}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    this.name = 'ConfigParseError';
  }
}

/** True when the value is a non-null, non-array plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/** True when the value is an array. */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Identity key used to dedupe array entries that carry a `name` field. */
function namedEntryKey(entry: unknown): string | undefined {
  if (isPlainObject(entry) && typeof entry.name === 'string') {
    return entry.name;
  }
  if (isPlainObject(entry) && typeof entry.id === 'string') {
    return entry.id;
  }
  return undefined;
}

/**
 * Merge two arrays without discarding user content.
 *
 * When both arrays hold objects carrying a `name`/`id`, entries are unioned by
 * that key with incoming entries winning, so a hand-written server entry
 * survives while a re-configured one is updated in place. For any other array
 * shape the incoming array replaces the existing one, matching the scalar
 * behaviour users expect when re-running the wizard.
 */
function mergeArrays(existing: unknown[], incoming: unknown[]): unknown[] {
  const allNamed = [
    ...existing,
    ...incoming
  ].every((entry) => namedEntryKey(entry) !== undefined);

  if (!allNamed) {
    return incoming;
  }

  const byKey = new Map<string, unknown>();
  for (const entry of existing) {
    const key = namedEntryKey(entry);
    if (key !== undefined) byKey.set(key, entry);
  }
  for (const entry of incoming) {
    const key = namedEntryKey(entry);
    if (key !== undefined) byKey.set(key, entry);
  }
  return Array.from(byKey.values());
}

/**
 * Recursively merge `source` into `target`, returning a new object.
 * Nested plain objects are merged key-by-key so unrelated user settings
 * survive, and arrays of named entries are unioned rather than replaced.
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const existing = output[key];

    if (isPlainObject(existing) && isPlainObject(sourceValue)) {
      output[key] = deepMerge(existing, sourceValue);
    } else if (isArray(existing) && isArray(sourceValue)) {
      output[key] = mergeArrays(existing, sourceValue);
    } else {
      // Scalar or type mismatch: the incoming value wins. This mirrors user
      // intent when re-running the wizard to update a server definition.
      output[key] = sourceValue;
    }
  }

  return output;
}

/** Parse a config file's contents into an object, or {} when empty/missing. */
export function parseConfig(
  contents: string,
  format: McpConfigTarget['format'],
  filePath: string
): Record<string, unknown> {
  const trimmed = contents.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    let parsed: unknown;

    switch (format) {
      case 'json':
        // Tolerate JSONC-ish files: strip // and /* */ comments plus trailing
        // commas, which VS Code config files occasionally contain.
        parsed = JSON.parse(stripJsonComments(trimmed));
        break;
      case 'yaml':
        parsed = yaml.load(trimmed);
        break;
      case 'toml':
        parsed = parseToml(trimmed);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    if (parsed === null || parsed === undefined) {
      return {};
    }
    if (!isPlainObject(parsed)) {
      throw new Error('Root of the configuration is not an object.');
    }
    return parsed;
  } catch (error) {
    throw new ConfigParseError(filePath, format, error);
  }
}

/**
 * Minimal comment/trailing-comma stripper for JSON-with-comments.
 * String-aware so it never touches comment-like sequences inside values.
 */
function stripJsonComments(input: string): string {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\') {
        result += next ?? '';
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    result += char;
  }

  // Remove trailing commas before } or ].
  return result.replace(/,(\s*[}\]])/g, '$1');
}

/** Serialize an object into the target format with a trailing newline. */
export function serializeConfig(
  value: Record<string, unknown>,
  format: McpConfigTarget['format']
): string {
  switch (format) {
    case 'json':
      return `${JSON.stringify(value, null, 2)}\n`;
    case 'yaml':
      return yaml.dump(value, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });
    case 'toml': {
      // smol-toml cannot represent undefined; strip such keys defensively.
      const clean = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
      return `${stringifyToml(clean)}\n`;
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/** Ensure the containing directory exists. */
async function ensureDirectory(filePath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

/**
 * Write a timestamped backup of an existing file immediately next to it.
 * Returns the backup path, or undefined when there was nothing to back up.
 */
export async function backupFile(filePath: string): Promise<string | undefined> {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const backupPath = `${filePath}.airflutter-backup-${stamp}`;

  await fs.promises.copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Whether to take a timestamped backup before modifying a config file.
 * Controlled by the `airFlutter.mcp.backupBeforeWrite` setting (default true).
 */
function shouldBackupBeforeWrite(): boolean {
  try {
    return vscode.workspace
      .getConfiguration('airFlutter')
      .get<boolean>('mcp.backupBeforeWrite', true);
  } catch {
    return true;
  }
}

/**
 * Read, deep-merge and write a configuration file.
 *
 * @returns the set of top-level keys that were newly added vs. updated,
 *          plus the backup path when one was created.
 * @throws  ConfigParseError when the existing file cannot be parsed.
 */
export async function mergeConfigFile(
  target: McpConfigTarget,
  payload: Record<string, unknown>
): Promise<{ added: string[]; updated: string[]; backupPath?: string }> {
  await ensureDirectory(target.path);

  const exists = fs.existsSync(target.path);
  const existingContents = exists
    ? await fs.promises.readFile(target.path, 'utf8')
    : '';

  const existingConfig = parseConfig(existingContents, target.format, target.path);

  const added: string[] = [];
  const updated: string[] = [];

  for (const key of Object.keys(payload)) {
    if (Object.prototype.hasOwnProperty.call(existingConfig, key)) {
      updated.push(key);
    } else {
      added.push(key);
    }
  }

  const merged = deepMerge(existingConfig, payload);
  const serialized = serializeConfig(merged, target.format);

  const backupPath = shouldBackupBeforeWrite()
    ? await backupFile(target.path)
    : undefined;
  await fs.promises.writeFile(target.path, serialized, 'utf8');

  return { added, updated, backupPath };
}

/** Write a generated code example or guide with the same backup guarantee. */
export async function writeTextArtifact(
  target: McpTextTarget,
  contents: string
): Promise<{ added: string[]; updated: string[]; backupPath?: string }> {
  await ensureDirectory(target.path);
  const exists = fs.existsSync(target.path);
  const backupPath = exists && shouldBackupBeforeWrite()
    ? await backupFile(target.path)
    : undefined;

  await fs.promises.writeFile(target.path, contents, 'utf8');
  return {
    added: exists ? [] : [path.basename(target.path)],
    updated: exists ? [path.basename(target.path)] : [],
    backupPath
  };
}
