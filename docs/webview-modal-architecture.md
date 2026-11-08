# Webview Modal & Feature Seam

Reference for adding or modifying features in the main Air Flutter panel (`src/controllers/flutter-panel-controller/`) and webview (`media/`).

## The 5-Part Feature Seam

Every panel feature spans five co-located touchpoints that must stay synchronized:

1. **Markup (`src/controllers/flutter-panel-controller/views/modals/<feature>ModalHtml.ts`)**
   - Export a pure HTML builder function and interpolate it inside [`panelHtml.ts`](../src/controllers/flutter-panel-controller/views/panelHtml.ts).
   - Bind inline button triggers explicitly to `window.airFlutter.<method>()` so lexical globals cannot shadow the call.

2. **Synchronous Bridge (`src/controllers/flutter-panel-controller/views/panelHtml.ts`)**
   - Register the entry method on `window.airFlutter` in the inline `<script>` block **before** `DOMContentLoaded`.
   - Route modal openers through `this.delegate('<appMethod>', '<fallbackHostCommand>')`.

3. **Webview Module (`media/modules/<feature>Module.js` & `media/air-flutter.js`)**
   - Attach methods to `window.AirFlutter<Feature>Module = { ... }`.
   - Register the `<script src="${<feature>ModuleUri}">` tag in `panelHtml.ts` **before** `air-flutter.js`.
   - Mix the module into `AirFlutterWebview` via `mixinModule(AirFlutterWebview, window.AirFlutter<Feature>Module)` and call `this.init<Feature>()` inside `initializeEventListeners()` in [`media/air-flutter.js`](../media/air-flutter.js).

4. **Host Handler (`src/controllers/flutter-panel-controller/handlers/panel<Feature>Handler.ts`)**
   - Encapsulate extension-host message handling in a dedicated handler class receiving `PanelHandlerContext` or `PanelDeviceContext`.
   - Route incoming `message.command` cases in [`FlutterPanelController.ts`](../src/controllers/flutter-panel-controller/FlutterPanelController.ts) to the handler and delegate business logic to `src/domain/<feature>/`.

5. **Styles (`media/css/<feature>.css` or `media/css/sidebar/<part>.css`)**
   - For main panel features, link `media/css/<feature>.css` in `panelHtml.ts` using CSS custom properties from `media/css/theme.css`.
   - For sidebar views, edit `media/css/sidebar/<part>.css` and run `npm run build:sidebar-css` to regenerate `media/sidebar.css`.

## Completion Criteria for JSDOM Tests

- JSDOM tests (`test/test-*-dom.js`, `test/test-mcp-loadorder.js`) require compiled output in `out/`. Run `npm run compile` before executing any DOM test so `out/controllers/flutter-panel-controller/views/panelHtml.js` reflects current TypeScript templates.

