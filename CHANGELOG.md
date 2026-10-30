# Change Log

All notable changes to Air Flutter are documented in this file.

This project is a fresh, independent release. It shares no publisher, extension id or
update channel with any other extension.

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
