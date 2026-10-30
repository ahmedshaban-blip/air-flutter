# Product

**Air Flutter** — a VS Code / Antigravity extension that connects an Android phone to a
dev machine without cables, mirrors its screen, and runs Flutter tasks against it.

> Owner's brief. Assumptions are labelled.

## Users

Flutter developers on Windows who debug on a physical Android phone over Wi-Fi.
They open the panel many times a day, mid-task, usually on a second monitor.

## Jobs

1. See the phone: over USB, already discoverable on the network, or currently connected.
2. Enable wireless ADB once over USB, then reconnect later with one click.
3. Mirror the screen — optionally with the phone panel dark, or on a virtual display.
4. Watch the device log, filtered to what matters.
5. Run the everyday Flutter commands (`run`, `doctor`, `pub get`, `build apk`, ...).
6. Reach quick device tools: screenshot, wake screen, re-heal Wi-Fi.

## Hard constraints

- Runs inside a VS Code-style webview: no routing, no server, no local storage beyond
  `localStorage` and the extension host.
- Every action is a `postMessage` to the extension host; the host owns all logic.
- Element ids and message payloads are the contract with the host — the UI may
  restyle and restructure markup but must not rename them.
- Must work offline for layout; web fonts and icon fonts degrade to local fallbacks.
- Light and dark themes are both first-class, toggled manually and remembered.

## Identity

Terminal editorial: warm paper and ink in light mode, near-black in dark mode, one ember
accent, hairline rules, IBM Plex Sans for language, IBM Plex Mono for machine data
(serials, endpoints, commands, log lines). No gradients, no glass, no rounded card stacks.

## Owner

Ahmed Shaban — Front-end developer.

- LinkedIn: https://www.linkedin.com/in/ahmed-shaban-front-cross
- Portfolio: https://ahmed-shaban-dev.vercel.app

## Assumptions

- The panel is an **Operate** surface: scanability and fast task completion outrank
  expression; personality lives in typography and detail.
- Device data (logcat, screenshots) is written to a `.air-flutter/` folder in the
  user's workspace.
- Android needs one prior `adb tcpip 5555` over USB before any wireless connect
  without pairing.
