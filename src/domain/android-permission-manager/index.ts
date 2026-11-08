import * as fs from 'fs';
import * as path from 'path';
import {
  PlatformType,
  AndroidProtectionLevel,
  PermissionItem,
  PermissionCategory,
  PermissionCategorySummary,
  PERMISSION_CATALOG,
  getAllPermissionItems,
  findPermissionByAndroidName,
  findPermissionByIosKey,
  getPermissionCategories
} from './permissionCatalog';

export {
  PlatformType,
  AndroidProtectionLevel,
  PermissionItem,
  PermissionCategory,
  PermissionCategorySummary,
  PERMISSION_CATALOG,
  getAllPermissionItems,
  findPermissionByAndroidName,
  findPermissionByIosKey,
  getPermissionCategories
};

export interface AndroidPermissionDefinition {
  name: string;
  label: string;
  description: string;
  id?: string;
  category?: string;
  protectionLevel?: AndroidProtectionLevel;
  minSdk?: number;
  maxSdk?: number;
  adbPermissionName?: string;
  iosKey?: string;
  storeReviewWarning?: string;
  flutterPackageRecommendation?: string[];
}

export interface AndroidPermissionState {
  manifestPath: string;
  declaredPermissions: string[];
}

export interface AndroidPermissionInjectionResult extends AndroidPermissionState {
  addedPermissions: string[];
  changed: boolean;
}

export const ANDROID_PERMISSION_CATALOG: readonly AndroidPermissionDefinition[] = PERMISSION_CATALOG
  .flatMap(category => category.permissions)
  .filter((item): item is PermissionItem & { androidManifestName: string } => typeof item.androidManifestName === 'string')
  .map(item => ({
    name: item.androidManifestName,
    label: item.displayName,
    description: item.hint,
    id: item.id,
    category: item.category,
    protectionLevel: item.androidProtectionLevel,
    minSdk: item.androidMinSdk,
    maxSdk: item.androidMaxSdk,
    adbPermissionName: item.adbPermissionName,
    iosKey: item.iosKey,
    storeReviewWarning: item.storeReviewWarning,
    flutterPackageRecommendation: item.flutterPackageRecommendation
  }));

export interface IosPermissionDefinition {
  name: string;
  label: string;
  description: string;
  id?: string;
  category?: string;
  minVersion?: string;
  defaultUsageDescription: string;
  storeReviewWarning?: string;
  flutterPackageRecommendation?: string[];
}

export interface IosPermissionState {
  plistPath: string;
  declaredPermissions: string[];
  declaredDescriptions?: Record<string, string>;
}

export interface IosPermissionInjectionResult extends IosPermissionState {
  addedPermissions: string[];
  changed: boolean;
}

export const IOS_PERMISSION_CATALOG: readonly IosPermissionDefinition[] = PERMISSION_CATALOG
  .flatMap(category => category.permissions)
  .filter((item): item is PermissionItem & { iosKey: string } => typeof item.iosKey === 'string')
  .map(item => ({
    name: item.iosKey,
    label: item.displayName,
    description: item.hint,
    id: item.id,
    category: item.category,
    minVersion: item.iosMinVersion,
    defaultUsageDescription: item.defaultIosUsageDescription || item.hint,
    storeReviewWarning: item.storeReviewWarning,
    flutterPackageRecommendation: item.flutterPackageRecommendation
  }));

export class IosPermissionManager {
  public static getPlistPath(projectPath: string): string {
    return path.join(projectPath, 'ios', 'Runner', 'Info.plist');
  }

  public static parseDeclaredPermissions(xml: string): Set<string> {
    const permissions = new Set<string>();
    const keyPattern = /<key>([^<]+)<\/key>/g;
    let match: RegExpExecArray | null;
    while ((match = keyPattern.exec(xml)) !== null) {
      permissions.add(match[1].trim());
    }
    return permissions;
  }

  public static parseDeclaredDescriptions(xml: string): Record<string, string> {
    const descriptions: Record<string, string> = {};
    const entryPattern = /<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g;
    let match: RegExpExecArray | null;
    while ((match = entryPattern.exec(xml)) !== null) {
      descriptions[match[1].trim()] = match[2];
    }
    return descriptions;
  }

  public static async read(projectPath: string): Promise<IosPermissionState> {
    const plistPath = this.getPlistPath(projectPath);
    const xml = await fs.promises.readFile(plistPath, 'utf8');
    return {
      plistPath,
      declaredPermissions: Array.from(this.parseDeclaredPermissions(xml)),
      declaredDescriptions: this.parseDeclaredDescriptions(xml)
    };
  }

  public static async inject(
    projectPath: string,
    permissionsToAdd: Record<string, string>
  ): Promise<IosPermissionInjectionResult> {
    const plistPath = this.getPlistPath(projectPath);
    const xml = await fs.promises.readFile(plistPath, 'utf8');
    const declaredPermissions = this.parseDeclaredPermissions(xml);
    const declaredDescriptions = this.parseDeclaredDescriptions(xml);

    const keysToAdd = Object.keys(permissionsToAdd).filter(key => !declaredPermissions.has(key));
    if (keysToAdd.length === 0) {
      return {
        plistPath,
        declaredPermissions: Array.from(declaredPermissions),
        declaredDescriptions,
        addedPermissions: [],
        changed: false
      };
    }

    const filteredMap: Record<string, string> = {};
    for (const key of keysToAdd) {
      filteredMap[key] = permissionsToAdd[key];
    }

    const updatedXml = this.appendPermissions(xml, filteredMap);
    await fs.promises.writeFile(plistPath, updatedXml, 'utf8');
    keysToAdd.forEach(key => {
      declaredPermissions.add(key);
      declaredDescriptions[key] = filteredMap[key];
    });

    return {
      plistPath,
      declaredPermissions: Array.from(declaredPermissions),
      declaredDescriptions,
      addedPermissions: keysToAdd,
      changed: true
    };
  }

  private static appendPermissions(xml: string, permissions: Record<string, string>): string {
    const insertionIndex = xml.lastIndexOf('</dict>');
    if (insertionIndex === -1) {
      throw new Error('Info.plist does not contain a closing </dict> tag.');
    }

    const eol = xml.includes('\r\n') ? '\r\n' : '\n';
    const lineBeforeIndex = xml.lastIndexOf('\n', insertionIndex);
    const dictIndent = lineBeforeIndex !== -1 ? xml.slice(lineBeforeIndex + 1, insertionIndex) : '\t';
    const itemIndent = dictIndent.includes('\t') ? `${dictIndent}\t` : `${dictIndent}    `;

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const entries = Object.entries(permissions)
      .map(([key, desc]) => {
        return `${itemIndent}<key>${escapeXml(key)}</key>${eol}${itemIndent}<string>${escapeXml(desc)}</string>`;
      })
      .join(eol);

    return `${xml.slice(0, insertionIndex)}${entries}${eol}${dictIndent}${xml.slice(insertionIndex)}`;
  }
}


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
      .map(permission => {
        const item = findPermissionByAndroidName(permission);
        if (item && typeof item.androidMaxSdk === 'number') {
          return `${indent}<uses-permission android:name="${permission}" android:maxSdkVersion="${item.androidMaxSdk}" />`;
        }
        return `${indent}<uses-permission android:name="${permission}" />`;
      })
      .join(eol);
    const insertionIndex = insertionMatch.index + 1;
    return `${xml.slice(0, insertionIndex)}${tags}${eol}${xml.slice(insertionIndex)}`;
  }
}
