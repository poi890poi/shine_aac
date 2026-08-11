# Communication Benchmark Report

Generated: 2026-08-11T02:48:20.766Z

These benchmarks are evaluation-only. They must not be used as special-case app logic.

## Real-World Metrics

| Metric | Unit | Current | Denominator / Target | Meaning |
| --- | --- | ---: | ---: | --- |
| Direct zh-TW phonetic symbols | weighted coverage | 100.00% | 100% | All 37 symbols directly visible on the first layer |
| Dynamic zh-TW continuation symbols | Zhuyin symbols | 0 | 0 | Hidden symbols required for phonetic input |
| Dead-end continuation symbols | Zhuyin symbols | 0 | 0 | Visible continuations that lead to no glyph/phrase candidate |
| Top zh-TW glyph reachability | unique Han glyphs | 224 / 224 (100.00%) | >= 99% | Single-character entries reachable in the top 500 source-ranked dictionary slice |
| Top zh-TW direct phrase reachability | unique phrases | 141 / 141 (100.00%) | >= 95% | Multi-character entries directly reachable as phrase candidates; this is compression, not the only coverage path |
| Top zh-TW phrase composability | unique phrases | 141 / 141 (100.00%) | >= 99% | Phrases whose component glyphs exist in the source dictionary and can be composed character by character |
| Top zh-TW exact-or-composable phrase coverage | unique phrases | 141 / 141 (100.00%) | >= 99% | Phrase is either directly suggested or constructible from reachable component glyphs |
| Direct phrase compression gaps | unique phrases | 0 | review downward | Top phrases not directly reachable but still composable from glyphs |
| zh-TW functional phrase surface | phrases | 48 | 10 areas x 8-12 phrases = 80-120 | Built-in functional phrases for needs, comfort, care, positioning, people, preference, and repair |
| Multi-concept utterance coverage | utterances / sentences | 16 | 10 areas x 12 utterances = 120 | Real communication sequences; this remains the main benchmark gap |
| Corpus-style zh-TW sentence audit | source sentences | 0 | external reference: 400 | BASPRO/TMNews scale reference only; generated filler is not counted |
| Benchmark pass rate | tasks | 103 | 103 | Evaluation tasks passing current limits |

## Effort Metrics

| Metric | Unit | Total | Average | Median | P90 |
| --- | --- | ---: | ---: | ---: | ---: |
| Estimated scan time | seconds | 4915.80 | 47.73 | 19.80 | 55.80 |
| Output selections | selected tiles | 411 | 3.99 | 2.00 | 4.00 |
| Switch activations | activations | 822 | 7.98 | 4.00 | 8.00 |
| Scanner advances | row/cell advances | 2731 | 26.51 | 11.00 | 31.00 |
| Activations per target concept | activations/concept | 822 / 152 | 5.41 |
| Selections per target concept | selections/concept | 411 / 152 | 2.70 |
| Activations per output character | activations/character | 822 / 393 | 2.09 |
| Estimated time per output character | seconds/character | 4915.80 / 393 | 12.51 |
| Direct zh-TW phrase commits | phrase commits | 17 | compression wins during benchmark composition |
| Decomposed zh-TW phrase fallbacks | phrase fallbacks | 0 | phrases completed by composing component glyphs |
| Least-cost optimized zh-TW tasks | tasks | 6 | expected-final-message tasks with generic path optimization |

## Effort Targets

| Metric | Current | Target | Status |
| --- | ---: | ---: | --- |
| Average benchmark time | 47.73 sec | <= 15 sec | gap |
| Median urgent phrase time | 5.40 sec across 19 marked tasks | <= 10 sec | meets |
| Average switch activations | 7.98 | <= 6 | gap |
| Median switch activations | 4.00 | <= 4 | meets |

## Selected Action Counts

| Tile Action | Count |
| --- | ---: |
| append | 310 |
| close-category | 2 |
| commit-candidate | 40 |
| more-suggestions | 56 |
| open-category | 2 |
| undo | 1 |

## Least-Cost zh-TW Path Comparison

This comparison is evaluation-only. It searches dictionary-backed segmentations and visible UI paths for `zh-TW` benchmarks with expected final messages. It does not add app shortcuts.

| Metric | Current Fixture Path | Least-Cost Estimate | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Selections | 198 | 189 | -9 | -4.55% |
| Switch activations | 396 | 378 | -18 | -4.55% |
| Scanner advances | 1555 | 1456 | -99 | -6.37% |
| Estimated scan time sec | 2799 | 2620.80 | -178.20 | -6.37% |

| Task | Current Tokens | Optimized Tokens | Current Activations | Optimized Activations | Difference | Change |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| zhtw-phonetic-home-podcast | 聽 新 資料 夾 | 聽 新 資料 夾 | 34 | 34 | 0 | 0.00% |
| zhtw-multilingual-home-podcast | 聽 podcast 新 資料 夾 | 聽 podcast 新 資料 夾 | 52 | 52 | 0 | 0.00% |
| zhtw-multilingual-audio-repair | podcast 音量 小 | podcast 音 量 小 | 38 | 34 | -4 | -10.53% |
| zhtw-phonetic-home-drink | 冰 紅茶 少 冰 不要 太 甜 等 一下 喝 用 吸管 | 冰 紅茶 少 冰 不 要 太 甜 等一下 喝 用 吸管 | 98 | 94 | -4 | -4.08% |
| zhtw-phonetic-home-audio-repair | 音量 小 從 剛剛 那裡 | 音 量 小 從 剛剛 那裡 | 48 | 44 | -4 | -8.33% |
| zhtw-phonetic-home-feeling | 今天 比較 累 但是 心情 好 想 聽 你 講 這樣 很 舒服 謝謝 | 今 天 比較 累 但 是 心情 好想 聽 你 講 這樣 很 舒服 謝謝 | 126 | 120 | -6 | -4.76% |

## Paired Baseline Regression

Frozen baseline: Accepted code-47 slower-access baseline (2026-08-09T01:21:42.664Z).

Regression gates: FAIL. Measured improvement over baseline: NO.

The gates require aggregate motor effort and scan time, P90 effort and time, and every established communication-function group to remain stable or improve. One task may use at most one additional `更多` selection. This prevents a lower raw paging count from hiding slower or less equitable communication paths.

| Metric | Baseline | Current | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Selections | 408 | 411 | +3 | 0.74% |
| Switch activations | 816 | 822 | +6 | 0.74% |
| Scanner advances | 2596 | 2731 | +135 | 5.20% |
| Estimated scan time sec | 4827.80 | 4915.80 | +88 | 1.82% |
| 更多 selections | 56 | 56 | 0 | 0.00% |
| P90 switch activations | 8 | 8 | 0 | 0.00% |
| P90 scan time sec | 51.90 | 55.80 | +3.90 | 7.51% |

| Gate | Status | Detail |
| --- | --- | --- |
| schema | PASS | baseline=1, candidate=1 |
| task-set | PASS | missing=0, unexpected=0, duplicate baseline=0, duplicate candidate=0, changes allowed=true |
| reachability | PASS | unreachable=0 |
| total-switches | FAIL | baseline=816, candidate=822 |
| total-scan-time | FAIL | baseline=4827800, candidate=4915800 |
| p90-switches | PASS | baseline=8, candidate=8 |
| p90-scan-time | FAIL | baseline=51900, candidate=55800 |
| bounded-task-paging | PASS | max additional pages=0 |
| group-universal-core-switches | PASS | baseline=162, candidate=160 |
| group-universal-core-scan-time | FAIL | baseline=902900, candidate=968400 |
| group-daily-needs-switches | PASS | baseline=24, candidate=24 |
| group-daily-needs-scan-time | PASS | baseline=70600, candidate=70200 |
| group-body-comfort-switches | PASS | baseline=24, candidate=24 |
| group-body-comfort-scan-time | FAIL | baseline=94500, candidate=122400 |
| group-refusal-control-switches | FAIL | baseline=20, candidate=28 |
| group-refusal-control-scan-time | FAIL | baseline=78800, candidate=156600 |
| group-care-health-switches | PASS | baseline=18, candidate=18 |
| group-care-health-scan-time | PASS | baseline=68300, candidate=64800 |
| group-positioning-switches | PASS | baseline=32, candidate=32 |
| group-positioning-scan-time | PASS | baseline=138900, candidate=131400 |
| group-people-social-switches | PASS | baseline=22, candidate=22 |
| group-people-social-scan-time | PASS | baseline=99100, candidate=93600 |
| group-preference-switches | PASS | baseline=22, candidate=22 |
| group-preference-scan-time | PASS | baseline=113500, candidate=106200 |
| group-conversation-repair-switches | PASS | baseline=46, candidate=46 |
| group-conversation-repair-scan-time | PASS | baseline=208000, candidate=198000 |
| group-regression-switches | PASS | baseline=6, candidate=6 |
| group-regression-scan-time | FAIL | baseline=6400, candidate=21600 |

| Communication Function | Baseline Activations | Current Activations | Baseline Time Sec | Current Time Sec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| universal-core | 162 | 160 | 902.90 | 968.40 | FAIL |
| daily-needs | 24 | 24 | 70.60 | 70.20 | PASS |
| body-comfort | 24 | 24 | 94.50 | 122.40 | FAIL |
| refusal-control | 20 | 28 | 78.80 | 156.60 | FAIL |
| care-health | 18 | 18 | 68.30 | 64.80 | PASS |
| positioning | 32 | 32 | 138.90 | 131.40 | PASS |
| people-social | 22 | 22 | 99.10 | 93.60 | PASS |
| preference | 22 | 22 | 113.50 | 106.20 | PASS |
| conversation-repair | 46 | 46 | 208.00 | 198.00 | PASS |
| regression | 6 | 6 | 6.40 | 21.60 | FAIL |

| Changed Task | Classification | Activation Difference | Time Difference Sec | 更多 Difference |
| --- | --- | ---: | ---: | ---: |
| project-core-word-all | regressed | +2 | +21.10 | 0 |
| project-core-word-can | improved | 0 | -2.80 | 0 |
| project-core-word-different | regressed | 0 | +33 | 0 |
| project-core-word-do | regressed | 0 | +12.10 | 0 |
| project-core-word-done | regressed | +2 | +15.70 | 0 |
| project-core-word-get | improved | -2 | -15.90 | 0 |
| project-core-word-go | regressed | 0 | +1.30 | 0 |
| project-core-word-good | improved | 0 | -1 | 0 |
| project-core-word-he | improved | 0 | -2.80 | 0 |
| project-core-word-help | regressed | 0 | +1.30 | 0 |
| project-core-word-here | improved | 0 | -3.30 | 0 |
| project-core-word-i | regressed | 0 | +9 | 0 |
| project-core-word-in | improved | -2 | -14.90 | 0 |
| project-core-word-it | regressed | 0 | +8.50 | 0 |
| project-core-word-like | improved | 0 | -2.80 | 0 |
| project-core-word-look | regressed | 0 | +1.30 | 0 |
| project-core-word-make | regressed | 0 | +0.80 | 0 |
| project-core-word-more | improved | 0 | -1 | 0 |
| project-core-word-not | improved | 0 | -2.80 | 0 |
| project-core-word-on | improved | 0 | -2.80 | 0 |
| project-core-word-open | regressed | +2 | +17 | 0 |
| project-core-word-put | regressed | +2 | +18.80 | 0 |
| project-core-word-same | improved | -2 | -2.30 | 0 |
| project-core-word-she | regressed | 0 | +1.30 | 0 |
| project-core-word-some | improved | -2 | -6.40 | 0 |
| project-core-word-stop | regressed | 0 | +1.30 | 0 |
| project-core-word-that | improved | 0 | -4.60 | 0 |
| project-core-word-turn | regressed | +2 | +15.20 | 0 |
| project-core-word-up | improved | 0 | -1 | 0 |
| project-core-word-want | regressed | 0 | +3.10 | 0 |
| project-core-word-what | regressed | +2 | +15.20 | 0 |
| project-core-word-when | improved | -4 | -29 | 0 |
| project-core-word-where | improved | 0 | -5.10 | 0 |
| project-core-word-who | improved | -2 | -24.90 | 0 |
| project-core-word-why | regressed | 0 | +4.40 | 0 |
| project-core-word-you | regressed | 0 | +8.50 | 0 |
| zhtw-first-page-eat | improved | 0 | -0.50 | 0 |
| zhtw-first-page-toilet | improved | 0 | -0.50 | 0 |
| zhtw-first-page-rest | improved | 0 | -0.50 | 0 |
| zhtw-first-page-stop | improved | 0 | -0.50 | 0 |
| zhtw-first-page-uncomfortable | improved | 0 | -0.50 | 0 |
| zhtw-first-page-hot | improved | 0 | -0.50 | 0 |
| zhtw-first-page-tired | improved | 0 | -0.50 | 0 |
| zhtw-first-page-nausea | improved | 0 | -0.50 | 0 |
| zhtw-first-page-dizzy | improved | 0 | -0.50 | 0 |
| zhtw-first-page-family | improved | 0 | -0.50 | 0 |
| zhtw-first-page-nurse | improved | 0 | -0.50 | 0 |
| zhtw-first-page-not | improved | 0 | -0.50 | 0 |
| zhtw-first-page-help | improved | 0 | -0.50 | 0 |
| zhtw-first-page-pain | improved | 0 | -0.50 | 0 |
| zhtw-second-page-doctor | improved | 0 | -0.50 | 0 |
| zhtw-second-page-medicine | improved | 0 | -1 | 0 |
| zhtw-second-page-position | improved | 0 | -1 | 0 |
| zhtw-second-page-wait | improved | 0 | -1 | 0 |
| zhtw-second-page-can | improved | 0 | -0.50 | 0 |
| zhtw-second-page-up | improved | 0 | -1 | 0 |
| zhtw-second-page-down | improved | 0 | -1 | 0 |
| zhtw-second-page-left | improved | 0 | -1 | 0 |
| zhtw-second-page-right | improved | 0 | -0.50 | 0 |
| zhtw-second-page-sit-up | improved | 0 | -1 | 0 |
| zhtw-second-page-lie-down | improved | 0 | -1 | 0 |
| zhtw-second-page-turn-over | improved | 0 | -1 | 0 |
| zhtw-second-page-pillow | improved | 0 | -0.50 | 0 |
| zhtw-second-page-mom | improved | 0 | -1 | 0 |
| zhtw-second-page-dad | improved | 0 | -1 | 0 |
| zhtw-third-page-caregiver | improved | 0 | -1 | 0 |
| zhtw-third-page-friend | improved | 0 | -1.50 | 0 |
| zhtw-third-page-me | improved | 0 | -1.50 | 0 |
| zhtw-third-page-not-yes | improved | 0 | -1.50 | 0 |
| zhtw-third-page-want | improved | 0 | -1 | 0 |
| zhtw-third-page-cannot | improved | 0 | -1.50 | 0 |
| zhtw-third-page-good | improved | 0 | -1.50 | 0 |
| zhtw-third-page-bad | improved | 0 | -1.50 | 0 |
| zhtw-third-page-know | improved | 0 | -1 | 0 |
| zhtw-third-page-dont-know | improved | 0 | -1.50 | 0 |
| zhtw-third-page-like | improved | 0 | -1.50 | 0 |
| zhtw-third-page-dislike | improved | 0 | -1.50 | 0 |
| zhtw-third-page-again | improved | 0 | -1 | 0 |
| zhtw-third-page-finish | improved | 0 | -1.50 | 0 |
| zhtw-utterance-help-position | improved | 0 | -1.50 | 0 |
| zhtw-utterance-wait-repeat | improved | 0 | -2.50 | 0 |
| zhtw-utterance-dont-know-repeat | improved | 0 | -3 | 0 |
| zhtw-utterance-sit-up-pillow | improved | 0 | -2 | 0 |
| zhtw-utterance-nausea-doctor | improved | 0 | -1.50 | 0 |
| zhtw-utterance-finish | improved | 0 | -1.50 | 0 |
| zhtw-phonetic-home-podcast | improved | 0 | -5.50 | 0 |
| zhtw-multilingual-home-podcast | improved | 0 | -3.10 | 0 |
| zhtw-multilingual-audio-repair | improved | 0 | -1.10 | 0 |
| zhtw-phonetic-home-drink | improved | 0 | -16 | 0 |
| zhtw-phonetic-home-audio-repair | improved | 0 | -9.50 | 0 |
| zhtw-phonetic-home-feeling | improved | 0 | -19 | 0 |
| project-core-go | regressed | 0 | +1.30 | 0 |
| project-core-like | improved | 0 | -2.80 | 0 |
| project-core-refuse-drink | regressed | +8 | +81.80 | 0 |
| asha-wants-needs-help | regressed | 0 | +1.30 | 0 |
| asha-feelings-sick | regressed | 0 | +30.90 | 0 |
| shine-current-want-water | regressed | 0 | +15.20 | 0 |

## Read This Correctly

- Word-list reachability is still tracked: 36 / 36 Project Core words, but this is not a sentence metric.
- Current zh-TW phrase-surface coverage is 48 phrases against an initial target of 80-120.
- Real multi-concept utterance coverage is 16 / 120; that denominator means 10 communication areas x 12 utterance probes each.
- Source-licensed natural sentence audit coverage is 0. The 400-sentence number is an external Chinese phonetic-balanced script reference, not a SHINE release target.
- zh-TW glyph and phrase reachability above comes from source-ranked dictionary entries, not generated sentences.
- A long phrase does not need to be an early candidate if its component words or glyphs are reachable. Direct phrase candidates are measured as efficiency/compression, while exact-or-composable coverage is the core reachability metric.
- Estimated time uses configured scanner timings along the actual selected path; it is not test runtime.
- Switch activations are physical input activations. Output selections are selected tiles. Scanner advances are passive highlights before a selection.
- Least-cost estimates search known dictionary labels and visible UI paths. They are better than scripted demos, but they are still test estimates, not proof of user comfort.

## Sentence Target Rationale

The estimated target is 120 multi-concept utterance tasks, not 120 generated sentences.
A useful target should cover repeated examples across 10 stable communication areas without optimizing for any one example:

| Communication Area | Utterance Target |
| --- | ---: |
| Basic needs | 12 |
| Body comfort and status | 12 |
| Care and medical support | 12 |
| Positioning and environment | 12 |
| Refusal, consent, and control | 12 |
| People and relationship | 12 |
| Preference and choice | 12 |
| Conversation repair and pacing | 12 |
| Social closeness and etiquette | 12 |
| Operational app control | 12 |

The current report now treats that as a gap, not as solved by word or tile reachability.

For source-sentence audits, 400 sentences is only a reference scale from Chinese phonetic-balanced script work. SHINE should count only licensed corpus lines or clinician/caregiver-reviewed materials toward that metric.

## Target Formulas

| Number | Formula | Meaning |
| ---: | --- | --- |
| 80-120 | 10 communication areas x 8-12 phrases | Minimum functional phrase inventory range. |
| 120 | 10 communication areas x 12 utterances | SHINE benchmark target for composable AAC utterance paths. |
| 400 | BASPRO/TMNews external reference: 20 sets x 20 Chinese sentences | Reference scale for future licensed source-sentence audits, not a current product target. |

## Evidence Tiers

- Tier A: source-backed vocabulary or language data, including Project Core words and Chewing-backed zh-TW phonetic access analysis
- Tier B: current zh-TW product-surface functional vocabulary, measured for reachability and scanning cost
- Tier C: app regression and workflow checks

More high-quality data should be added as new Tier A or clinician/caregiver-reviewed Tier B material, not as generated filler sentences.

## Result Stats

- Total estimated scan time across passing tasks: 4915.80 seconds
- Average estimated scan time per passing task: 47.73 seconds
- Total selections across passing tasks: 411
- Average selections per passing task: 3.99
- Total switch activations across passing tasks: 822
- Average switch activations per passing task: 7.98
- Total scan advances across passing tasks: 2731
- Average scan advances per passing task: 26.51
- Total target concepts across passing tasks: 152
- Total output characters across passing tasks: 393
- Activations per target concept: 5.41
- Activations per output character: 2.09
- Direct zh-TW phrase commits during benchmark composition: 17
- Decomposed zh-TW phrase fallbacks during benchmark composition: 0

## Task Type Counts

| Task Type | Tasks |
| --- | ---: |
| multi-concept / operational utterance | 16 |
| single-concept workflow | 3 |
| word reachability | 36 |
| zh-TW functional surface | 48 |

## Profile Counts

| Profile | Tasks |
| --- | ---: |
| en-US | 43 |
| zh-TW | 60 |

## Purpose Counts

| Purpose | Tasks |
| --- | ---: |
| app-regression | 1 |
| body-care | 1 |
| body-comfort | 8 |
| care-health | 1 |
| care-help | 1 |
| care-people | 3 |
| care-positioning | 1 |
| comfort-object | 1 |
| conversation | 2 |
| conversation-repair | 1 |
| feeling-social-expression | 1 |
| feelings | 1 |
| home-audio-repair | 1 |
| home-drink-request | 1 |
| home-media-request | 1 |
| identity | 1 |
| multilingual-home-audio-repair | 1 |
| multilingual-home-media-request | 1 |
| need | 6 |
| operational-repair | 1 |
| people | 4 |
| permission | 1 |
| permission-refusal | 1 |
| positioning | 8 |
| positioning-comfort | 1 |
| preference | 4 |
| preference-refusal | 1 |
| quick-response | 2 |
| refusal | 1 |
| refusal-control | 2 |
| repair-close | 2 |
| repair-repeat | 1 |
| repair-wait | 2 |
| request-or-transition | 1 |
| universal-core-word | 36 |
| wants-needs | 1 |

## Source Counts

| Source | Tasks |
| --- | ---: |
| ASHA AAC Practice Portal | 2 |
| Light & McNaughton communicative competence model | 1 |
| Project Core Universal Core Vocabulary | 39 |
| SHINE AAC current-app regression | 1 |
| SHINE zh-TW built-in functional vocabulary | 48 |
| SHINE zh-TW phonetic core regression | 6 |
| SHINE zh-TW telegraphic AAC utterances | 6 |

| Task | Source | Best Output | Time Sec | Selections | Activations | Scan Advances | Actions | Limits | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| project-core-word-all | Project Core Universal Core Vocabulary | all | 36.00 | 3 | 6 | 20 | append:3 | selections<=4 | PASS |
| project-core-word-can | Project Core Universal Core Vocabulary | can | 18.00 | 2 | 4 | 10 | append:2 | selections<=4 | PASS |
| project-core-word-different | Project Core Universal Core Vocabulary | different | 133.20 | 9 | 18 | 74 | append:9 | selections<=10 | PASS |
| project-core-word-do | Project Core Universal Core Vocabulary | do | 32.40 | 2 | 4 | 18 | append:2 | selections<=3 | PASS |
| project-core-word-done | Project Core Universal Core Vocabulary | done | 34.20 | 3 | 6 | 19 | append:3 | selections<=5 | PASS |
| project-core-word-get | Project Core Universal Core Vocabulary | get | 21.60 | 2 | 4 | 12 | append:2 | selections<=4 | PASS |
| project-core-word-go | Project Core Universal Core Vocabulary | go | 10.80 | 1 | 2 | 6 | append:1 | selections<=3 | PASS |
| project-core-word-good | Project Core Universal Core Vocabulary | good | 25.20 | 2 | 4 | 14 | append:2 | selections<=5 | PASS |
| project-core-word-he | Project Core Universal Core Vocabulary | he | 19.80 | 2 | 4 | 11 | append:2 | selections<=3 | PASS |
| project-core-word-help | Project Core Universal Core Vocabulary | help | 7.20 | 1 | 2 | 4 | append:1 | selections<=5 | PASS |
| project-core-word-here | Project Core Universal Core Vocabulary | here | 32.40 | 3 | 6 | 18 | append:3 | selections<=5 | PASS |
| project-core-word-i | Project Core Universal Core Vocabulary | I | 9.00 | 1 | 2 | 5 | append:1 | selections<=2 | PASS |
| project-core-word-in | Project Core Universal Core Vocabulary | in | 1.80 | 1 | 2 | 1 | append:1 | selections<=3 | PASS |
| project-core-word-it | Project Core Universal Core Vocabulary | it | 23.40 | 2 | 4 | 13 | append:2 | selections<=3 | PASS |
| project-core-word-like | Project Core Universal Core Vocabulary | like | 21.60 | 2 | 4 | 12 | append:2 | selections<=5 | PASS |
| project-core-word-look | Project Core Universal Core Vocabulary | look | 10.80 | 1 | 2 | 6 | append:1 | selections<=5 | PASS |
| project-core-word-make | Project Core Universal Core Vocabulary | make | 27.00 | 2 | 4 | 15 | append:2 | selections<=5 | PASS |
| project-core-word-more | Project Core Universal Core Vocabulary | more | 23.40 | 2 | 4 | 13 | append:2 | selections<=5 | PASS |
| project-core-word-not | Project Core Universal Core Vocabulary | not | 18.00 | 2 | 4 | 10 | append:2 | selections<=4 | PASS |
| project-core-word-on | Project Core Universal Core Vocabulary | on | 16.20 | 2 | 4 | 9 | append:2 | selections<=3 | PASS |
| project-core-word-open | Project Core Universal Core Vocabulary | open | 34.20 | 3 | 6 | 19 | append:3 | selections<=5 | PASS |
| project-core-word-put | Project Core Universal Core Vocabulary | put | 41.40 | 3 | 6 | 23 | append:3 | selections<=4 | PASS |
| project-core-word-same | Project Core Universal Core Vocabulary | same | 25.20 | 2 | 4 | 14 | append:2 | selections<=5 | PASS |
| project-core-word-she | Project Core Universal Core Vocabulary | she | 19.80 | 2 | 4 | 11 | append:2 | selections<=4 | PASS |
| project-core-word-some | Project Core Universal Core Vocabulary | some | 23.40 | 2 | 4 | 13 | append:2 | selections<=5 | PASS |
| project-core-word-stop | Project Core Universal Core Vocabulary | stop | 12.60 | 1 | 2 | 7 | append:1 | selections<=5 | PASS |
| project-core-word-that | Project Core Universal Core Vocabulary | that | 16.20 | 2 | 4 | 9 | append:2 | selections<=5 | PASS |
| project-core-word-turn | Project Core Universal Core Vocabulary | turn | 34.20 | 3 | 6 | 19 | append:3 | selections<=5 | PASS |
| project-core-word-up | Project Core Universal Core Vocabulary | up | 21.60 | 2 | 4 | 12 | append:2 | selections<=3 | PASS |
| project-core-word-want | Project Core Universal Core Vocabulary | want | 7.20 | 1 | 2 | 4 | append:1 | selections<=5 | PASS |
| project-core-word-what | Project Core Universal Core Vocabulary | what | 43.20 | 3 | 6 | 24 | append:3 | selections<=5 | PASS |
| project-core-word-when | Project Core Universal Core Vocabulary | when | 28.80 | 2 | 4 | 16 | append:2 | selections<=5 | PASS |
| project-core-word-where | Project Core Universal Core Vocabulary | where | 39.60 | 3 | 6 | 22 | append:3 | selections<=6 | PASS |
| project-core-word-who | Project Core Universal Core Vocabulary | who | 27.00 | 2 | 4 | 15 | append:2 | selections<=4 | PASS |
| project-core-word-why | Project Core Universal Core Vocabulary | why | 61.20 | 3 | 6 | 34 | append:3 | selections<=4 | PASS |
| project-core-word-you | Project Core Universal Core Vocabulary | you | 10.80 | 1 | 2 | 6 | append:1 | selections<=4 | PASS |
| zhtw-first-page-drink-water | SHINE zh-TW built-in functional vocabulary | 喝水 | 0.00 | 1 | 2 | 0 | append:1 | selections<=1 | PASS |
| zhtw-first-page-eat | SHINE zh-TW built-in functional vocabulary | 吃飯 | 1.80 | 1 | 2 | 1 | append:1 | selections<=1 | PASS |
| zhtw-first-page-toilet | SHINE zh-TW built-in functional vocabulary | 廁所 | 3.60 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-rest | SHINE zh-TW built-in functional vocabulary | 休息 | 5.40 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-sleep | SHINE zh-TW built-in functional vocabulary | 睡覺 | 1.80 | 1 | 2 | 1 | append:1 | selections<=1 | PASS |
| zhtw-first-page-stop | SHINE zh-TW built-in functional vocabulary | 停 | 3.60 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-uncomfortable | SHINE zh-TW built-in functional vocabulary | 不舒服 | 5.40 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-hot | SHINE zh-TW built-in functional vocabulary | 熱 | 7.20 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-cold | SHINE zh-TW built-in functional vocabulary | 冷 | 3.60 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-tired | SHINE zh-TW built-in functional vocabulary | 累 | 5.40 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-nausea | SHINE zh-TW built-in functional vocabulary | 想吐 | 7.20 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-dizzy | SHINE zh-TW built-in functional vocabulary | 頭暈 | 9.00 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-afraid | SHINE zh-TW built-in functional vocabulary | 怕 | 5.40 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-family | SHINE zh-TW built-in functional vocabulary | 家人 | 7.20 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-nurse | SHINE zh-TW built-in functional vocabulary | 護理師 | 9.00 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-yes | SHINE zh-TW built-in functional vocabulary | 是 | 7.20 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-not | SHINE zh-TW built-in functional vocabulary | 不 | 9.00 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-help | SHINE zh-TW built-in functional vocabulary | 幫忙 | 10.80 | 1 | 2 | 6 | append:1 | selections<=1 | PASS |
| zhtw-first-page-pain | SHINE zh-TW built-in functional vocabulary | 痛 | 12.60 | 1 | 2 | 7 | append:1 | selections<=1 | PASS |
| zhtw-second-page-doctor | SHINE zh-TW built-in functional vocabulary | 更多 醫生 | 10.80 | 2 | 4 | 6 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-medicine | SHINE zh-TW built-in functional vocabulary | 更多 藥 | 12.60 | 2 | 4 | 7 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-position | SHINE zh-TW built-in functional vocabulary | 更多 姿勢 | 14.40 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-wait | SHINE zh-TW built-in functional vocabulary | 更多 等一下 | 16.20 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-can | SHINE zh-TW built-in functional vocabulary | 更多 可以 | 12.60 | 2 | 4 | 7 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-up | SHINE zh-TW built-in functional vocabulary | 更多 上 | 14.40 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-down | SHINE zh-TW built-in functional vocabulary | 更多 下 | 16.20 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-left | SHINE zh-TW built-in functional vocabulary | 更多 左 | 18.00 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-right | SHINE zh-TW built-in functional vocabulary | 更多 右 | 14.40 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-sit-up | SHINE zh-TW built-in functional vocabulary | 更多 坐起來 | 16.20 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-lie-down | SHINE zh-TW built-in functional vocabulary | 更多 躺下 | 18.00 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-turn-over | SHINE zh-TW built-in functional vocabulary | 更多 翻身 | 19.80 | 2 | 4 | 11 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-pillow | SHINE zh-TW built-in functional vocabulary | 更多 枕頭 | 16.20 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-mom | SHINE zh-TW built-in functional vocabulary | 更多 媽媽 | 18.00 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-dad | SHINE zh-TW built-in functional vocabulary | 更多 爸爸 | 19.80 | 2 | 4 | 11 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-third-page-caregiver | SHINE zh-TW built-in functional vocabulary | 更多 更多 照顧者 | 21.60 | 3 | 6 | 12 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-friend | SHINE zh-TW built-in functional vocabulary | 更多 更多 朋友 | 23.40 | 3 | 6 | 13 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-me | SHINE zh-TW built-in functional vocabulary | 更多 更多 我 | 25.20 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-not-yes | SHINE zh-TW built-in functional vocabulary | 更多 更多 不是 | 27.00 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-want | SHINE zh-TW built-in functional vocabulary | 更多 更多 要 | 23.40 | 3 | 6 | 13 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-cannot | SHINE zh-TW built-in functional vocabulary | 更多 更多 不可以 | 25.20 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-good | SHINE zh-TW built-in functional vocabulary | 更多 更多 好 | 27.00 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-bad | SHINE zh-TW built-in functional vocabulary | 更多 更多 不好 | 28.80 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-know | SHINE zh-TW built-in functional vocabulary | 更多 更多 知道 | 25.20 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-dont-know | SHINE zh-TW built-in functional vocabulary | 更多 更多 不知道 | 27.00 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-like | SHINE zh-TW built-in functional vocabulary | 更多 更多 喜歡 | 28.80 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-dislike | SHINE zh-TW built-in functional vocabulary | 更多 更多 不喜歡 | 30.60 | 3 | 6 | 17 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-again | SHINE zh-TW built-in functional vocabulary | 更多 更多 再一次 | 27.00 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-finish | SHINE zh-TW built-in functional vocabulary | 更多 更多 結束 | 28.80 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-utterance-help-position | SHINE zh-TW telegraphic AAC utterances | 幫忙 更多 姿勢 | 27.00 | 3 | 6 | 15 | append:2, more-suggestions:1 | selections<=3 | PASS |
| zhtw-utterance-wait-repeat | SHINE zh-TW telegraphic AAC utterances | 更多 等一下 更多 更多 再一次 | 45.00 | 5 | 10 | 25 | append:2, more-suggestions:3 | selections<=5 | PASS |
| zhtw-utterance-dont-know-repeat | SHINE zh-TW telegraphic AAC utterances | 更多 更多 不知道 更多 更多 再一次 | 55.80 | 6 | 12 | 31 | append:2, more-suggestions:4 | selections<=6 | PASS |
| zhtw-utterance-sit-up-pillow | SHINE zh-TW telegraphic AAC utterances | 更多 坐起來 更多 枕頭 | 34.20 | 4 | 8 | 19 | append:2, more-suggestions:2 | selections<=4 | PASS |
| zhtw-utterance-nausea-doctor | SHINE zh-TW telegraphic AAC utterances | 想吐 更多 醫生 | 19.80 | 3 | 6 | 11 | append:2, more-suggestions:1 | selections<=3 | PASS |
| zhtw-utterance-finish | SHINE zh-TW telegraphic AAC utterances | 更多 更多 結束 | 28.80 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-phonetic-home-podcast | SHINE zh-TW phonetic core regression | 聽 新 資料 夾 | 250.20 | 17 | 34 | 139 | append:13, commit-candidate:4 | selections<=18 | PASS |
| zhtw-multilingual-home-podcast | SHINE zh-TW phonetic core regression | 聽 podcast 新 資料 夾 | 345.60 | 26 | 52 | 192 | append:20, close-category:1, commit-candidate:4, open-category:1 | selections<=30 | PASS |
| zhtw-multilingual-audio-repair | SHINE zh-TW phonetic core regression | podcast 音量 小 | 243.00 | 19 | 38 | 135 | append:15, close-category:1, commit-candidate:2, open-category:1 | selections<=23 | PASS |
| zhtw-phonetic-home-drink | SHINE zh-TW phonetic core regression | 冰 紅茶 少 冰 不要 太 甜 等 一下 喝 用 吸管 | 714.60 | 49 | 98 | 397 | append:37, commit-candidate:12 | selections<=54 | PASS |
| zhtw-phonetic-home-audio-repair | SHINE zh-TW phonetic core regression | 音量 小 從 剛剛 那裡 | 351.00 | 24 | 48 | 195 | append:19, commit-candidate:5 | selections<=28 | PASS |
| zhtw-phonetic-home-feeling | SHINE zh-TW phonetic core regression | 今天 比較 累 但是 心情 好 想 聽 你 講 這樣 很 舒服 謝謝 | 894.60 | 63 | 126 | 497 | append:50, commit-candidate:13 | selections<=70 | PASS |
| project-core-go | Project Core Universal Core Vocabulary | go | 10.80 | 1 | 2 | 6 | append:1 | selections<=1 | PASS |
| project-core-like | Project Core Universal Core Vocabulary | like | 21.60 | 2 | 4 | 12 | append:2 | selections<=2 | PASS |
| project-core-refuse-drink | Project Core Universal Core Vocabulary | no drink | 88.20 | 6 | 12 | 49 | append:6 | selections<=6 | PASS |
| asha-wants-needs-help | ASHA AAC Practice Portal | help | 7.20 | 1 | 2 | 4 | append:1 | selections<=3 | PASS |
| asha-feelings-sick | ASHA AAC Practice Portal | sick | 66.60 | 4 | 8 | 37 | append:4 | selections<=4 | PASS |
| light-operational-repair | Light & McNaughton communicative competence model | UNDO | 0.00 | 1 | 2 | 0 | undo:1 | selections<=1 | PASS |
| shine-current-want-water | SHINE AAC current-app regression | I want water | 21.60 | 3 | 6 | 12 | append:3 | selections<=3 | PASS |

## Sources

- Project Core Universal Core Vocabulary: https://project-core.com/communication-systems/
  - Uses a 36-word Universal Core vocabulary for flexible communication across topics and partners.
  - Introduces GO, LIKE, and NOT through repeated real-world teaching opportunities.
- ASHA AAC Practice Portal: https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/
  - Describes AAC as supporting expression of thoughts, wants and needs, feelings, and ideas.
  - Describes direct selection and scanning as access methods that must fit individual abilities.
- Light & McNaughton communicative competence model: https://arxiv.org/abs/1411.6568
  - Frames AAC communication around functional competence across linguistic, operational, social, and strategic demands.
- SHINE AAC current-app regression: docs/TESTING_REPORT.md
  - Existing app sequences are regression checks only; they must not drive case-specific ranking rules.
- SHINE zh-TW built-in functional vocabulary: docs/ZHTW_PHONETIC_ACCESS_DESIGN.md
  - Measures the current Traditional Chinese board surface for urgent daily needs, comfort, care, positioning, people, preference, and repair.
  - These are product-surface coverage tasks, not academic sentence examples.
- SHINE zh-TW telegraphic AAC utterances: docs/QUALITY_TARGET_METRICS.md
  - Uses existing zh-TW functional phrases as short AAC utterances across ASHA and Light/McNaughton communication functions.
  - These are benchmark probes for current UI reachability, not generated natural-language corpus sentences.
- SHINE zh-TW phonetic core regression: docs/QUALITY_TARGET_METRICS.md
  - Uses source-backed zh-TW dictionary entries and virtual row/column selection to measure whether daily words can be composed without browser timing.
  - Counts tile activations for reachability and efficiency; real-time scanning is covered separately by browser smoke tests.
