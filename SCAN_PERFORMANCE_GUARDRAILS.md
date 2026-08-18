# Scan performance guardrails

## Purpose

Row and cell scanning is a real-time interaction loop. A configured 300 ms scan
interval must mean approximately 300 ms between visible scan changes on a real
device. Suggestion generation, layout preparation, persistence, speech setup,
or rendering must not consume part of that interval or run once per scan step.

This document records the Android-only pause investigation around code71, the
failure mechanism, the fixes that were proven on a physical device, and the
rules and tests required for future changes.

## What we learned

### The timer setting was not the cause

The pause reproduced with a 300 ms setting while the same build appeared normal
in a PC emulator. Early measurements that reported approximately 30 ms for a
300 ms setting were measuring the wrong boundary and therefore could not
validate the user-visible scan interval.

The important boundary is visible highlight onset to visible highlight onset on
the target Android device. JavaScript execution time measured in isolation, or
an emulator-only timer, is not an acceptance measurement for this defect.

### Synchronous preparation can look like a timer pause

The old path coupled board construction and suggestion processing to scan and
activation transitions. Long synchronous work on the WebView UI thread delays
rendering and timer callbacks. Depending on where it occurs, the user sees a
pause before the next row/cell highlight or before activation even when the
configured timer value itself is correct.

The defect was most visible after reset because the initial zh-TW state had no
phonetic narrowing. That state expanded a 60,000-entry corpus, filtered and
mapped it, normalized candidates during deduplication, and then discarded nearly
all results because only three pages were reachable.

Observed core-level sizes for the old empty zh-TW path were:

| Stage | Candidate count |
| --- | ---: |
| Configured dictionary entries | 120 |
| Configured entries after core-response exclusions | 105 |
| Combined stream after suppression | 60,098 |
| Unique results after deduplication | 33,525 |
| Results reachable through three pages | 45 |

At the default four suggestion columns, a page has 16 cells. When `MORE` is
present, 15 results are usable per page, so three pages expose at most 45
results. Processing tens of thousands of entries to produce those 45 results
was structurally wrong, regardless of how fast it appeared on a desktop.

### Scan state and content state are different domains

The logical board depends on content state such as message text, undo
availability, profile, category, suggestion page, symbols, column count, and
measured suggestion spans. It does not depend on the currently highlighted row
or cell, nor on a timing-only configuration clone.

Changing only `scannerState` must therefore reuse the same prepared logical
board. Row activation must lock a row from that prepared board rather than build
a second board. Normal cell scanning should retain the same outer board identity
when the locked row is already the prepared row.

### Preparation must finish before the scan clock starts

The correct sequence is:

1. Apply a content/configuration change.
2. Generate the bounded suggestions and logical board.
3. Render the board.
4. Complete any required DOM measurement, such as wide-label column spans.
5. Render the measured layout if it changed.
6. Reset and start the scan clock.

Starting the clock before steps 2-5 makes correct work consume the user's scan
interval. Wide-label measurement is asynchronous because it requires browser
layout, so a changed span layout cancels the old scheduled scan and starts a
fresh interval only after the measured board is rendered.

## Implemented architecture

### Bounded, lazy suggestions

- Empty zh-TW input keeps configured AAC suggestions but does not query or
  enumerate the phonetic corpus.
- The zh-TW candidate stream stops after the 45 reachable results are accepted.
- Nonempty Han fallback is lazy and stops when the reachable result set is full.
- Deduplication computes normalized keys once per visited candidate and combines
  filtering and limiting in one greedy pass.
- Ordinary English rows read only their visible capacity. A bounded overflow
  pool is requested only when explicit wide spans can defer candidates.
- English prefix results are cached per dictionary and prefix. The first lookup
  for a new English prefix can still be O(N), but it occurs on a content change,
  before the replacement scan clock begins, and never on each scan step.

### Prepared-board reuse

The core caches the prepared logical board by suggestion-dictionary identity and
validates every board-affecting field. Scan-only and timing-only changes reuse
that board. If a new configuration field affects board contents or packing, it
must be added to the cache validation and covered by an invalidation test.

Current board-affecting fields include:

- profile and auto-space mode;
- column count;
- symbols and suggestion dictionary identity;
- measured suggestion-column spans;
- message and undo availability;
- active category and suggestion page.

The cache assumes prepared rows and candidate tiles are treated as immutable.
Code must replace content/configuration objects instead of mutating cached board
data in place.

### Scan hot path

For a normal row or cell transition, the remaining work is bounded by board
size, not corpus size:

- retrieve the prepared board;
- count/select within the relevant small row;
- update scanner state;
- reuse a cached board signature when the board identity is unchanged;
- patch active CSS classes and progress state.

The hot path must not call corpus filtering, sort a dictionary, serialize a
dictionary, rebuild the logical board, perform label measurement, or replace the
full board DOM.

## Regression tests and analysis methods

### Work-count invariants

Elapsed time on a fast machine can hide algorithmic regressions. Tests should
also count work directly:

- prepare a dictionary entry with an observable label getter;
- prepare the board once;
- advance at least 24 row/cell scan transitions;
- assert zero additional suggestion reads;
- activate a row with zero and positive transition pauses;
- assert zero additional suggestion reads;
- clone timing-only configuration and assert the board remains cached;
- change message or measured spans and assert the board is invalidated.

A throwing getter immediately after visible capacity also proves that bounded
suggestion retrieval does not read beyond the required result pool.

The automated large-N acceptance uses virtual one-million-entry English and
zh-TW dictionaries without allocating a million persistent objects. It covers
the computational worst cases directly:

- a cold English prefix with its only match at entry 1,000,000 must make one
  preparation pass within five seconds, then perform zero corpus reads through
  10,000 scan transitions;
- empty English input must read no more than the eight visible candidates;
- empty zh-TW input with one million configured suggestions must stop below 100
  reads, reflecting its bounded reachable result capacity.

This gate measures N as corpus/candidate-pool size. The scan-transition loop is
only a cache-invariance check after large-N preparation; repeated transitions
are not treated as the computational data size.

### State-space equivalence

When replacing a candidate algorithm, compare visible results against the
previous accepted implementation over generated states, not only hand-picked
examples. The fixed-code71 validation covered:

- 40,264 valid Zhuyin prefixes;
- 8,329 Han-context prefixes;
- 186,043 zh-TW board comparisons;
- 210 English comparisons.

All visible results matched code71 except the deliberate empty-input corpus
suppression. This method catches rare page-boundary and deduplication changes
that are impractical to test manually.

### Physical-device timing acceptance

Use a fixed scan setting, such as 300 ms, and measure a large number `X` of
visible transitions. For a steady row or cell phase, expected time is
approximately `X * scanIntervalMs`. Test row scanning and cell scanning
separately. Account explicitly for transition-pause and first-cell intervals
only when the measured sequence crosses those states.

Required cases are:

- reset and initial scanning before any activation;
- first row activation and first cell activation;
- repeated row/cell activation;
- first Zhuyin symbol;
- a deeper Zhuyin prefix;
- empty and growing English input;
- a layout containing long English suggestions.

The opt-in browser cumulative timing acceptance defaults to 80 row transitions
and 80 cell transitions. It rejects:

- mean absolute interval drift above 15 ms per transition;
- p95 interval excess above 35 ms;
- any single interval excess above 100 ms;
- row-to-first-cell or cell-to-first-row activation latency above 75 ms.

Run the core gate with `npm run test:scan-performance`. Run the visible browser
gate with `SHINE_AAC_SCAN_INTERVAL_MS=300` and
`node scripts/e2e-web.mjs --cumulative-timing`. The transition count may be
raised for timer soak testing, but it is separate from corpus-size N.

Instrument visible render/highlight timestamps if automation is used. Do not
infer user-visible timing from the duration of a core function alone. Emulator
results are useful for determinism and correctness but do not replace physical
Android acceptance.

### Complexity review before merging

For every suggestion or layout change, record:

- corpus size `N`;
- maximum visited candidates;
- maximum visible/reachable results;
- whether work happens at module load, content change, layout change, activation,
  or every scan step;
- cache key and invalidation conditions;
- worst-case empty-input behavior.

Reject a design when scan-step work is O(N), when empty input scans a corpus, or
when an unbounded intermediate array is created to fill a bounded UI.

## Change-management rules

- Commit each feature or performance fix separately.
- Tag a physical-device-verified checkpoint before adding the next feature.
- Keep feature increments cumulative after the defect is fixed; do not resume a
  bisect unless a new regression is observed.
- Package source with every APK so a verified binary always maps to a recoverable
  commit.
- Do not push or create release tags without explicit authorization.

## Checklist for future board-affecting changes

- [ ] Does this field change logical rows, labels, ordering, spans, or actions?
- [ ] If yes, is it part of prepared-board cache invalidation?
- [ ] Is empty input O(visible capacity), not O(corpus size)?
- [ ] Is retrieval bounded before materialization and deduplication?
- [ ] Can scan-only transitions reuse the same board identity?
- [ ] Does row activation lock the already-prepared row?
- [ ] Does DOM measurement finish before the scan clock restarts?
- [ ] Do work-count tests prove zero suggestion reads during scanning?
- [ ] Do exhaustive comparisons cover ranking and page boundaries?
- [ ] Has the final build been tested on a physical Android device?
