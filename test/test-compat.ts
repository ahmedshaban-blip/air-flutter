import * as assert from 'assert'
import { VersionComparator, CompatibilityEngine } from '../src/features/compatibility/services/compatibilityEngine'
import { ParsedGradleInfo, ParsedPodfileInfo, EnvironmentInfo } from '../src/features/compatibility/models/types'

console.log('🧪 Running Air Flutter Compatibility Tests...')

// Test 1: VersionComparator
console.log('--- Testing VersionComparator ---')
assert.strictEqual(VersionComparator.compare('8.5.2', '8.7'), -1)
assert.strictEqual(VersionComparator.compare('8.7', '8.5.2'), 1)
assert.strictEqual(VersionComparator.compare('8.7.0', '8.7'), 0)
assert.strictEqual(VersionComparator.compare('13.0', '11.0'), 1)
assert.strictEqual(VersionComparator.satisfies('8.5.2', '>=8.5.0 <8.6.0'), true)
assert.strictEqual(VersionComparator.satisfies('8.6.0', '>=8.5.0 <8.6.0'), false)
assert.strictEqual(VersionComparator.satisfies('8.7', '>=8.7'), true)
assert.strictEqual(VersionComparator.satisfies('8.2', '>=8.2 <=8.5'), true)
assert.strictEqual(VersionComparator.satisfies('8.6', '>=8.2 <=8.5'), false)
console.log('✅ VersionComparator passed!')

// Test 2: Mismatch AGP 8.5.2 with Gradle 7.5
console.log('--- Testing AGP & Gradle Mismatch ---')
const mockGradleMismatch: ParsedGradleInfo = {
  wrapperPath: 'android/gradle/wrapper/gradle-wrapper.properties',
  gradleVersion: '7.5',
  gradleRange: { startLine: 2, startChar: 60, endLine: 2, endChar: 63 },
  buildGradlePath: 'android/build.gradle',
  agpVersion: '8.5.2',
  agpRange: { startLine: 8, startChar: 40, endLine: 8, endChar: 45 },
  isKotlinDsl: false
}
const mockEnvJdk17: EnvironmentInfo = {
  javaVersion: 17,
  rawJavaOutput: 'openjdk 17.0.2',
  cocoapodsVersion: null,
  isWindows: true,
  notes: []
}
const mockPodfileHealthy: ParsedPodfileInfo = {
  exists: true,
  podfilePath: 'ios/Podfile',
  deploymentTarget: '13.0',
  targetRange: { startLine: 1, startChar: 15, endLine: 1, endChar: 19 }
}

const report1 = CompatibilityEngine.evaluate(
  'C:/mock/project',
  mockGradleMismatch,
  mockPodfileHealthy,
  mockEnvJdk17
)

assert.strictEqual(report1.isHealthy, false)
const mismatchIssue = report1.issues.find(i => i.code === 'AGP_GRADLE_MISMATCH')
assert.ok(mismatchIssue, 'Should detect AGP_GRADLE_MISMATCH')
assert.strictEqual(mismatchIssue?.type, 'error')
assert.strictEqual(mismatchIssue?.suggestedFix?.newText, '8.7')
console.log('✅ AGP & Gradle Mismatch detection passed!')

// Test 3: Java Mismatch
console.log('--- Testing Java Runtime Mismatch ---')
const mockEnvJdk11: EnvironmentInfo = {
  javaVersion: 11,
  rawJavaOutput: 'openjdk 11.0.12',
  cocoapodsVersion: null,
  isWindows: true,
  notes: []
}
const report2 = CompatibilityEngine.evaluate(
  'C:/mock/project',
  {
    ...mockGradleMismatch,
    gradleVersion: '8.7'
  },
  mockPodfileHealthy,
  mockEnvJdk11
)
const javaIssue = report2.issues.find(i => i.code === 'JAVA_AGP_MISMATCH')
assert.ok(javaIssue, 'Should detect JAVA_AGP_MISMATCH')
assert.strictEqual(javaIssue?.type, 'error')
console.log('✅ Java Runtime Mismatch detection passed!')

// Test 4: Deprecated iOS target
console.log('--- Testing Deprecated iOS Deployment Target ---')
const mockPodfileDeprecated: ParsedPodfileInfo = {
  exists: true,
  podfilePath: 'ios/Podfile',
  deploymentTarget: '11.0',
  targetRange: { startLine: 1, startChar: 15, endLine: 1, endChar: 19 }
}
const report3 = CompatibilityEngine.evaluate(
  'C:/mock/project',
  {
    ...mockGradleMismatch,
    gradleVersion: '8.7'
  },
  mockPodfileDeprecated,
  mockEnvJdk17
)
const iosIssue = report3.issues.find(i => i.code === 'DEPRECATED_IOS_TARGET')
assert.ok(iosIssue, 'Should detect DEPRECATED_IOS_TARGET')
assert.strictEqual(iosIssue?.suggestedFix?.newText, '13.0')
console.log('✅ Deprecated iOS Target detection passed!')

// Test 5: Fully Healthy & Up-to-Date
console.log('--- Testing Fully Compatible Project ---')
const reportHealthy = CompatibilityEngine.evaluate(
  'C:/mock/project',
  {
    ...mockGradleMismatch,
    gradleVersion: '8.7'
  },
  mockPodfileHealthy,
  mockEnvJdk17
)
assert.strictEqual(reportHealthy.isHealthy, true)
assert.strictEqual(reportHealthy.issues.length, 0)
assert.strictEqual(reportHealthy.canAutoUpgrade, false)
console.log('✅ Fully Compatible verification passed!')

console.log('\n🎉 ALL COMPATIBILITY TESTS PASSED SUCCESSFULLY! 🎉')

