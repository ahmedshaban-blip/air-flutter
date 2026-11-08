const { CommentedCodeBlockDetector } = require('./out/domain/code-cleanup-assistant');

const lines = [
  "import 'package:flutter/material.dart';",
  "",
  "// enum SystemStateType { offline, loading, error, empty }",
  "",
  "// class _SystemStatesCard extends StatelessWidget {",
  "//   final ValueChanged<SystemStateType>? onSelected;",
  "//   const _SystemStatesCard({this.onSelected});",
  "",
  "//   static const _items = [",
  "//     (",
  "//       SystemStateType.offline,",
  "//       'تجربة عدم الاتصال',",
  "//       'معاينة رسالة انقطاع الشبكة.',",
  "//     ),",
  "//   ];",
  "// }"
];

const source = lines.join('\n');
const blocks = CommentedCodeBlockDetector.detectInSource(source, 'test.dart');
console.log('Blocks detected:', blocks.length);
blocks.forEach((b, i) => console.log('Block', i + 1, 'lines:', b.startLine, 'to', b.endLine, 'reason:', b.reason));

