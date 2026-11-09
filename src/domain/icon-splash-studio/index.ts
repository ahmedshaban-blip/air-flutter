import * as fs from 'fs';
import * as path from 'path';

export interface IconDensityData {
  density: 'mdpi' | 'hdpi' | 'xhdpi' | 'xxhdpi' | 'xxxhdpi';
  base64Png: string; // Data URL or raw base64
}

export interface NativeIconPayload {
  projectRoot: string;
  master1024Base64?: string;
  densities?: IconDensityData[];
  backgroundColorHex?: string;
}

export interface LauncherIconsConfigOptions {
  projectRoot: string;
  imagePath: string;
  backgroundColorHex?: string;
  adaptiveIconBackground?: string;
}

export interface NativeSplashConfigOptions {
  projectRoot: string;
  imagePath: string;
  backgroundColorHex: string;
  fullscreen?: boolean;
}

export class IconSplashStudioService {
  private static stripBase64Header(data: string): Buffer {
    const cleaned = data.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(cleaned, 'base64');
  }

  public writeAndroidIcons(payload: NativeIconPayload): { ok: boolean; count: number; error?: string } {
    try {
      const resDir = path.join(payload.projectRoot, 'android', 'app', 'src', 'main', 'res');
      if (!fs.existsSync(resDir)) {
        return { ok: false, count: 0, error: 'Could not find android/app/src/main/res directory.' };
      }

      let count = 0;
      if (payload.densities && payload.densities.length > 0) {
        for (const item of payload.densities) {
          const mipmapDir = path.join(resDir, `mipmap-${item.density}`);
          if (!fs.existsSync(mipmapDir)) {
            fs.mkdirSync(mipmapDir, { recursive: true });
          }
          const iconPath = path.join(mipmapDir, 'ic_launcher.png');
          const buffer = IconSplashStudioService.stripBase64Header(item.base64Png);
          fs.writeFileSync(iconPath, buffer);
          count++;
        }
      }

      // If background color provided, create/update ic_launcher_background.xml
      if (payload.backgroundColorHex) {
        const valuesDir = path.join(resDir, 'values');
        if (!fs.existsSync(valuesDir)) {
          fs.mkdirSync(valuesDir, { recursive: true });
        }
        const colorsXmlPath = path.join(valuesDir, 'colors.xml');
        const colorEntry = `<color name="ic_launcher_background">${payload.backgroundColorHex}</color>`;
        if (fs.existsSync(colorsXmlPath)) {
          let content = fs.readFileSync(colorsXmlPath, 'utf8');
          if (content.includes('ic_launcher_background')) {
            content = content.replace(/<color name="ic_launcher_background">.*?<\/color>/, colorEntry);
          } else {
            content = content.replace('</resources>', `    ${colorEntry}\n</resources>`);
          }
          fs.writeFileSync(colorsXmlPath, content, 'utf8');
        } else {
          fs.writeFileSync(
            colorsXmlPath,
            `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    ${colorEntry}\n</resources>\n`,
            'utf8'
          );
        }
      }

      return { ok: true, count };
    } catch (err: any) {
      return { ok: false, count: 0, error: err.message };
    }
  }

  public writeIosIcons(payload: NativeIconPayload): { ok: boolean; error?: string } {
    try {
      const iosAppIconDir = path.join(
        payload.projectRoot,
        'ios',
        'Runner',
        'Assets.xcassets',
        'AppIcon.appiconset'
      );
      if (!fs.existsSync(iosAppIconDir)) {
        fs.mkdirSync(iosAppIconDir, { recursive: true });
      }

      if (payload.master1024Base64) {
        const iconPath = path.join(iosAppIconDir, 'Icon-App-1024x1024@1x.png');
        const buffer = IconSplashStudioService.stripBase64Header(payload.master1024Base64);
        fs.writeFileSync(iconPath, buffer);
      }

      const contentsJsonPath = path.join(iosAppIconDir, 'Contents.json');
      const contentsJson = {
        images: [
          {
            filename: 'Icon-App-1024x1024@1x.png',
            idiom: 'universal',
            platform: 'ios',
            size: '1024x1024'
          }
        ],
        info: {
          author: 'xcode',
          version: 1
        }
      };
      fs.writeFileSync(contentsJsonPath, JSON.stringify(contentsJson, null, 2), 'utf8');
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  public configureFlutterLauncherIcons(options: LauncherIconsConfigOptions): { ok: boolean; message: string } {
    try {
      const pubspecPath = path.join(options.projectRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) {
        return { ok: false, message: 'pubspec.yaml not found' };
      }

      let content = fs.readFileSync(pubspecPath, 'utf8');
      const bg = options.backgroundColorHex || '#FFFFFF';

      const configBlock = [
        'flutter_launcher_icons:',
        '  android: "launcher_icon"',
        '  ios: true',
        `  image_path: "${options.imagePath}"`,
        '  min_sdk_android: 21',
        '  adaptive_icon_background: "' + (options.adaptiveIconBackground || bg) + '"',
        `  adaptive_icon_foreground: "${options.imagePath}"`
      ].join('\n');

      if (content.includes('flutter_launcher_icons:')) {
        content = content.replace(/flutter_launcher_icons:[\s\S]*?(?=\n\S|\n$|$)/, configBlock);
      } else {
        content = content.trimEnd() + '\n\n' + configBlock + '\n';
      }

      fs.writeFileSync(pubspecPath, content, 'utf8');
      return { ok: true, message: 'Updated pubspec.yaml with flutter_launcher_icons configuration.' };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  public configureFlutterNativeSplash(options: NativeSplashConfigOptions): { ok: boolean; message: string } {
    try {
      const pubspecPath = path.join(options.projectRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) {
        return { ok: false, message: 'pubspec.yaml not found' };
      }

      let content = fs.readFileSync(pubspecPath, 'utf8');
      const color = options.backgroundColorHex || '#FFFFFF';

      const configBlock = [
        'flutter_native_splash:',
        `  color: "${color}"`,
        `  image: "${options.imagePath}"`,
        '  android_12:',
        `    image: "${options.imagePath}"`,
        `    icon_background_color: "${color}"`,
        '  web: false',
        options.fullscreen ? '  fullscreen: true' : '  fullscreen: false'
      ].join('\n');

      if (content.includes('flutter_native_splash:')) {
        content = content.replace(/flutter_native_splash:[\s\S]*?(?=\n\S|\n$|$)/, configBlock);
      } else {
        content = content.trimEnd() + '\n\n' + configBlock + '\n';
      }

      fs.writeFileSync(pubspecPath, content, 'utf8');
      return { ok: true, message: 'Updated pubspec.yaml with flutter_native_splash configuration.' };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }
}

