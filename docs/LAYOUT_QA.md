# Layout quality audit

Layout QA uses structural evidence. It does not tone-match screenshots or
modify normal app behavior to satisfy a test.

## Layout graph model

Treat every rendered screen as a small graph instead of a collection of
screenshots to inspect one at a time:

- **Nodes** are text ink, controls, repeated rows, and named major regions.
  Measure rendered ink and bounds, not the width of an arbitrary layout cell.
- **Edges** express relationships: explicitly adjacent content belongs together,
  rows belong to a sequence, and a major visual region belongs between its
  header and controls. An ordinary two-column form is not assumed to be adjacent.
- **Local invariants** cover touch size, overlap, text leading, cell padding,
  repeated-row rhythm, edge alignment, contrast, and explicitly declared
  source-to-target gaps.
- **Global invariants** use proportions rather than captured pixels: important
  regions receive an explicit minimum/maximum share of the available viewport.
- **Differential invariants** compare the same named region across interaction
  state, locale, theme, orientation, and supported font scales. Unexpected
  movement or clipping is reported even when every individual screenshot looks
  superficially plausible.

The Android adapter builds this graph from UIAutomator accessibility bounds; the
Web adapter uses DOM geometry and `Range` text-ink rectangles. Screen-specific
code may identify a semantic region or relationship, but the finding rules are
shared and resolution-independent. Captured examples are regression fixtures,
not target dimensions.

The automated matrix should sample at least:

| Dimension | Required samples |
| --- | --- |
| Viewport | narrow/short phone, reference phone, and a wider or taller device |
| Font | default and supported enlarged scale; 200% is a clipping stress case |
| Locale | `zh-TW` and English, including the longest important labels |
| Theme | every shipped preset, with extra checks on dark surfaces |
| State | idle, active, error/help/status changes, and restored state |

Automation produces candidates. A new or uncertain heuristic remains a review
finding until before/after screenshots establish that it has low false-positive
risk across the matrix.

## Design references

- Android adaptive guidance: make layout decisions from the available app
  window and test across width/height classes, rather than assuming a physical
  device size.
  <https://developer.android.com/develop/ui/views/layout/responsive-adaptive-design-with-views>
- Android accessibility guidance: interactive targets are at least 48×48dp;
  visual content may remain more compact inside that target.
  <https://developer.android.com/guide/topics/ui/accessibility/views/apps-views>
- Material accessibility guidance: keep related information grouped, but retain
  consistent alignment and at least 8dp between distinct touch targets.
  <https://m1.material.io/usability/accessibility.html>
- Google's Camera Switches flow gives gesture selection and gesture duration
  distinct, plainly named concepts rather than combining them into long prose.
  <https://support.google.com/accessibility/android/answer/11150722>

## Evidence layers

1. **Rendered geometry**
   - Read DOM rectangles and computed styles from the real Android WebView.
   - Read native control rectangles from UIAutomator.
   - Detect clipping, horizontal overflow, overlapping controls, touch targets
     below 48dp, repeated-row gaps, alignment drift, loose text leading, and
     padding disproportionate to the text size.
2. **Theme surfaces**
   - In a dark theme, inspect every visible opaque background surface.
   - Flag bright surfaces that occupy at least 1% of the visible panel.
   - Small bright controls and text are excluded by the area threshold.
3. **Native content allocation**
   - Some rendered surfaces, including Camera Setup's `TextureView`, are not
     exposed to accessibility tools.
   - Infer the camera-preview band from the accessible header/status and
     controls-panel landmarks, or read the exact accessible preview frame.
     Flag a portrait preview below 40% of screen height.
   - Change the real optical mode and message, then require identical preview
     bounds before, during, and after restoring the original mode.
   - Normalize native button widths to dp and compare secondary control cells
     with Unicode glyph-width estimates. Identify the primary action row from
     geometry so prominent Start/Done actions are not treated as wasted space.
   - Require secondary control groups to share a coherent trailing edge. Do not
     treat intentional whitespace in a label/control grid as wasted space.
4. **Screenshot review**
   - Capture every major surface with state, locale, theme, font scale, and
     build identity in its filename/manifest.
   - Keep after-only review archives separate from intentionally broken
     before evidence.
   - Use screenshot inspection for visual hierarchy and aesthetics that are
     not safely reducible to a numeric rule.

## Calibration evidence

The heuristics are regression-tested against observed failures rather than
invented examples:

- Configuration checkbox rows: the reported layout had five 12 CSS-pixel
  gaps between consecutive 48px targets. A compact list has at most 4px.
- Camera preview: the broken capture used 205px, and the first compact fix used
  906px (37.8% of the full display). The current accessible preview is 1070px
  (44.6%) at normal scale and 1032px (43.0%) at capped 200% font.
- Preview stability: the real-device Long Blink → Cheek Twitch → Long Blink
  sequence retained exact `(top, bottom) = (340, 1410)` bounds while both top
  messages changed.
- Camera Setup controls: the equal-weight layout stretched short secondary
  labels to 88-137dp cells. The corrected app uses Android's measured text
  width plus 16dp padding, with a 48dp minimum touch width; the independent
  UIAutomator audit reports no disproportionately padded secondary cells.
- Camera Setup rows: compact secondary buttons remain anchored to one trailing
  grid edge. Labels use concise nouns and values rather than sentence-like text;
  whitespace inside the label column is not itself considered a defect.
- Dark theme: a large opaque white surface is a finding; a small bright
  checkbox is not.

Threshold findings are review candidates, not automatic authorization to
change production UI. A screenshot and geometry report must confirm the
problem in normal use before an app fix is made.

## Required state matrix

At minimum, release layout evidence covers:

- Traditional Chinese and English;
- default, high-contrast light, and high-contrast dark presets;
- communication board, Configuration, voice selection, App Info, Input Test,
  reset confirmation, text export, and Camera Setup;
- normal font scale, plus the 200% corner-case pass;
- portrait and constrained landscape evidence;
- default values and representative longest translated labels.

## Reports

`device-test.bat` is the release-facing entry point. It produces screenshots,
UI hierarchies, layout metrics, and ranked findings under `test-results/`.
`scripts/device-config-audit.mjs` performs the WebView geometry/theme audit;
`scripts/device-acceptance-test.py` performs native and lifecycle checks.

P2-P4 output must include the exact screenshot and machine-readable geometry
used to produce the finding. Uncertain aesthetic findings are shown to the
user for judgment instead of being silently "fixed."
