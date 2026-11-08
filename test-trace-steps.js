const { CommentedCodeBlockDetector } = require('./out/domain/code-cleanup-assistant');

const c2 = `
  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(18.r);

    return InkWell(
      borderRadius: radius,
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(14.w),
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: ColorsManager.fieldBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: AppTextStyles.strongLabel),
            SizedBox(height: 8.h),
            Text(subtitle, style: AppTextStyles.mutedMicro),
          ],
        ),
      ),
    );
  }
`;

const lines = c2.split('\n').filter(l => l.trim().length > 0);
const rawLines = lines.map((l, idx) => ({
  zeroBasedLine: idx,
  rawLine: '// ' + l,
  indentBeforeMarker: '',
  markerColumn: 0,
  innerText: l,
  isBlankGap: false
}));

const subBlocks = CommentedCodeBlockDetector.extractCodeSubBlocks(rawLines);
console.log('subBlocks count:', subBlocks.length);
if (subBlocks.length > 0) {
  console.log('subBlock 0 line count:', subBlocks[0].length);
  const evalResult = CommentedCodeBlockDetector.evaluateSingleLineSubBlock('test.dart', subBlocks[0]);
  console.log('evaluateSingleLineSubBlock result:', evalResult);
}

