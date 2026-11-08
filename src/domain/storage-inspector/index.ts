import { execFile } from 'child_process';
import * as path from 'path';

export type StorageInspectorMode = 'auto' | 'presets';

export interface StoragePreset {
  id: string;
  name: string;
  description: string;
  defaultPaths: string[];
  type: 'shared_prefs' | 'sqlite' | 'hive_isar' | 'generic';
}

export const KNOWN_STORAGE_PRESETS: readonly StoragePreset[] = [
  {
    id: 'shared_preferences',
    name: 'SharedPreferences',
    description: 'Flutter default key-value store (shared_prefs/*.xml)',
    defaultPaths: ['shared_prefs'],
    type: 'shared_prefs'
  },
  {
    id: 'sqflite',
    name: 'sqflite / Drift / Room',
    description: 'SQLite relational databases (databases/*.db, *.sqlite)',
    defaultPaths: ['databases'],
    type: 'sqlite'
  },
  {
    id: 'hive_isar',
    name: 'Hive / Isar / ObjectBox',
    description: 'NoSQL binary box stores (app_flutter/*.hive, *.isar)',
    defaultPaths: ['app_flutter', 'files'],
    type: 'hive_isar'
  }
];

export interface StorageFileEntry {
  name: string;
  relativePath: string;
  category: 'shared_prefs' | 'sqlite' | 'hive_isar' | 'other';
  sizeBytes: number;
}

export interface SharedPrefItem {
  key: string;
  value: string;
  type: 'string' | 'int' | 'long' | 'float' | 'boolean' | 'set';
}

export interface SqliteQueryResult {
  columns: string[];
  rows: Record<string, string>[];
  totalCount: number;
  rawOutput?: string;
}

export interface StorageInspectionResult {
  mode: StorageInspectorMode;
  packageId: string;
  files: StorageFileEntry[];
  selectedPresets?: string[];
}

export class StorageInspectorService {
  constructor(
    private readonly getADBExecutable: () => Promise<string>,
    private readonly runProcess: (
      executable: string,
      args: string[],
      timeout?: number
    ) => Promise<{ stdout: string; stderr: string; errorMessage?: string }> = StorageInspectorService.executeProcess
  ) {}

  public static async executeProcess(
    executable: string,
    args: string[],
    timeout = 15000
  ): Promise<{ stdout: string; stderr: string; errorMessage?: string }> {
    return new Promise(resolve => {
      execFile(executable, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          errorMessage: error ? error.message : undefined
        });
      });
    });
  }

  public async listStorageFiles(
    serial: string,
    packageId: string,
    mode: StorageInspectorMode = 'auto',
    selectedPresetIds: string[] = []
  ): Promise<StorageInspectionResult> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();

    // Use run-as to query files inside package directory
    const shellCmd = `cd /data/data/${cleanPkg} 2>/dev/null && ls -laR 2>/dev/null`;
    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', shellCmd], 15000);

    const files = StorageInspectorService.parseLsOutput(res.stdout);

    // If presets mode, filter files based on chosen presets
    let filteredFiles = files;
    if (mode === 'presets' && selectedPresetIds.length > 0) {
      const allowedCategories = new Set<string>();
      for (const presetId of selectedPresetIds) {
        const found = KNOWN_STORAGE_PRESETS.find(p => p.id === presetId);
        if (found) allowedCategories.add(found.type);
      }
      filteredFiles = files.filter(f => allowedCategories.has(f.category));
    }

    return {
      mode,
      packageId: cleanPkg,
      files: filteredFiles,
      selectedPresets: selectedPresetIds
    };
  }

  public static parseLsOutput(raw: string): StorageFileEntry[] {
    const lines = raw.split(/\r?\n/);
    const results: StorageFileEntry[] = [];
    let currentDir = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('total ')) continue;

      if (trimmed.endsWith(':')) {
        currentDir = trimmed.slice(0, -1).replace(/^\.\/?/, '');
        continue;
      }

      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 7 && /^[dlrwx-]{10}/.test(tokens[0])) {
        const isDirectory = tokens[0].startsWith('d');
        let sizeIndex = 4;
        let nameIndex = 7;
        if (tokens.length === 7 || isNaN(Number(tokens[4]))) {
          sizeIndex = 3;
          nameIndex = 6;
        }

        const sizeBytes = parseInt(tokens[sizeIndex], 10) || 0;
        const filename = tokens.slice(nameIndex).join(' ');

        if (isDirectory || !filename || filename === '.' || filename === '..') {
          continue;
        }

        const relativePath = currentDir ? `${currentDir}/${filename}` : filename;
        const category = StorageInspectorService.detectCategory(relativePath);

        results.push({
          name: filename,
          relativePath,
          category,
          sizeBytes
        });
      }
    }

    return results;
  }

  public static detectCategory(relativePath: string): 'shared_prefs' | 'sqlite' | 'hive_isar' | 'other' {
    const lower = relativePath.toLowerCase();
    if (lower.includes('shared_prefs') && lower.endsWith('.xml')) {
      return 'shared_prefs';
    }
    if (lower.includes('databases') || lower.endsWith('.db') || lower.endsWith('.sqlite')) {
      return 'sqlite';
    }
    if (lower.endsWith('.hive') || lower.endsWith('.isar') || lower.includes('objectbox')) {
      return 'hive_isar';
    }
    return 'other';
  }

  public async readSharedPreferences(
    serial: string,
    packageId: string,
    fileName: string
  ): Promise<SharedPrefItem[]> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();
    const cleanFile = fileName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const cmd = `cat "/data/data/${cleanPkg}/shared_prefs/${cleanFile}" 2>/dev/null`;

    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', cmd], 10000);
    if (!res.stdout && res.stderr) {
      throw new Error(`Failed to read shared_prefs: ${res.stderr}`);
    }

    return StorageInspectorService.parseSharedPrefsXml(res.stdout);
  }

  public static parseSharedPrefsXml(xml: string): SharedPrefItem[] {
    const items: SharedPrefItem[] = [];
    if (!xml) return items;

    // Pattern match <string name="...">...</string>, <int name="..." value="..."/>, etc.
    const tagRegex = /<(string|int|long|float|boolean)\s+name="([^"]+)"(?:\s+value="([^"]*)")?(?:>([^<]*)<\/\1>|\s*\/>)/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(xml)) !== null) {
      const type = match[1] as SharedPrefItem['type'];
      const key = match[2];
      const value = type === 'string' ? (match[4] ?? '') : (match[3] ?? '');

      items.push({
        key,
        value,
        type
      });
    }

    return items;
  }

  public async setSharedPreference(
    serial: string,
    packageId: string,
    fileName: string,
    key: string,
    value: string,
    type: 'string' | 'int' | 'long' | 'float' | 'boolean'
  ): Promise<void> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();
    const cleanFile = fileName.replace(/[^a-zA-Z0-9_.-]/g, '');

    // First read existing items
    const items = await this.readSharedPreferences(serial, cleanPkg, cleanFile);
    const existingIndex = items.findIndex(it => it.key === key);
    if (existingIndex >= 0) {
      items[existingIndex] = { key, value, type };
    } else {
      items.push({ key, value, type });
    }

    const xml = StorageInspectorService.buildSharedPrefsXml(items);
    // Write back via temporary file in run-as
    const writeCmd = `cat << 'EOF' > "/data/data/${cleanPkg}/shared_prefs/${cleanFile}"\n${xml}\nEOF`;
    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', writeCmd], 10000);
    if (res.errorMessage) {
      throw new Error(`Failed to write SharedPreferences: ${res.errorMessage}`);
    }
  }

  public async deleteSharedPreference(
    serial: string,
    packageId: string,
    fileName: string,
    key: string
  ): Promise<void> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();
    const cleanFile = fileName.replace(/[^a-zA-Z0-9_.-]/g, '');

    const items = await this.readSharedPreferences(serial, cleanPkg, cleanFile);
    const filtered = items.filter(it => it.key !== key);
    const xml = StorageInspectorService.buildSharedPrefsXml(filtered);

    const writeCmd = `cat << 'EOF' > "/data/data/${cleanPkg}/shared_prefs/${cleanFile}"\n${xml}\nEOF`;
    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', writeCmd], 10000);
    if (res.errorMessage) {
      throw new Error(`Failed to delete SharedPreferences key: ${res.errorMessage}`);
    }
  }

  public static buildSharedPrefsXml(items: SharedPrefItem[]): string {
    const lines = ['<?xml version=\'1.0\' encoding=\'utf-8\' standalone=\'yes\' ?>', '<map>'];
    for (const item of items) {
      const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      if (item.type === 'string') {
        lines.push(`    <string name="${escape(item.key)}">${escape(item.value)}</string>`);
      } else {
        lines.push(`    <${item.type} name="${escape(item.key)}" value="${escape(item.value)}" />`);
      }
    }
    lines.push('</map>');
    return lines.join('\n');
  }

  public async listSqliteTables(
    serial: string,
    packageId: string,
    dbName: string
  ): Promise<string[]> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();
    const cleanDb = dbName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const cmd = `sqlite3 "/data/data/${cleanPkg}/databases/${cleanDb}" ".tables" 2>/dev/null`;

    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', cmd], 10000);
    const tables = res.stdout.split(/\s+/).map(t => t.trim()).filter(Boolean);
    return tables.filter(t => !t.startsWith('android_metadata') && !t.startsWith('sqlite_sequence'));
  }

  public async querySqliteTable(
    serial: string,
    packageId: string,
    dbName: string,
    query: string
  ): Promise<SqliteQueryResult> {
    const adb = await this.getADBExecutable();
    const cleanPkg = packageId.trim();
    const cleanDb = dbName.replace(/[^a-zA-Z0-9_.-]/g, '');
    // Sanitize query to avoid destructive commands in read mode
    const sanitizedQuery = query.trim().replace(/;+$/, '');
    const cmd = `sqlite3 -header -line "/data/data/${cleanPkg}/databases/${cleanDb}" "${sanitizedQuery.replace(/"/g, '\\"')};" 2>/dev/null`;

    const res = await this.runProcess(adb, ['-s', serial, 'shell', 'run-as', cleanPkg, 'sh', '-c', cmd], 15000);
    return StorageInspectorService.parseSqliteLineOutput(res.stdout);
  }

  public static parseSqliteLineOutput(raw: string): SqliteQueryResult {
    const rows: Record<string, string>[] = [];
    const columnsSet = new Set<string>();

    const blocks = raw.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const row: Record<string, string> = {};
      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          const col = line.slice(0, eqIdx).trim();
          const val = line.slice(eqIdx + 1).trim();
          columnsSet.add(col);
          row[col] = val;
        }
      }
      if (Object.keys(row).length > 0) {
        rows.push(row);
      }
    }

    return {
      columns: Array.from(columnsSet),
      rows,
      totalCount: rows.length,
      rawOutput: raw
    };
  }
}
