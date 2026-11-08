const assert = require('assert');
const { CommentedCodeBlockDetector } = require('../out/domain/code-cleanup-assistant');

(async () => {
  // 1. Multi-line commented-out Flutter Widget tree -> grouped as ONE atomic block
  const widgetSource = [
    'import \'package:flutter/material.dart\';',
    '',
    'class DemoWidget extends StatelessWidget {',
    '  @override',
    '  Widget build(BuildContext context) {',
    '    // Container(',
    '    //   padding: const EdgeInsets.all(16),',
    '    //   child: Column(',
    '    //     children: [',
    '    //       const Text(\'Legacy header\'),',
    '    //       ElevatedButton(',
    '    //         onPressed: () {},',
    '    //         child: const Text(\'Tap\'),',
    '    //       ),',
    '    //     ],',
    '    //   ),',
    '    // ),',
    '    return const SizedBox.shrink();',
    '  }',
    '}'
  ].join('\n');

  const widgetBlocks = CommentedCodeBlockDetector.detectInSource(widgetSource, 'lib/demo_widget.dart');
  assert.strictEqual(widgetBlocks.length, 1, 'Multi-line widget tree must be grouped into a single block');
  assert.strictEqual(widgetBlocks[0].startLine, 6);
  assert.strictEqual(widgetBlocks[0].endLine, 17);
  assert.strictEqual(widgetBlocks[0].lineCount, 12);
  assert.ok(widgetBlocks[0].uncommentedText.startsWith('Container('));
  assert.ok(widgetBlocks[0].uncommentedText.endsWith('),'));
  assert.ok(widgetBlocks[0].restoredCodeText.startsWith('    Container('));

  // 2. Multi-line English & Arabic explanation paragraphs using `//` -> MUST NOT be flagged
  const proseSource = [
    '// This service coordinates wireless ADB discovery across local subnets.',
    '// If the device disconnects while mirroring is active, the controller',
    '// waits for the socket timeout and displays a status message to the user.',
    '//',
    '// هذا القسم مسؤول عن إدارة حالة الاتصال اللاسلكي بالهاتف',
    '// وعرض رسائل الخطأ للمستخدم عند انقطاع الاتصال بشكل مفاجئ',
    '// دون التأثير على واجهة المستخدم الرئيسية في التطبيق.',
    'void activeFunction() {}'
  ].join('\n');

  const proseBlocks = CommentedCodeBlockDetector.detectInSource(proseSource, 'lib/prose.dart');
  assert.strictEqual(proseBlocks.length, 0, 'English and Arabic explanation paragraphs must not be flagged');

  // 3. Mixed block: human note line immediately preceding commented-out code -> peel off human note
  const mixedSource = [
    'void calculate() {',
    '  // Old implementation:',
    '  // final legacyRate = 0.15;',
    '  // final legacyTotal = baseAmount * legacyRate;',
    '  // return legacyTotal;',
    '  return 42;',
    '}'
  ].join('\n');

  const mixedBlocks = CommentedCodeBlockDetector.detectInSource(mixedSource, 'lib/mixed.dart');
  assert.strictEqual(mixedBlocks.length, 1, 'Mixed block should yield the code sub-block');
  assert.strictEqual(mixedBlocks[0].startLine, 3, 'Human note on line 2 must be preserved and excluded');
  assert.strictEqual(mixedBlocks[0].endLine, 5);
  assert.strictEqual(mixedBlocks[0].lineCount, 3);
  assert.ok(!mixedBlocks[0].rawText.includes('Old implementation'));
  assert.ok(mixedBlocks[0].uncommentedText.includes('final legacyRate = 0.15;'));

  // 4. Protected comments: /// dartdoc, /** */, // ignore:, // TODO, section dividers -> MUST NOT be flagged
  const protectedSource = [
    '/// Returns the current device state; final result = true;',
    '/** final docBlock = 123; */',
    '// ignore_for_file: unused_local_variable, dead_code',
    '// ======== UI Widgets ========',
    '// --- Helper Methods ---',
    '// TODO(ahmed): final pendingRefactor = compute();',
    '// FIXME: return fallbackValue;',
    '// NOTE: if (isReady) { refresh(); }',
    '// dart format off',
    '// ignore: unused_local_variable',
    'final activeVar = 10;'
  ].join('\n');

  const protectedBlocks = CommentedCodeBlockDetector.detectInSource(protectedSource, 'lib/protected.dart');
  assert.strictEqual(protectedBlocks.length, 0, 'Protected comments and analyzer directives must never be flagged');

  // 5. Unbalanced partial snippets -> MUST NOT be flagged
  const unbalancedSource = [
    'void render() {',
    '  // if (shouldRenderHeader) {',
    '  //   Container(',
    '  //     child: Text(\'Unclosed\'),',
    '  print(\'active\');',
    '}'
  ].join('\n');

  const unbalancedBlocks = CommentedCodeBlockDetector.detectInSource(unbalancedSource, 'lib/unbalanced.dart');
  assert.strictEqual(unbalancedBlocks.length, 0, 'Unbalanced partial commented snippets must be rejected');

  // 6. Async batch detection with Dart Analyzer fallback
  const batchBlocks = await CommentedCodeBlockDetector.detectInFiles([
    { relativePath: 'lib/demo_widget.dart', content: widgetSource },
    { relativePath: 'lib/prose.dart', content: proseSource },
    { relativePath: 'lib/mixed.dart', content: mixedSource },
    { relativePath: 'lib/protected.dart', content: protectedSource }
  ]);
  assert.strictEqual(batchBlocks.length, 2);

  console.log('✅ All CommentedCodeBlockDetector 3-stage pipeline & edge-case tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

