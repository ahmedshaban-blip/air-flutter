# Product

<!-- impeccable:product-schema 1 -->

**Air Flutter** — a VS Code / Antigravity extension that connects an Android phone to a
dev machine without cables, mirrors its screen, and runs Flutter tasks against it, plus a
suite of adjacent device and Flutter studios in the same panel.

> Owner's brief. Confirmed facts plus labelled assumptions; nothing invented.

## Platform

web

## Users

Solo Flutter developers on Windows who debug on a physical Android phone over Wi-Fi.
They open the panel many times a day, mid-task, usually on a second monitor. They run the
extension inside VS Code or a VS Code-family host (Cursor, VSCodium, Google Antigravity).

## Product Purpose

Remove the cable and the terminal from the Android debugging loop: find the phone, enable
wireless ADB once, mirror it, read its log, and run the everyday Flutter commands from one
panel — then keep the same panel for the release and quality chores that surround that loop
(signing keys, CI/CD, flavors, sizes, locales, storage, permissions, proxies).

Success means the developer never leaves the panel to do a routine device or Flutter
operation, and never has to remember an `adb` incantation.

## Positioning

One panel owns the whole phone ↔ Flutter loop, and the extension host — not the webview —
owns every `adb`, `scrcpy`, and `flutter` invocation. The webview is a stateless view over
`postMessage`, so the same UI survives restarts, theme switches, and host differences.

The second half is the MCP & AI Agent Hub: the extension writes agent MCP configuration for
other tools (Cursor, Cline, Roo Code, Windsurf, Antigravity, Copilot, Claude Desktop,
Continue, OpenCode, Codex, Devin, CrewAI, AutoGen, AutoGPT) from inside the editor, with
backup-before-write on by default.

## Operating Context

- VS Code `1.85.0+` or a compatible fork; Windows is the stated target.
- Flutter SDK on `PATH`; `adb` bundled or on `PATH`; `scrcpy` bundled, no path setup.
- A physical Android device, Android 5.0+, Developer Options and USB Debugging on.
- Wireless ADB needs one prior `adb tcpip 5555` over USB before a cable-free connect
  without pairing.
- Device artifacts (logcat captures, screenshots, recordings, reports) land in an
  `.air-flutter/` folder in the user's workspace.
- Offline-safe: layout must hold with web fonts and icon fonts unavailable.
- The panel is used as an **Operate** surface — scanned mid-task, not read at leisure.

## Capabilities and Constraints

Shipped surface (3.1.0), core job first:

1. **Wireless loop** — USB / network / connected device discovery, one-click wireless
   enable and reconnect, device health card (battery, temperature, Wi-Fi SSID, IP, Android
   and API level), ADB server control.
2. **Screen mirroring** — bundled `scrcpy`; standard, screen-off, screen-off with hardware
   keyboard, and virtual-display (phone stays off) modes; configurable max size, FPS and
   bit rate; optional audio.
3. **Device log** — filtered logcat with aggressive default noise reduction.
4. **Flutter tasks** — `run`, `doctor`, `pub get`, `upgrade`, `clean`, `build apk`, `aab`,
   install APK, Firebase debug toggles.
5. **Release chores** — GitHub Actions workflow generation with keystore secrets guidance,
   Android signing-key studio, flavor management and batch builds, APK/AAB size analyzer.
6. **Diagnostics** — compatibility doctor with Gradle/AGP/Java/iOS auto-fix, pub health,
   SSL & proxy doctor, network and screen-state lab (proxy, Private DNS, offline, slow
   network), storage inspector (SharedPreferences, SQLite), app-state wiper.
7. **Build & asset studios** — Build Runner cockpit, app icon and splash studio, ARB
   localization studio, asset assistant, deep-link studio, localhost bridge.
8. **Device instrumentation** — device environment sandbox (font scale, dark mode, battery,
   locale), debug overlays (paint, performance, slow-mo, repaint rainbow), mock GPS,
   permission manager and manifest handling, screen recording, push-notification tester.
9. **Agent tooling** — MCP & AI Agent Hub with catalog, wizard, prerequisites check, and
   per-host config writers; AI agent/sub-agent scaffolding and generated CI workflows.

Hard constraints:

- Runs inside a VS Code-style webview: no routing, no server, no storage beyond
  `localStorage` and the extension host.
- Every action is a `postMessage` to the extension host; the host owns all state, CLI
  spawning (`adb`, `scrcpy`, `flutter`) and file I/O.
- Element ids and message payload keys are the contract with the host — markup and styling
  may change, names may not.
- Light and dark themes are both first-class, toggled manually and remembered.
- `media/sidebar.css` is generated from `media/css/sidebar/*.css`; edit partials only.
- Passwords for keystores pass to `keytool` via temporary environment variables and are
  never written to the activity log.

Undecided / unverified product facts (do not assert either way):

- Support on macOS and Linux: README scopes Windows; `engines` does not restrict OS.
- Any macOS/Linux-specific mirroring or ADB behaviour differences.
- Telemetry: no telemetry configuration exists in the manifest; treat as unconfirmed.
- Marketplace rating, install counts, and review quotes: no verified figures on hand.

## Brand Commitments

- Name: **Air Flutter**. Publisher `ahmedshaban`. MIT license. Source
  `github.com/ahmedshaban-blip/air-flutter`.
- Voice: plain, confident, terminal-adjacent. No pairing codes, no terminal acrobatics, no
  manual `adb` commands.
- Identity — terminal editorial: warm paper (`#F2EFE6`) and ink (`#14150F`) in light mode,
  near-black in dark mode, one ember accent (`#B23B16`), hairline rules, IBM Plex Sans for
  language, IBM Plex Mono for machine data (serials, endpoints, commands, log lines). No
  gradients, no glass, no rounded card stacks.
- Owner: Ahmed Shaban — front-end developer.
  [LinkedIn](https://www.linkedin.com/in/ahmed-shaban-front-cross) ·
  [Portfolio](https://ahmed-shaban-dev.vercel.app)

## Evidence on Hand

- `screenshots/` — nine real panel captures (panel, sidebar + log, workflow builder,
  signing key, compat doctor, flavors, proxy/DNS, agent engine, log filter).
- `README.md` — thirteen documented feature sections, system requirements, settings table.
- `CHANGELOG.md` and ~40 packaged `.vsix` builds in the repo root — real release history.
- `docs/` — `webview-modal-architecture.md`, `mcp-workspace-paths-research.md`,
  `app-icon-studio-requirements.md`.
- `test/` — JSDOM harnesses and domain suites that exercise the real webview markup.

Absent, and must not be fabricated: customer testimonials, benchmark numbers, install
counts, marketplace awards, pricing, or team/company claims.

## Product Principles

1. **The host owns the machine.** Webviews render and request; the extension host acts.
   Never move spawning, state, or file I/O into the panel.
2. **One panel, no detours.** A routine device or Flutter operation should not require a
   terminal, a second tool, or a remembered command.
3. **The contract outlives the pixels.** Ids and message payloads are the API; restyle and
   restructure freely, rename never.
4. **Degrade to local.** Fonts, icons, and layout must hold offline and inside any
   VS Code-family host.
5. **Both themes are real.** Light is warm paper, dark is near-black; neither is an
   afterthought inversion.

## Assumptions

- Labelled by the owner, not independently verified: device data is expected in
  `.air-flutter/` within the workspace, and one prior `adb tcpip 5555` over USB is expected
  before a cable-free connect without pairing.
