# Text And Display Scaling Policy

SHINE AAC must remain usable with Android's non-default font and display-size
settings. Testers must not be told to restore the Android default as a workaround.

## Platform baseline

- Native Android text uses `sp`; geometry, padding, and touch targets use `dp`.
- The app is tested through Android's maximum supported 200% font scale.
- Text containers reflow or scroll. A fixed height must not be derived from an
  assumed text height.
- Critical actions stay visible. Secondary setup controls may scroll, with a
  persistent scrollbar or another clear scroll cue.
- WebView text zoom follows `Configuration.fontScale` instead of being forced to
  100%. The Web UI must then re-measure its available viewport.

Android 14 introduced nonlinear font scaling up to 200%. Android explicitly asks
apps to use `sp` and test at the maximum setting. Padding and layout dimensions
should not be expressed in `sp`, and code must not reverse-calculate pixels by
dividing by `fontScale` or `scaledDensity`.

References:

- https://developer.android.com/about/versions/14/features#accessibility
- https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units
- https://developer.android.com/develop/ui/compose/accessibility/scalable-content
- https://developer.android.com/develop/ui/compose/accessibility/testing

## AAC board exception

The communication board is a timed scanning surface, not a reading page. Making
the entire board scroll would hide scan targets and change their spatial
positions. Therefore:

1. Touch and scan targets keep their allocated size.
2. Rows and columns adapt to the available window. Function and word keys use
   exactly the same display, padding, border width, radius, line height, font
   weight, and label-fitting algorithm. Function identity uses only
   spacing-independent styling: background colour, border colour, inset-shadow
   colour, and an accessible name. Badges and icons are not drawn inside keys.
3. Text first grows with the system preference. Communication-board labels stay
   on one line so their visual form remains stable while scanning.
4. Only when a label cannot fit its fixed scan target may that individual label
   be fitted down. Every label uses the same 10 CSS-pixel emergency fitting
   floor. A visible board label is accepted for release only when the resulting
   shared fit stays at or above 18 CSS pixels; function labels must reach 20 CSS
   pixels on the normal phone board. Dense layouts inherit the shared key base
   size when it is below those thresholds.
5. If a required label still cannot fit at that floor, the test fails. The label
   must be shortened, redesigned, or moved to a roomier layout; clipping is not
   accepted.

This exception preserves access to the complete first-layer Zhuyin board while
allowing short symbols and common words to benefit from larger text.

## Required release matrix

Run the main board, Config, Input Test, and Camera setup at:

| Font size | Display size | Required coverage |
| --- | --- | --- |
| Default | Default | Baseline phone and tablet |
| 200% | Default | Android maximum-font behavior |
| Default | One step larger | Reduced effective viewport |
| 200% | One step larger | Worst supported combined setting |

At least one run must use the target Samsung phone because vendor font/display
presets and system bars can expose failures that a browser viewport does not.
For Camera setup, `開始`, `測試`, and `完成` must be visible without
scrolling; hold and zoom controls must remain reachable by scrolling. For every
function tile, the label must stay inside the tile without clipping. Automated
release checks require exact metric equality between function and word keys at
default and 200% text on default and larger-display phone viewports. Any metric
divergence, sub-floor, clipped, or overlapping label blocks the build.
