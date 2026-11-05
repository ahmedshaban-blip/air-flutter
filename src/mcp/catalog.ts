/**
 * Air Flutter - MCP & AI Agent Hub
 * The pre-configured catalog of Flutter-focused MCP servers.
 *
 * Every entry is declarative: command, args, transport, runtime and the
 * parameters the wizard must collect. Adapters translate these definitions
 * into agent-specific file shapes.
 *
 * Servers that need a package inside the user's own Flutter app declare a
 * `companionPackage`, which the hub offers to install and wire up.
 *
 * Package names are pinned loosely on purpose so users receive upstream
 * fixes; the doc comment on each entry records the canonical source.
 */

import { McpCategory, McpServerDefinition } from './types';

/** Validation helper: reject empty/whitespace-only input. */
const required = (value: string): string | undefined =>
  value && value.trim().length > 0 ? undefined : 'This value is required.';

/** Validation helper: require an http(s) URL. */
const isHttpUrl = (value: string): string | undefined => {
  if (!/^https?:\/\//i.test(value.trim())) {
    return 'Enter a full URL starting with http:// or https://';
  }
  return undefined;
};

/**
 * The catalog. Order is meaningful: it drives prerequisite grouping and the
 * wizard's listing order within each category.
 */
export const MCP_CATALOG: McpServerDefinition[] = [
  // ---------------------------------------------------------------------------
  // Flutter & Dart Core
  // ---------------------------------------------------------------------------
  {
    id: 'flutter-dart-mcp',
    name: 'Dart & Flutter MCP Server',
    category: 'Flutter & Dart Core',
    badge: 'Official',
    description:
      'SDK-native tools: dart analyze, dart fix, flutter test, formatting and pub workflows.',
    transport: 'stdio',
    runtime: 'dart',
    command: 'dart',
    // The official MCP server ships with the Dart SDK. Users on older SDKs
    // can switch to the pub-hosted launcher shown in the README.
    args: ['mcp-server', '--port', '0'],
    env: {},
    parameters: [],
    extra: { note: 'Requires Dart SDK 3.5+ which bundles the dart mcp-server command.' },
    defaultInstructions:
      'Prefer `dart analyze` and `dart fix --apply` before suggesting manual edits, and always run `flutter test` after modifying widget or state code.',
    instructionTemplates: [
      {
        label: 'Analyze then fix',
        description: 'Run the analyzer first and only apply automatic fixes when safe.',
        value:
          'Always run `dart analyze` before proposing changes. When issues are purely mechanical, prefer `dart fix --apply` over hand-editing. Re-run the analyzer after every fix and report any remaining issues explicitly.'
      },
      {
        label: 'Test-after-change',
        description: 'Force a test run after each code change.',
        value:
          'After any change to files under lib/, run `flutter test` and report the result. If tests fail, do not move on until the failure is explained and resolved.'
      }
    ]
  },
  {
    id: 'pubdev-mcp',
    name: 'pub.dev MCP Server',
    category: 'Flutter & Dart Core',
    description:
      'Package discovery, live documentation lookups and version/dependency conflict checks.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'devqxi/pubdev-mcp-server'],
    env: {},
    parameters: [],
    defaultInstructions:
      'Prefer the latest stable published version of a package. Check the current version and Flutter/Dart SDK constraints before suggesting a dependency change.',
    instructionTemplates: [
      {
        label: 'Check SDK constraints',
        description: 'Verify package compatibility with the project SDK before adding.',
        value:
          'Before recommending any package, verify its latest version supports the Flutter and Dart SDK constraints declared in this project. Report the exact version numbers you validated.'
      },
      {
        label: 'Pin to exact versions',
        description: 'Suggest pinned versions rather than loose ranges.',
        value:
          'When adding or upgrading a dependency, propose a pinned version (no caret range) and explain the reason. Never upgrade a package across a major version without flagging the breaking changes.'
      }
    ]
  },
  {
    id: 'devdocs-mcp',
    name: 'DevDocs MCP Server',
    category: 'Flutter & Dart Core',
    description:
      'Up-to-date offline docs for Riverpod, Bloc, GoRouter, Flutter SDK and Dart core.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@arabold/docs-mcp-server'],
    env: {},
    parameters: [
      {
        key: 'DOCS_LIBRARIES',
        label: 'Documentation libraries to index',
        description:
          'Comma-separated list of docs to make searchable, e.g. riverpod,bloc,go_router,flutter',
        placeholder: 'riverpod,bloc,go_router,flutter',
        defaultValue: 'riverpod,bloc,go_router,flutter',
        required: false
      }
    ],
    defaultInstructions:
      'Ground every framework answer in the indexed documentation for this project. When APIs differ between versions, state which version the guidance applies to.',
    instructionTemplates: [
      {
        label: 'Prefer indexed docs',
        description: 'Require answers to come from the indexed docs, not memory.',
        value:
          'Answer framework questions using the indexed documentation only. If the docs do not cover something, say so explicitly instead of guessing from memory.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Backend & Database
  // ---------------------------------------------------------------------------
  {
    id: 'firebase-mcp',
    name: 'Firebase MCP Server',
    category: 'Backend & Database',
    badge: 'Official',
    description:
      'Firestore rules, Firebase Auth, Cloud Functions and Remote Config management.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'firebase-tools@latest', 'experimental:mcp', '--dir', '.' ],
    env: {},
    parameters: [
      {
        key: 'FIREBASE_PROJECT_ID',
        label: 'Firebase project ID',
        description: 'Optional. Leave empty to let the server infer the project from .firebaserc.',
        placeholder: 'my-flutter-app-12345',
        required: false
      },
      {
        key: 'GOOGLE_APPLICATION_CREDENTIALS',
        label: 'Service account JSON path (optional)',
        description:
          'Absolute path to a service account key file. Leave empty if you use firebase login.',
        placeholder: 'C:\\keys\\firebase-adminsdk.json',
        required: false
      }
    ],
    defaultInstructions:
      'Always target the configured Firebase project. Never deploy Firestore rules, Cloud Functions or Remote Config to any other project or environment unless explicitly instructed.',
    instructionTemplates: [
      {
        label: 'Pin to one project',
        description: 'Prevent accidental writes to a different Firebase project.',
        value:
          "Always operate on the '<YOUR_PROJECT_ID>' Firebase project exclusively. Before any deploy or write operation, state the target project id explicitly and stop if it does not match '<YOUR_PROJECT_ID>'."
      },
      {
        label: 'Dry-run rules first',
        description: 'Always validate security rules before deploying.',
        value:
          'For any change to Firestore or Storage security rules, show the full diff and explain the resulting access model first. Never deploy rules without an explicit deploy instruction.'
      }
    ]
  },
  {
    id: 'supabase-mcp',
    name: 'Supabase MCP Server',
    category: 'Backend & Database',
    badge: 'Official',
    description:
      'SQL querying, schema inspection, RLS policy auditing and Dart model generation.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@supabase/mcp-server-supabase@latest', '--read-only'],
    env: {},
    parameters: [
      {
        key: 'SUPABASE_URL',
        label: 'Supabase project URL',
        description: 'Found in Supabase dashboard → Project Settings → API.',
        placeholder: 'https://abcdefghijklm.supabase.co',
        required: true,
        validate: isHttpUrl
      },
      {
        key: 'SUPABASE_ACCESS_TOKEN',
        label: 'Supabase access token',
        description:
          'Personal access token from https://supabase.com/dashboard/account/tokens',
        placeholder: 'sbp_xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      },
      {
        key: 'SUPABASE_ANON_KEY',
        label: 'Supabase anon/public key (optional)',
        description: 'Used by some tooling for client-side schema reflections.',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
        secret: true,
        required: false
      }
    ],
    defaultInstructions:
      'Always operate strictly within the intended schema for this project. All queries, migrations, table inspections and data operations must target that schema exclusively. Never touch `public` or other schemas unless explicitly asked.',
    instructionTemplates: [
      {
        label: 'Restrict to a single schema',
        description:
          'Lock every query and migration to one schema, never touching public.',
        value:
          "Always operate strictly within the '<YOUR_SCHEMA>' schema for this project. All queries, migrations, table inspections, and data operations must target '<YOUR_SCHEMA>' exclusively and never interact with 'public' or other schemas unless explicitly requested."
      },
      {
        label: 'Prefer read-only inspection',
        description: 'Inspect and explain first; never mutate without confirmation.',
        value:
          'Treat this project as read-only by default. Inspect schemas, run SELECT queries and explain results, but never execute INSERT, UPDATE, DELETE, ALTER or DROP statements without an explicit, unambiguous instruction naming the exact table and operation.'
      },
      {
        label: 'Generate Dart models on demand',
        description: 'Ask for Dart model generation after schema work.',
        value:
          'After any schema change or inspection, offer to generate matching Dart model classes using freezed and json_serializable conventions. Do not write generated files into the repository unless asked.'
      }
    ]
  },
  {
    id: 'appwrite-mcp',
    name: 'Appwrite MCP Server',
    category: 'Backend & Database',
    description:
      'Appwrite databases, storage buckets, authentication and serverless function execution.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'appwrite-mcp-server'],
    env: {},
    parameters: [
      {
        key: 'APPWRITE_ENDPOINT',
        label: 'Appwrite endpoint',
        description: 'Your Appwrite API endpoint.',
        placeholder: 'https://cloud.appwrite.io/v1',
        defaultValue: 'https://cloud.appwrite.io/v1',
        required: true,
        validate: isHttpUrl
      },
      {
        key: 'APPWRITE_PROJECT_ID',
        label: 'Appwrite project ID',
        description: 'Found in your Appwrite console project settings.',
        placeholder: '65f0a1b2c3d4e5f6a7b8',
        required: true,
        validate: required
      },
      {
        key: 'APPWRITE_API_KEY',
        label: 'Appwrite API key',
        description: 'Server API key with the scopes your project needs.',
        placeholder: 'standard_xxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      }
    ],
    defaultInstructions:
      'Always target the configured Appwrite project. Inspect collections and storage buckets read-only and never delete or overwrite data without an explicit instruction.',
    instructionTemplates: [
      {
        label: 'Pin to one project',
        description: 'Prevent writes to a different Appwrite project.',
        value:
          'Operate only on the configured Appwrite project id. State the target project explicitly before any write, and stop if it does not match.'
      },
      {
        label: 'Read-only inspection',
        description: 'Inspect collections and buckets without mutating.',
        value:
          'Inspect databases, collections, storage buckets and function definitions read-only. Never create, update or delete documents, files or functions unless explicitly instructed.'
      }
    ]
  },
  {
    id: 'sqlite-mcp',
    name: 'SQLite MCP Server',
    category: 'Backend & Database',
    description:
      'Query local SQLite databases used by sqflite / drift for schema and data debugging.',
    transport: 'stdio',
    runtime: 'python',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', './app.db'],
    env: {},
    parameters: [
      {
        key: 'MCP_SQLITE_DB_PATH',
        label: 'Path to SQLite database file',
        description:
          'Relative to the workspace or absolute. Created on first write if missing.',
        placeholder: './app.db',
        defaultValue: './app.db',
        required: true,
        validate: required
      }
    ],
    defaultInstructions:
      'Inspect the local database read-only and explain the schema before changing anything. Match findings against the sqflite or drift definitions in the project.',
    instructionTemplates: [
      {
        label: 'Read-only inspection',
        description: 'Never mutate the local database without instruction.',
        value:
          'Inspect tables, columns and indexes read-only. Never run INSERT, UPDATE, DELETE or DDL statements against the local database unless an instruction explicitly names the exact operation.'
      }
    ]
  },
  {
    id: 'postgres-mcp',
    name: 'PostgreSQL MCP Server',
    category: 'Backend & Database',
    description:
      'Relational schema checks and Flutter repository contract validation against Postgres.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {},
    parameters: [
      {
        key: 'POSTGRES_CONNECTION_STRING',
        label: 'Postgres connection string',
        description: 'Full connection URI including credentials.',
        placeholder: 'postgresql://user:password@localhost:5432/mydb',
        secret: true,
        required: true,
        validate: (v) =>
          /^postgres(ql)?:\/\//i.test(v.trim())
            ? undefined
            : 'Enter a valid postgresql:// connection string.'
      }
    ],
    defaultInstructions:
      'Treat this database as read-only by default. Inspect schema and run SELECT queries, and never mutate data or schema without an explicit instruction naming the exact operation.',
    instructionTemplates: [
      {
        label: 'Read-only inspection',
        description: 'Never write without an explicit instruction.',
        value:
          'Never execute INSERT, UPDATE, DELETE, ALTER, DROP or TRUNCATE. Read schema, run SELECT queries and explain results only, unless an instruction explicitly names the exact write operation.'
      },
      {
        label: 'Validate repository contracts',
        description: 'Cross-check schema against the Flutter data layer.',
        value:
          'When inspecting a table, compare its columns and nullability against the corresponding Flutter repository model and report any mismatch between the schema and the Dart data classes.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Design & UI
  // ---------------------------------------------------------------------------
  {
    id: 'figma-mcp',
    name: 'Figma MCP Server',
    category: 'Design & UI',
    badge: 'Official',
    description:
      'Layout tokens, typography, padding extraction and direct design-to-Flutter widget generation.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'figma-developer-mcp', '--stdio'],
    env: {},
    parameters: [
      {
        key: 'FIGMA_API_KEY',
        label: 'Figma personal access token',
        description:
          'Create one at https://www.figma.com/developers/api#access-tokens',
        placeholder: 'figd_xxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      },
      {
        key: 'FIGMA_FILE_KEY',
        label: 'Figma file key (optional)',
        description:
          'Pin a default Figma file so the agent can resolve it automatically.',
        placeholder: 'AbCdEfGh1234567890',
        required: false
      }
    ],
    defaultInstructions:
      'Generate Flutter widgets that match the extracted design tokens exactly, and reuse this project’s existing theme and design-system widgets instead of hardcoding raw values.',
    instructionTemplates: [
      {
        label: 'Reuse project design system',
        description: 'Map tokens onto the existing theme rather than hardcoding.',
        value:
          "When translating a design into Flutter, map colors to the project's ThemeData ColorScheme, spacing to the design system constants, and typography to the app text theme. Never hardcode raw hex colors or magic numbers in widget code."
      },
      {
        label: 'Split widgets into files',
        description: 'Enforce one widget per file in the screen widgets folder.',
        value:
          'Keep the main screen file as composition only. Place every extracted widget in its own Dart file inside that screen’s dedicated widgets/ folder.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Device & QA
  // ---------------------------------------------------------------------------
  {
    id: 'adb-mcp',
    name: 'Android ADB MCP Server',
    category: 'Device & QA',
    description:
      'Device/emulator automation, screenshot capture, UI hierarchy dumps and logcat streaming.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'mcp-server-adb'],
    env: {},
    parameters: [
      {
        key: 'ADB_PATH',
        label: 'Full path to adb executable (optional)',
        description:
          'Leave empty to use adb from PATH. Air Flutter can auto-detect this for you.',
        placeholder: 'C:\\Users\\you\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
        required: false
      },
      {
        key: 'ANDROID_SERIAL',
        label: 'Target device serial (optional)',
        description:
          'Pin a specific device when several are connected. See `adb devices`.',
        placeholder: 'emulator-5554',
        required: false
      }
    ],
    defaultInstructions:
      'Before any destructive device action (uninstall, clear data, reboot), state the exact command and the target device serial, and wait for confirmation.',
    instructionTemplates: [
      {
        label: 'Confirm destructive actions',
        description: 'Require confirmation before uninstall, clear or reboot.',
        value:
          'Before running any destructive device command such as `pm clear`, `uninstall`, `reboot` or `am force-stop`, print the exact command and the target device serial and wait for explicit confirmation.'
      },
      {
        label: 'Filter logcat by package',
        description: 'Only surface logs for this app, not the whole device.',
        value:
          'When reading logcat, filter to this application’s package and its Flutter engine tags. Do not dump unfiltered device logs unless asked.'
      }
    ]
  },
  {
    id: 'marionette-mcp',
    name: 'Marionette MCP Server',
    category: 'Device & QA',
    description:
      'Drive a running Flutter app: inspect the widget tree, tap, type, scroll and screenshot.',
    transport: 'stdio',
    // The official bridge is a Dart package activated globally, not an npm one.
    runtime: 'dart',
    command: 'marionette_mcp',
    args: [],
    env: {},
    parameters: [],
    companionPackage: {
      packageName: 'marionette_flutter',
      addCommand: 'flutter pub add marionette_flutter',
      docsUrl: 'https://pub.dev/packages/marionette_flutter',
      requiredImport: "import 'package:marionette_flutter/marionette_flutter.dart';",
      bindingCall: 'MarionetteBinding.ensureInitialized()',
      mainDartSnippet: `void main() {
  if (kDebugMode) {
    MarionetteBinding.ensureInitialized();
  } else {
    WidgetsFlutterBinding.ensureInitialized();
  }
  runApp(const MyApp());
}`,
      setupSteps: [
        'Add the package to your app: flutter pub add marionette_flutter',
        'Open lib/main.dart and add the marionette_flutter import.',
        'Initialize MarionetteBinding in main() inside a kDebugMode check, so it never runs in release builds.',
        'Activate the MCP bridge: dart pub global activate marionette_mcp',
        'Run your app in debug mode (flutter run) and copy the VM service URI it prints.',
        'Ask your agent to connect using that URI, then it can drive the app.'
      ]
    },
    defaultInstructions:
      'Drive the running app the way a real user would: tap real widgets, wait for frames to settle, and verify state through the widget tree rather than by reading source code.',
    instructionTemplates: [
      {
        label: 'Verify visually before concluding',
        description: 'Confirm UI state through the widget tree, not assumptions.',
        value:
          'After every interaction, inspect the widget tree to confirm the resulting state before concluding it worked. Never assume a tap succeeded without verifying the tree changed as expected.'
      },
      {
        label: 'Debug-build only',
        description: 'Never leave testing hooks enabled in a release build.',
        value:
          'Assume the app exposes Marionette only in debug builds, guarded by kDebugMode. Never suggest removing that guard or shipping the binding in a release build.'
      }
    ]
  },
  {
    id: 'mobile-mcp',
    name: 'Mobile MCP Server (Android / iOS)',
    category: 'Device & QA',
    description:
      'Platform-agnostic device automation for emulators, simulators and real Android/iOS devices.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@mobilenext/mobile-mcp@latest'],
    env: {},
    parameters: [
      {
        key: 'MOBILEMCP_DISABLE_TELEMETRY',
        label: 'Disable anonymous telemetry',
        description:
          'Set to 1 to opt out of the server’s anonymous usage telemetry.',
        placeholder: '1',
        defaultValue: '1',
        required: false
      },
      {
        key: 'ANDROID_HOME',
        label: 'Android SDK path (optional)',
        description:
          'Only needed when the Android SDK is not already discoverable via the environment.',
        placeholder: 'C:\\Users\\you\\AppData\\Local\\Android\\Sdk',
        required: false
      }
    ],
    defaultInstructions:
      'Before installing, uninstalling or clearing app data on a device, state the exact target device and package and wait for confirmation. Prefer accessibility-based element targeting over raw coordinates.',
    instructionTemplates: [
      {
        label: 'Accessibility-first interaction',
        description: 'Read the accessibility tree instead of guessing coordinates.',
        value:
          'Drive the device from the accessibility tree: list elements on screen and target them by their ref rather than by raw coordinates. Only fall back to coordinates when no accessible element matches.'
      },
      {
        label: 'Confirm destructive device actions',
        description: 'Require confirmation before uninstall or clear-data.',
        value:
          'Before running any destructive tool such as mobile_uninstall_app or mobile_clear_app_data, print the target device and package and wait for explicit confirmation.'
      },
      {
        label: 'Keep telemetry off',
        description: 'Do not re-enable anonymous telemetry.',
        value:
          'Leave MOBILEMCP_DISABLE_TELEMETRY enabled. Never suggest removing it or re-enabling anonymous telemetry.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // API & Network
  // ---------------------------------------------------------------------------
  {
    id: 'openapi-mcp',
    name: 'OpenAPI / Swagger MCP Server',
    category: 'API & Network',
    description:
      'Read live Swagger/OpenAPI specs to generate typed Dio or Retrofit HTTP clients.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'openapi-mcp-server'],
    env: {},
    parameters: [
      {
        key: 'OPENAPI_SPEC_URL',
        label: 'OpenAPI / Swagger spec URL or path',
        description:
          'Point at a live JSON/YAML spec endpoint or a local file path.',
        placeholder: 'https://api.example.com/openapi.json',
        required: true,
        validate: required
      },
      {
        key: 'OPENAPI_BEARER_TOKEN',
        label: 'Bearer token for the spec (optional)',
        description: 'Only needed when the spec endpoint is authenticated.',
        placeholder: 'eyJhbGciOi...',
        secret: true,
        required: false
      }
    ],
    defaultInstructions:
      'Generate typed HTTP clients that match this project’s existing networking layer, and always derive request and response models from the specification rather than guessing field names.',
    instructionTemplates: [
      {
        label: 'Generate Dio clients',
        description: 'Produce typed Dio/Retrofit code matching project conventions.',
        value:
          'Generate typed Dio or Retrofit client code that follows this project’s existing repository and data-source structure. Derive every model field from the specification and never invent field names.'
      }
    ]
  },
  {
    id: 'fetch-mcp',
    name: 'Fetch / HTTP MCP Server',
    category: 'API & Network',
    badge: 'Official',
    description:
      'Live REST endpoint testing, JSON payload inspection and mock response capture.',
    transport: 'stdio',
    runtime: 'python',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    env: {},
    parameters: [
      {
        key: 'FETCH_USER_AGENT',
        label: 'Default User-Agent header (optional)',
        description: 'Sent with every request; useful for staging API gateways.',
        placeholder: 'air-flutter-mcp/1.0',
        defaultValue: 'air-flutter-mcp/1.0',
        required: false
      }
    ]
  },
  {
    id: 'postman-mcp',
    name: 'Postman MCP Server',
    category: 'API & Network',
    description:
      'Inspect Postman collections and translate them into Flutter repository services.',
    transport: 'http',
    runtime: 'remote',
    command: '',
    args: [],
    url: 'https://mcp.postman.com/mcp',
    env: {},
    parameters: [
      {
        key: 'POSTMAN_API_KEY',
        label: 'Postman API key',
        description:
          'Create one at https://web.postman.co/settings/me/api-keys',
        placeholder: 'PMAK-xxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // DevOps & Observability
  // ---------------------------------------------------------------------------
  {
    id: 'sentry-mcp',
    name: 'Sentry MCP Server',
    category: 'DevOps & Observability',
    badge: 'Official',
    description:
      'Mobile crash stack traces, exception diagnostics and real-time error triage.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@sentry/mcp-server@latest'],
    env: {},
    parameters: [
      {
        key: 'SENTRY_AUTH_TOKEN',
        label: 'Sentry auth token',
        description:
          'Create one at https://sentry.io/settings/account/api/auth-tokens/',
        placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      },
      {
        key: 'SENTRY_HOST',
        label: 'Sentry host (optional)',
        description: 'Set for self-hosted Sentry; leave empty for sentry.io.',
        placeholder: 'sentry.io',
        defaultValue: 'sentry.io',
        required: false
      },
      {
        key: 'SENTRY_ORG',
        label: 'Sentry organization slug (optional)',
        description: 'Pins the default organization for multi-org accounts.',
        placeholder: 'my-org',
        required: false
      }
    ],
    defaultInstructions:
      'Focus triage on this mobile app’s releases. Group crashes by root cause and always map the stack trace back to the originating Dart or native frame before proposing a fix.',
    instructionTemplates: [
      {
        label: 'Root-cause first',
        description: 'Group by root cause and locate the Dart frame.',
        value:
          'Group crash reports by root cause rather than by raw message. For each group, identify the originating Dart or native frame and explain the failure mechanism before suggesting a fix.'
      },
      {
        label: 'Ignore known noise',
        description: 'Deprioritise known non-actionable events.',
        value:
          'Deprioritise crashes originating from OS-level or third-party native SDKs that this app cannot fix, and say so explicitly instead of proposing a workaround.'
      }
    ]
  },
  {
    id: 'github-mcp',
    name: 'GitHub MCP Server',
    category: 'DevOps & Observability',
    badge: 'Official',
    description:
      'PR reviews, Git diffs, issue tracking and GitHub Actions Flutter build monitoring.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {},
    parameters: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'GitHub personal access token',
        description:
          'Fine-grained token with repo, workflow and pull-request scopes.',
        placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      }
    ],
    defaultInstructions:
      'Never push, force-push, merge or close issues and pull requests without an explicit instruction. Prefer draft pull requests and always summarize the diff before proposing a change.',
    instructionTemplates: [
      {
        label: 'No pushes without approval',
        description: 'Review the diff first; never push or merge automatically.',
        value:
          'Never run `git push`, force-push, merge a pull request, or close an issue without an explicit instruction. Always show the diff and summarize the impact first.'
      },
      {
        label: 'Monitor Flutter CI',
        description: 'Check the Flutter build workflow when reporting on a PR.',
        value:
          'When reporting on a pull request, always check the status of the Flutter build and test workflows and surface any failing job with its failing step.'
      }
    ]
  },
  {
    id: 'gitlab-mcp',
    name: 'GitLab MCP Server',
    category: 'DevOps & Observability',
    description:
      'GitLab merge requests and enterprise CI/CD mobile pipeline automation.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gitlab'],
    env: {},
    parameters: [
      {
        key: 'GITLAB_PERSONAL_ACCESS_TOKEN',
        label: 'GitLab personal access token',
        description: 'Token with api scope from your GitLab profile settings.',
        placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      },
      {
        key: 'GITLAB_API_URL',
        label: 'GitLab API URL',
        description: 'Change only when using a self-managed GitLab instance.',
        placeholder: 'https://gitlab.com/api/v4',
        defaultValue: 'https://gitlab.com/api/v4',
        required: false
      }
    ]
  },
  {
    id: 'fastlane-mcp',
    name: 'Fastlane / Mobile DevOps MCP Server',
    category: 'DevOps & Observability',
    description:
      'Release pipelines, code signing, TestFlight and Google Play deployment automation.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', 'fastlane-mcp-server'],
    env: {},
    parameters: [
      {
        key: 'FASTLANE_APP_IDENTIFIER',
        label: 'App bundle identifier',
        description: 'iOS bundle id / Android applicationId used by lanes.',
        placeholder: 'com.example.myflutterapp',
        required: true,
        validate: required
      },
      {
        key: 'FASTLANE_GOOGLE_PLAY_JSON_KEY',
        label: 'Google Play service account JSON path (optional)',
        description: 'Path to the Play Console service account key file.',
        placeholder: 'android/app/play-service-account.json',
        required: false
      },
      {
        key: 'FASTLANE_APPLE_APP_ID',
        label: 'Apple App Store Connect app id (optional)',
        description: 'Numeric App Store Connect app id for TestFlight uploads.',
        placeholder: '1234567890',
        required: false
      }
    ],
    defaultInstructions:
      'Never trigger a store submission or production deployment without an explicit instruction. Isolate signing credentials and never print secret values into logs.',
    instructionTemplates: [
      {
        label: 'No production deploys',
        description: 'Require confirmation before TestFlight or Play uploads.',
        value:
          'Never run a release lane that uploads to TestFlight or Google Play without an explicit instruction. Always run the build and validate steps first and report the result.'
      },
      {
        label: 'Protect signing secrets',
        description: 'Keep credentials out of logs and diffs.',
        value:
          'Never print keystore passwords, service account JSON contents or signing identities into logs or diffs. Reference them by path only.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Knowledge & Research
  // ---------------------------------------------------------------------------
  {
    id: 'brave-search-mcp',
    name: 'Brave Search MCP Server',
    category: 'Knowledge & Research',
    description:
      'Web search for Gradle, CocoaPods, Xcode build fixes and framework release changes.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {},
    parameters: [
      {
        key: 'BRAVE_API_KEY',
        label: 'Brave Search API key',
        description:
          'Get a free key at https://brave.com/search/api/',
        placeholder: 'BSAxxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        required: true,
        validate: required
      }
    ],
    defaultInstructions:
      'Prefer official documentation and release notes over forum posts. Always cite the source URL and the version the guidance applies to.',
    instructionTemplates: [
      {
        label: 'Prefer official sources',
        description: 'Weight official docs and changelogs above forum answers.',
        value:
          'Prefer official documentation, changelogs and release notes over forum or blog posts. Always cite the source URL and state which version the guidance applies to.'
      },
      {
        label: 'Target build-tool errors',
        description: 'Focus search on Gradle, CocoaPods and Xcode build failures.',
        value:
          'When searching, focus on Gradle, CocoaPods and Xcode build failures relevant to Flutter. Summarise the fix and note any version constraints it imposes.'
      }
    ]
  },

  // ---------------------------------------------------------------------------
  // Agent Memory
  // ---------------------------------------------------------------------------
  {
    id: 'memory-thinking-mcp',
    name: 'Memory & Sequential Thinking MCP Server',
    category: 'Agent Memory',
    badge: 'Official',
    description:
      'Persistent architecture context (Clean Architecture, patterns) plus structured reasoning chains.',
    transport: 'stdio',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    parameters: [
      {
        key: 'MEMORY_FILE_PATH',
        label: 'Memory store file path',
        description:
          'Where the knowledge graph is persisted between sessions.',
        placeholder: '.mcp/memory.json',
        defaultValue: '.mcp/memory.json',
        required: false
      }
    ],
    defaultInstructions:
      'Retain and reuse the architecture decisions of this project across sessions. Follow the established Clean Architecture layering and never introduce a new pattern without recording the decision first.',
    instructionTemplates: [
      {
        label: 'Preserve architecture decisions',
        description: 'Record and honour the project’s Clean Architecture choices.',
        value:
          'Remember and honour this project’s architecture: Clean Architecture with presentation, domain and data layers. Reuse existing naming and folder conventions, and record any new architectural decision before applying it.'
      },
      {
        label: 'Reason step by step',
        description: 'Use sequential thinking for non-trivial design work.',
        value:
          'For any non-trivial design or refactor, work through the reasoning step by step before proposing code, and state the trade-offs you considered.'
      }
    ],
    extra: {
      companionServers: [
        {
          name: 'sequential-thinking',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
        }
      ]
    }
  }
];

/** Look up a catalog entry by id. */
export function findServerById(id: string): McpServerDefinition | undefined {
  return MCP_CATALOG.find((s) => s.id === id);
}

/** Ordered list of categories as they appear in the catalog. */
export function getCatalogCategories(): McpCategory[] {
  const seen: McpCategory[] = [];
  for (const server of MCP_CATALOG) {
    if (!seen.includes(server.category)) {
      seen.push(server.category);
    }
  }
  return seen;
}

/** Extract the distinct runtime ids required to run the given servers. */
export function getRequiredRuntimes(
  servers: McpServerDefinition[]
): Array<McpServerDefinition['runtime']> {
  const runtimes: Array<McpServerDefinition['runtime']> = [];
  for (const s of servers) {
    if (s.runtime !== 'remote' && !runtimes.includes(s.runtime)) {
      runtimes.push(s.runtime);
    }
  }
  return runtimes;
}
