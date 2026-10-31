"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const compatibilityEngine_1 = require("../src/features/compatibility/services/compatibilityEngine");
console.log('🧪 Running Air Flutter Compatibility Tests...');
// Test 1: VersionComparator
console.log('--- Testing VersionComparator ---');
assert.strictEqual(compatibilityEngine_1.VersionComparator.compare('8.5.2', '8.7'), -1);
assert.strictEqual(compatibilityEngine_1.VersionComparator.compare('8.7', '8.5.2'), 1);
assert.strictEqual(compatibilityEngine_1.VersionComparator.compare('8.7.0', '8.7'), 0);
assert.strictEqual(compatibilityEngine_1.VersionComparator.compare('13.0', '11.0'), 1);
assert.strictEqual(compatibilityEngine_1.VersionComparator.satisfies('8.5.2', '>=8.5.0 <8.6.0'), true);
assert.strictEqual(compatibilityEngine_1.VersionComparator.satisfies('8.6.0', '>=8.5.0 <8.6.0'), false);
assert.strictEqual(compatibilityEngine_1.VersionComparator.satisfies('8.7', '>=8.7'), true);
assert.strictEqual(compatibilityEngine_1.VersionComparator.satisfies('8.2', '>=8.2 <=8.5'), true);
assert.strictEqual(compatibilityEngine_1.VersionComparator.satisfies('8.6', '>=8.2 <=8.5'), false);
console.log('✅ VersionComparator passed!');
// Test 2: Mismatch AGP 8.5.2 with Gradle 7.5
console.log('--- Testing AGP & Gradle Mismatch ---');
const mockGradleMismatch = {
    wrapperPath: 'android/gradle/wrapper/gradle-wrapper.properties',
    gradleVersion: '7.5',
    gradleRange: { startLine: 2, startChar: 60, endLine: 2, endChar: 63 },
    buildGradlePath: 'android/build.gradle',
    agpVersion: '8.5.2',
    agpRange: { startLine: 8, startChar: 40, endLine: 8, endChar: 45 },
    isKotlinDsl: false
};
const mockEnvJdk17 = {
    javaVersion: 17,
    rawJavaOutput: 'openjdk 17.0.2',
    cocoapodsVersion: null,
    isWindows: true,
    notes: []
};
const mockPodfileHealthy = {
    exists: true,
    podfilePath: 'ios/Podfile',
    deploymentTarget: '13.0',
    targetRange: { startLine: 1, startChar: 15, endLine: 1, endChar: 19 }
};
const report1 = compatibilityEngine_1.CompatibilityEngine.evaluate('C:/mock/project', mockGradleMismatch, mockPodfileHealthy, mockEnvJdk17);
assert.strictEqual(report1.isHealthy, false);
const mismatchIssue = report1.issues.find(i => i.code === 'AGP_GRADLE_MISMATCH');
assert.ok(mismatchIssue, 'Should detect AGP_GRADLE_MISMATCH');
assert.strictEqual(mismatchIssue === null || mismatchIssue === void 0 ? void 0 : mismatchIssue.type, 'error');
assert.strictEqual((_a = mismatchIssue === null || mismatchIssue === void 0 ? void 0 : mismatchIssue.suggestedFix) === null || _a === void 0 ? void 0 : _a.newText, '8.7');
console.log('✅ AGP & Gradle Mismatch detection passed!');
// Test 3: Java Mismatch
console.log('--- Testing Java Runtime Mismatch ---');
const mockEnvJdk11 = {
    javaVersion: 11,
    rawJavaOutput: 'openjdk 11.0.12',
    cocoapodsVersion: null,
    isWindows: true,
    notes: []
};
const report2 = compatibilityEngine_1.CompatibilityEngine.evaluate('C:/mock/project', Object.assign(Object.assign({}, mockGradleMismatch), { gradleVersion: '8.7' }), mockPodfileHealthy, mockEnvJdk11);
const javaIssue = report2.issues.find(i => i.code === 'JAVA_AGP_MISMATCH');
assert.ok(javaIssue, 'Should detect JAVA_AGP_MISMATCH');
assert.strictEqual(javaIssue === null || javaIssue === void 0 ? void 0 : javaIssue.type, 'error');
console.log('✅ Java Runtime Mismatch detection passed!');
// Test 4: Deprecated iOS target
console.log('--- Testing Deprecated iOS Deployment Target ---');
const mockPodfileDeprecated = {
    exists: true,
    podfilePath: 'ios/Podfile',
    deploymentTarget: '11.0',
    targetRange: { startLine: 1, startChar: 15, endLine: 1, endChar: 19 }
};
const report3 = compatibilityEngine_1.CompatibilityEngine.evaluate('C:/mock/project', Object.assign(Object.assign({}, mockGradleMismatch), { gradleVersion: '8.7' }), mockPodfileDeprecated, mockEnvJdk17);
const iosIssue = report3.issues.find(i => i.code === 'DEPRECATED_IOS_TARGET');
assert.ok(iosIssue, 'Should detect DEPRECATED_IOS_TARGET');
assert.strictEqual((_b = iosIssue === null || iosIssue === void 0 ? void 0 : iosIssue.suggestedFix) === null || _b === void 0 ? void 0 : _b.newText, '13.0');
console.log('✅ Deprecated iOS Target detection passed!');
// Test 5: Fully Healthy & Up-to-Date
console.log('--- Testing Fully Compatible Project ---');
const reportHealthy = compatibilityEngine_1.CompatibilityEngine.evaluate('C:/mock/project', Object.assign(Object.assign({}, mockGradleMismatch), { gradleVersion: '8.7' }), mockPodfileHealthy, mockEnvJdk17);
assert.strictEqual(reportHealthy.isHealthy, true);
assert.strictEqual(reportHealthy.issues.length, 0);
assert.strictEqual(reportHealthy.canAutoUpgrade, false);
console.log('✅ Fully Compatible verification passed!');
console.log('\n🎉 ALL COMPATIBILITY TESTS PASSED SUCCESSFULLY! 🎉');
//# sourceMappingURL=test-compat.js.map