# Change Log

All notable changes to Air Flutter are documented in this file.

This project is a fresh, independent release. It shares no publisher, extension id or
update channel with any other extension.

## [Unreleased]

## [1.8.1] - 2026-11-04

### GitHub Actions

- **CI-only NDK pinning**: Generated Android workflows use a preinstalled Ubuntu 24.04 NDK through `CI_NDK_VERSION`, while local builds continue using Flutter's default NDK.
- **Optional Android tool installation**: Workflows can install manually entered NDK and CMake versions with `sdkmanager`, or verify a manually entered preinstalled NDK version without downloading it.
- **All Android build variants covered**: Universal APK, split APK, App Bundle, combined APK/AAB, debug, and release workflows share the same verified NDK configuration.
- **Build troubleshooting controls**: A collapsible workflow section explains common NDK, CMake, memory, and caching failures, with CI-only Gradle heap, Metaspace, worker, parallelism, and daemon limits.
- **Conflict-free cache providers**: Flutter SDK/Pub caching is independent from the mutually exclusive Gradle Setup, Java Setup, and no-cache options.
- **Actionable failure diagnostics**: Generated workflows classify common memory, Android toolchain, disk, signing, dependency, and network failures, then upload target-specific logs and safe runner diagnostics for seven days.

## [1.8.0] - 2026-11-04

### MCP Hub

- **Official workspace paths**: Copilot now uses `.mcp.json`, Antigravity uses `.agents/mcp_config.json`, and Continue writes a valid MCP block under `.continue/mcpServers/`.
- **Capability-aware scopes**: Every integration declares its supported scopes and mode. The panel disables incompatible scope choices, rejects selections with no common scope, and the extension host validates the scope again before writing.
- **Global-only agents**: Cline, Windsurf/Cascade, and Claude Desktop are available only at their documented user-level locations; Air Flutter no longer creates unsupported project files for them.
- **Framework-native outputs**: CrewAI and AutoGen generate reviewable Python integration templates under `.air-flutter/mcp/`; AutoGPT generates a setup guide for its Settings → Integrations flow.
- **Unsupported targets removed**: Aider and AutoClaw are no longer presented as native MCP clients, and the inert `.mcp/multi-agent.templates.json` convention has been removed.

## [1.7.3] - 2026-11-04

### Fixes

- **MCP Hub click handler resolves the correct bridge**: The panel button now calls `window.airFlutter.openMcpHubModal()` explicitly, preventing VS Code's webview from resolving the bare `airFlutter` identifier to the underlying instance, where that method does not exist.

## [1.7.2] - 2026-11-04

### Fixes

- **Panel buttons failed with "airFlutter.openMcpHubModal is not a function"**: The webview bridge (`window.airFlutter`) was defined inside a `DOMContentLoaded` handler. When that handler had not run yet, the object did not exist with its methods, so every button routed through the bridge threw and the click was silently lost. This affected **MCP Hub**, Flavors, Proxy / DNS, GitHub Workflow, Signing Key, Agent Engine and Compat Doctor. The bridge is now defined synchronously, so it is always available before the first click.
- **Graceful degradation**: If the webview scripts fail to load, the bridge now falls back to asking the extension host to open the panel instead of throwing `is not a function`.
- **Toast routed to the wrong object**: The MCP module called `window.airFlutter.showToast`, which resolves to the bridge rather than the real instance. It now targets `window.airFlutterApp`, so toasts display correctly.

## [1.7.1] - 2026-11-04

### Fixes

- **MCP Hub button did nothing**: Clicking **MCP Hub** in the panel had no effect. The panel's inline script replaces `window.airFlutter` with a small bridge object, which discarded every method the webview module mixins had added — so the button's handler had nothing to delegate to. The real webview instance is now exposed as `window.airFlutterApp` before the bridge is created, and the bridge delegates to it. The same flaw silently affected the Flavors, Proxy, Workflow, Signing Key, Agent Engine and Compat Doctor buttons, which called themselves in a loop instead of the real implementation; they are fixed too.

## [1.7.0] - 2026-11-04

### Features

- **Mobile MCP Server**: The catalog gains **Mobile MCP** (`@mobilenext/mobile-mcp`) — platform-agnostic automation for Android emulators, iOS simulators and real devices, driving apps through the native accessibility tree.
- **Marionette is now complete**: The Marionette entry correctly uses the Dart bridge (`marionette_mcp`) instead of an npm package, and knows that your app needs the `marionette_flutter` package installed and wired up.
- **App-side setup wizard**: Servers that need a package inside your own Flutter app now show a call-out in the Configure step. Air Flutter detects whether the dependency is already in `pubspec.yaml`, offers to run `flutter pub add` for you, and can wire `lib/main.dart` automatically.
- **Smart `main.dart` editing**: The automatic rewrite inserts the required imports, wraps `MarionetteBinding.ensureInitialized()` in a `kDebugMode` guard, and preserves your own `runApp(...)` call — including nested arguments such as `runApp(const MyApp(home: Home()))`. A backup is created first, and an unrecognised `main()` is reported for manual editing rather than rewritten.
- **Setup guide window**: A dedicated guide modal shows the exact `flutter pub add` command, the `main()` snippet and a numbered checklist, each with copy buttons, plus a one-click **Save as Markdown** export.

### Fixes

- **`kDebugMode` import**: The generated snippet needs `package:flutter/foundation.dart`. `material.dart` does not re-export `kDebugMode` (verified against the Flutter SDK), so the import is now added whenever it is missing.

## [1.6.0] - 2026-11-04

### Features

- **MCP & AI Agent Hub**: A new **MCP Hub** button inside the Air Flutter panel (commands grid) and the sidebar (Network & automation group) opens a guided 5-step modal that configures Model Context Protocol servers for your AI coding agent. A QuickPick version is also available from the Command Palette as **MCP & AI Agent Hub (Quick Wizard)**.
- **20 Flutter-Focused MCP Servers**: A curated catalog covering the Dart & Flutter SDK server, pub.dev, Firebase, Supabase, Appwrite, Figma, Android ADB, Marionette, SQLite, PostgreSQL, OpenAPI/Swagger, Fetch, Postman, Sentry, GitHub, GitLab, Fastlane, DevDocs, Brave Search, and the Memory & Sequential Thinking server.
- **14 AI Agent Adapters**: Writes the exact schema each agent expects — GitHub Copilot, Cursor, Cline, Roo Code, Windsurf/Cascade, Anti-Gravity, Claude Desktop, Continue, Aider, Devin, OpenCode, Auto-Claw, OpenAI Codex CLI, and portable multi-agent templates (CrewAI, AutoGPT, AutoGen). JSON, YAML (Continue/Aider) and TOML (Codex) are all supported.
- **Per-Server Instructions**: Optionally attach an `instructions` field to any server so the agent knows how to use it in your project — for example restricting Supabase to a single schema. 17 of the 20 servers ship ready-made templates you can accept, edit, or replace with your own text.
- **Dual-Scope Targeting**: Install each configuration at project level (workspace) or global level (user/machine), with OS-correct paths on Windows, macOS and Linux.
- **Batch Installation**: Select and configure any number of MCP servers in a single run.
- **Prerequisites Health-Check**: Before writing anything, the hub verifies Node/npx, Flutter, Dart, Python/uvx, adb and Git, and shows a checklist with official download links and copy-paste install commands for your OS when something is missing.
- **Catalog Browser & Prerequisite Check**: Two extra commands — `Browse MCP Server Catalog` and `Check MCP Prerequisites` — for inspecting the catalog and verifying your toolchain without installing anything.

### Safety

- **Non-Destructive Writes**: New server entries are deep-merged into existing config files. Pre-existing servers, custom settings and unrelated keys are never overwritten or removed, and arrays of named servers are unioned rather than replaced.
- **Automatic Backups**: A timestamped backup is created next to any config file before it is modified (can be disabled with `airFlutter.mcp.backupBeforeWrite`).
- **Corruption Guard**: If an existing config file cannot be parsed, it is left byte-for-byte untouched and reported, instead of being silently rewritten.
- **Secrets Notice**: A one-time warning explains that API keys are stored in plaintext, and workspace-scope runs offer to add the written config paths to `.gitignore`.

### Fixes

- **Prerequisites False Negatives on Windows**: The health check reported installed tools such as the Flutter SDK, `npx` and `adb` as missing, because on Windows they ship as `.bat`/`.cmd` shims that a plain executable probe cannot launch. The check now resolves Windows shims and probes them correctly, so a working Flutter install is recognised.
- **MCP Hub button did not open the modal**: The **MCP Hub** button in the panel did nothing when clicked. The message router called a method that only existed on the host class rather than on a mixed-in module, so the call threw and the handler aborted silently. The entry point now lives on the module and is copied by the mixin correctly.
- **Final "Next" button did nothing**: On the Review step the button stayed labelled **Next** and clicking it had no effect. The module kept its step state in a `constructor()`, which the webview's mixin pattern never invokes, so the step counter was undefined and the "write configuration" branch was never reached. State is now initialised in the module's `initMcpModal()` like every other module, and the button correctly becomes **Write configuration**.

## [1.5.1] - 2026-11-04

### Fixes

- **Display Off During Standard Mirroring**: The panel device row now offers **Turn display off** while a standard mirror session is live, and the same button flips to **Wake screen** once the panel is dark — no need to use “Screen Off + Keys”. The action is routed through the verified host toggle, so it works on the active session only and cannot act on a stale device row.
- **Honest Panel Display State**: The panel previously received only `isMirroring`, so its button could never reflect the real display state. Both surfaces now consume the full `MirroringState` (`isMirroring`, `displayOff`, `serial`) broadcast on start, stop, toggle and panel load, keeping the label honest in the panel and sidebar at all times.
- **Samsung/MediaTek Display Reading**: `dumpsys display` keeps reporting `mScreenState=ON` while `cmd display power-off` has already blanked the physical panel on these builds, so display-off looked like a failure and the code kept issuing pointless POWER toggles. The reader now prefers the physical DisplayManager `mState=OFF` and treats a successful power-off exit code as authoritative, giving verified ON→OFF→ON reads on real hardware.

## [1.5.0] - 2026-11-04

### Features & Fixes

- **Mirroring Setup in Both Surfaces**: Starting a mirror session from the panel device rows now opens the same setup flow as the sidebar — Audio route (Computer / Phone) and Performance profile (Fast / Balanced / Ultra) — with the choices remembered for the next session.
- **Audio Route Fixed**: The chosen audio route was silently dropped before reaching scrcpy, so "Computer" fell back to `--no-audio` and the phone kept its sound; preferences now flow end-to-end. `Computer only` forwards the device audio to the computer and mutes the phone speaker (Android 11+, scrcpy REMOTE_SUBMIX).
- **Ultra Performance Profile**: The misleading `Quality` profile (native size but only 30 FPS) is replaced by **Ultra** — native resolution, 16 Mbps, up to 120 FPS. Honest caveat surfaced in both UIs: FPS is a cap; the device encoder, screen refresh rate and Wi-Fi decide the actual result. Older saved `quality` preferences migrate automatically to Ultra.

## [1.4.0] - 2026-11-04

### Features & Fixes

- **Unified Loading Lifecycle**: Every panel and sidebar operation now shows a spinner from the moment the request reaches the extension host until it settles — success, failure or cancellation — so long ADB, mirroring or filesystem work never feels ignored.
- **Real Completion Tracking for Flutter Commands**: `flutter doctor`, `pub get`, `pub upgrade`, `clean`, `run` and APK/AAB builds now run as dedicated VS Code tasks, and their loading indicators track the actual process exit code instead of the previous fixed 2–3 second timers.
- **Flavor Build Tracking**: Running and building flavors (including batch builds) now surface progress until each `flutter` process exits, restoring buttons only after completion.
- **First-Load Feedback**: Opening the panel or sidebar shows a loading indicator while connected devices, mirroring state and localhost bridge rules are hydrated.
- **Stuck-Spinner Fixes**: Cancelling app-package pickers or failing workflow / agent-scaffold generation now re-enables their buttons and clears spinners; native VS Code progress notifications wrap the same operations launched from the command palette.
- **Wake Screen & Display State Fixes**: Wake now reads the real display state (`dumpsys display` / `dumpsys power`), verifies after each attempt, and escalates (display restore → WAKEUP → POWER) until the screen is verifiably on — so waking a panel blanked by "Screen Off + Keys" works directly from the panel or sidebar without toggling display-off first. The sidebar Wake/Turn-off button now renders from verified state instead of stale session flags, and mirror start/stop broadcast the full state (including `displayOff`) to both surfaces.

## [1.3.1] - 2026-11-04

### Features & Fixes

- Added a polished file-layout choice for **Both (APK + AAB)**, allowing one coordinated workflow or two independently runnable workflow files.
- Workflow filenames now reflect their output: APK uses `build_apk.yml`, while AAB and the combined Android build use `build_android.yml`.

## [1.3.0] - 2026-11-04

### Features

- Organized the sidebar tools into four accessible, collapsible categories with tool counts, keyboard support, responsive two-column layouts, and remembered open/closed state.

- **Deep Storage & Cache Wiper (Reset App State)**: Reset the app's cache, local databases or entire sandbox over ADB without uninstalling and reinstalling.
  - **Auto package resolution**: Detects `applicationId` from `android/app/build.gradle` or `build.gradle.kts`, with a QuickPick fallback that lists installed third-party packages (`pm list packages -3`) and offers manual entry.
  - **Scoped operations**: `Clear cache` (`cache/*`), `Reset databases` (`databases/*`) and `Factory reset app` (`adb shell pm clear`). Cache/database removal runs through `run-as` (debug builds) and falls back to `pm clear` with an explicit warning when the build is not debuggable — no root required.
  - **Guardrails & confirmation**: Package ids are validated, `pm path` verifies installation, system/OEM packages are refused, and a modal confirmation names exactly what will be erased before any destructive action.
  - **Auto-restart**: An app that was running before the wipe is relaunched to a fresh state.
  - **Single-device safety**: Every command targets the selected serial via `adb -s <serial>`.
  - **UI in both surfaces**: A dedicated "Reset App State" card in the main panel and a "Reset app state" section in the sidebar, with live status spinner and success/error feedback, plus four command-palette entries.

## [1.1.0] - 2026-10-31

### Features & Fixes

- **Version Configurator Four-Way Auto-Sync**: Changing any of AGP, Gradle, Kotlin, or Java/JDK in the Compatibility Doctor now keeps that selection and instantly re-syncs the other three fields to the nearest verified-compatible stack from the matrix, with a status banner naming the field that started the sync. Also fixed the AGP 7.4 matrix range so Gradle `7.6.4` resolves as compatible (`>=7.5 <7.7`).
- **GitHub Workflow Builder — Releases, Retention & Timeout**: New options to publish successful builds to a uniquely tagged GitHub Release, set artifact retention in days, and configure a per-job timeout in minutes; all three flow into the generated workflow and `SECRETS_SETUP.md`.
- **Android Signing Key Studio**: Guided keystore wizard (file name, alias, certificate identity, validity, RSA key size) that runs `keytool` with passwords passed through temporary environment variables — never written to the activity log — and returns `key.properties` snippets, Git ignore entries, and the GitHub Secrets Base64 command.
- **Per-Phone Wake Targeting**: Wake-screen actions now target a specific connected device from its panel row instead of a single global wake.
- **Compatibility Doctor from the Sidebar**: Open and auto-scan the Doctor directly from the sidebar tool button.
- **Modal Visibility Fix**: Elements inside modal cards carrying the `hidden` attribute (for example the Flavors empty state) are now reliably hidden by stylesheet rules instead of relying on browser defaults.
- **Screen Recording Integrity & Playability**: Resolved unplayable MP4 recording bug caused by missing `moov atom` by sending targeted `SIGINT` signals to `screenrecord` and awaiting graceful container finalization before pulling from the device.
- **Sidebar Live Recording Indicator & Toggle Control**: Added active recording state to the sidebar "Record Video" tool button with live pulsing effect, real-time duration timer (`REC mm:ss`), and 1-click toggle to stop recording immediately.
- **Architectural Refactoring & Modularization**: Cleanly partitioned monolithic files into focused, maintainable modules:
  - Extracted domain handlers for Flutter Panel (`panelCompatHandler`, `panelFlavorHandler`, `panelNetworkHandler`, `panelWorkflowHandler`, `panelAgentHandler`).
  - Separated sidebar stylesheets into modular CSS files (`base.css`, `device-card.css`, `tools.css`, `logcat.css`).
  - Decoupled `compatDoctorModule.js` into modular views (`compatAuditView.js`, `compatConfigView.js`).
  - Extracted inline JavaScript from `sidebarHtml.ts` into clean `media/sidebar.js`.
  - Modularized `android-device-manager` into dedicated parser and utility units.

## [1.0.9] - 2026-10-31

### Features & Fixes

- **Instant Auto-Scan on Modal Open**: Resolved hanging spinner issue when opening Compat Doctor from the panel by automatically resolving active workspace and initiating scan immediately.
- **Two-Tab Compatibility Hub**: Redesigned `#compatDoctorModal` with two dedicated tabs:
  - **Audit Findings**: Real-time diagnostic findings, status cards, and one-click auto-upgrade.
  - **Version Configurator & Auto-Sync**: Interactive customizer to select specific versions with smart cascading enforcement.
- **Smart Cascading & Incompatibility Prevention**: Selecting an AGP version automatically filters and disables incompatible Gradle versions, auto-selects the recommended Gradle version, and updates Kotlin and Java baseline (JDK 11 / 17).
- **Full Project Mutation Scope**: Non-destructively modifies `gradle-wrapper.properties`, `build.gradle`, `build.gradle.kts`, `ios/Podfile`, and `app/build.gradle` (`sourceCompatibility`, `targetCompatibility`, and `jvmTarget`).
- **Interactive Diff Preview Modal**: Displays granular before-and-after diffs for all affected files with selective checkboxes before applying non-destructive `vscode.WorkspaceEdit` (with full `Ctrl+Z` undo support).

## [1.0.8] - 2026-10-31

### Features

- **Flutter Compatibility Doctor & Auto-Fixer**:
  - **Declarative Compatibility Matrix**: Extensible rules matrix covering Java (JDK), Gradle Wrapper, Android Gradle Plugin (AGP), Kotlin, and iOS deployment targets (`platform :ios`).
  - **Robust Non-Destructive Parsers**: Accurately parses `gradle-wrapper.properties`, Groovy & Kotlin DSL build scripts (`build.gradle`, `build.gradle.kts`), and `ios/Podfile` while strictly preserving user comments, indentation, and structure.
  - **Real-Time VS Code Diagnostics**: Issues inline editor squigglies with clickable links to official Android & Apple migration guides.
  - **1-Click Quick Fixes**: Provides `vscode.CodeActionProvider` with non-destructive `vscode.WorkspaceEdit` to resolve mismatches and outdated configurations instantly with full Undo support.
  - **Interactive Webview Modal & Sidebar Integration**: Visual status cards (Gradle, AGP, Java, iOS), loading spinner, external project browser, structured findings, and a 1-click Auto-Upgrade wizard.
  - **Dedicated Output Channel**: Generates structured, readable build stack audit reports inside `Air Flutter Compatibility Doctor`.
  - **Environment-Aware JDK & CocoaPods Detection**: Detects local Java Runtime from `PATH`/`JAVA_HOME`, gracefully handling CocoaPods on Windows.

## [1.0.7] - 2026-10-31

### Features

- **Full Google Antigravity Subagents Specification Compliance**:
  - Implements canonical `<name>.md` subagent file discovery structure.
  - Generates mandatory YAML Frontmatter (`name`, `description`, `model`, `workspace`, `tools`) for native Antigravity subagent registration.
  - Aligns global machine scope path with `~/.gemini/config/agents/` for seamless cross-project agent discovery.
  - Intelligent project-level resolution: auto-targets `<project>/.agents/agents/` when selecting external Flutter project roots.
  - Generates production-ready Asynchronous Subagent Delegation instructions (`invoke_subagent` calls, tool payloads, reactive wakeup patterns) in `orchestrator.md`.

## [1.0.6] - 2026-10-31

### Features

- **Multi-Role Custom Workflow Builder**: Multi-select any combination of Agent Roles (Planner, Architect, Developer, QA, Flutter UI, Flutter State, and Custom Roles) to build bespoke multi-agent workflows.
- **Dynamic Orchestration Chaining**: Dynamically crafts sequential pipeline flowcharts (Mermaid diagrams in `orchestrator.agent.md`), sequential step execution in Herdr (`herdr.yaml`), and sequential Agent/Task runs in CrewAI (`crew.py`) mapping exclusively to the chosen roles.

## [1.0.5] - 2026-10-31

### Features

- **AI Agent Architect & Scaffolding Engine**: Interactive 5-step visual stepper wizard to configure, scaffold, and generate production-ready AI Sub-Agents and Multi-Agent Workflows. Supports workspace, external, or global machine scopes with non-destructive merging; Single Sub-Agent or full SDLC Team Pipelines (Planner -> Architect -> Developer -> QA); multi-framework outputs (Antigravity Markdown `.agent.md`, Herdr YAML, CrewAI Python, Generic Custom Loops); granular tool permission matrices; and Fully Populated vs. Blank Template with LLM self-filling prompts.

## [1.0.4] - 2026-10-31

### Features

- **Flutter Flavors Suite**: Detect existing product flavors in `build.gradle` / `build.gradle.kts`, select any Flutter project on disk, automated flavor setup wizard (`dev`, `staging`, `prod` + Dart entrypoints), one-click run with flavor, flavor APK building, and batch building all flavors.
- **Screen Recording for PRs**: Record device screen directly to workspace MP4 files (`screenshots/recording_*.mp4`) via ADB `screenrecord` with live animated pulsating recording badge and timer in both Webview Panel and Sidebar, graceful signal handling for clean MP4 muxing, and instant "Open Video" action.
- **Network Proxy & Private DNS Inspector**: Interactive modal detecting local machine Wi-Fi IP, one-click presets for HTTP Proxy (Charles `8888`, Proxyman `9090`, Fiddler `8866`) with instant apply and clear, and Private DNS (DNS-over-TLS) presets (Google, Cloudflare, AdGuard) for secure network inspection.

## [1.0.3] - 2026-10-31

### Features

- **GitHub Actions CI/CD Workflow Builder**: Generate a complete `.github/workflows/build_apk.yml` and `SECRETS_SETUP.md` with options for project folder, target branch, build outputs (Universal APK, Split-per-ABI, AAB, or both), Gradle & Pub caching, and production signing via GitHub Secrets.
- **Consolidated Mirroring Controls**: Streamlined mirroring into two clear modes: `Mirror` (standard) and `Screen Off + Keys` (eco mode with hardware keyboard), complete with subtext notes and hover tooltips.
- **Stop Mirroring**: One-click termination of active `scrcpy` sessions from VS Code, restoring phone screen immediately.
- **One-click APK Installer**: Install selected APK files directly to connected devices via ADB.
- **Send Text / Clipboard**: Send text or computer clipboard directly to active input fields on the device.
- **Smart Screen-Off Guidance**: Helpful tips and reminders for `Alt+Shift+O` shortcut when using screen-off mirror modes.

## [1.0.2] - 2026-10-30

### Fixes

- README screenshots now load on the Marketplace page. The Marketplace rewrites relative
  image paths to the GitHub repository, which has to be public for them to resolve; the
  repository is now public.

## [1.0.1] - 2026-10-30

### Discoverability

- Rewrote the display name, description and keyword list so search inside the editor and
  on the Marketplace matches how people look for wireless Flutter debugging
- Added screenshots, rendered from the shipped interface

### Fixes

- Draw the log checkboxes explicitly; the editor's own form styles hid them
- Append incoming log rows instead of rebuilding the whole list on every batch
- Removed a launch configuration pointing at a test folder that does not exist
- Removed an unrelated framework recommendation from the editor extension list

## [1.0.0] - 2026-10-30

First release of Air Flutter.

### Devices

- Discover Android phones over USB and on the local network, including devices with an
  open wireless ADB port on `5555`
- Enable wireless ADB with one click over USB, then reconnect later without a cable or a
  pairing code
- Show live device state and disconnect wireless devices directly

### Screen mirroring

- Mirror with scrcpy 4.1 bundled in the extension — no path to configure
- Four modes on every device row: **Screen**, **Screen off**, **+ Keyboard** and
  **Phone off**
- **Screen off** keeps the physical panel dark while the desktop window works
- **+ Keyboard** simulates a hardware keyboard so input languages switch per keystroke
- **Phone off** mirrors into a virtual display, so the phone panel stays off and does not
  wake on touch
- No console window flashes while scrcpy starts

### Device log

- Stream `adb logcat` from the sidebar, started and stopped on demand
- Tabs for All, Flutter, Crashes and Warnings, plus free-text search and follow-scroll
- **Pause** freezes the view while lines keep buffering, then catches up on resume
- Default filter keeps every crash and warning while dropping vendor chatter — measured at
  roughly 27x fewer lines on a Samsung device in debug mode
- Append every line to `.air-flutter/logcat.log` in the workspace, and copy or open the
  visible lines

### Live device card

- Model, serial, Android version, API level, network, Wi-Fi name, IP address and screen state
- Battery gauge with charging state and temperature
- Refreshed every five seconds, with a manual refresh

### Quick tools

- Screenshot to `.air-flutter/screenshots/`, with open and reveal actions
- Wake the screen without unlocking
- Fix Wi-Fi: reboot the phone after a confirmation prompt and restore wireless ADB

### Interface

- New identity: warm paper and ink, one ember accent, hairline rules
- IBM Plex Sans for language and IBM Plex Mono for serials, endpoints, commands and log
  lines, with local fallbacks
- Three-column responsive panel: devices, Flutter commands with the activity log, shortcuts
- Sidebar view in the same identity, showing the live device card, the log and quick tools
- Light and dark themes, remembered between sessions
- Monochrome SVG Activity Bar icon that follows the editor theme

### Flutter commands

- Run app, Flutter doctor, get and upgrade packages, build APK, build app bundle, clean project
