import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PubPackageVersion {
  version: string;
}

export interface RawPubPackage {
  package: string;
  kind?: 'direct' | 'dev' | 'transitive';
  current?: PubPackageVersion;
  upgradable?: PubPackageVersion;
  resolvable?: PubPackageVersion;
  latest?: PubPackageVersion;
}

export interface PubHealthItem {
  name: string;
  kind: 'direct' | 'dev' | 'transitive';
  currentVersion: string;
  upgradableVersion: string;
  latestVersion: string;
  status: 'up_to_date' | 'upgradable' | 'major_update';
  parentPackages?: string[];
}

export interface PubHealthSummary {
  total: number;
  upToDateCount: number;
  upgradableCount: number;
  majorUpdateCount: number;
  packages: PubHealthItem[];
  checkedAt: string;
}

export interface PubspecDiagnostics {
  isPubspecError: boolean;
  filePath?: string;
  line?: number;
  column?: number;
  title: string;
  detail: string;
  suggestion: string;
  codeSnippet?: string;
}

export class PubspecSyntaxError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: PubspecDiagnostics
  ) {
    super(message);
    this.name = 'PubspecSyntaxError';
  }
}

export class PubHealthService {
  constructor(
    private readonly runProcess: (
      executable: string,
      args: string[],
      cwd: string,
      timeout?: number
    ) => Promise<{ stdout: string; stderr: string; errorMessage?: string }> = PubHealthService.executeProcess
  ) {}

  public static async executeProcess(
    executable: string,
    args: string[],
    cwd: string,
    timeout = 35000
  ): Promise<{ stdout: string; stderr: string; errorMessage?: string }> {
    const fullCmd = `${executable} ${args.join(' ')}`;
    return new Promise(resolve => {
      exec(fullCmd, { cwd, timeout, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          errorMessage: error ? error.message : undefined
        });
      });
    });
  }

  public async checkHealth(projectPath: string): Promise<PubHealthSummary> {
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      const folderName = projectPath ? path.basename(projectPath) : 'workspace';
      throw new Error(`The folder "${folderName}" is not a Flutter project (missing pubspec.yaml). Please select or open a Flutter project.`);
    }

    const res = await this.runProcess('flutter', ['pub', 'outdated', '--json'], projectPath, 45000);
    if (!res.stdout && (res.errorMessage || res.stderr)) {
      const fullError = `${res.stderr || ''}\n${res.errorMessage || ''}`.trim();
      const diagnostics = PubHealthService.parsePubspecError(fullError, projectPath);
      if (diagnostics) {
        throw new PubspecSyntaxError(
          `Syntax error in pubspec.yaml: ${diagnostics.detail}`,
          diagnostics
        );
      }
      throw new Error(`flutter pub outdated failed: ${res.errorMessage || res.stderr}`);
    }

    let parentMap: Map<string, string[]> | undefined;
    try {
      const depsRes = await this.runProcess('flutter', ['pub', 'deps', '--json'], projectPath, 25000);
      if (depsRes.stdout) {
        parentMap = PubHealthService.parsePubDepsJson(depsRes.stdout);
      }
    } catch {
      // Non-fatal if deps graph resolution fails
    }

    return PubHealthService.parsePubOutdatedJson(res.stdout, parentMap);
  }

  public async updatePackages(
    projectPath: string,
    packagesToUpdate: Array<{ name: string; version: string; isDev?: boolean }>
  ): Promise<{ success: boolean; output: string }> {
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      throw new Error('Invalid project path: missing pubspec.yaml');
    }
    if (!packagesToUpdate || packagesToUpdate.length === 0) {
      return { success: true, output: 'No packages selected for update.' };
    }

    const directPkgs = packagesToUpdate.filter(p => !p.isDev);
    const devPkgs = packagesToUpdate.filter(p => p.isDev);
    const outputs: string[] = [];

    if (directPkgs.length > 0) {
      const args = ['pub', 'add', ...directPkgs.map(p => `${p.name}:^${p.version.replace(/^\^/, '')}`)];
      const res = await this.runProcess('flutter', args, projectPath, 60000);
      outputs.push(res.stdout || res.stderr || res.errorMessage || '');
      if (res.errorMessage && !res.stdout) {
        throw new Error(`Failed to update dependencies: ${res.errorMessage || res.stderr}`);
      }
    }

    if (devPkgs.length > 0) {
      const args = ['pub', 'add', '--dev', ...devPkgs.map(p => `${p.name}:^${p.version.replace(/^\^/, '')}`)];
      const res = await this.runProcess('flutter', args, projectPath, 60000);
      outputs.push(res.stdout || res.stderr || res.errorMessage || '');
      if (res.errorMessage && !res.stdout) {
        throw new Error(`Failed to update dev_dependencies: ${res.errorMessage || res.stderr}`);
      }
    }

    return {
      success: true,
      output: outputs.join('\n')
    };
  }

  public async upgradeTransitivePackage(
    projectPath: string,
    packageName: string
  ): Promise<{ success: boolean; output: string }> {
    if (!projectPath || !fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      throw new Error('Invalid project path: missing pubspec.yaml');
    }
    const res = await this.runProcess('flutter', ['pub', 'upgrade', packageName], projectPath, 60000);
    if (res.errorMessage && !res.stdout) {
      throw new Error(`Failed to upgrade ${packageName}: ${res.errorMessage || res.stderr}`);
    }
    return {
      success: true,
      output: res.stdout || res.stderr || ''
    };
  }

  public static extractPubspecSnippet(filePath?: string, errorLine?: number): string | undefined {
    if (!filePath || !errorLine || !fs.existsSync(filePath)) return undefined;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const start = Math.max(0, errorLine - 4);
      const end = Math.min(lines.length, errorLine + 3);
      return lines.slice(start, end).map((l, idx) => {
        const lineNum = start + idx + 1;
        const marker = lineNum === errorLine ? ' > ' : '   ';
        return `${marker}${String(lineNum).padStart(4, ' ')} | ${l}`;
      }).join('\n');
    } catch {
      return undefined;
    }
  }

  public static parsePubspecError(rawError: string, projectPath?: string): PubspecDiagnostics | null {
    if (!rawError) return null;

    const lineColMatch =
      rawError.match(/Error on line (\d+), column (\d+) of pubspec\.yaml:\s*([^\n\r]+)/i) ||
      rawError.match(/pubspec\.yaml:(\d+):(\d+):\s*([^\n\r]+)/i);

    const fullPubspecPath = projectPath ? path.join(projectPath, 'pubspec.yaml') : undefined;

    if (lineColMatch) {
      const line = parseInt(lineColMatch[1], 10);
      const column = parseInt(lineColMatch[2], 10);
      const rawReason = (lineColMatch[3] || '').trim();

      let title = `Syntax Error in pubspec.yaml (Line ${line})`;
      let detail = rawReason;
      let suggestion = 'Check your pubspec.yaml indentation and structure.';

      if (/dependency may only have one source/i.test(rawReason)) {
        title = `Invalid Dependency Structure (Line ${line})`;
        detail = 'A dependency may only have one source. You have misplaced sections or keys nested under a package name.';
        suggestion = 'In Flutter, "assets:" must NOT be inside "dependencies:". It belongs under the root "flutter:" section. Also ensure packages like "flutter_localizations:" are aligned directly under "dependencies:" (2 spaces indentation).';
      } else if (/mapping values are not allowed/i.test(rawReason) || /expected <block end>/i.test(rawReason)) {
        title = `Indentation / Mapping Error (Line ${line})`;
        detail = 'Invalid YAML spacing, tab characters, or misplaced colons.';
        suggestion = 'YAML strictly requires spaces (never tabs). Ensure each nested level is indented with exactly 2 spaces.';
      }

      return {
        isPubspecError: true,
        filePath: fullPubspecPath,
        line,
        column,
        title,
        detail,
        suggestion,
        codeSnippet: PubHealthService.extractPubspecSnippet(fullPubspecPath, line)
      };
    }

    if (/pubspec\.yaml/i.test(rawError)) {
      return {
        isPubspecError: true,
        filePath: fullPubspecPath,
        title: 'Invalid pubspec.yaml',
        detail: rawError.replace(/Command failed:[^\n]+/, '').trim(),
        suggestion: 'Verify that pubspec.yaml is formatted properly according to Flutter YAML specifications.'
      };
    }

    return null;
  }

  public static parsePubDepsJson(raw: string): Map<string, string[]> {
    const parentMap = new Map<string, string[]>();
    if (!raw) return parentMap;

    let parsed: { packages?: Array<{ name: string; kind?: string; dependencies?: string[] }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      }
    }

    const packages = Array.isArray(parsed.packages) ? parsed.packages : [];
    for (const pkg of packages) {
      if (!pkg.name || pkg.kind === 'root') continue;
      const deps = Array.isArray(pkg.dependencies) ? pkg.dependencies : [];
      for (const dep of deps) {
        if (!parentMap.has(dep)) {
          parentMap.set(dep, []);
        }
        const parents = parentMap.get(dep)!;
        if (!parents.includes(pkg.name)) {
          // Put direct/dev parents first
          if (pkg.kind === 'direct' || pkg.kind === 'dev') {
            parents.unshift(pkg.name);
          } else {
            parents.push(pkg.name);
          }
        }
      }
    }
    return parentMap;
  }

  public static parsePubOutdatedJson(
    raw: string,
    parentMap?: Map<string, string[]> | Record<string, string[]>
  ): PubHealthSummary {
    let parsed: { packages?: RawPubPackage[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Find JSON block if there's leading noise
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      }
    }

    const rawPackages = Array.isArray(parsed.packages) ? parsed.packages : [];
    const packages: PubHealthItem[] = [];

    let upToDateCount = 0;
    let upgradableCount = 0;
    let majorUpdateCount = 0;

    for (const pkg of rawPackages) {
      const current = pkg.current?.version || 'none';
      const upgradable = pkg.upgradable?.version || current;
      const latest = pkg.latest?.version || upgradable;

      let status: PubHealthItem['status'] = 'up_to_date';
      if (current !== 'none' && current !== latest) {
        if (current !== upgradable) {
          status = 'upgradable';
          upgradableCount++;
        } else {
          status = 'major_update';
          majorUpdateCount++;
        }
      } else {
        upToDateCount++;
      }

      let parentPackages: string[] | undefined;
      if (pkg.kind === 'transitive' && parentMap) {
        if (parentMap instanceof Map) {
          parentPackages = parentMap.get(pkg.package);
        } else {
          parentPackages = parentMap[pkg.package];
        }
      }

      packages.push({
        name: pkg.package,
        kind: pkg.kind || 'direct',
        currentVersion: current,
        upgradableVersion: upgradable,
        latestVersion: latest,
        status,
        parentPackages
      });
    }

    return {
      total: packages.length,
      upToDateCount,
      upgradableCount,
      majorUpdateCount,
      packages,
      checkedAt: new Date().toISOString()
    };
  }
}

