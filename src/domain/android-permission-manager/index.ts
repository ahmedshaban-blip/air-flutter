import * as fs from 'fs';
import * as path from 'path';

export interface AndroidPermissionDefinition {
  name: string;
  label: string;
  description: string;
}

export interface AndroidPermissionState {
  manifestPath: string;
  declaredPermissions: string[];
}

export interface AndroidPermissionInjectionResult extends AndroidPermissionState {
  addedPermissions: string[];
  changed: boolean;
}

export const ANDROID_PERMISSION_CATALOG: readonly AndroidPermissionDefinition[] = [
  { name: 'android.permission.INTERNET', label: 'Internet', description: 'Access network connections.' },
  { name: 'android.permission.ACCESS_NETWORK_STATE', label: 'Network state', description: 'Inspect network connectivity.' },
  { name: 'android.permission.CAMERA', label: 'Camera', description: 'Capture photos and video.' },
  { name: 'android.permission.RECORD_AUDIO', label: 'Microphone', description: 'Record audio from the microphone.' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', label: 'Precise location', description: 'Access precise device location.' },
  { name: 'android.permission.ACCESS_COARSE_LOCATION', label: 'Approximate location', description: 'Access approximate device location.' },
  { name: 'android.permission.POST_NOTIFICATIONS', label: 'Notifications', description: 'Post notifications on Android 13+.' },
  { name: 'android.permission.READ_CONTACTS', label: 'Read contacts', description: 'Read contacts stored on the device.' },
  { name: 'android.permission.WRITE_CONTACTS', label: 'Write contacts', description: 'Add or update device contacts.' },
  { name: 'android.permission.READ_CALENDAR', label: 'Read calendar', description: 'Read calendar events.' },
  { name: 'android.permission.WRITE_CALENDAR', label: 'Write calendar', description: 'Add or update calendar events.' },
  { name: 'android.permission.BLUETOOTH_CONNECT', label: 'Bluetooth connect', description: 'Connect to paired Bluetooth devices.' },
  { name: 'android.permission.BLUETOOTH_SCAN', label: 'Bluetooth scan', description: 'Discover nearby Bluetooth devices.' },
  { name: 'android.permission.NFC', label: 'NFC', description: 'Communicate with NFC tags and devices.' },
  { name: 'android.permission.VIBRATE', label: 'Vibration', description: 'Control the device vibrator.' },
  { name: 'android.permission.READ_MEDIA_IMAGES', label: 'Read images', description: 'Read images on Android 13+.' },
  { name: 'android.permission.READ_MEDIA_VIDEO', label: 'Read videos', description: 'Read videos on Android 13+.' },
  { name: 'android.permission.READ_MEDIA_AUDIO', label: 'Read audio', description: 'Read audio on Android 13+.' },
  { name: 'android.permission.READ_EXTERNAL_STORAGE', label: 'Read storage (legacy)', description: 'Read shared storage on Android 12 and earlier.' },
  { name: 'android.permission.WRITE_EXTERNAL_STORAGE', label: 'Write storage (legacy)', description: 'Write shared storage on Android 9 and earlier.' }
];

export class AndroidPermissionManager {
  public static readonly permissionPattern = /<uses-permission\s+[^>]*android:name=["']([^"']+)["'][^>]*>/g;

  public static getManifestPath(projectPath: string): string {
    return path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  }

  public static parseDeclaredPermissions(xml: string): Set<string> {
    const permissions = new Set<string>();
    const pattern = new RegExp(this.permissionPattern.source, this.permissionPattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
      permissions.add(match[1]);
    }
    return permissions;
  }

  public static async read(projectPath: string): Promise<AndroidPermissionState> {
    const manifestPath = this.getManifestPath(projectPath);
    const xml = await fs.promises.readFile(manifestPath, 'utf8');
    return {
      manifestPath,
      declaredPermissions: Array.from(this.parseDeclaredPermissions(xml))
    };
  }

  public static async inject(projectPath: string, selectedPermissions: readonly string[]): Promise<AndroidPermissionInjectionResult> {
    const manifestPath = this.getManifestPath(projectPath);
    const xml = await fs.promises.readFile(manifestPath, 'utf8');
    const declaredPermissions = this.parseDeclaredPermissions(xml);
    const candidates = Array.from(new Set(selectedPermissions));
    const newPermissions = candidates.filter(permission => !declaredPermissions.has(permission));

    if (newPermissions.length === 0) {
      return {
        manifestPath,
        declaredPermissions: Array.from(declaredPermissions),
        addedPermissions: [],
        changed: false
      };
    }

    const updatedXml = this.appendPermissions(xml, newPermissions);
    await fs.promises.writeFile(manifestPath, updatedXml, 'utf8');
    newPermissions.forEach(permission => declaredPermissions.add(permission));

    return {
      manifestPath,
      declaredPermissions: Array.from(declaredPermissions),
      addedPermissions: newPermissions,
      changed: true
    };
  }

  private static appendPermissions(xml: string, permissions: readonly string[]): string {
    const insertionMatch = /\n([ \t]*)<application\b/.exec(xml) || /\n([ \t]*)<\/manifest\s*>/.exec(xml);
    if (!insertionMatch || insertionMatch.index === undefined) {
      throw new Error('AndroidManifest.xml does not contain an <application> or closing <manifest> tag.');
    }

    const eol = xml.includes('\r\n') ? '\r\n' : '\n';
    const indent = insertionMatch[1] || '    ';
    const tags = permissions
      .map(permission => `${indent}<uses-permission android:name="${permission}" />`)
      .join(eol);
    const insertionIndex = insertionMatch.index + 1;
    return `${xml.slice(0, insertionIndex)}${tags}${eol}${xml.slice(insertionIndex)}`;
  }
}
