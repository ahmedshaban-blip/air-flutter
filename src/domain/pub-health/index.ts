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
}

export interface PubHealthSummary {
  total: number;
  upToDateCount: number;
  upgradableCount: number;
  majorUpdateCount: number;
  packages: PubHealthItem[];
  checkedAt: string;
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
    if (!res.stdout && res.errorMessage) {
      throw new Error(`flutter pub outdated failed: ${res.errorMessage}`);
    }

    return PubHealthService.parsePubOutdatedJson(res.stdout);
  }

  public static parsePubOutdatedJson(raw: string): PubHealthSummary {
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

      packages.push({
        name: pkg.package,
        kind: pkg.kind || 'direct',
        currentVersion: current,
        upgradableVersion: upgradable,
        latestVersion: latest,
        status
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

