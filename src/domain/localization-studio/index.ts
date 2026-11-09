import * as fs from 'fs';
import * as path from 'path';

export interface ArbKeyEntry {
  key: string;
  translations: Record<string, string>;
  metadata?: Record<string, any>;
  missingInLocales: string[];
}

export interface LocalizationMatrix {
  projectRoot: string;
  arbDir: string;
  templateArbFile: string;
  templateLocale: string;
  locales: string[];
  entries: ArbKeyEntry[];
  totalKeys: number;
  totalMissing: number;
  hasL10nYaml: boolean;
}

export class LocalizationStudioService {
  public getArbDir(projectRoot: string): { arbDir: string; templateArbFile: string; hasL10nYaml: boolean } {
    const l10nYamlPath = path.join(projectRoot, 'l10n.yaml');
    let arbDir = path.join(projectRoot, 'lib', 'l10n');
    let templateArbFile = 'app_en.arb';
    let hasL10nYaml = false;

    if (fs.existsSync(l10nYamlPath)) {
      hasL10nYaml = true;
      try {
        const content = fs.readFileSync(l10nYamlPath, 'utf8');
        const arbDirMatch = content.match(/arb-dir:\s*([^\r\n#]+)/);
        if (arbDirMatch && arbDirMatch[1]) {
          arbDir = path.isAbsolute(arbDirMatch[1].trim())
            ? arbDirMatch[1].trim()
            : path.join(projectRoot, arbDirMatch[1].trim());
        }
        const templateMatch = content.match(/template-arb-file:\s*([^\r\n#]+)/);
        if (templateMatch && templateMatch[1]) {
          templateArbFile = templateMatch[1].trim();
        }
      } catch {}
    } else {
      // Fallback search
      const fallbackL10n = path.join(projectRoot, 'lib', 'l10n');
      const assetsL10n = path.join(projectRoot, 'assets', 'l10n');
      if (fs.existsSync(fallbackL10n)) {
        arbDir = fallbackL10n;
      } else if (fs.existsSync(assetsL10n)) {
        arbDir = assetsL10n;
      }
    }

    return { arbDir, templateArbFile, hasL10nYaml };
  }

  public getMatrix(projectRoot: string): LocalizationMatrix {
    const { arbDir, templateArbFile, hasL10nYaml } = this.getArbDir(projectRoot);

    if (!fs.existsSync(arbDir)) {
      return {
        projectRoot,
        arbDir,
        templateArbFile,
        templateLocale: 'en',
        locales: [],
        entries: [],
        totalKeys: 0,
        totalMissing: 0,
        hasL10nYaml
      };
    }

    const files = fs.readdirSync(arbDir).filter(f => f.endsWith('.arb'));
    const localesMap: Record<string, { filePath: string; data: Record<string, any> }> = {};

    for (const file of files) {
      const filePath = path.join(arbDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        let localeCode = parsed['@@locale'];
        if (!localeCode) {
          const m = file.match(/_([a-zA-Z0-9_-]+)\.arb$/);
          localeCode = m ? m[1] : file.replace('.arb', '');
        }
        localesMap[localeCode] = { filePath, data: parsed };
      } catch {}
    }

    const locales = Object.keys(localesMap).sort();
    const allKeysSet = new Set<string>();

    for (const locale of locales) {
      const d = localesMap[locale].data;
      for (const k of Object.keys(d)) {
        if (!k.startsWith('@') && !k.startsWith('@@')) {
          allKeysSet.add(k);
        }
      }
    }

    const templateLocale = locales.find(l => templateArbFile.includes(`_${l}.arb`)) || locales[0] || 'en';

    const entries: ArbKeyEntry[] = [];
    let totalMissing = 0;

    for (const key of Array.from(allKeysSet).sort()) {
      const translations: Record<string, string> = {};
      const missingInLocales: string[] = [];
      let metadata: any = undefined;

      for (const locale of locales) {
        const d = localesMap[locale].data;
        if (d[key] !== undefined && d[key] !== null) {
          translations[locale] = String(d[key]);
        } else {
          missingInLocales.push(locale);
          totalMissing++;
        }
        if (!metadata && d[`@${key}`]) {
          metadata = d[`@${key}`];
        }
      }

      entries.push({
        key,
        translations,
        metadata,
        missingInLocales
      });
    }

    return {
      projectRoot,
      arbDir,
      templateArbFile,
      templateLocale,
      locales,
      entries,
      totalKeys: entries.length,
      totalMissing,
      hasL10nYaml
    };
  }

  public saveKey(
    projectRoot: string,
    key: string,
    translations: Record<string, string>,
    metadataDescription?: string
  ): { ok: boolean; message: string } {
    const { arbDir } = this.getArbDir(projectRoot);
    if (!fs.existsSync(arbDir)) {
      return { ok: false, message: 'ARB directory does not exist' };
    }

    try {
      const files = fs.readdirSync(arbDir).filter(f => f.endsWith('.arb'));
      for (const file of files) {
        const filePath = path.join(arbDir, file);
        let raw = '{}';
        try {
          raw = fs.readFileSync(filePath, 'utf8');
        } catch {}
        const data = JSON.parse(raw);
        let localeCode = data['@@locale'];
        if (!localeCode) {
          const m = file.match(/_([a-zA-Z0-9_-]+)\.arb$/);
          localeCode = m ? m[1] : file.replace('.arb', '');
        }

        if (translations[localeCode] !== undefined) {
          data[key] = translations[localeCode];
        }

        if (metadataDescription && file.includes('en')) {
          data[`@${key}`] = { description: metadataDescription };
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }

      return { ok: true, message: `Saved key "${key}" across ARB files.` };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  public initWorkspace(projectRoot: string): { ok: boolean; message: string } {
    try {
      const l10nYamlPath = path.join(projectRoot, 'l10n.yaml');
      if (!fs.existsSync(l10nYamlPath)) {
        fs.writeFileSync(
          l10nYamlPath,
          'arb-dir: lib/l10n\ntemplate-arb-file: app_en.arb\noutput-localization-file: app_localizations.dart\n',
          'utf8'
        );
      }

      const arbDir = path.join(projectRoot, 'lib', 'l10n');
      if (!fs.existsSync(arbDir)) {
        fs.mkdirSync(arbDir, { recursive: true });
      }

      const enPath = path.join(arbDir, 'app_en.arb');
      if (!fs.existsSync(enPath)) {
        const enData = {
          '@@locale': 'en',
          appTitle: 'Air Flutter App',
          '@appTitle': {
            description: 'The title of the application'
          },
          welcomeMessage: 'Welcome to Flutter!',
          '@welcomeMessage': {
            description: 'Greeting displayed on home screen'
          }
        };
        fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), 'utf8');
      }

      const arPath = path.join(arbDir, 'app_ar.arb');
      if (!fs.existsSync(arPath)) {
        const arData = {
          '@@locale': 'ar',
          appTitle: 'تطبيق فلاتر',
          welcomeMessage: 'مرحباً بك في فلاتر!'
        };
        fs.writeFileSync(arPath, JSON.stringify(arData, null, 2), 'utf8');
      }

      return {
        ok: true,
        message: 'Initialized l10n.yaml and default app_en.arb / app_ar.arb files.'
      };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  public generateAiPrompt(projectRoot: string, targetLocale: string): string {
    const matrix = this.getMatrix(projectRoot);
    let missingEntries = matrix.entries.filter(e => e.missingInLocales.includes(targetLocale));
    if (missingEntries.length === 0 && !matrix.locales.includes(targetLocale)) {
      missingEntries = matrix.entries;
    }

    if (missingEntries.length === 0) {
      return `No missing keys found for locale "${targetLocale}". Everything is up to date!`;
    }

    const payloadToTranslate: Record<string, string> = {};
    for (const item of missingEntries) {
      const sourceVal = item.translations[matrix.templateLocale] || Object.values(item.translations)[0] || '';
      payloadToTranslate[item.key] = sourceVal;
    }

    return [
      `You are a professional Flutter localization translator.`,
      `Translate the following JSON key-value pairs into target locale: "${targetLocale}".`,
      `Preserve any Flutter ICU format tokens (like {count}, {name}, etc.). Return only valid JSON:`,
      '```json',
      JSON.stringify(payloadToTranslate, null, 2),
      '```'
    ].join('\n');
  }
}
