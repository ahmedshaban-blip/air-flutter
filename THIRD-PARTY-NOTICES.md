# Third-party notices

Air Flutter is distributed under the MIT License (see `LICENSE`). It builds on the work
listed below. This file exists for licence compliance and is not part of the extension's
user interface.

---

## Upstream project

This extension began as a derivative of an MIT-licensed VS Code extension for wireless
ADB and Flutter tooling. Substantial parts of the source were rewritten for this release,
including the entire user interface, the sidebar, the device log, the device tools and the
mirroring modes. The original licence grant still applies to the portions that remain.

```
MIT License

Copyright (c) 2025 Jam Ali Hassan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## scrcpy

Screen mirroring is performed by **scrcpy**, redistributed unmodified in `bin/`.
scrcpy is licensed under the **Apache License 2.0**.

- Project: https://github.com/Genymobile/scrcpy
- Full licence text: [`bin/LICENSE.scrcpy.txt`](bin/LICENSE.scrcpy.txt)
- Copyright (C) 2018 Genymobile, Copyright (C) 2018-2026 Romain Vimont

The bundled `bin/` directory also contains FFmpeg libraries (`avcodec`, `avformat`,
`avutil`, `swresample`), `SDL3`, and `libusb`, each under their own licence. These are
the exact builds the scrcpy project ships; see
<https://github.com/Genymobile/scrcpy/blob/master/app/data/README.md>.

---

## Runtime dependencies

Only the packages actually loaded at runtime are listed.

| Package | Licence | Used for |
|---|---|---|
| `local-devices` | MIT | Finding phones on the local network |

Two further packages remain declared in `package.json` for historical reasons but are not
imported by any code path in this release: `adm-zip` (MIT) and `diff` (BSD-3-Clause).

---

## Fonts and icons

Loaded at runtime from public CDNs; nothing is redistributed.

- **IBM Plex Sans** and **IBM Plex Mono** — SIL Open Font License 1.1
- **Font Awesome Free** — CC BY 4.0 (icons), SIL OFL 1.1 (fonts), MIT (code)
