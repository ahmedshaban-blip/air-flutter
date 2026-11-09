const assert = require('assert');
const { AndroidRuntimePermissionService } = require('../out/domain/android-permission-manager');

(async () => {
  console.log('🧪 Testing AndroidRuntimePermissionService...');

  const sampleDumpsys = `
Packages:
  Package [com.example.app] (4f123a):
    userId=10123
    runtime permissions:
      android.permission.CAMERA: granted=true, flags=[ USER_SET ]
      android.permission.ACCESS_FINE_LOCATION: granted=false, flags=[ USER_SET ]
      android.permission.RECORD_AUDIO: granted=true, flags=[ ]
      android.permission.POST_NOTIFICATIONS: granted=false, flags=[ ]
`;

  const perms = AndroidRuntimePermissionService.parseDumpsysPermissions(sampleDumpsys);
  assert.strictEqual(perms.length, 4);

  const camera = perms.find(p => p.name === 'android.permission.CAMERA');
  assert.ok(camera);
  assert.strictEqual(camera.granted, true);
  assert.strictEqual(camera.label, 'CAMERA');

  const loc = perms.find(p => p.name === 'android.permission.ACCESS_FINE_LOCATION');
  assert.ok(loc);
  assert.strictEqual(loc.granted, false);

  // Test that install permissions (like INTERNET) are NOT parsed as runtime permissions
  const dumpsysWithInstallPerms = `
Packages:
  Package [com.example.app] (4f123a):
    install permissions:
      android.permission.INTERNET: granted=true
      android.permission.ACCESS_NETWORK_STATE: granted=true
    User 0:
      runtime permissions:
        android.permission.CAMERA: granted=true
`;
  const parsedWithInstall = AndroidRuntimePermissionService.parseDumpsysPermissions(dumpsysWithInstallPerms);
  assert.strictEqual(parsedWithInstall.some(p => p.name === 'android.permission.INTERNET'), false, 'INTERNET install permission should not be treated as runtime permission');
  assert.strictEqual(parsedWithInstall.length, 1);

  // Test command execution
  const calls = [];
  const service = new AndroidRuntimePermissionService(
    async () => 'adb',
    async (exe, args) => {
      calls.push({ exe, args });
      return { stdout: '', stderr: '' };
    }
  );

  const grantOk = await service.grantPermission('dev1', 'com.example.app', 'android.permission.CAMERA');
  assert.strictEqual(grantOk, true);
  assert.deepStrictEqual(calls[0].args, ['-s', 'dev1', 'shell', 'pm', 'grant', 'com.example.app', 'android.permission.CAMERA']);

  const revokeOk = await service.revokePermission('dev1', 'com.example.app', 'android.permission.CAMERA');
  assert.strictEqual(revokeOk, true);
  assert.deepStrictEqual(calls[1].args, ['-s', 'dev1', 'shell', 'pm', 'revoke', 'com.example.app', 'android.permission.CAMERA']);

  console.log('✅ AndroidRuntimePermissionService tests passed!');
})();

