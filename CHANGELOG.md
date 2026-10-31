# Change Log

All notable changes to Air Flutter are documented in this file.

This project is a fresh, independent release. It shares no publisher, extension id or
update channel with any other extension.

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
