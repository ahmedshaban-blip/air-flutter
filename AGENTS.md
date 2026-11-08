---
name: air-flutter
description: Architecture invariants, verification gates, and context pointers for the Air Flutter VS Code & Antigravity extension.
---

# Air Flutter — Agent Instructions

## Execution Steps & Completion Criteria

1. **Resolve Context Pointers**
   - Follow the matching pointer under [Context Pointers](#context-pointers) before modifying webview modals, MCP adapters, or UI styling.
   - **Criterion**: Target domain service (`src/domain/`), controller handler (`src/controllers/`), webview module (`media/`), and test suite (`test/`) are identified.

2. **Implement & Synchronize Build Artifacts**
   - Keep all state, CLI spawning (`adb`, `scrcpy`, `flutter`), and file I/O in the extension host; keep webviews stateless beyond UI state and `postMessage`.
   - When modifying `media/css/sidebar/*.css`, run `npm run build:sidebar-css` to bundle `media/sidebar.css`.
   - Run `npm run compile` after any `src/**/*.ts` edit so `out/` stays synchronized for JSDOM harnesses.
   - **Criterion**: `npm run compile` exits `0` with zero TypeScript errors and `media/sidebar.css` matches its source partials.

3. **Run Verification Gates**
   - Execute the matching test suites in `test/` (`npm run test:mcp`, `npm run test:workflow`, `node test/test-<feature>.js`, and `npm run test:vsix` when packaging or `.vscodeignore` changes).
   - **Criterion**: Every relevant test suite goes *green* with zero uncaught JSDOM or runtime errors.

## Architecture Invariants

- **Host–Webview Contract**: Element IDs and `postMessage` command/payload keys form a strict contract between `media/` and `src/controllers/`. Preserve existing IDs and message schemas when refactoring markup or styles.
- **Synchronous Bridge Delegation**: `media/air-flutter.js` declares `const airFlutter = new AirFlutterWebview()` in global lexical scope and assigns `window.airFlutterApp = airFlutter`. Define `window.airFlutter` synchronously in inline HTML before `DOMContentLoaded`, delegate modal calls via `this.delegate('<method>', '<command>')`, and invoke `window.airFlutter.<method>()` explicitly in inline `onclick` attributes so the lexical binding never shadows the bridge.
- **Sidebar CSS Source of Truth**: `media/sidebar.css` is a generated bundle of `media/css/sidebar/{base,device-card,bridge,tools,logcat,wipe}.css`. Edit the partials in `media/css/sidebar/` and regenerate via `npm run build:sidebar-css`.
- **Terminal Editorial Styling**: Consume tokens from `media/css/theme.css` (`IBM Plex Sans` for prose, `IBM Plex Mono` for serials/endpoints/commands/logs, warm paper light mode, near-black dark mode, ember accent, hairline borders, offline font fallbacks).
- **VSIX Packaging Hygiene**: Register any new authoring doc, test harness, or scratch path in `.vscodeignore` so `npx vsce package` ships only runtime code and assets.

## Context Pointers

- **Webview modals & panel features**: Read [`docs/webview-modal-architecture.md`](docs/webview-modal-architecture.md) when adding or editing panel modals, `media/modules/*.js` mixins, `window.airFlutter` bridge methods, or `FlutterPanelController` handlers.
- **MCP Hub & agent config adapters**: Read [`docs/mcp-workspace-paths-research.md`](docs/mcp-workspace-paths-research.md) when modifying `src/mcp/`, workspace vs. user config paths, host support scopes, or companion package exports.
- **Product brief & visual identity**: Read [`PRODUCT.md`](PRODUCT.md) when changing core user jobs, layout density, theme parity, or `.air-flutter/` workspace output conventions.

