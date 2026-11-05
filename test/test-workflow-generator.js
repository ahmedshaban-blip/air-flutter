const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
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

const createFlutterProject = (prefix, kotlin = false) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(projectPath, 'android', 'app'), { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'pubspec.yaml'), 'name: workflow_fixture\n');
  fs.writeFileSync(
    path.join(projectPath, 'android', 'app', kotlin ? 'build.gradle.kts' : 'build.gradle'),
    kotlin
      ? 'android {\n    ndkVersion = flutter.ndkVersion\n}\n'
      : 'android {\n    ndkVersion flutter.ndkVersion\n}\n'
  );
  return projectPath;
};

(async () => {
  const singleProject = createFlutterProject('air-flutter-workflow-single-');

  const single = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(singleProject),
    workflowLayout: 'single'
  });
  assert.deepStrictEqual(single.workflowPaths.map(file => path.basename(file)), ['build_android.yml']);
  const combinedYaml = fs.readFileSync(single.workflowPath, 'utf8');
  assert.ok(combinedYaml.startsWith('name: Flutter Android CI'));
  assert.ok(combinedYaml.includes('flutter build apk --release'));
  assert.ok(combinedYaml.includes('flutter build appbundle --release'));
  assert.ok(combinedYaml.includes('runs-on: ubuntu-24.04'));
  assert.ok(combinedYaml.includes("CI_NDK_VERSION: '27.3.13750724'"));
  assert.ok(combinedYaml.includes('Verify preinstalled Android NDK (27.3.13750724)'));
  assert.ok(combinedYaml.includes('Prepare CI diagnostics'));
  assert.ok(combinedYaml.includes('Diagnose workflow failure'));
  assert.ok(combinedYaml.includes('flutter-build-diagnostics-${{ github.run_number }}-${{ github.run_attempt }}'));
  assert.ok(fs.readFileSync(single.androidBuildFilePath, 'utf8').includes(
    'ndkVersion = System.getenv("CI_NDK_VERSION") ?: flutter.ndkVersion'
  ));

  for (const buildTarget of ['universal_apk', 'split_apk', 'appbundle', 'both']) {
    for (const buildMode of ['debug', 'release']) {
      const generatedYaml = WorkflowGenerator.generateWorkflowYaml({
        ...baseOptions(singleProject),
        buildTarget,
        buildMode
      });
      assert.ok(generatedYaml.includes('Verify preinstalled Android NDK (27.3.13750724)'));
      assert.ok(generatedYaml.includes(`Build Android (${buildMode})`));
      assert.ok(generatedYaml.includes('run_with_diagnostics'));
      yaml.load(generatedYaml);
    }
  }

  const ndkDisabledYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    usePreinstalledNdk: false
  });
  assert.ok(!ndkDisabledYaml.includes('CI_NDK_VERSION'));
  assert.ok(!ndkDisabledYaml.includes('Verify preinstalled Android NDK'));

  const manualPreinstalledYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    ndkVersion: '29.0.14206865'
  });
  assert.ok(manualPreinstalledYaml.includes("CI_NDK_VERSION: '29.0.14206865'"));

  const installedToolsYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    usePreinstalledNdk: false,
    installAndroidTools: true,
    ndkVersion: '28.2.13676358',
    cmakeVersion: '3.22.1'
  });
  assert.ok(installedToolsYaml.includes("CI_NDK_VERSION: '28.2.13676358'"));
  assert.ok(installedToolsYaml.includes("CI_CMAKE_VERSION: '3.22.1'"));
  assert.ok(installedToolsYaml.includes('sdkmanager" --install "ndk;${CI_NDK_VERSION}" "cmake;${CI_CMAKE_VERSION}"'));
  assert.ok(!installedToolsYaml.includes('Verify preinstalled Android NDK'));

  const constrainedGradleYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    limitGradleMemory: true,
    gradleHeapMb: 2048,
    gradleMetaspaceMb: 512,
    gradleWorkers: 2,
    disableGradleParallel: true,
    disableGradleDaemon: true
  });
  assert.ok(constrainedGradleYaml.includes('org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m'));
  assert.ok(constrainedGradleYaml.includes('org.gradle.workers.max=2'));
  assert.ok(constrainedGradleYaml.includes('org.gradle.parallel=false'));
  assert.ok(constrainedGradleYaml.includes('org.gradle.daemon=false'));

  const javaCacheYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    gradleCacheProvider: 'setup-java'
  });
  assert.ok(javaCacheYaml.includes("cache: 'gradle'"));
  assert.ok(!javaCacheYaml.includes('gradle/actions/setup-gradle'));

  const noCacheYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    flutterCache: false,
    gradleCacheProvider: 'none'
  });
  assert.ok(noCacheYaml.includes('cache: false'));
  assert.ok(noCacheYaml.includes('pub-cache: false'));
  assert.ok(!noCacheYaml.includes("cache: 'gradle'"));
  assert.ok(!noCacheYaml.includes('gradle/actions/setup-gradle'));

  const namedReleaseYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    publishToReleases: true,
    releaseNameSource: 'manual',
    releaseVersionSource: 'manual',
    releaseNameTemplate: '{app} - {version}',
    releaseTagTemplate: '{slug}-v{version}',
    artifactNameTemplate: '{slug}-{target}-{fullVersion}'
  });
  assert.ok(namedReleaseYaml.includes('release_name:'));
  assert.ok(namedReleaseYaml.includes('release_version:'));
  assert.ok(namedReleaseYaml.includes("RELEASE_NAME_TEMPLATE: '{app} - {version}'"));
  assert.ok(namedReleaseYaml.includes('RELEASE_TAG="$RELEASE_TAG-build-$GITHUB_RUN_NUMBER"'));
  assert.ok(namedReleaseYaml.includes('RELEASE_TAG="$RELEASE_TAG-attempt-$GITHUB_RUN_ATTEMPT"'));
  assert.ok(namedReleaseYaml.includes('tag_name: ${{ env.RELEASE_TAG }}'));
  assert.ok(namedReleaseYaml.includes('name: ${{ env.RELEASE_NAME }}'));
  assert.ok(namedReleaseYaml.includes('name: ${{ env.ARTIFACT_APK_NAME }}'));
  assert.ok(namedReleaseYaml.includes('name: ${{ env.ARTIFACT_AAB_NAME }}'));
  assert.ok(namedReleaseYaml.includes('release-assets/*'));
  assert.ok(namedReleaseYaml.includes('prerelease: false'));
  assert.ok(namedReleaseYaml.includes('make_latest: true'));
  yaml.load(namedReleaseYaml);

  const debugReleaseYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    buildMode: 'debug',
    publishToReleases: true
  });
  assert.ok(debugReleaseYaml.includes('prerelease: true'));
  assert.ok(debugReleaseYaml.includes('make_latest: false'));

  const separateReleaseYaml = WorkflowGenerator.generateWorkflowYaml({
    ...baseOptions(singleProject),
    buildTarget: 'appbundle',
    workflowLayout: 'separate',
    publishToReleases: true,
    releaseCustomName: "Owner's App",
    releaseNameSource: 'custom'
  });
  assert.ok(separateReleaseYaml.includes("RELEASE_CUSTOM_NAME: 'Owner''s App'"));
  assert.ok(separateReleaseYaml.includes("REQUIRE_TARGET_IN_TAG: 'true'"));
  assert.ok(separateReleaseYaml.includes('RELEASE_TAG="$RELEASE_TAG-$RELEASE_TARGET"'));
  assert.ok(separateReleaseYaml.includes('release-assets/${ARTIFACT_AAB_NAME}.aab'));
  yaml.load(separateReleaseYaml);

  assert.throws(
    () => WorkflowGenerator.generateWorkflowYaml({
      ...baseOptions(singleProject),
      publishToReleases: true,
      releaseNameTemplate: '{app} {verion}'
    }),
    /unknown variable \{verion\}/
  );
  assert.throws(
    () => WorkflowGenerator.generateWorkflowYaml({
      ...baseOptions(singleProject),
      publishToReleases: true,
      releaseNameSource: 'custom'
    }),
    /custom release name is required/i
  );
  assert.throws(
    () => WorkflowGenerator.generateWorkflowYaml({
      ...baseOptions(singleProject),
      triggerManual: false,
      publishToReleases: true,
      releaseVersionSource: 'manual'
    }),
    /requires the Manual Run trigger/
  );

  assert.throws(
    () => WorkflowGenerator.generateWorkflowYaml({
      ...baseOptions(singleProject),
      limitGradleMemory: true,
      gradleHeapMb: 7000
    }),
    /Gradle heap must be an integer between 512 and 6144/
  );

  const ndkDisabled = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(singleProject),
    usePreinstalledNdk: false
  });
  assert.strictEqual(ndkDisabled.androidBuildFilePath, undefined);
  assert.ok(fs.readFileSync(path.join(singleProject, 'android', 'app', 'build.gradle'), 'utf8').includes(
    'ndkVersion = flutter.ndkVersion'
  ));

  const separateProject = createFlutterProject('air-flutter-workflow-separate-', true);

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
  assert.ok(fs.readFileSync(separate.androidBuildFilePath, 'utf8').includes(
    'ndkVersion = System.getenv("CI_NDK_VERSION") ?: flutter.ndkVersion'
  ));

  const aabProject = createFlutterProject('air-flutter-workflow-aab-');
  const aabOnly = await WorkflowGenerator.writeWorkflowFiles({
    ...baseOptions(aabProject),
    buildTarget: 'appbundle'
  });
  assert.deepStrictEqual(aabOnly.workflowPaths.map(file => path.basename(file)), ['build_android.yml']);

  const workflowModal = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'controllers', 'flutter-panel-controller', 'views', 'modals', 'workflowModalHtml.ts'),
    'utf8'
  );
  assert.ok(workflowModal.includes('Build Troubleshooting &amp; Resource Controls'));
  assert.ok(workflowModal.includes('From 512 to 6144 MB'));
  assert.ok(workflowModal.includes('workflowGradleCacheProvider'));
  assert.ok(workflowModal.includes('workflowFlutterCache'));

  console.log('Workflow generator tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
