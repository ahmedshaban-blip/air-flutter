import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface DeepLinkSuggestion {
  label: string;
  uri: string;
  scheme: string;
  host?: string;
}

export interface IntentDispatchRequest {
  deviceId: string;
  uri: string;
  packageName?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

export interface PushDispatchRequest {
  deviceId: string;
  packageName: string;
  payload: PushNotificationPayload;
}

export interface IntentDispatchResult {
  ok: boolean;
  kind: 'launched' | 'unresolved' | 'failed';
  summary: string;
  output: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  errorMessage?: string;
}

export type IntentProcessRunner = (
  executable: string,
  args: string[],
  timeout: number
) => Promise<ProcessResult>;

const URI_MAX_LENGTH = 4096;
const NO_ACTIVITY_PATTERN = /(?:unable to resolve intent|no activity found|activity not started)/i;

export interface DeepLinkStateStore {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): PromiseLike<void>;
}

/** Workspace-backed MRU list; constructing a new instance restores persisted links. */
export class DeepLinkHistory {
  public static readonly key = 'deepLinkIntentStudio.recentUris';

  constructor(private readonly storage: DeepLinkStateStore, private readonly limit = 10) {}

  public list(): string[] {
    const stored = this.storage.get<string[]>(DeepLinkHistory.key, []);
    return Array.isArray(stored) ? stored.filter(value => typeof value === 'string').slice(0, this.limit) : [];
  }

  public async remember(uri: string): Promise<string[]> {
    const next = [uri, ...this.list().filter(value => value !== uri)].slice(0, this.limit);
    await this.storage.update(DeepLinkHistory.key, next);
    return next;
  }
}

/** Executes Android VIEW intents without ever constructing a host shell command. */
export class DeepLinkIntentStudio {
  constructor(
    private readonly getADBExecutable: () => Promise<string>,
    private readonly runProcess: IntentProcessRunner = DeepLinkIntentStudio.execute
  ) {}

  public async dispatch(request: IntentDispatchRequest): Promise<IntentDispatchResult> {
    const deviceId = DeepLinkIntentStudio.validateDeviceId(request.deviceId);
    const uri = DeepLinkIntentStudio.validateUri(request.uri);
    const packageName = DeepLinkIntentStudio.validatePackageName(request.packageName);
    const args = [
      '-s', deviceId,
      'shell', 'am', 'start', '-W',
      '-a', 'android.intent.action.VIEW',
      '-d', uri,
      ...(packageName ? [packageName] : [])
    ];

    const adb = await this.getADBExecutable();
    const result = await this.runProcess(adb, args, 20000);
    return DeepLinkIntentStudio.parseResult(result);
  }

  public static validateUri(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Enter a deep link URI.');
    const uri = value.trim();
    if (!uri) throw new Error('Enter a deep link URI.');
    if (uri.length > URI_MAX_LENGTH) throw new Error(`URI exceeds ${URI_MAX_LENGTH} characters.`);
    if (/[^\x20-\x7E]/.test(uri)) throw new Error('URI contains control or non-ASCII characters; percent-encode them first.');
    if (/\s/.test(uri)) throw new Error('URI cannot contain spaces; percent-encode them as %20.');
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(uri)) {
      throw new Error('Malformed URI: include a scheme such as https:// or myapp://.');
    }
    return uri;
  }

  public static validateDeviceId(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(value)) {
      throw new Error('Select a valid connected Android device.');
    }
    return value;
  }

  public static validatePackageName(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error('Invalid Android package name.');
    const packageName = value.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
      throw new Error('Invalid Android package name. Use a value such as com.example.app.');
    }
    return packageName;
  }

  public static parseResult(result: ProcessResult): IntentDispatchResult {
    const output = [result.stdout, result.stderr, result.errorMessage].filter(Boolean).join('\n').trim();
    if (NO_ACTIVITY_PATTERN.test(output)) {
      return {
        ok: false,
        kind: 'unresolved',
        summary: 'No Activity found for this URI. Check the manifest intent filter and target package.',
        output
      };
    }
    if (result.errorMessage || /\b(?:error|exception):/i.test(output)) {
      return {
        ok: false,
        kind: 'failed',
        summary: output || 'ADB failed to dispatch the intent.',
        output
      };
    }
    return {
      ok: true,
      kind: 'launched',
      summary: DeepLinkIntentStudio.successSummary(output),
      output
    };
  }

  public static detectManifestLinks(projectPath: string): DeepLinkSuggestion[] {
    const manifestPath = path.join(projectPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    if (!fs.existsSync(manifestPath)) return [];
    return DeepLinkIntentStudio.extractManifestLinks(fs.readFileSync(manifestPath, 'utf8'));
  }

  public static extractManifestLinks(xml: string): DeepLinkSuggestion[] {
    const suggestions = new Map<string, DeepLinkSuggestion>();
    const addSuggestion = (scheme: string, host?: string) => {
      if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(scheme)) return;
      const uri = host ? `${scheme}://${host}` : `${scheme}://`;
      suggestions.set(uri, {
        label: host ? `${scheme} · ${host}` : scheme,
        uri,
        scheme,
        ...(host ? { host } : {})
      });
    };

    const filters = xml.match(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/gi) || [];
    for (const filter of filters) {
      const tags = filter.match(/<data\b[^>]*>/gi) || [];
      const schemes = tags.map(tag => DeepLinkIntentStudio.readAndroidAttribute(tag, 'scheme')).filter((value): value is string => Boolean(value));
      const hosts = tags.map(tag => DeepLinkIntentStudio.readAndroidAttribute(tag, 'host')).filter((value): value is string => Boolean(value));
      for (const scheme of schemes) {
        if (hosts.length) hosts.forEach(host => addSuggestion(scheme, host));
        else addSuggestion(scheme);
      }
    }

    // Also support isolated data tags in malformed or generated manifest fragments.
    const outsideFilters = xml.replace(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/gi, '');
    for (const tag of outsideFilters.match(/<data\b[^>]*>/gi) || []) {
      const scheme = DeepLinkIntentStudio.readAndroidAttribute(tag, 'scheme');
      if (scheme) addSuggestion(scheme, DeepLinkIntentStudio.readAndroidAttribute(tag, 'host'));
    }
    return Array.from(suggestions.values());
  }

  private static readAndroidAttribute(tag: string, name: string): string | undefined {
    const match = tag.match(new RegExp(`(?:android:)?${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return match?.[1]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private static successSummary(output: string): string {
    const activity = output.match(/(?:Activity|cmp)=([^\s}]+)/i)?.[1];
    const status = output.match(/^Status:\s*(.+)$/im)?.[1];
    if (activity) return `Intent launched in ${activity}.`;
    if (status) return `Intent dispatched successfully (Status: ${status}).`;
    return 'Intent dispatched successfully.';
  }

  public async dispatchPush(request: PushDispatchRequest): Promise<IntentDispatchResult> {
    const deviceId = DeepLinkIntentStudio.validateDeviceId(request.deviceId);
    const packageName = DeepLinkIntentStudio.validatePackageName(request.packageName);
    if (!packageName) {
      throw new Error('Package name is required for push notification dispatch.');
    }
    const title = request.payload.title || 'Air Flutter Test';
    const body = request.payload.body || 'Testing push notifications';
    const deepLink = request.payload.deepLink || '';

    // Construct ADB broadcast command simulating an FCM notification arrival
    const args = [
      '-s', deviceId,
      'shell', 'am', 'broadcast',
      '-a', `${packageName}.NOTIFICATION_RECEIVED`,
      '--es', 'title', title,
      '--es', 'body', body,
      ...(deepLink ? ['--es', 'click_action', deepLink] : []),
      packageName
    ];

    const adb = await this.getADBExecutable();
    const result = await this.runProcess(adb, args, 15000);
    return {
      ok: !result.errorMessage,
      kind: result.errorMessage ? 'failed' : 'launched',
      summary: result.errorMessage ? `Broadcast failed: ${result.errorMessage}` : `Push notification dispatched to ${packageName}`,
      output: result.stdout || result.stderr
    };
  }

  private static execute(executable: string, args: string[], timeout: number): Promise<ProcessResult> {
    return new Promise(resolve => {
      execFile(executable, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          ...(error ? { errorMessage: error.message } : {})
        });
      });
    });
  }
}
