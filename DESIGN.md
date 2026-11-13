---
name: Air Flutter
description: Terminal editorial design system for the Air Flutter VS Code panel and sidebar — paper, ink, one ember accent, hairline rules, mono machine data.
colors:
  paper: "#F2EFE6"
  surface-chalk: "#FAF8F2"
  surface-ash: "#ECE7DA"
  ink-iron: "#14150F"
  ink-slate: "#3C3F33"
  ink-field: "#5E6152"
  rule-hairline: "#D5D0BF"
  rule-heavy: "#B9B4A2"
  ember: "#B23B16"
  ember-ink: "#FFF4EC"
  signal-ok: "#2C6E49"
  signal-warn: "#8A5A06"
  signal-err: "#A3231C"
  well: "#14150F"
  well-ink: "#E7E3D6"
  well-muted: "#8F9184"
  well-rule: "#2C2F27"
  well-info: "#8FB6C9"
  well-success: "#7FC08F"
  well-warn: "#D6B36A"
  well-err: "#E08575"
  level-debug: "#6E93B8"
typography:
  headline:
    fontFamily: "IBM Plex Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "IBM Plex Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body-small:
    fontFamily: "IBM Plex Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
  label-small:
    fontFamily: "IBM Plex Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "9.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.09em"
  machine-data:
    fontFamily: "IBM Plex Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.02em"
rounded:
  sm: "2px"
  field: "3px"
  lg: "4px"
  mark: "7px"
  badge: "10px"
  pill: "999px"
spacing:
  hair: "4px"
  tight: "6px"
  row: "8px"
  control: "12px"
  block: "14px"
  section: "22px"
  column: "24px"
  gutter: "28px"
components:
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-iron}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-default-hover:
    backgroundColor: "{colors.ink-iron}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ember-ink}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.ink-iron}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    size: "28px"
  text-field:
    backgroundColor: "{colors.surface-chalk}"
    textColor: "{colors.ink-iron}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
    typography: "{typography.machine-data}"
  modal-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-iron}"
    rounded: "{rounded.lg}"
    width: "620px"
  log-well:
    backgroundColor: "{colors.well}"
    textColor: "{colors.well-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  ruled-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-iron}"
    padding: "11px 0"
---

# Design System: Air Flutter

## Overview

**Creative North Star: "The Terminal Ledger"**

A printed technical record kept open beside a running terminal. Every entry is ruled, every serial is set in mono, and exactly one stamp — ember — marks the line that matters. The interface never draws a box where a rule will do, and never reaches for a shadow where the paper itself can carry the structure. This is why the panel reads as a document rather than a dashboard: the columns, the rules between them, the tabular serials, and the uppercase mono labels are all moves borrowed from a well-kept logbook.

The system is dense on purpose. It is scanned mid-task on a second monitor, so information is packed into ruled rows with small caps labels instead of being spread across cards. Density is achieved by removing chrome, not by shrinking type: body copy stays at 14px, controls keep a 34px hit area, and the compression happens in the 2px corners, the 1px rules, and the 8–11px row padding.

Two modes, both first class. Light is warm paper (#F2EFE6) with iron ink; dark is near-black (#0F110E) with bone ink. Neither is an inversion of the other — they swap the paper stock and the accent shifts from ember oxide to a brighter ember so the same signal survives on black. Machine output in both modes sits on its own inverted **well** surface, which is the one place in the system where background does the work that a card would do elsewhere.

**Key Characteristics:**
- Ruled-line structure: 1px `rule` between rows, 1px `ink` under mastheads and column splits.
- One ember accent, used as a stamp — primary actions, focus, active state — never as a field.
- Absolute sans/mono split: prose and device models in sans, every serial, endpoint, command, timestamp and status label in mono.
- 2px corners as the rule; 3px fields, 4px modals, pills only for gauges and badges.
- Flat at rest; exactly one elevated object (the modal) plus the inverted well.
- Optical density: 9.5–10.5px uppercase mono labels against 12.5–14px sans body.

## Colors

A warm neutral paper stack carrying a single oxide-red signal — closer to red ink on cream stock than to a product palette.

### Primary
- **Ember Oxide** (#B23B16): the only accent. Primary button fill, focus ring, active tab border, link colour, the stamped rule under the wordmark, and hover text on interactive rows. In dark mode it brightens to **Ember Bright** (#F06A3C) so it holds the same weight on near-black.
- **Ember Ink** (#FFF4EC): text and iconography placed on top of ember. In dark mode it inverts to near-black (#180C08) because the bright ember needs dark type.

### Neutral
- **Warm Paper** (#F2EFE6): the canvas — page background behind every column, ruled row, and panel. Outlined controls are cut-outs onto it, so they carry no fill of their own.
- **Chalk Surface** (#FAF8F2): the one step up from paper. Modal headers and footers, modal input fills, step cards, keys.
- **Ash Surface** (#ECE7DA): the recessed step — preset pills, segmented-control troughs, status badges, inline `code` chips.
- **Iron Ink** (#14150F): primary type, 1px control borders, and the heavy rules that separate masthead, columns, and footer.
- **Slate Ink** (#3C3F33): secondary type — quiet button labels, step copy, log tags in the sidebar.
- **Field Grey** (#5E6152): muted metadata — captions, notes, timestamps outside a well, footer text.
- **Ruled Line** (#D5D0BF): the hairline that divides rows inside a column. The single most-repeated visual element in the product.
- **Heavy Rule** (#B9B4A2): borders that need to be seen without becoming ink — icon buttons, quiet buttons, unchecked checkboxes, `kbd` edges.

### Signals
- **Dried Green** (#2C6E49): online device, successful build, active badge.
- **Amber Seal** (#8A5A06): offline, unauthorized, warning, secrets notice.
- **Sealing Wax** (#A3231C): errors, destructive buttons, recording state, invalid input.

### The Well
- **Well Ink** (#E7E3D6) on **Well** (#14150F), with **Well Muted** (#8F9184) and **Well Rule** (#2C2F27). The well is the same near-black in both modes: machine output is a terminal, and a terminal does not get lighter in light mode.
- Log levels are tinted against the well, not against paper: **Well Info** (#8FB6C9), **Well Success** (#7FC08F), **Well Sand** (#D6B36A), **Well Salmon** (#E08575). These four are the only place the system uses a low-chroma tint set; they exist so a log line's severity is legible without reading the tag.
- The sidebar log has no well — it sits on paper — so it reuses `--ok`, `--warn`, `--err` for info/warn/error plus **Debug Blue** (#6E93B8). Same four meanings, resolved for the surface they sit on.

### Dark ledger
Light values are the normative frontmatter. Dark mode re-points the same semantic names: paper #0F110E, surface #151814, surface-2 #1E221B, ink #E9E5D8, ink-soft #C6C2B4, muted #93958A, rule #2A2E26, rule-strong #3A3F35, ember #F06A3C, ok #63C286, warn #D9A94E, err #E57663, well #0A0C09.

### Token map
Descriptive names above are the spec's language; these are the variables an agent must actually write. All live in `media/css/theme.css` under `:root`, and are re-pointed on `html.dark-mode`.

| Token | Variable |
|---|---|
| Warm Paper | `--paper` |
| Chalk Surface | `--surface` |
| Ash Surface | `--surface-2` |
| Iron Ink | `--ink` |
| Slate Ink | `--ink-soft` |
| Field Grey | `--muted` |
| Ruled Line | `--rule` |
| Heavy Rule | `--rule-strong` |
| Ember Oxide | `--accent` |
| Ember Ink | `--accent-ink` |
| Dried Green / Amber Seal / Sealing Wax | `--ok` / `--warn` / `--err` |
| Well / Well Ink / Well Muted / Well Rule | `--well` / `--well-ink` / `--well-muted` / `--well-rule` |
| Sans / Mono stacks | `--font-sans` / `--font-mono` |
| Easing | `--ease` |

### Named Rules
**The One Ember Rule.** Ember covers less than 10% of any screen and never fills a large surface. It appears as a stamp: one primary action per region, one active state per control group, one focus ring.

**The Well Rule.** Machine output — logcat, generated shell commands, secrets snippets, toasts — renders on the inverted well, never on paper. A well is depth by inversion, not by shadow.

## Typography

**Display Font:** none. The wordmark is body sans at 19px/600 — the system has no display face and does not need one.
**Body Font:** IBM Plex Sans (fallback Segoe UI, system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (fallback Cascadia Mono, Consolas, Courier New, monospace)

**Character:** A single superfamily doing two jobs. Plex Sans carries language — names, sentences, command titles — at normal weight and slightly negative tracking so 14px reads as typeset rather than as UI chrome. Plex Mono carries everything a machine produced: it is the visual proof that a value was not written by a designer. Because both faces come from the same family, the switch reads as a change of voice, not a change of brand. Everything is offline-safe: both stacks terminate in system fonts.

### Hierarchy
- **Headline** (600, 19px, 1.1, -0.015em): the masthead wordmark only. The panel has no hero.
- **Title** (600, 16px, 1.3, -0.01em): section heads — "Devices", "Flutter commands", "Activity". Sans, sentence case.
- **Body** (400, 14px, 1.5): command titles at 13.5px/500, device models at 13–14px/600. Prose inside modals and step cards runs at 12.5px with 1.55 line-height and keeps to a single column under 620px.
- **Body small** (400, 12.5px, 1.5): secondary explanation, empty states, modal helper text.
- **Label** (500 mono, 10.5px, 0.06em, UPPERCASE): section eyebrows, subheads, column notes, status words. The **label-small** step (9.5px, 0.09em) carries the densest chrome: sidebar section heads, status words, tabs, footer, log tags. Uppercase mono at small size is the system's signature texture — it is how a ruled document labels a field.
- **Machine data** (400 mono, 10–11px, tabular-nums): serials, IP:port pairs, adb/flutter command lines, timestamps, counts.

### Named Rules
**The Machine Data Rule.** If a value came from a device, a CLI, or a clock — serial, IP, port, endpoint, package id, command, timestamp, log line, version — it is mono. If a human wrote it as language — device model, command title, button label, sentence — it is sans. There is no third option and no exceptions for cramped layouts; cramped layouts shorten the string or wrap it.

**The Small Caps Rule.** Labels are uppercase mono with positive tracking, never uppercase sans. Uppercase sans is reserved for the two words of a primary button.

## Layout

A three-column ledger inside a 1440px shell with 28px side padding and 24px column gutters. Columns are sized `minmax(280px, 330px) / minmax(0, 1fr) / minmax(216px, 252px)` — device discovery, command list, and action rail — separated by a 1px `ink` rule on the left edge of every column after the first. The masthead and footer are closed by the same 1px ink rule, so the page reads as three stacked bands rather than a floating grid.

Vertical rhythm is ruled, not spaced: rows are divided by a 1px `rule` and separated by padding alone (8px compact, 11px standard, 12–14px for cards). Groups sit 22px apart, sections 30px apart. Controls are 34px tall on the panel and 26–30px in the sidebar, which is the compression dial the two surfaces differ on.

Responsive behaviour is deliberate collapse, not fluid scaling:
- **≤1180px** — the rail leaves the grid and becomes a full-width band under the two remaining columns, opened by a 1px ink rule. Rail items reflow into two columns with 28px gap.
- **≤860px** — single column; every column boundary becomes a horizontal ink rule; shell padding drops to 18px; the sidebar log grows from 208px to 240px now that it is the main reading surface, and the log-line grid tightens.
- **≤340px** — the three-up mirror-mode grid stacks to one column.

**The Ruled Column Rule.** A column is separated by a border on its leading edge and rows inside it by hairlines. Cards are not used to group content that a rule can already group.

**The Pad-Not-Margin Rule.** Vertical rhythm inside a list comes from row padding, never from margins between rows. Two rows are separated by exactly one hairline; adding a gap on top of a rule turns a ledger into a card stack.

## Elevation & Depth

Flat by default. The system has no ambient shadows and no elevation scale; structure is carried entirely by 1px rules, the paper/chalk/ash tonal steps, and the inverted well. Depth exists in exactly two forms: the modal, which is the only lifted object, and the well, which is depth by inversion rather than by shadow.

### Shadow Vocabulary
- **Modal Lift** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35)`): the modal card only. Paired with a blurred scrim (`rgba(20, 21, 15, 0.65)` + `backdrop-filter: blur(4px)`) so the panel behind reads as out of focus, not merely dimmed.
- **Operation Indicator** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2)`): the sticky in-sidebar busy indicator. The one other exception, and it exists only while a long operation is running.
- **Recording Glow** (`box-shadow: 0 0 10px rgba(224, 49, 49, 0.4)` + pulse): destructive state feedback on the active mirror/record button. State, not elevation.

### Named Rules
**The Flat-At-Rest Rule.** Nothing casts a shadow at rest. If a surface needs to separate from the page, use a 1px rule, a tonal step, or inversion into the well. A shadow is a statement that something is temporarily floating above the document, and only the modal is ever above the document.

## Shapes

Square-leaning rectangles with a 2px radius — visible enough to soften a corner, not enough to read as a card. 2px covers buttons, icon buttons, inputs in the sidebar, log panels, toasts, tabs, checkboxes, step numbers, and version chips. 3px covers compact controls that sit one layer in — mirror-mode tiles, modal fields, modal option cards — where a control inside a container needs a touch more give. 4px is reserved for the modal card and the modal's larger option blocks. The brand mark is the only 6–7px corner in the system. Above that, radius becomes a status signal rather than a shape decision: 10px for status badges, 12px for preset pills and stage badges, `999px` for gauges and toggle-style badges.

Borders are always 1px except three deliberate heavier cases: the 2px ink rule under the masthead's brand, the 2px bottom edge of `kbd` keys, and the 3px ember left edge that marks a callout block inside a modal. Icons are single-weight line glyphs at 11–13px, inheriting text colour; there is no icon set with its own palette.

**The Two-Pixel Rule.** Unless it is a modal (4px), a brand mark (7px), or a status pill, the corner is 2px. Rounding up is how this system would start looking like a different product.

## Components

### Buttons
Precise and typed: a control reads like a typeset form field, not a physical key.
- **Shape:** 2px radius, 1px border, 34px tall on the panel (30px in the sidebar), 13px horizontal padding, 12px/500 label.
- **Default:** transparent fill with an **Iron Ink** border and ink label — an outlined cut-out on paper.
- **Hover:** full inversion to Iron Ink fill with Warm Paper label, 130ms linear. This inversion is the system's primary interaction verb.
- **Primary:** **Ember Oxide** fill, ember-ink label, ember border. Hover inverts to Iron Ink, not to a darker ember.
- **Quiet:** **Heavy Rule** border with Slate Ink label and 400 weight; hover inverts the same way. Used for secondary actions that must not compete with the ember stamp.
- **Danger:** **Sealing Wax** fill at 1px, hover darkens the same hue. `btn-danger-hover` applies the same treatment only on hover.
- **Disabled:** 40% opacity, `not-allowed`, hover suppressed so an inverted ghost never appears on a dead control.
- **Focus:** 2px ember outline at 2px offset, globally — never a border colour change alone.

### Icon buttons
28px square on the panel, 20–22px in the sidebar subheads, 1px **Heavy Rule** border, 2px radius, transparent fill, Slate Ink glyph. Hover raises the border and glyph to **Iron Ink**; the destructive variant raises them to **Sealing Wax** instead. No fill on hover — the inversion verb belongs to labelled buttons.

### Inputs / Fields
- **Style:** Chalk Surface fill, 1px **Heavy Rule** border, 3px radius, 8px/10px padding, **mono** type at 12px. Field values are machine data, so the field itself is set in mono.
- **Sidebar variant:** transparent fill on paper, 1px `rule` border, 2px radius, 26–30px tall, mono 10.5–11px; the placeholder is Field Grey and the caret is ink.
- **Focus:** border shifts to **Ember Oxide** with `outline: none`, or the global 2px ember outline when focus-visible must be explicit (checkboxes, buttons). One or the other, never both.
- **Labels:** 12px/600 uppercase ink at 0.04em in modals; 11px/600 muted in generic form rows. Helper text sits at 11px Field Grey.

### Checkboxes
Hand-drawn, not native: 12px square, 2px radius, **Heavy Rule** border, transparent fill. Checked fills **Ember Oxide** with an ember-ink 2px check drawn as a rotated border. This exists because host-injected form styles shrink bare checkboxes, so the control is authored explicitly.

### Cards / Containers
Ruled rows are the default container; cards are the exception, used only for a bounded step or a modal option.
- **Ruled row:** full-width, paper background, 1px `rule` top border (`first-child` drops it), 8–11px vertical padding. Hover recolours text to ember and nudges a trailing arrow 2px right.
- **Step card:** Chalk Surface, 1px `rule`, 2px radius, header/body split by a hairline, border darkens to Slate Ink on hover. No shadow.
- **Modal option card:** Chalk Surface, 1px Heavy Rule, 3px radius, 8px/10px padding; hover and checked both shift the border to ember.

### Device card (signature)
The panel's identity component. Device model at 13–14px/600 sans, serial directly beneath in 10.5px mono Field Grey, a 7px status dot (Dried Green online, Amber Seal offline/unauthorized, Field Grey unknown), and an uppercase mono status word in the matching signal colour. Below it, a 6px-tall pill gauge with an ember fill on an Ash Surface track (Sealing Wax when the value is low), a tabular mono value beside it, then a `dl` of mono small-caps keys against right-aligned values separated by hairlines. Mirror modes sit on their own three-up row of 3px-radius tiles whose mono titles shift to ember on hover.

### Log well (signature)
The machine-voice surface. **Well** fill in both themes, 1px **Well Rule** border, 2px radius, 10px/12px padding, 11px mono at 1.5 line-height, laid out as a three-column grid (62px time / 44px tag / 1fr text) with tabular timestamps. Tags are 9.5px uppercase mono tinted per level — cool blue for info, green for success, amber for warning, salmon for error. New lines animate in over 180ms with a 2px rise; nothing else in the log moves.

### Tabs and segmented controls
Tabs are 2px-radius 9.5px uppercase mono buttons on transparent fill; the active tab is signalled by an ember border and ember label, nothing else. The segmented control is a 6px-radius Ash Surface trough with a Chalk Surface active pill, ember label and 600 weight — the one place a control accepts a 6px corner, because it is a trough, not a button.

### Toasts
Well fill, 1px Well Rule, 2px radius, 10px/12px padding, fixed bottom-right at 18px inset, 240–340px wide, stacked 8px apart. A 9.5px uppercase mono head carries the status (success green, error salmon), the body is 12px sans on well-ink. They fade and rise 6px over 160ms and never carry a shadow.

### Modal
The one lifted object: paper fill, 1px Heavy Rule, 4px radius, 620px max width, 90vh cap, split into a Chalk Surface head, scrolling body at 18px padding with 16px gaps, and a Chalk Surface footer. Closes with an ember-free 16px glyph that turns **Sealing Wax** on hover. Callouts inside it are marked with a 3px ember left edge and Chalk Surface fill.

## Do's and Don'ts

### Do:
- **Do** divide rows with `1px solid var(--rule)` and separate major bands with `1px solid var(--ink)`; hairline density is the identity.
- **Do** set every device-derived value — serial, IP, port, package id, command, timestamp, version, count — in `var(--font-mono)` with `tabular-nums` where it aligns in a column.
- **Do** keep the accent as a stamp: one primary action per region, ember border plus ember label for active states, 2px ember focus outline at 2px offset.
- **Do** keep corners at 2px by default, 3px for tiles and modal fields, 4px for the modal card, and reserve 10px badges, 12px pills, and 999px gauges for status only.
- **Do** let hover invert a labelled button to Iron Ink fill with paper label, and let icon buttons only raise their border and glyph.
- **Do** put machine output on the inverted well (`var(--well)` / `var(--well-ink)`), which is identical in both themes.
- **Do** author both themes from the same semantic names so the dark ledger is re-pointed, never re-invented.
- **Do** keep every font stack terminating in a system face; the panel must hold with web fonts unavailable.

### Don't:
- **Don't** use gradients, glass, glow, or blur on surfaces. The single blur in the system is the modal scrim.
- **Don't** exceed a 4px radius on any panel, card, button, or input. Rounding up is a different product.
- **Don't** give anything a shadow at rest; the modal lift and the busy indicator are the only exceptions.
- **Don't** wash a large surface in ember — no ember page sections, headers, or fills behind text.
- **Don't** stack cards where ruled rows belong; devices, commands, and rail items are always ruled lists.
- **Don't** set labels in uppercase sans — uppercase labels are mono with 0.04–0.10em tracking.
- **Don't** introduce a second accent hue, a display typeface, or an icon font; icon glyphs must degrade to nothing gracefully.
- **Don't** rename element ids or message keys when restyling — markup and CSS are free, the host contract is not.
