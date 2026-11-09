import * as fs from 'fs';
import * as path from 'path';

export interface SslSecurityStatus {
  hasXmlConfig: boolean;
  xmlConfigPath?: string;
  isManifestLinked: boolean;
  manifestPath?: string;
  hasDevHttpOverrides: boolean;
  devHttpOverridesPath?: string;
}

export class SslDoctorService {
  public getStatus(projectRoot: string): SslSecurityStatus {
    const xmlConfigPath = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      'xml',
      'network_security_config.xml'
    );
    const hasXmlConfig = fs.existsSync(xmlConfigPath);

    const manifestPath = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'AndroidManifest.xml'
    );
    let isManifestLinked = false;
    if (fs.existsSync(manifestPath)) {
      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        isManifestLinked = manifestContent.includes('android:networkSecurityConfig="@xml/network_security_config"');
      } catch {}
    }

    const devHttpOverridesPath = path.join(projectRoot, 'lib', 'dev_http_overrides.dart');
    const hasDevHttpOverrides = fs.existsSync(devHttpOverridesPath);

    return {
      hasXmlConfig,
      xmlConfigPath: hasXmlConfig ? xmlConfigPath : undefined,
      isManifestLinked,
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : undefined,
      hasDevHttpOverrides,
      devHttpOverridesPath: hasDevHttpOverrides ? devHttpOverridesPath : undefined
    };
  }

  public applyNetworkSecurityConfig(projectRoot: string): { ok: boolean; message: string } {
    try {
      const xmlDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const xmlFile = path.join(xmlDir, 'network_security_config.xml');
      const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>
`;
      fs.writeFileSync(xmlFile, xmlBody, 'utf8');

      // Update AndroidManifest.xml
      const manifestPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'AndroidManifest.xml'
      );
      if (fs.existsSync(manifestPath)) {
        let manifest = fs.readFileSync(manifestPath, 'utf8');
        if (!manifest.includes('android:networkSecurityConfig')) {
          manifest = manifest.replace(
            /<application(\s+)/,
            '<application\n        android:networkSecurityConfig="@xml/network_security_config"$1'
          );
          fs.writeFileSync(manifestPath, manifest, 'utf8');
        }
      }

      return {
        ok: true,
        message: 'Generated network_security_config.xml and linked it in AndroidManifest.xml.'
      };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  public generateDevHttpOverrides(projectRoot: string): { ok: boolean; message: string; filePath: string } {
    try {
      const libDir = path.join(projectRoot, 'lib');
      if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
      }
      const targetFile = path.join(libDir, 'dev_http_overrides.dart');

      const content = `import 'dart:io';

/// Air Flutter Dev Proxy & SSL Overrides
/// Directs Dart HttpClient requests through a desktop proxy (Charles, Proxyman, Fiddler)
/// and bypasses self-signed SSL handshake failures in debug mode.
class DevHttpOverrides extends HttpOverrides {
  final String proxyHost;
  final int proxyPort;

  DevHttpOverrides({this.proxyHost = 'localhost', this.proxyPort = 8888});

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    client.findProxy = (uri) => 'PROXY $proxyHost:$proxyPort; DIRECT';
    client.badCertificateCallback = (X509Certificate cert, String host, int port) => true;
    return client;
  }
}

// To activate in your main() function:
// void main() {
//   if (kDebugMode) {
//     HttpOverrides.global = DevHttpOverrides(proxyHost: '192.168.1.XX', proxyPort: 8888);
//   }
//   runApp(const MyApp());
// }
`;
      fs.writeFileSync(targetFile, content, 'utf8');
      return {
        ok: true,
        message: 'Created lib/dev_http_overrides.dart successfully.',
        filePath: targetFile
      };
    } catch (err: any) {
      return { ok: false, message: err.message, filePath: '' };
    }
  }
}

