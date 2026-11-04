const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const assetHandler = fs.readFileSync(path.join(projectRoot, 'src', 'controllers', 'flutter-panel-controller', 'handlers', 'panelAssetHandler.ts'), 'utf8');
const permissionHandler = fs.readFileSync(path.join(projectRoot, 'src', 'controllers', 'flutter-panel-controller', 'handlers', 'panelPermissionHandler.ts'), 'utf8');
const panelScript = fs.readFileSync(path.join(projectRoot, 'media', 'air-flutter.js'), 'utf8');

assert.ok(assetHandler.includes("fs.existsSync(path.join(projectPath, 'pubspec.yaml'))"));
assert.ok(assetHandler.includes("command: 'assetAssistantUnavailable'"));
assert.ok(permissionHandler.includes("command: 'permissionCatalogUnavailable'"));
assert.ok(permissionHandler.includes("'android', 'app', 'src', 'main', 'AndroidManifest.xml'"));
assert.ok(panelScript.includes("case 'assetAssistantUnavailable':"));
assert.ok(panelScript.includes("case 'permissionCatalogUnavailable':"));

console.log('Non-Flutter workspace empty-state tests passed.');
