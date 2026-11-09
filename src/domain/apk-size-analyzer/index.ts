import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export type FileCategory = 'native_lib' | 'dex_code' | 'assets' | 'resources' | 'other';

export interface ApkFileEntry {
  path: string;
  size: number;
  compressedSize: number;
  category: FileCategory;
  abi?: string;
}

export interface CategorySummary {
  category: FileCategory;
  label: string;
  size: number;
  percentage: number;
}

export interface AbiSummary {
  abi: string;
  size: number;
  percentage: number;
}

export interface ApkAnalysisReport {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  totalUncompressedBytes: number;
  categories: CategorySummary[];
  abis: AbiSummary[];
  topFiles: ApkFileEntry[];
  analyzedAt: string;
}

export class ApkSizeAnalyzerService {
  public static readonly CATEGORY_LABELS: Record<FileCategory, string> = {
    native_lib: 'Native C/C++ Libraries (lib/)',
    assets: 'Flutter Assets & Fonts (assets/)',
    dex_code: 'Compiled DEX Code (classes*.dex)',
    resources: 'Android Resources & Manifest',
    other: 'Other / Metadata'
  };

  public static categorizeEntry(entryPath: string): { category: FileCategory; abi?: string } {
    const normalized = entryPath.replace(/\\/g, '/');

    if (normalized.startsWith('lib/')) {
      const parts = normalized.split('/');
      const abi = parts.length > 1 ? parts[1] : undefined;
      return { category: 'native_lib', abi };
    }
    if (/classes\d*\.dex$/i.test(normalized)) {
      return { category: 'dex_code' };
    }
    if (normalized.startsWith('assets/')) {
      return { category: 'assets' };
    }
    if (normalized.startsWith('res/') || normalized === 'resources.arsc' || normalized === 'AndroidManifest.xml') {
      return { category: 'resources' };
    }
    return { category: 'other' };
  }

  public analyzeApkFile(apkPath: string): ApkAnalysisReport {
    if (!fs.existsSync(apkPath)) {
      throw new Error(`File not found: ${apkPath}`);
    }

    const stat = fs.statSync(apkPath);
    const zip = new AdmZip(apkPath);
    const entries = zip.getEntries();

    let totalUncompressed = 0;
    const categoryTotals: Record<FileCategory, number> = {
      native_lib: 0,
      assets: 0,
      dex_code: 0,
      resources: 0,
      other: 0
    };
    const abiTotals: Record<string, number> = {};
    const fileEntries: ApkFileEntry[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const size = entry.header.size || 0;
      const compressedSize = entry.header.compressedSize || 0;
      totalUncompressed += size;

      const { category, abi } = ApkSizeAnalyzerService.categorizeEntry(entry.entryName);
      categoryTotals[category] += size;

      if (abi) {
        abiTotals[abi] = (abiTotals[abi] || 0) + size;
      }

      fileEntries.push({
        path: entry.entryName,
        size,
        compressedSize,
        category,
        abi
      });
    }

    // Sort descending by uncompressed size
    fileEntries.sort((a, b) => b.size - a.size);

    const safeTotal = totalUncompressed || 1;
    const categories: CategorySummary[] = (Object.keys(categoryTotals) as FileCategory[]).map(cat => ({
      category: cat,
      label: ApkSizeAnalyzerService.CATEGORY_LABELS[cat],
      size: categoryTotals[cat],
      percentage: Number(((categoryTotals[cat] / safeTotal) * 100).toFixed(1))
    })).sort((a, b) => b.size - a.size);

    const abis: AbiSummary[] = Object.keys(abiTotals).map(abi => ({
      abi,
      size: abiTotals[abi],
      percentage: Number(((abiTotals[abi] / safeTotal) * 100).toFixed(1))
    })).sort((a, b) => b.size - a.size);

    return {
      filePath: apkPath,
      fileName: path.basename(apkPath),
      fileSizeBytes: stat.size,
      totalUncompressedBytes: totalUncompressed,
      categories,
      abis,
      topFiles: fileEntries.slice(0, 25),
      analyzedAt: new Date().toISOString()
    };
  }

  public static findDefaultApks(projectPath: string): string[] {
    const discovered = new Set<string>();

    const scanOutputsDir = (outputsDir: string) => {
      const standardCandidates = [
        path.join(outputsDir, 'flutter-apk', 'app-release.apk'),
        path.join(outputsDir, 'flutter-apk', 'app-debug.apk'),
        path.join(outputsDir, 'apk', 'release', 'app-release.apk'),
        path.join(outputsDir, 'apk', 'debug', 'app-debug.apk'),
        path.join(outputsDir, 'bundle', 'release', 'app-release.aab')
      ];
      for (const c of standardCandidates) {
        if (fs.existsSync(c)) {
          discovered.add(c);
        }
      }

      if (fs.existsSync(outputsDir)) {
        const scanDir = (dir: string, depth = 0) => {
          if (depth > 4) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(fullPath, depth + 1);
              } else if (entry.isFile() && (entry.name.endsWith('.apk') || entry.name.endsWith('.aab'))) {
                discovered.add(fullPath);
              }
            }
          } catch {
            // ignore directory reading errors
          }
        };
        scanDir(outputsDir);
      }
    };

    const directOutputs = path.join(projectPath, 'build', 'app', 'outputs');
    if (fs.existsSync(directOutputs)) {
      scanOutputsDir(directOutputs);
    }

    // Search nested directories (e.g. monorepo / subproject structures) for build/app/outputs
    if (fs.existsSync(projectPath)) {
      const searchNestedOutputs = (dir: string, depth = 0) => {
        if (depth > 3) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (['.git', 'node_modules', '.dart_tool', '.vscode', 'ios', 'windows', 'linux', 'macos', 'web'].includes(entry.name)) {
              continue;
            }
            const fullPath = path.join(dir, entry.name);
            const candidate = path.join(fullPath, 'build', 'app', 'outputs');
            if (fs.existsSync(candidate)) {
              scanOutputsDir(candidate);
            } else {
              searchNestedOutputs(fullPath, depth + 1);
            }
          }
        } catch {
          // ignore directory traversal errors
        }
      };
      searchNestedOutputs(projectPath);
    }

    return Array.from(discovered).sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });
  }
}

