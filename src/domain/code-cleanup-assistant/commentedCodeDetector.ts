import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface CommentBlockRange {
  /** Zero-based start line index (compatible with vscode.Range) */
  startLine: number;
  /** Zero-based start character index */
  startCharacter: number;
  /** Zero-based end line index (compatible with vscode.Range) */
  endLine: number;
  /** Zero-based end character index */
  endCharacter: number;
}

export interface DetectedCommentedCodeBlock {
  /** Relative path within workspace/project */
  file: string;
  /** 1-based start line */
  startLine: number;
  /** 1-based end line (inclusive) */
  endLine: number;
  /** 1-based start column */
  startColumn: number;
  /** 1-based end column */
  endColumn: number;
  /** Zero-based range metadata matching vscode.Range */
  range: CommentBlockRange;
  /** Comment syntax style */
  commentStyle: 'single-line' | 'multi-line';
  /** Exact raw lines from the document */
  rawText: string;
  /** Uncommented text with common leading indentation stripped (for inspection/preview) */
  uncommentedText: string;
  /** Uncommented text preserving the original document indentation (for safe Uncomment action) */
  restoredCodeText: string;
  /** Number of lines in this block */
  lineCount: number;
  /** Heuristic + structural confidence score (0.0 - 1.0) */
  confidenceScore: number;
  /** Human-readable reason summarizing why this block was classified as commented-out code */
  reason: string;
}

export interface DetectorOptions {
  /** Enable batched `dart analyze` syntax verification for borderline candidates (default: true) */
  useDartAnalyzerFallback?: boolean;
  /** Optional workspace root path for running `dart analyze` */
  projectPath?: string;
  /** Chunk size (number of files) before yielding to the event loop on large scans */
  asyncChunkSize?: number;
}

interface RawCommentLine {
  zeroBasedLine: number;
  rawLine: string;
  indentBeforeMarker: string;
  markerColumn: number;
  innerText: string;
  isBlankGap?: boolean;
}

interface CandidateBlock {
  file: string;
  commentStyle: 'single-line' | 'multi-line';
  startLineZero: number;
  endLineZero: number;
  startCharZero: number;
  endCharZero: number;
  rawText: string;
  uncommentedText: string;
  restoredCodeText: string;
  lineCount: number;
  confidenceScore: number;
  reason: string;
  needsAnalyzerVerification: boolean;
}

const PROTECTED_COMMENT_PATTERNS: RegExp[] = [
  // Analyzer & formatter directives
  /^ignore\s*:/i,
  /^ignore_for_file\s*:/i,
  /^dart\s+format\s+(?:off|on)\b/i,
  /^coverage\s*:\s*ignore-(?:line|start|end|file)\b/i,
  // Task annotations
  /^(?:TODO|FIXME|NOTE|HACK|XXX|BUG)\b/i,
  // Section dividers / headers
  /^[=\-*#~_]{3,}/,
  /^[-=*]{2,}\s*[\w\s]+\s*[-=*]{2,}$/,
  /^MARK\s*:/i,
  // License & copyright headers
  /^(?:Copyright\s+\(c\)|SPDX-License-Identifier:|Licensed\s+under\b|All\s+rights\s+reserved\b)/i,
  // Pure URLs or file references
  /^https?:\/\/\S+$/i,
  /^see\s+https?:\/\/\S+/i
];

const DART_KEYWORDS = new Set([
  'abstract', 'as', 'assert', 'async', 'await', 'base', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'covariant', 'default', 'deferred', 'do', 'dynamic',
  'else', 'enum', 'export', 'extends', 'extension', 'external', 'factory', 'false',
  'final', 'finally', 'for', 'Function', 'get', 'hide', 'if', 'implements', 'import',
  'in', 'interface', 'is', 'late', 'library', 'mixin', 'new', 'null', 'on', 'operator',
  'part', 'required', 'rethrow', 'return', 'sealed', 'set', 'show', 'static', 'super',
  'switch', 'sync', 'this', 'throw', 'true', 'try', 'typedef', 'var', 'void', 'when',
  'while', 'with', 'yield'
]);

const HIGH_CONFIDENCE_SINGLE_PATTERNS: RegExp[] = [
  // Directives
  /^(?:import|export)\s+['"][^'"]+['"](?:\s+(?:as|show|hide)\s+[\w$,\s]+)?\s*;$/,
  /^part\s+(?:of\s+[\w.]+|['"][^'"]+['"])\s*;$/,
  // Type declarations
  /^(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+|mixin\s+)*(?:class|enum|mixin|extension|typedef)\s+[A-Za-z_$][\w$]*/,
  // Variable declarations with initialization
  /^(?:(?:final|const|var|late(?:\s+final)?)\s+)(?:[A-Za-z_$][\w$<>,? ]*\s+)?[A-Za-z_$][\w$]*\s*(?:=|\?\?=)\s*.+;$/,
  /^[A-Za-z_$][\w$]*(?:<[\w$<>,? ]+>)?\??\s+[A-Za-z_$][\w$]*\s*(?:=|\?\?=)\s*.+;$/,
  // Uninitialized typed/keyword declarations (at least 1 keyword + 1 identifier, max 1 type + 1 name)
  /^(?:final|const|var|late(?:\s+final)?)\s+(?:[A-Za-z_$][\w$<>,?]*\s+)?[A-Za-z_$][\w$]*\s*;$/,
  // Function / method declarations
  /^(?:@[A-Za-z_$][\w$.]*\s+)*(?:static\s+|Future(?:<[^>]+>)?\s+|Stream(?:<[^>]+>)?\s+|Widget\s+|State<[^>]+>\s+|void\s+|bool\s+|int\s+|double\s+|String\s+|num\s+|dynamic\s+|[A-Z][\w$]*(?:<[^>]+>)?\??\s+)?[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*(?:async\*?|sync\*)?\s*(?:\{[\s\S]*\}|=>\s*[\s\S]+;|;)$/,
  // Return / throw / control jumps
  /^(?:return(?:\s+[^;]+)?|throw\s+[^;]+|rethrow|break(?:\s+[A-Za-z_$][\w$]*)?|continue(?:\s+[A-Za-z_$][\w$]*)?)\s*;$/,
  // Function / method calls ending with ;
  /^(?:await\s+)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:<[^>]+>)?\s*\([\s\S]*\)\s*;$/,
  // Assignments ending with ;
  /^[A-Za-z_$][\w$.[\]]*\s*(?:=|\+=|-=|\*=|\/=|~\/=|%=|\?\?=|\|=|&=|\^=)\s*[^;=]+;$/,
  // Increment / decrement statements
  /^(?:\+\+|--)?[A-Za-z_$][\w$.[\]]*(?:\+\+|--)\s*;$/,
  // Flutter Widget constructor or named parameter entry ending with , or ;
  /^(?:const\s+|new\s+)?[A-Z][\w$.]*(?:<[^>]+>)?\s*\([\s\S]*\)\s*[,;]$/,
  /^[a-z_$][\w$]*\s*:\s*(?:const\s+)?[A-Za-z_$0-9'"([\]{}][\s\S]*[,;]$/
];

const SYNTAX_ERROR_CODES = new Set([
  'expected_token',
  'missing_identifier',
  'expected_executable',
  'expected_class_member',
  'expected_type_name',
  'expected_string_literal',
  'unexpected_token',
  'unterminated_string_literal',
  'unterminated_multi_line_comment',
  'invalid_operator',
  'missing_function_body',
  'missing_method_parameters',
  'var_and_type',
  'extraneous_modifier',
  'synthetic_token'
]);

export class CommentedCodeBlockDetector {
  /**
   * Synchronous 3-stage detection for a single Dart file's content.
   */
  public static detectInSource(
    content: string,
    relativeFile = 'unknown.dart'
  ): DetectedCommentedCodeBlock[] {
    const candidates = this.collectCandidatesInSource(content, relativeFile);
    return candidates
      .filter(candidate => !candidate.needsAnalyzerVerification)
      .map(candidate => this.toDetectedBlock(candidate));
  }

  /**
   * Asynchronous 3-stage detection across multiple Dart files with event-loop chunking
   * and optional batched `dart analyze` verification for borderline candidates.
   */
  public static async detectInFiles(
    files: ReadonlyArray<{ relativePath: string; content: string }>,
    options: DetectorOptions = {}
  ): Promise<DetectedCommentedCodeBlock[]> {
    const chunkSize = Math.max(1, options.asyncChunkSize ?? 25);
    const allCandidates: CandidateBlock[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileCandidates = this.collectCandidatesInSource(file.content, file.relativePath);
      allCandidates.push(...fileCandidates);

      if ((i + 1) % chunkSize === 0) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    }

    const borderline = allCandidates.filter(c => c.needsAnalyzerVerification);
    if (borderline.length > 0 && (options.useDartAnalyzerFallback ?? true)) {
      const verifiedIndices = await this.verifyBorderlineWithDartAnalyzer(
        borderline,
        options.projectPath
      );
      return allCandidates
        .filter(c => !c.needsAnalyzerVerification || verifiedIndices.has(c))
        .map(c => this.toDetectedBlock(c));
    }

    return allCandidates
      .filter(c => !c.needsAnalyzerVerification)
      .map(c => this.toDetectedBlock(c));
  }

  // ============================================================================
  // STAGE 1: Contiguous Block Aggregation & Mixed-Block Sub-Partitioning
  // ============================================================================

  private static collectCandidatesInSource(
    content: string,
    relativeFile: string
  ): CandidateBlock[] {
    const lines = content.split(/\r?\n/);
    const candidates: CandidateBlock[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      // 1. Check for full-line single-line comment `//` (excluding `///` dartdoc)
      const singleMatch = line.match(/^(\s*)\/\/(?!\/)\s?(.*)$/);
      if (singleMatch) {
        const rawRun: RawCommentLine[] = [];
        while (index < lines.length) {
          const currentLine = lines[index];
          const m = currentLine.match(/^(\s*)\/\/(?!\/)\s?(.*)$/);
          if (m) {
            const indent = m[1];
            const inner = m[2];

            // Do not merge across drastically unrelated indentation contexts unless inner text is indented or closing
            if (rawRun.length > 0 && !this.sharesIndentationContext(rawRun[0], indent, inner)) {
              break;
            }

            rawRun.push({
              zeroBasedLine: index,
              rawLine: currentLine,
              indentBeforeMarker: indent,
              markerColumn: indent.length,
              innerText: inner,
              isBlankGap: false
            });
            index++;
            continue;
          }

          // Tolerate one or more empty/whitespace-only lines inside a commented code run
          // if followed by another `//` line in the same indentation context.
          if (currentLine.trim().length === 0) {
            let lookahead = index + 1;
            while (lookahead < lines.length && lines[lookahead].trim().length === 0) {
              lookahead++;
            }
            if (lookahead < lines.length) {
              const nextMatch = lines[lookahead].match(/^(\s*)\/\/(?!\/)\s?(.*)$/);
              if (
                nextMatch &&
                rawRun.length > 0 &&
                this.sharesIndentationContext(rawRun[0], nextMatch[1], nextMatch[2])
              ) {
                while (index < lookahead) {
                  rawRun.push({
                    zeroBasedLine: index,
                    rawLine: lines[index],
                    indentBeforeMarker: rawRun[0].indentBeforeMarker,
                    markerColumn: rawRun[0].markerColumn,
                    innerText: '',
                    isBlankGap: true
                  });
                  index++;
                }
                continue;
              }
            }
          }

          break;
        }

        const partitioned = this.partitionSingleLineRun(rawRun, relativeFile);
        candidates.push(...partitioned);
        continue;
      }

      // 2. Check for multi-line block comment `/* ... */` (excluding `/**` dartdoc)
      const blockStartMatch = line.match(/^(\s*)\/\*(?!\*)(.*)$/);
      if (blockStartMatch) {
        const startLineZero = index;
        const startIndent = blockStartMatch[1];
        const rawBlockLines: string[] = [line];
        const innerLines: string[] = [];

        let firstLineRemainder = blockStartMatch[2];
        let closedOnFirstLine = false;
        const closeIdx = firstLineRemainder.indexOf('*/');
        if (closeIdx !== -1) {
          firstLineRemainder = firstLineRemainder.slice(0, closeIdx);
          closedOnFirstLine = true;
        }
        innerLines.push(firstLineRemainder);

        if (!closedOnFirstLine) {
          while (index + 1 < lines.length) {
            index++;
            rawBlockLines.push(lines[index]);
            const endMarkerIdx = lines[index].indexOf('*/');
            if (endMarkerIdx !== -1) {
              innerLines.push(lines[index].slice(0, endMarkerIdx).replace(/^\s*\*\s?/, ''));
              break;
            } else {
              innerLines.push(lines[index].replace(/^\s*\*\s?/, ''));
            }
          }
        }

        const endLineZero = index;
        const candidate = this.evaluateMultiLineBlock(
          relativeFile,
          startLineZero,
          endLineZero,
          startIndent.length,
          lines[endLineZero].length,
          rawBlockLines,
          innerLines,
          startIndent
        );
        if (candidate) {
          candidates.push(candidate);
        }
      }

      index++;
    }

    return candidates;
  }

  private static sharesIndentationContext(
    firstLine: RawCommentLine,
    currentIndent: string,
    currentInner: string
  ): boolean {
    const firstCols = firstLine.indentBeforeMarker.replace(/\t/g, '  ').length;
    const currentCols = currentIndent.replace(/\t/g, '  ').length;
    // Standard IDE comment toggle puts `//` at the exact same column, or indents `//` for nested lines
    if (currentCols >= firstCols) return true;
    // Allow outdent if closing a block `}` / `)` / `]` or `else` / `catch` / `finally`
    const trimmed = currentInner.trim();
    if (/^[})\]]|^(?:else|catch|finally)\b/.test(trimmed)) return true;
    return Math.abs(currentCols - firstCols) <= 2;
  }

  /**
   * Splits a contiguous run of `//` lines on protected comments (TODO, ignore:, dividers)
   * and peels off leading/trailing natural-language prose lines so mixed blocks
   * (e.g. `// Old implementation:` followed by commented code) isolate only the code lines.
   */
  private static partitionSingleLineRun(
    run: RawCommentLine[],
    relativeFile: string
  ): CandidateBlock[] {
    // Step 1: Split on hard-excluded protected lines (directives, TODOs, section headers)
    const segments: RawCommentLine[][] = [];
    let currentSegment: RawCommentLine[] = [];

    for (const item of run) {
      const trimmed = item.innerText.trim();
      if (this.isProtectedCommentLine(trimmed)) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        continue;
      }
      currentSegment.push(item);
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    // Step 2: Within each segment, peel off leading and trailing natural-language prose lines
    // and split if an internal prose header separates distinct code blocks.
    const results: CandidateBlock[] = [];
    for (const segment of segments) {
      const subBlocks = this.extractCodeSubBlocks(segment);
      for (const sub of subBlocks) {
        const evaluated = this.evaluateSingleLineSubBlock(relativeFile, sub);
        if (evaluated) {
          results.push(evaluated);
        } else {
          // If the full subBlock is unbalanced (e.g. a commented class is missing its final closing `}`),
          // split on blank gaps and evaluate balanced sub-chunks so valid sections are still detected.
          const chunks = this.splitOnBlankGaps(sub);
          if (chunks.length > 1) {
            for (const chunk of this.mergeBalancedAdjacentChunks(chunks)) {
              const chunkEvaluated = this.evaluateSingleLineSubBlock(relativeFile, chunk);
              if (chunkEvaluated) {
                results.push(chunkEvaluated);
              }
            }
          }
        }
      }
    }

    return results;
  }

  private static extractCodeSubBlocks(segment: RawCommentLine[]): RawCommentLine[][] {
    const subBlocks: RawCommentLine[][] = [];
    let current: RawCommentLine[] = [];

    for (let i = 0; i < segment.length; i++) {
      const line = segment[i];
      const trimmed = line.innerText.trim();

      if (!trimmed) {
        if (current.length > 0) {
          current.push(line);
        }
        continue;
      }

      if (this.isClearlyNaturalLanguageLine(trimmed)) {
        if (current.length > 0) {
          this.trimEmptyEdges(current);
          if (current.length > 0) subBlocks.push(current);
          current = [];
        }
        continue;
      }

      current.push(line);
    }

    if (current.length > 0) {
      this.trimEmptyEdges(current);
      if (current.length > 0) subBlocks.push(current);
    }

    return subBlocks;
  }

  private static trimEmptyEdges(lines: RawCommentLine[]): void {
    while (lines.length > 0 && !lines[0].innerText.trim()) {
      lines.shift();
    }
    while (lines.length > 0 && !lines[lines.length - 1].innerText.trim()) {
      lines.pop();
    }
  }

  private static splitOnBlankGaps(lines: RawCommentLine[]): RawCommentLine[][] {
    const chunks: RawCommentLine[][] = [];
    let current: RawCommentLine[] = [];
    for (const line of lines) {
      if (line.isBlankGap) {
        this.trimEmptyEdges(current);
        if (current.length > 0) {
          chunks.push(current);
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    this.trimEmptyEdges(current);
    if (current.length > 0) {
      chunks.push(current);
    }
    return chunks;
  }

  /**
   * Attempts to greedily combine consecutive chunks (including the blank gap lines between them)
   * into the largest balanced code blocks possible, falling back to individual chunks when a chunk
   * has an unclosed outer brace (e.g. a commented-out class missing its final `}`).
   */
  private static mergeBalancedAdjacentChunks(chunks: RawCommentLine[][]): RawCommentLine[][] {
    const merged: RawCommentLine[][] = [];
    let i = 0;
    while (i < chunks.length) {
      let bestEnd = -1;
      for (let j = chunks.length - 1; j >= i; j--) {
        const candidateLines = chunks.slice(i, j + 1).flatMap(c => c);
        const text = candidateLines.map(l => l.innerText).join('\n');
        if (this.areDelimitersBalanced(text)) {
          bestEnd = j;
          break;
        }
      }
      if (bestEnd > i) {
        // Reconstruct with blank gap lines included between chunks[i]..chunks[bestEnd]
        const combined: RawCommentLine[] = [];
        for (let k = i; k <= bestEnd; k++) {
          if (k > i) {
            const prevLast = chunks[k - 1][chunks[k - 1].length - 1];
            const nextFirst = chunks[k][0];
            for (let z = prevLast.zeroBasedLine + 1; z < nextFirst.zeroBasedLine; z++) {
              combined.push({
                zeroBasedLine: z,
                rawLine: '',
                indentBeforeMarker: prevLast.indentBeforeMarker,
                markerColumn: prevLast.markerColumn,
                innerText: '',
                isBlankGap: true
              });
            }
          }
          combined.push(...chunks[k]);
        }
        merged.push(combined);
        i = bestEnd + 1;
      } else {
        merged.push(chunks[i]);
        i++;
      }
    }
    return merged;
  }

  // ============================================================================
  // STAGE 2: Fast Heuristic Pre-Filtering & Code Probability Scoring
  // ============================================================================

  public static isProtectedCommentLine(trimmedText: string): boolean {
    if (!trimmedText) return false;
    // Dartdoc triple slash (if passed directly)
    if (trimmedText.startsWith('/')) return true;
    return PROTECTED_COMMENT_PATTERNS.some(pattern => pattern.test(trimmedText));
  }

  /**
   * Detects natural-language prose lines (English, Arabic, or general documentation sentences)
   * even when they begin with words that happen to be Dart keywords (`final`, `return`, `if`).
   */
  public static isClearlyNaturalLanguageLine(trimmedText: string): boolean {
    if (!trimmedText) return true;
    if (this.isProtectedCommentLine(trimmedText)) return true;

    // Strip string literals first so Arabic/English text inside quotes `'مرحبا'` doesn't trigger prose rejection
    const withoutStrings = this.stripStringLiterals(trimmedText);

    // Non-ASCII letters (e.g., Arabic, Cyrillic, CJK) outside of string literals => natural language comment
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF\u4E00-\u9FFF]/.test(withoutStrings)) {
      return true;
    }

    // Prose header ending with a colon (e.g. `// Old implementation:` or `// Note:`)
    // Distinguished from Dart named parameter on its own line (`child:`, `children:`) which is a single lowercase identifier
    if (
      /^(?:[A-Za-z][A-Za-z0-9,'-]*\s+[A-Za-z0-9\s,'-]*|[A-Z][A-Za-z0-9_-]*):\s*$/.test(trimmedText) &&
      !/^(?:default|case\s+\S+)\s*:$/.test(trimmedText)
    ) {
      return true;
    }

    // Sentence ending with period `.`, exclamation `!`, or question mark `?` (not `?.` or `??`)
    if (/[.!?]$/.test(trimmedText) && !/\.\.\.$/.test(trimmedText)) {
      return true;
    }

    // Check for 3+ consecutive plain words separated by whitespace outside of string literals
    if (this.hasNaturalLanguageWordRun(withoutStrings)) {
      // Don't reject if the line is clearly a Dart declaration or statement
      const isDeclaration = /^(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+|mixin\s+)*(?:class|enum|mixin|extension|typedef)\s+[A-Za-z_$][\w$]*/.test(trimmedText);
      if (!isDeclaration) {
        return true;
      }
    }

    // Pure words and spaces with no code punctuation at all (allow standalone block keywords `else`, `try`, `do`, `finally`)
    if (!/[;{}()[\]=<>:,+*/&|^!~?@]/.test(trimmedText) && !/^(?:else|try|do|finally)$/.test(trimmedText)) {
      return true;
    }

    return false;
  }

  /**
   * Returns true if `textWithoutStrings` contains a natural-language phrase
   * (e.g. `value is cached to make`, `the device disconnects`, `Keep this explanatory note`).
   */
  private static hasNaturalLanguageWordRun(textWithoutStrings: string): boolean {
    const declarationModifiers = new Set([
      'abstract', 'base', 'final', 'interface', 'sealed', 'mixin', 'class', 'enum',
      'extension', 'typedef', 'static', 'late', 'const', 'var', 'external', 'covariant',
      'required', 'void', 'async', 'sync', 'part', 'of', 'import', 'export', 'as', 'show', 'hide',
      'extends', 'implements', 'with'
    ]);

    // Find runs of space-separated alphabetic words
    const wordRunRegex = /\b[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*){2,}\b/g;
    let match: RegExpExecArray | null;
    while ((match = wordRunRegex.exec(textWithoutStrings)) !== null) {
      const words = match[0].split(/\s+/);
      if (words.length >= 4) {
        // Allow Dart type declarations (`class Foo extends Bar`, `class Foo with Mixin implements Baz`)
        if (words.some(w => ['class', 'enum', 'mixin', 'extension', 'typedef'].includes(w))) {
          continue;
        }
        const modifierCount = words.filter(w => declarationModifiers.has(w)).length;
        if (modifierCount < words.length - 1) {
          return true;
        }
      }
      if (words.length === 3) {
        // In valid Dart, a 3-word run must start with a modifier/keyword (`late final int`, `final String name`, `return await foo` - wait `foo` is followed by `(`)
        const firstIsModifier = declarationModifiers.has(words[0]);
        const secondIsModifier = declarationModifiers.has(words[1]);
        if (!firstIsModifier && !secondIsModifier) {
          return true;
        }
        // Even if `words[0]` is `final` or `return` (e.g. `final value is`, `return the active`),
        // in Dart `final Type name` has `words[1]` as a Type/modifier and `words[2]` followed by `=`, `;`, `in`, etc.
        // If any of the 2nd or 3rd words is a common English stopword (`the`, `a`, `an`, `to`, `by`, `from`, `with`, `without`, `that`, `this`, `these`, `those`, `what`, `when`, `where`, `which`, `who`, `for`, `is`, `are`, `was`, `were`, `be`, `been`), it's prose!
        const proseStopWords = new Set([
          'the', 'a', 'an', 'to', 'by', 'from', 'without', 'that', 'these', 'those',
          'what', 'where', 'which', 'who', 'is', 'are', 'was', 'were', 'be', 'been',
          'has', 'have', 'had', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
          'must', 'into', 'onto', 'upon', 'about', 'above', 'below', 'between', 'among',
          'through', 'during', 'before', 'after', 'under', 'over', 'again', 'further',
          'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
          'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
          'so', 'than', 'too', 'very', 'just', 'because', 'until', 'while', 'of', 'at'
        ]);
        if (proseStopWords.has(words[1].toLowerCase()) || proseStopWords.has(words[2].toLowerCase())) {
          return true;
        }
      }
    }
    return false;
  }

  private static evaluateSingleLineSubBlock(
    relativeFile: string,
    lines: RawCommentLine[]
  ): CandidateBlock | undefined {
    const normalizedLines = this.stripCommonIndentation(lines.map(l => l.innerText));
    const uncommentedText = normalizedLines.join('\n').trim();
    if (!uncommentedText) return undefined;

    // Stage 2: Score & fast exclusion
    const { score, reason, highConfidencePattern } = this.scoreCodeBlock(normalizedLines, uncommentedText);
    if (score < 0.45) return undefined;

    // Stage 3: Structural & syntactic validation
    const structural = this.validateStructure(normalizedLines, uncommentedText);
    if (!structural.valid) return undefined;

    const first = lines[0];
    const last = lines[lines.length - 1];
    const rawText = lines.map(l => l.rawLine).join('\n');
    const restoredCodeText = lines
      .map((l, idx) => (l.isBlankGap || !normalizedLines[idx].trim() ? '' : `${l.indentBeforeMarker}${normalizedLines[idx]}`))
      .join('\n');

    const finalScore = Math.min(1, Number((score + structural.bonus).toFixed(2)));
    const needsAnalyzerVerification = !highConfidencePattern && finalScore < 0.72;

    return {
      file: relativeFile,
      commentStyle: 'single-line',
      startLineZero: first.zeroBasedLine,
      endLineZero: last.zeroBasedLine,
      startCharZero: first.markerColumn,
      endCharZero: last.rawLine.length,
      rawText,
      uncommentedText,
      restoredCodeText,
      lineCount: lines.length,
      confidenceScore: finalScore,
      reason,
      needsAnalyzerVerification
    };
  }

  private static evaluateMultiLineBlock(
    relativeFile: string,
    startLineZero: number,
    endLineZero: number,
    startCharZero: number,
    endCharZero: number,
    rawBlockLines: string[],
    innerLines: string[],
    baseIndent: string
  ): CandidateBlock | undefined {
    const normalizedLines = this.stripCommonIndentation(innerLines);
    const uncommentedText = normalizedLines.join('\n').trim();
    if (!uncommentedText) return undefined;

    // Check if any line in the block is a protected comment or natural language prose
    const nonEmptyLines = normalizedLines.map(l => l.trim()).filter(Boolean);
    if (nonEmptyLines.length === 0) return undefined;
    if (nonEmptyLines.some(l => this.isProtectedCommentLine(l) || this.isClearlyNaturalLanguageLine(l))) {
      return undefined;
    }

    const { score, reason, highConfidencePattern } = this.scoreCodeBlock(normalizedLines, uncommentedText);
    if (score < 0.45) return undefined;

    const structural = this.validateStructure(normalizedLines, uncommentedText);
    if (!structural.valid) return undefined;

    const restoredCodeText = normalizedLines
      .map(l => (l.trim().length > 0 ? `${baseIndent}${l}` : ''))
      .join('\n');
    const finalScore = Math.min(1, Number((score + structural.bonus).toFixed(2)));

    return {
      file: relativeFile,
      commentStyle: 'multi-line',
      startLineZero,
      endLineZero,
      startCharZero,
      endCharZero,
      rawText: rawBlockLines.join('\n'),
      uncommentedText,
      restoredCodeText,
      lineCount: endLineZero - startLineZero + 1,
      confidenceScore: finalScore,
      reason,
      needsAnalyzerVerification: !highConfidencePattern && finalScore < 0.72
    };
  }

  private static scoreCodeBlock(
    lines: string[],
    uncommentedText: string
  ): { score: number; reason: string; highConfidencePattern: boolean } {
    const singleLineCollapsed = lines
      .map(l => l.trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    if (this.isProtectedCommentLine(singleLineCollapsed) || this.isClearlyNaturalLanguageLine(singleLineCollapsed)) {
      return { score: 0, reason: 'Excluded natural language or directive', highConfidencePattern: false };
    }

    let score = 0;
    const reasons: string[] = [];
    let highConfidencePattern = false;

    // 1. Check direct high-confidence Dart/Flutter statement patterns
    if (HIGH_CONFIDENCE_SINGLE_PATTERNS.some(pattern => pattern.test(singleLineCollapsed))) {
      score += 0.65;
      highConfidencePattern = true;
      reasons.push('Dart statement syntax');
    }

    // 2. Flutter widget constructor & named parameter indicators
    const hasWidgetConstructor = /\b(?:const\s+)?[A-Z][A-Za-z0-9_]*(?:<[^>]+>)?\s*\(/.test(uncommentedText);
    const hasNamedParam = /\b(?:child|children|onPressed|onTap|onChanged|builder|padding|margin|style|color|decoration|controller|key|body|appBar|title|leading|actions|mainAxisAlignment|crossAxisAlignment)\s*:/.test(uncommentedText);
    const hasSetState = /\bsetState\s*\(\s*\(\s*\)\s*(?:\{|=>)/.test(uncommentedText);

    if (hasWidgetConstructor) {
      score += 0.35;
      reasons.push('Flutter widget constructor');
    }
    if (hasNamedParam) {
      score += 0.35;
      highConfidencePattern = true;
      reasons.push('Flutter named parameter');
    }
    if (hasSetState) {
      score += 0.45;
      highConfidencePattern = true;
      reasons.push('Flutter setState block');
    }

    // 3. Dart lexical keywords
    const tokens = this.stripStringLiterals(uncommentedText).match(/\b[A-Za-z_$][\w$]*\b/g) || [];
    const keywordMatches = tokens.filter(t => DART_KEYWORDS.has(t));
    if (keywordMatches.length > 0) {
      score += Math.min(0.3, keywordMatches.length * 0.12);
      if (reasons.length === 0) reasons.push(`Dart keyword (${keywordMatches[0]})`);
    }

    // 4. Code symbol density (`;`, `{`, `}`, `(`, `)`, `[`, `]`, `=>`, `=`, `:`)
    const symbolMatches = uncommentedText.match(/[;{}()[\]=:,]|=>/g) || [];
    if (symbolMatches.length >= 2) {
      score += Math.min(0.25, symbolMatches.length * 0.05);
    }

    const summaryReason =
      reasons.length > 0
        ? `Commented-out ${reasons.slice(0, 2).join(' + ')} (${lines.length} ${lines.length === 1 ? 'line' : 'lines'})`
        : `This comment looks like disabled Dart code (${lines.length} ${lines.length === 1 ? 'line' : 'lines'}).`;

    return { score, reason: summaryReason, highConfidencePattern };
  }

  // ============================================================================
  // STAGE 3: Structural & Syntactic Validation
  // ============================================================================

  private static validateStructure(
    lines: string[],
    uncommentedText: string
  ): { valid: boolean; bonus: number } {
    // 1. Verify balanced parentheses `()`, braces `{}`, and brackets `[]`
    // (allows unclosed outer class brace if a class declaration is commented out)
    if (!this.areDelimitersBalanced(uncommentedText, true)) {
      return { valid: false, bonus: 0 };
    }

    const withoutStrings = this.stripStringLiterals(uncommentedText).trim();
    if (!withoutStrings) {
      return { valid: false, bonus: 0 };
    }

    // 2. Reject any block where natural-language word runs exist outside strings
    if (this.hasNaturalLanguageWordRun(withoutStrings)) {
      const isDeclaration = /^(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+|mixin\s+)*(?:class|enum|mixin|extension|typedef)\s+[A-Za-z_$][\w$]*/.test(withoutStrings);
      if (!isDeclaration) {
        return { valid: false, bonus: 0 };
      }
    }

    // 3. Reject parenthesized conditions that contain plain prose (`if (the device disconnects)`)
    const parenContents = withoutStrings.match(/\(([^()]*)\)/g) || [];
    for (const group of parenContents) {
      const inner = group.slice(1, -1).trim();
      if (this.hasNaturalLanguageWordRun(inner)) {
        return { valid: false, bonus: 0 };
      }
    }

    // 4. Verify valid Dart/Flutter structural termination
    const trimmed = withoutStrings.trim();
    const endsWithSemicolon = trimmed.endsWith(';');
    const endsWithBlockBrace = trimmed.endsWith('}');
    const endsWithWidgetComma = /[)\]}]\s*,$/.test(trimmed) || /^[a-z_$][\w$]*\s*:\s*[^,;]+,$/.test(trimmed);
    const endsWithWidgetCall = /^(?:const\s+|new\s+)?[A-Z][\w$.]*(?:<[^>]+>)?\s*\([\s\S]*\)$/.test(trimmed);
    const isClassOrDeclarationHeader = /^(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+|mixin\s+)*(?:class|enum|mixin|extension|typedef)\s+[A-Za-z_$][\w$]*/.test(trimmed);

    if (
      !endsWithSemicolon &&
      !endsWithBlockBrace &&
      !endsWithWidgetComma &&
      !endsWithWidgetCall &&
      !isClassOrDeclarationHeader
    ) {
      return { valid: false, bonus: 0 };
    }

    // 5. If it ends with `;` on a single line without `(`, `{`, `[`, `=`, `return`, `import`, `export`, `part`, `throw`, `break`, `continue`, `rethrow`,
    // ensure it is a valid declaration (`final x;`, `late int count;`) and not a prose phrase with a semicolon (`Keep this explanatory note;`)
    if (
      endsWithSemicolon &&
      lines.length === 1 &&
      !/[(){}[\]=<>+*/&|^!~?:]/.test(trimmed)
    ) {
      const isValidSimpleStatement =
        /^(?:return(?:\s+[A-Za-z_$0-9.]+)?|rethrow|break(?:\s+[A-Za-z_$][\w$]*)?|continue(?:\s+[A-Za-z_$][\w$]*)?|throw\s+[A-Za-z_$0-9.]+)\s*;$/.test(trimmed) ||
        /^(?:final|const|var|late(?:\s+final)?)\s+(?:[A-Za-z_$][\w$]*\s+)?[A-Za-z_$][\w$]*\s*;$/.test(trimmed);
      if (!isValidSimpleStatement) {
        return { valid: false, bonus: 0 };
      }
    }

    const bonus = endsWithBlockBrace || endsWithWidgetComma || lines.length > 1 ? 0.15 : 0.1;
    return { valid: true, bonus };
  }

  /**
   * String-aware delimiter balance checker for `()`, `{}`, and `[]`.
   * When allowUnclosedOuterClassBrace is true, allows exactly one unmatched outer `{`
   * if the code begins with a top-level class, enum, mixin, or extension declaration.
   */
  public static areDelimitersBalanced(code: string, allowUnclosedOuterClassBrace = false): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const prev = i > 0 ? code[i - 1] : '';

      if (ch === "'" && !inDoubleQuote && prev !== '\\') {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (ch === '"' && !inSingleQuote && prev !== '\\') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (inSingleQuote || inDoubleQuote) continue;

      if (ch === '(' || ch === '{' || ch === '[') {
        stack.push(ch);
      } else if (ch === ')' || ch === '}' || ch === ']') {
        if (stack.length === 0 || stack[stack.length - 1] !== pairs[ch]) {
          return false;
        }
        stack.pop();
      }
    }

    if (inSingleQuote || inDoubleQuote) return false;
    if (stack.length === 0) return true;

    if (allowUnclosedOuterClassBrace && stack.length === 1 && stack[0] === '{') {
      const trimmed = code.trim();
      return /^(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+|mixin\s+)*(?:class|enum|mixin|extension|typedef)\s+[A-Za-z_$][\w$]*/.test(trimmed);
    }

    return false;
  }

  /**
   * Batches borderline candidate snippets into a single temporary `.dart` file
   * wrapped in dummy contexts and verifies zero fatal syntax errors via `dart analyze`.
   * Gracefully falls back to accepting the TypeScript structural pass if Dart CLI cannot run.
   */
  private static async verifyBorderlineWithDartAnalyzer(
    borderline: CandidateBlock[],
    projectPath?: string
  ): Promise<Set<CandidateBlock>> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'air-flutter-cc-verify-'));
    const tempFile = path.join(tempDir, 'snippet_verify.dart');
    const lineRanges: Array<{ candidate: CandidateBlock; startLine: number; endLine: number }> = [];
    const fileLines: string[] = ['// ignore_for_file: all'];

    for (let idx = 0; idx < borderline.length; idx++) {
      const candidate = borderline[idx];
      const snippet = candidate.uncommentedText.trim();
      const isTopLevel = /^(?:import|export|part|class|enum|mixin|extension|typedef)\b/.test(snippet);
      const isNamedArgOrComma = snippet.endsWith(',');

      fileLines.push(`void _dummy_${idx}() {`);
      const startLine = fileLines.length + 1;
      if (isTopLevel) {
        fileLines.push('}');
        const topStart = fileLines.length + 1;
        for (const l of snippet.split(/\r?\n/)) fileLines.push(l);
        lineRanges.push({ candidate, startLine: topStart, endLine: fileLines.length });
        continue;
      } else if (isNamedArgOrComma) {
        fileLines.push('  _Widget(');
        const argStart = fileLines.length + 1;
        for (const l of snippet.split(/\r?\n/)) fileLines.push(`    ${l}`);
        const argEnd = fileLines.length;
        fileLines.push('  );');
        fileLines.push('}');
        lineRanges.push({ candidate, startLine: argStart, endLine: argEnd });
      } else {
        for (const l of snippet.split(/\r?\n/)) fileLines.push(`  ${l}`);
        const endLine = fileLines.length;
        fileLines.push('}');
        lineRanges.push({ candidate, startLine, endLine });
      }
    }

    try {
      await fs.promises.writeFile(tempFile, fileLines.join('\n'), 'utf8');
      const output = await new Promise<string | undefined>(resolve => {
        execFile(
          'dart',
          ['analyze', '--format=machine', tempFile],
          { cwd: projectPath || tempDir, windowsHide: true, timeout: 15000 },
          (error, stdout, stderr) => {
            if (error && !stdout && !stderr) {
              resolve(undefined);
              return;
            }
            resolve(`${stdout || ''}\n${stderr || ''}`);
          }
        );
      });

      if (output === undefined) {
        // Graceful fallback if `dart` executable is not in PATH
        return new Set(borderline);
      }

      const failedCandidates = new Set<CandidateBlock>();
      for (const rawLine of output.split(/\r?\n/)) {
        const parts = rawLine.split('|');
        if (parts.length < 5) continue;
        const code = parts[2].toLowerCase();
        const errorLine = Number(parts[4]) || 0;
        if (SYNTAX_ERROR_CODES.has(code)) {
          for (const entry of lineRanges) {
            if (errorLine >= entry.startLine && errorLine <= entry.endLine + 1) {
              failedCandidates.add(entry.candidate);
            }
          }
        }
      }

      return new Set(borderline.filter(c => !failedCandidates.has(c)));
    } catch {
      return new Set(borderline);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private static stripCommonIndentation(lines: string[]): string[] {
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    if (nonEmpty.length === 0) return lines;
    const minIndent = Math.min(
      ...nonEmpty.map(l => {
        const match = l.match(/^[ \t]*/);
        return match ? match[0].length : 0;
      })
    );
    return lines.map(l => (l.length >= minIndent ? l.slice(minIndent) : l.trimStart()));
  }

  private static stripStringLiterals(text: string): string {
    return text
      .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, '""')
      .replace(/r?'(?:\\.|[^'\\])*'|r?"(?:\\.|[^"\\])*"/g, '""');
  }

  private static toDetectedBlock(candidate: CandidateBlock): DetectedCommentedCodeBlock {
    return {
      file: candidate.file,
      startLine: candidate.startLineZero + 1,
      endLine: candidate.endLineZero + 1,
      startColumn: candidate.startCharZero + 1,
      endColumn: candidate.endCharZero + 1,
      range: {
        startLine: candidate.startLineZero,
        startCharacter: candidate.startCharZero,
        endLine: candidate.endLineZero,
        endCharacter: candidate.endCharZero
      },
      commentStyle: candidate.commentStyle,
      rawText: candidate.rawText,
      uncommentedText: candidate.uncommentedText,
      restoredCodeText: candidate.restoredCodeText,
      lineCount: candidate.lineCount,
      confidenceScore: candidate.confidenceScore,
      reason: candidate.reason
    };
  }
}
