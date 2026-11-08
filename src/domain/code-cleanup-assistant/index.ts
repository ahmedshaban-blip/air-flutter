import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CommentBlockRange,
  CommentedCodeBlockDetector,
  DetectedCommentedCodeBlock,
  DetectorOptions
} from './commentedCodeDetector';

export {
  CommentBlockRange,
  CommentedCodeBlockDetector,
  DetectedCommentedCodeBlock,
  DetectorOptions
};

const IGNORED_DIRECTORIES = new Set([
  '.dart_tool', '.git', '.idea', '.vscode', 'build', 'coverage', 'ios/Pods', 'node_modules'
]);
const GENERATED_DART_SUFFIXES = ['.g.dart', '.freezed.dart', '.gr.dart', '.config.dart', '.mocks.dart'];
const REVIEW_DIAGNOSTICS = new Set([
  'dead_code', 'unused_catch_clause', 'unused_catch_stack', 'unused_element',
  'unused_field', 'unused_import', 'unused_label', 'unused_local_variable',
  'unused_result', 'unused_shown_name'
]);

export type CleanupFindingKind = 'dead-code' | 'unused-declaration' | 'commented-code';

export interface CodeCleanupFinding {
  kind: CleanupFindingKind;
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  length: number;
  endLine?: number;
  endColumn?: number;
  lineCount?: number;
  commentStyle?: 'single-line' | 'multi-line';
  rawText?: string;
  uncommentedText?: string;
  restoredCodeText?: string;
  confidenceScore?: number;
}

export interface UnusedDartFile {
  file: string;
  reason: string;
  safeToDelete: boolean;
}

export interface UnusedPackage {
  name: string;
  section: 'dependencies' | 'dev_dependencies';
  line: number;
}

export interface CodeCleanupReport {
  projectPath: string;
  findings: CodeCleanupFinding[];
  unusedFiles: UnusedDartFile[];
  unusedPackages: UnusedPackage[];
  analyzerError?: string;
}

interface DartSource {
  absolutePath: string;
  relativePath: string;
  content: string;
}

interface PubspecDependency {
  name: string;
  section: 'dependencies' | 'dev_dependencies';
  line: number;
}

export class CodeCleanupAssistant {
  public static async scan(
    projectPath: string,
    contentOverrides?: ReadonlyMap<string, string>
  ): Promise<CodeCleanupReport> {
    const root = await fs.promises.realpath(path.resolve(projectPath));
    const pubspecPath = path.join(root, 'pubspec.yaml');
    await fs.promises.access(pubspecPath);

    const dartSources = await this.readDartSources(root, contentOverrides);
    const productionSources = this.productionBuildSources(dartSources, root);
    const [analyzer, commentedFindings] = await Promise.all([
      this.runAnalyzer(root),
      this.findCommentedCode(productionSources, root)
    ]);
    const findings = [
      ...this.parseAnalyzerOutput(analyzer.output, root),
      ...this.findUnreferencedPublicFunctions(dartSources),
      ...commentedFindings
    ].sort(this.compareFindings);

    return {
      projectPath: root,
      findings,
      unusedFiles: this.findUnreachableFiles(dartSources, root),
      unusedPackages: await this.findUnusedPackages(pubspecPath, dartSources),
      analyzerError: analyzer.error
    };
  }

  public static async scanCommentedCodeBlocks(
    projectPath: string,
    contentOverrides?: ReadonlyMap<string, string>
  ): Promise<DetectedCommentedCodeBlock[]> {
    const root = await fs.promises.realpath(path.resolve(projectPath));
    const pubspecPath = path.join(root, 'pubspec.yaml');
    await fs.promises.access(pubspecPath);

    const dartSources = await this.readDartSources(root, contentOverrides);
    const productionSources = this.productionBuildSources(dartSources, root);
    return CommentedCodeBlockDetector.detectInFiles(productionSources, {
      projectPath: root,
      useDartAnalyzerFallback: true
    });
  }

  public static parseAnalyzerOutput(output: string, projectPath: string): CodeCleanupFinding[] {
    const findings: CodeCleanupFinding[] = [];
    for (const analyzerLine of output.split(/\r?\n/)) {
      const fields = this.machineFields(analyzerLine);
      if (fields.length < 8) continue;
      const code = fields[2].toLowerCase();
      if (!REVIEW_DIAGNOSTICS.has(code)) continue;
      const absoluteFile = path.resolve(fields[3]);
      if (!this.isInside(projectPath, absoluteFile)) continue;
      findings.push({
        kind: code === 'dead_code' ? 'dead-code' : 'unused-declaration',
        code,
        file: this.relativePath(projectPath, absoluteFile),
        line: Number(fields[4]) || 1,
        column: Number(fields[5]) || 1,
        length: Number(fields[6]) || 1,
        message: fields.slice(7).join('|')
      });
    }
    return findings;
  }

  private static machineFields(analyzerLine: string): string[] {
    const fields: string[] = [];
    let field = '';
    for (let index = 0; index < analyzerLine.length; index++) {
      const character = analyzerLine[index];
      if (character === '\\' && index + 1 < analyzerLine.length) {
        const escaped = analyzerLine[index + 1];
        field += escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped;
        index++;
      } else if (character === '|') {
        fields.push(field);
        field = '';
      } else {
        field += character;
      }
    }
    fields.push(field);
    return fields;
  }

  private static async readDartSources(
    projectPath: string,
    contentOverrides?: ReadonlyMap<string, string>
  ): Promise<DartSource[]> {
    const sources: DartSource[] = [];
    const visit = async (directory: string): Promise<void> => {
      if (!await this.exists(directory)) return;
      for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = this.relativePath(projectPath, absolutePath);
        if (entry.isDirectory() && !this.isIgnoredDirectory(relativePath)) {
          await visit(absolutePath);
        } else if (entry.isFile() && entry.name.endsWith('.dart')) {
          const override =
            contentOverrides?.get(relativePath) ??
            contentOverrides?.get(path.resolve(absolutePath));
          sources.push({
            absolutePath,
            relativePath,
            content: override !== undefined ? override : await fs.promises.readFile(absolutePath, 'utf8')
          });
        }
      }
    };
    await visit(projectPath);
    return sources.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  private static findUnreachableFiles(sources: DartSource[], projectPath: string): UnusedDartFile[] {
    const librarySources = sources.filter(source => source.relativePath.startsWith('lib/'));
    const reachable = this.reachableLibraryPaths(librarySources, projectPath);
    if (!reachable) return [];

    return librarySources
      .filter(source => !reachable.has(source.relativePath))
      .filter(source => !this.isGeneratedDartFile(source.relativePath))
      .map(source => ({
        file: source.relativePath,
        reason: 'Not reachable from any lib/main*.dart entry point.',
        safeToDelete: true
      }));
  }

  private static productionBuildSources(sources: DartSource[], projectPath: string): DartSource[] {
    const librarySources = sources.filter(source => source.relativePath.startsWith('lib/'));
    const reachable = this.reachableLibraryPaths(librarySources, projectPath);
    return librarySources.filter(source =>
      !this.isGeneratedDartFile(source.relativePath) && (!reachable || reachable.has(source.relativePath))
    );
  }

  private static reachableLibraryPaths(
    librarySources: DartSource[],
    projectPath: string
  ): Set<string> | undefined {
    const sourceByPath = new Map(librarySources.map(source => [source.relativePath, source]));
    const roots = librarySources
      .filter(source => /^lib\/main(?:_[^/]+)?\.dart$/.test(source.relativePath))
      .map(source => source.relativePath);
    if (roots.length === 0) return undefined;

    const reachable = new Set<string>();
    const pending = [...roots];
    while (pending.length > 0) {
      const currentPath = pending.pop() as string;
      if (reachable.has(currentPath)) continue;
      reachable.add(currentPath);
      const source = sourceByPath.get(currentPath);
      if (!source) continue;
      for (const dependency of this.dartDependencies(source, projectPath, sourceByPath)) {
        if (!reachable.has(dependency)) pending.push(dependency);
      }
    }
    return reachable;
  }

  private static dartDependencies(
    source: DartSource,
    projectPath: string,
    sourceByPath: Map<string, DartSource>
  ): string[] {
    const dependencies = new Set<string>();
    const projectName = this.projectName(projectPath);
    const directive = /\b(?:import|export|part)\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = directive.exec(source.content)) !== null) {
      const uri = match[1];
      let target: string | undefined;
      if (uri.startsWith('package:') && projectName && uri.startsWith(`package:${projectName}/`)) {
        target = `lib/${uri.slice(projectName.length + 9)}`;
      } else if (!uri.includes(':')) {
        target = this.relativePath(projectPath, path.resolve(path.dirname(source.absolutePath), uri));
      }
      if (target && sourceByPath.has(target)) dependencies.add(target);
    }
    return [...dependencies];
  }

  private static async findCommentedCode(
    sources: DartSource[],
    projectPath: string
  ): Promise<CodeCleanupFinding[]> {
    const blocks = await CommentedCodeBlockDetector.detectInFiles(sources, {
      projectPath,
      useDartAnalyzerFallback: true
    });
    return blocks.map(block => this.commentedCodeFindingFromBlock(block));
  }

  private static findUnreferencedPublicFunctions(sources: DartSource[]): CodeCleanupFinding[] {
    const combinedSource = sources.map(source => source.content).join('\n');
    const findings: CodeCleanupFinding[] = [];
    const declaration = /^(?:[A-Za-z_$][\w$<>,? ]*\s+)([a-zA-Z][\w$]*)\s*\([^;]*\)\s*(?:async\*?|sync\*)?\s*\{/;
    for (const source of sources) {
      const lines = source.content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const match = lines[index].match(declaration);
        if (!match || match[1] === 'main') continue;
        const references = combinedSource.match(new RegExp(`\\b${match[1]}\\b`, 'g')) || [];
        if (references.length !== 1) continue;
        findings.push({
          kind: 'unused-declaration',
          code: 'possibly_unused_public_function',
          message: 'No reference to this public top-level function was found. Review before removing it.',
          file: source.relativePath,
          line: index + 1,
          column: lines[index].indexOf(match[1]) + 1,
          length: match[1].length
        });
      }
    }
    return findings;
  }

  private static commentedCodeFindingFromBlock(block: DetectedCommentedCodeBlock): CodeCleanupFinding {
    return {
      kind: 'commented-code',
      code: 'commented_out_code',
      message: block.reason,
      file: block.file,
      line: block.startLine,
      column: block.startColumn,
      length: Math.max(2, block.rawText.length),
      endLine: block.endLine,
      endColumn: block.endColumn,
      lineCount: block.lineCount,
      commentStyle: block.commentStyle,
      rawText: block.rawText,
      uncommentedText: block.uncommentedText,
      restoredCodeText: block.restoredCodeText,
      confidenceScore: block.confidenceScore
    };
  }

  private static async findUnusedPackages(pubspecPath: string, sources: DartSource[]): Promise<UnusedPackage[]> {
    const pubspec = await fs.promises.readFile(pubspecPath, 'utf8');
    const dependencies = this.pubspecDependencies(pubspec);
    const importedPackages = new Set<string>();
    const importPattern = /\b(?:import|export)\s+['"]package:([^/'"]+)\//g;
    for (const source of sources) {
      let match: RegExpExecArray | null;
      while ((match = importPattern.exec(source.content)) !== null) importedPackages.add(match[1]);
    }
    return dependencies.filter(dependency => !importedPackages.has(dependency.name));
  }

  private static pubspecDependencies(pubspec: string): PubspecDependency[] {
    const dependencies: PubspecDependency[] = [];
    const lines = pubspec.split(/\r?\n/);
    let section: PubspecDependency['section'] | undefined;
    let sectionIndent = -1;
    for (let index = 0; index < lines.length; index++) {
      const sectionMatch = lines[index].match(/^(\s*)(dependencies|dev_dependencies)\s*:\s*(?:#.*)?$/);
      if (sectionMatch) {
        section = sectionMatch[2] as PubspecDependency['section'];
        sectionIndent = sectionMatch[1].length;
        continue;
      }
      if (!section || !lines[index].trim() || lines[index].trim().startsWith('#')) continue;
      const indent = lines[index].match(/^\s*/)?.[0].length ?? 0;
      if (indent <= sectionIndent) {
        section = undefined;
        continue;
      }
      const dependencyMatch = lines[index].match(/^(\s+)([a-zA-Z_][\w-]*)\s*:/);
      if (dependencyMatch && dependencyMatch[1].length === sectionIndent + 2 && !['flutter', 'flutter_test'].includes(dependencyMatch[2])) {
        dependencies.push({ name: dependencyMatch[2], section, line: index + 1 });
      }
    }
    return dependencies;
  }

  private static runAnalyzer(projectPath: string): Promise<{ output: string; error?: string }> {
    return new Promise(resolve => {
      execFile('dart', ['analyze', '--format=machine', projectPath], { cwd: projectPath, windowsHide: true, timeout: 120000 }, (error, stdout, stderr) => {
        const output = `${stdout || ''}\n${stderr || ''}`;
        if (error && !stdout && !stderr) {
          resolve({ output: '', error: `Dart Analyzer could not start: ${error.message}` });
          return;
        }
        const hasMachineDiagnostics = /^(?:INFO|WARNING|ERROR)\|/m.test(output);
        resolve({ output, error: error && !hasMachineDiagnostics ? output.trim() || error.message : undefined });
      });
    });
  }

  private static projectName(projectPath: string): string | undefined {
    try {
      const pubspec = fs.readFileSync(path.join(projectPath, 'pubspec.yaml'), 'utf8');
      return pubspec.match(/^name\s*:\s*([\w-]+)/m)?.[1];
    } catch {
      return undefined;
    }
  }

  private static compareFindings(left: CodeCleanupFinding, right: CodeCleanupFinding): number {
    return left.file.localeCompare(right.file) || left.line - right.line;
  }

  private static isGeneratedDartFile(relativePath: string): boolean {
    return GENERATED_DART_SUFFIXES.some(suffix => relativePath.endsWith(suffix));
  }

  private static isIgnoredDirectory(relativePath: string): boolean {
    return relativePath.split('/').some(part => IGNORED_DIRECTORIES.has(part)) || IGNORED_DIRECTORIES.has(relativePath);
  }

  private static relativePath(projectPath: string, absolutePath: string): string {
    return path.relative(projectPath, absolutePath).replace(/\\/g, '/');
  }

  private static isInside(projectPath: string, candidatePath: string): boolean {
    const relative = path.relative(path.resolve(projectPath), path.resolve(candidatePath));
    return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  private static async exists(candidatePath: string): Promise<boolean> {
    try {
      await fs.promises.access(candidatePath);
      return true;
    } catch {
      return false;
    }
  }
}
