# App Icon Studio Requirements

Primary-source notes used by the App Icon & Splash Studio UI and validation rules.

## Shared authoring input

- Air Flutter accepts a `PNG`, `JPEG`, or `WebP` file up to `10 MB`.
- A `PNG` that is already `1024 × 1024 px` is used as-is.
- Any other format or size opens a conversion dialog, because one lossless `1024 × 1024 px` PNG master must drive every Android and iOS export.
- The conversion dialog offers `Fit` (whole image, transparent padding) and `Cover` (fills the square, crops edges), with X/Y nudging and an optional solid padding color.
- `Stretch` is never offered: distorting the aspect ratio produces broken launcher icons.
- The generated PNG is re-validated by the extension host (signature, `1024 × 1024`, payload size) before the studio accepts it as a source.
- Conversion never changes the original file on disk, and no project file is written until `Generate & Apply`.
- Keep important artwork centered and inspect it at launcher size; fine detail can disappear after downscaling.
- Do not bake an outer mask, rounded corners, or an outer drop shadow into the master. Android launchers, Google Play, and Apple platforms apply their own masks.

## Android adaptive launcher icons

- A color adaptive icon has separate foreground and background layers; vector layers are preferred, but bitmap layers are supported.
- Every layer uses a `108 × 108 dp` canvas.
- Important foreground artwork must stay within the centered `66 × 66 dp` safe zone that OEM masks never clip.
- The outer `18 dp` on every side is available for OEM masking and launcher motion effects.
- The logo should be at least `48 × 48 dp` and no larger than `66 × 66 dp`.
- In Air Flutter's `1024 × 1024 px` authoring canvas, the `66 / 108` safe-zone ratio is approximately `626 × 626 px`.
- Android 13+ themed icons use a monochrome layer when the launcher supports themed icons.
- The final shape and motion can vary by device OEM, launcher, theme, and icon pack.

Source: [Android Developers — Adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)

## iOS app icons

- The standard iOS layout canvas is square and `1024 × 1024 px`.
- Supply square artwork; the system applies the rounded-rectangle mask.
- Air Flutter flattens alpha against the selected background before generating iOS assets because the App Store icon must be opaque.

Sources:

- [Apple Human Interface Guidelines — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Apple Developer — Configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)

## Google Play listing icon

The Play listing icon is separate from the APK launcher icon:

- `512 × 512 px`
- 32-bit PNG in sRGB
- Maximum `1024 KB`
- Full square; Google Play applies the corner radius and outer shadow

Source: [Android Developers — Google Play icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
