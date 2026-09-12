# v0.5.0 accessibility corrections

The user approved these fixes after reviewing the actual board evidence.

## Scope and cause

- **Sizing bug:** English suggestion spans cache content but omit geometry.
  Built-in ACCESSIBILITY after `accessibil` shrinks to 15.7 px following a
  393×851 to 320×694 resize; a fresh page uses three columns and 18 px.
  English and embedded English share this path.
- **Header design correction:** the narrow layout stretches Settings across
  two grid rows. At Android 200% text, its width crowds the status, whose
  `overflow-wrap: anywhere` splits Review. The replacement gives status priority
  and uses a compact, accessibly named gear when the full label cannot fit.

## Invariants

Keep the configured board, one-line board labels, two reserved status lines,
draft, language, undo history and switch semantics. Geometry-only suggestion
regrouping is allowed at the existing review pause. During active scanning,
defer it: preserve semantic targets, displayed candidates and the deadline.
Recompute from the current geometry at the next review pause. Do not disable
Android text scaling, reduce its requested size, or make the whole board scroll.
Settings retains a minimum 48 CSS-pixel touch target and accessible name.

## Verification

Use the full shipped board and built-in dictionary for both English paths.
Compare fresh load and resize, and check active scanning independently of pause.
Check word line rectangles, clipping, Settings bounds and accessible naming.
Preview the header on the actual phone at Android 200% before applying it.
Run source/packaged browser gates, build/native tests and device-test.bat on the
final APK. Restore all device settings and verify its display OFF under lease.
Record failures and exact tested artifacts in the release review.
