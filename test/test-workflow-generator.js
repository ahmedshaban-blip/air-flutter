const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WorkflowGenerator } = require('../out/domain/workflow-generator');

const baseOptions = projectPath => ({
  projectPath,
  branch: 'main',
  triggerOnPush: true,
  triggerOnPr: false,
  triggerManual: true,
  buildTarget: 'both',
  buildMode: 'release',
  enableSigning: false,
  enableCache: true
});

(async () => {
  const singleProject = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-workflow-single-'));
  fs.writeFileSync(path.join(singleProject, 'pubspec.yaml'), 'name: workflow_fixture\n');

  const single = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(singleProject),
    workflowLayout: 'single'
  });
  assert.deepStrictEqual(single.workflowPaths.map(file => path.basename(file)), ['build_android.yml']);
  const combinedYaml = fs.readFileSync(single.workflowPath, 'utf8');
  assert.ok(combinedYaml.startsWith('name: Flutter Android CI'));
  assert.ok(combinedYaml.includes('flutter build apk --release'));
  assert.ok(combinedYaml.includes('flutter build appbundle --release'));

  const separateProject = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-workflow-separate-'));
  fs.writeFileSync(path.join(separateProject, 'pubspec.yaml'), 'name: workflow_fixture\n');

  const separate = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(separateProject),
    workflowLayout: 'separate'
  });
  assert.deepStrictEqual(
    separate.workflowPaths.map(file => path.basename(file)),
    ['build_apk.yml', 'build_android.yml']
  );
  const apkYaml = fs.readFileSync(separate.workflowPaths[0], 'utf8');
  const aabYaml = fs.readFileSync(separate.workflowPaths[1], 'utf8');
  assert.ok(apkYaml.startsWith('name: Flutter APK CI'));
  assert.ok(aabYaml.startsWith('name: Flutter AAB CI'));
  assert.ok(apkYaml.includes('flutter build apk --release'));
  assert.ok(!apkYaml.includes('flutter build appbundle --release'));
  assert.ok(aabYaml.includes('flutter build appbundle --release'));
  assert.ok(!aabYaml.includes('flutter build apk --release'));

  const aabProject = fs.mkdtempSync(path.join(os.tmpdir(), 'air-flutter-workflow-aab-'));
  fs.writeFileSync(path.join(aabProject, 'pubspec.yaml'), 'name: workflow_fixture\n');
  const aabOnly = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(aabProject),
    buildTarget: 'appbundle'
  });
  assert.deepStrictEqual(aabOnly.workflowPaths.map(file => path.basename(file)), ['build_android.yml']);

  console.log('Workflow generator tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
