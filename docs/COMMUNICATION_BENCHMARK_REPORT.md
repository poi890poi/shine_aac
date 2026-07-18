# Communication Benchmark Report

Generated: 2026-07-18T11:49:17.866Z

These benchmarks are evaluation-only. They must not be used as special-case app logic.

## Real-World Metrics

| Metric | Unit | Current | Denominator / Target | Meaning |
| --- | --- | ---: | ---: | --- |
| Direct zh-TW phonetic symbols | weighted coverage | 98.87% | >= 98% | Static symbols available without copying a full keyboard |
| Dynamic zh-TW continuation symbols | Zhuyin symbols | 13 | 13 | Hidden symbols that can appear as valid continuations |
| Dead-end continuation symbols | Zhuyin symbols | 0 | 0 | Visible continuations that lead to no glyph/phrase candidate |
| Top zh-TW glyph reachability | unique Han glyphs | 222 / 224 (99.11%) | >= 99% | Single-character entries reachable in the top 500 source-ranked dictionary slice |
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
| Estimated scan time | seconds | 2829.50 | 27.47 | 13.80 | 37.60 |
| Output selections | selected tiles | 423 | 4.11 | 2.00 | 4.00 |
| Switch activations | activations | 846 | 8.21 | 4.00 | 8.00 |
| Scanner advances | row/cell advances | 2071 | 20.11 | 10.00 | 28.00 |
| Activations per target concept | activations/concept | 846 / 152 | 5.57 |
| Selections per target concept | selections/concept | 423 / 152 | 2.78 |
| Activations per output character | activations/character | 846 / 399 | 2.12 |
| Estimated time per output character | seconds/character | 2829.50 / 399 | 7.09 |
| Direct zh-TW phrase commits | phrase commits | 17 | compression wins during benchmark composition |
| Decomposed zh-TW phrase fallbacks | phrase fallbacks | 0 | phrases completed by composing component glyphs |
| Least-cost optimized zh-TW tasks | tasks | 6 | expected-final-message tasks with generic path optimization |

## Effort Targets

| Metric | Current | Target | Status |
| --- | ---: | ---: | --- |
| Average benchmark time | 27.47 sec | <= 15 sec | gap |
| Median urgent phrase time | 4.30 sec across 19 marked tasks | <= 10 sec | meets |
| Average switch activations | 8.21 | <= 6 | gap |
| Median switch activations | 4.00 | <= 4 | meets |

## Selected Action Counts

| Tile Action | Count |
| --- | ---: |
| append | 307 |
| close-category | 2 |
| commit-candidate | 40 |
| more-suggestions | 68 |
| open-category | 2 |
| space | 3 |
| undo | 1 |

## Least-Cost zh-TW Path Comparison

This comparison is evaluation-only. It searches dictionary-backed segmentations and visible UI paths for `zh-TW` benchmarks with expected final messages. It does not add app shortcuts.

| Metric | Current Fixture Path | Least-Cost Estimate | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Selections | 213 | 204 | -9 | -4.23% |
| Switch activations | 426 | 408 | -18 | -4.23% |
| Scanner advances | 1024 | 969 | -55 | -5.37% |
| Estimated scan time sec | 1396.40 | 1322.90 | -73.50 | -5.26% |

| Task | Current Tokens | Optimized Tokens | Current Activations | Optimized Activations | Difference | Change |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| zhtw-phonetic-home-podcast | 聽 新 資料 夾 | 聽 新 資料 夾 | 36 | 36 | 0 | 0.00% |
| zhtw-multilingual-home-podcast | 聽  podcast  新 資料 夾 | 聽  podcast  新 資料 夾 | 58 | 58 | 0 | 0.00% |
| zhtw-multilingual-audio-repair | podcast  音量 小 | podcast  音 量 小 | 42 | 38 | -4 | -9.52% |
| zhtw-phonetic-home-drink | 冰 紅茶 少 冰 不要 太 甜 等 一下 喝 用 吸管 | 冰 紅茶 少 冰 不 要 太 甜 等一下 喝 用 吸管 | 104 | 100 | -4 | -3.85% |
| zhtw-phonetic-home-audio-repair | 音量 小 從 剛剛 那裡 | 音 量 小 從 剛剛 那裡 | 52 | 48 | -4 | -7.69% |
| zhtw-phonetic-home-feeling | 今天 比較 累 但是 心情 好 想 聽 你 講 這樣 很 舒服 謝謝 | 今 天 比較 累 但 是 心情 好想 聽 你 講 這樣 很 舒服 謝謝 | 134 | 128 | -6 | -4.48% |

## Paired Baseline Regression

Frozen baseline: Pre-adaptive suggestion ranking baseline (2026-07-18T11:03:18.178Z).

Regression gates: PASS. Measured improvement over baseline: YES.

The gates require aggregate motor effort and scan time, P90 effort and time, and every established communication-function group to remain stable or improve. One task may use at most one additional `更多` selection. This prevents a lower raw paging count from hiding slower or less equitable communication paths.

| Metric | Baseline | Current | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Selections | 423 | 423 | 0 | 0.00% |
| Switch activations | 846 | 846 | 0 | 0.00% |
| Scanner advances | 2095 | 2071 | -24 | -1.15% |
| Estimated scan time sec | 2866.30 | 2829.50 | -36.80 | -1.28% |
| 更多 selections | 68 | 68 | 0 | 0.00% |
| P90 switch activations | 8 | 8 | 0 | 0.00% |
| P90 scan time sec | 37.60 | 37.60 | 0 | 0.00% |

| Gate | Status | Detail |
| --- | --- | --- |
| schema | PASS | baseline=1, candidate=1 |
| task-set | PASS | missing=0, unexpected=0, duplicate baseline=0, duplicate candidate=0, changes allowed=false |
| reachability | PASS | unreachable=0 |
| total-switches | PASS | baseline=846, candidate=846 |
| total-scan-time | PASS | baseline=2866300, candidate=2829500 |
| p90-switches | PASS | baseline=8, candidate=8 |
| p90-scan-time | PASS | baseline=37600, candidate=37600 |
| bounded-task-paging | PASS | max additional pages=0 |
| group-universal-core-switches | PASS | baseline=162, candidate=162 |
| group-universal-core-scan-time | PASS | baseline=654700, candidate=654700 |
| group-daily-needs-switches | PASS | baseline=24, candidate=24 |
| group-daily-needs-scan-time | PASS | baseline=51300, candidate=51300 |
| group-body-comfort-switches | PASS | baseline=24, candidate=24 |
| group-body-comfort-scan-time | PASS | baseline=68600, candidate=68600 |
| group-refusal-control-switches | PASS | baseline=20, candidate=20 |
| group-refusal-control-scan-time | PASS | baseline=57300, candidate=57300 |
| group-care-health-switches | PASS | baseline=18, candidate=18 |
| group-care-health-scan-time | PASS | baseline=49600, candidate=49600 |
| group-positioning-switches | PASS | baseline=32, candidate=32 |
| group-positioning-scan-time | PASS | baseline=100900, candidate=100900 |
| group-people-social-switches | PASS | baseline=22, candidate=22 |
| group-people-social-scan-time | PASS | baseline=72000, candidate=72000 |
| group-preference-switches | PASS | baseline=22, candidate=22 |
| group-preference-scan-time | PASS | baseline=82400, candidate=82400 |
| group-conversation-repair-switches | PASS | baseline=46, candidate=46 |
| group-conversation-repair-scan-time | PASS | baseline=151000, candidate=151000 |
| group-regression-switches | PASS | baseline=6, candidate=6 |
| group-regression-scan-time | PASS | baseline=4700, candidate=4700 |

| Communication Function | Baseline Activations | Current Activations | Baseline Time Sec | Current Time Sec | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| universal-core | 162 | 162 | 654.70 | 654.70 | PASS |
| daily-needs | 24 | 24 | 51.30 | 51.30 | PASS |
| body-comfort | 24 | 24 | 68.60 | 68.60 | PASS |
| refusal-control | 20 | 20 | 57.30 | 57.30 | PASS |
| care-health | 18 | 18 | 49.60 | 49.60 | PASS |
| positioning | 32 | 32 | 100.90 | 100.90 | PASS |
| people-social | 22 | 22 | 72.00 | 72.00 | PASS |
| preference | 22 | 22 | 82.40 | 82.40 | PASS |
| conversation-repair | 46 | 46 | 151.00 | 151.00 | PASS |
| regression | 6 | 6 | 4.70 | 4.70 | PASS |

| Changed Task | Classification | Activation Difference | Time Difference Sec | 更多 Difference |
| --- | --- | ---: | ---: | ---: |
| zhtw-phonetic-home-podcast | improved | 0 | -3 | 0 |
| zhtw-multilingual-home-podcast | improved | 0 | -3 | 0 |
| zhtw-multilingual-audio-repair | improved | 0 | -1.70 | 0 |
| zhtw-phonetic-home-drink | improved | 0 | -7.70 | 0 |
| zhtw-phonetic-home-audio-repair | improved | 0 | -1.70 | 0 |
| zhtw-phonetic-home-feeling | improved | 0 | -19.70 | 0 |

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

- Total estimated scan time across passing tasks: 2829.50 seconds
- Average estimated scan time per passing task: 27.47 seconds
- Total selections across passing tasks: 423
- Average selections per passing task: 4.11
- Total switch activations across passing tasks: 846
- Average switch activations per passing task: 8.21
- Total scan advances across passing tasks: 2071
- Average scan advances per passing task: 20.11
- Total target concepts across passing tasks: 152
- Total output characters across passing tasks: 399
- Activations per target concept: 5.57
- Activations per output character: 2.12
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
| project-core-word-all | Project Core Universal Core Vocabulary | all | 10.80 | 2 | 4 | 8 | append:2 | selections<=4 | PASS |
| project-core-word-can | Project Core Universal Core Vocabulary | can | 15.10 | 2 | 4 | 11 | append:2 | selections<=4 | PASS |
| project-core-word-different | Project Core Universal Core Vocabulary | different | 72.60 | 9 | 18 | 54 | append:9 | selections<=10 | PASS |
| project-core-word-do | Project Core Universal Core Vocabulary | do | 14.70 | 2 | 4 | 11 | append:2 | selections<=3 | PASS |
| project-core-word-done | Project Core Universal Core Vocabulary | done | 13.40 | 2 | 4 | 10 | append:2 | selections<=5 | PASS |
| project-core-word-get | Project Core Universal Core Vocabulary | get | 27.20 | 3 | 6 | 20 | append:3 | selections<=4 | PASS |
| project-core-word-go | Project Core Universal Core Vocabulary | go | 6.90 | 1 | 2 | 5 | append:1 | selections<=3 | PASS |
| project-core-word-good | Project Core Universal Core Vocabulary | good | 19.00 | 2 | 4 | 14 | append:2 | selections<=5 | PASS |
| project-core-word-he | Project Core Universal Core Vocabulary | he | 16.40 | 2 | 4 | 12 | append:2 | selections<=3 | PASS |
| project-core-word-help | Project Core Universal Core Vocabulary | help | 4.30 | 1 | 2 | 3 | append:1 | selections<=5 | PASS |
| project-core-word-here | Project Core Universal Core Vocabulary | here | 25.90 | 3 | 6 | 19 | append:3 | selections<=5 | PASS |
| project-core-word-i | Project Core Universal Core Vocabulary | I | 0.00 | 1 | 2 | 0 | append:1 | selections<=2 | PASS |
| project-core-word-in | Project Core Universal Core Vocabulary | in | 12.10 | 2 | 4 | 9 | append:2 | selections<=3 | PASS |
| project-core-word-it | Project Core Universal Core Vocabulary | it | 10.80 | 2 | 4 | 8 | append:2 | selections<=3 | PASS |
| project-core-word-like | Project Core Universal Core Vocabulary | like | 17.70 | 2 | 4 | 13 | append:2 | selections<=5 | PASS |
| project-core-word-look | Project Core Universal Core Vocabulary | look | 6.90 | 1 | 2 | 5 | append:1 | selections<=5 | PASS |
| project-core-word-make | Project Core Universal Core Vocabulary | make | 19.00 | 2 | 4 | 14 | append:2 | selections<=5 | PASS |
| project-core-word-more | Project Core Universal Core Vocabulary | more | 17.70 | 2 | 4 | 13 | append:2 | selections<=5 | PASS |
| project-core-word-not | Project Core Universal Core Vocabulary | not | 15.10 | 2 | 4 | 11 | append:2 | selections<=4 | PASS |
| project-core-word-on | Project Core Universal Core Vocabulary | on | 13.80 | 2 | 4 | 10 | append:2 | selections<=3 | PASS |
| project-core-word-open | Project Core Universal Core Vocabulary | open | 12.50 | 2 | 4 | 9 | append:2 | selections<=5 | PASS |
| project-core-word-put | Project Core Universal Core Vocabulary | put | 16.40 | 2 | 4 | 12 | append:2 | selections<=4 | PASS |
| project-core-word-same | Project Core Universal Core Vocabulary | same | 19.90 | 3 | 6 | 15 | append:3 | selections<=5 | PASS |
| project-core-word-she | Project Core Universal Core Vocabulary | she | 13.40 | 2 | 4 | 10 | append:2 | selections<=4 | PASS |
| project-core-word-some | Project Core Universal Core Vocabulary | some | 21.60 | 3 | 6 | 16 | append:3 | selections<=5 | PASS |
| project-core-word-stop | Project Core Universal Core Vocabulary | stop | 8.20 | 1 | 2 | 6 | append:1 | selections<=5 | PASS |
| project-core-word-that | Project Core Universal Core Vocabulary | that | 15.10 | 2 | 4 | 11 | append:2 | selections<=5 | PASS |
| project-core-word-turn | Project Core Universal Core Vocabulary | turn | 13.80 | 2 | 4 | 10 | append:2 | selections<=5 | PASS |
| project-core-word-up | Project Core Universal Core Vocabulary | up | 16.40 | 2 | 4 | 12 | append:2 | selections<=3 | PASS |
| project-core-word-want | Project Core Universal Core Vocabulary | want | 3.00 | 1 | 2 | 2 | append:1 | selections<=5 | PASS |
| project-core-word-what | Project Core Universal Core Vocabulary | what | 20.30 | 2 | 4 | 15 | append:2 | selections<=5 | PASS |
| project-core-word-when | Project Core Universal Core Vocabulary | when | 41.90 | 4 | 8 | 31 | append:4 | selections<=5 | PASS |
| project-core-word-where | Project Core Universal Core Vocabulary | where | 32.40 | 3 | 6 | 24 | append:3 | selections<=6 | PASS |
| project-core-word-who | Project Core Universal Core Vocabulary | who | 37.60 | 3 | 6 | 28 | append:3 | selections<=4 | PASS |
| project-core-word-why | Project Core Universal Core Vocabulary | why | 41.10 | 3 | 6 | 31 | append:3 | selections<=4 | PASS |
| project-core-word-you | Project Core Universal Core Vocabulary | you | 1.70 | 1 | 2 | 1 | append:1 | selections<=4 | PASS |
| zhtw-first-page-drink-water | SHINE zh-TW built-in functional vocabulary | 喝水 | 0.00 | 1 | 2 | 0 | append:1 | selections<=1 | PASS |
| zhtw-first-page-eat | SHINE zh-TW built-in functional vocabulary | 吃飯 | 1.70 | 1 | 2 | 1 | append:1 | selections<=1 | PASS |
| zhtw-first-page-toilet | SHINE zh-TW built-in functional vocabulary | 廁所 | 3.00 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-rest | SHINE zh-TW built-in functional vocabulary | 休息 | 4.30 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-sleep | SHINE zh-TW built-in functional vocabulary | 睡覺 | 1.30 | 1 | 2 | 1 | append:1 | selections<=1 | PASS |
| zhtw-first-page-stop | SHINE zh-TW built-in functional vocabulary | 停 | 3.00 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-uncomfortable | SHINE zh-TW built-in functional vocabulary | 不舒服 | 4.30 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-hot | SHINE zh-TW built-in functional vocabulary | 熱 | 5.60 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-cold | SHINE zh-TW built-in functional vocabulary | 冷 | 2.60 | 1 | 2 | 2 | append:1 | selections<=1 | PASS |
| zhtw-first-page-tired | SHINE zh-TW built-in functional vocabulary | 累 | 4.30 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-nausea | SHINE zh-TW built-in functional vocabulary | 想吐 | 5.60 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-dizzy | SHINE zh-TW built-in functional vocabulary | 頭暈 | 6.90 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-afraid | SHINE zh-TW built-in functional vocabulary | 怕 | 3.90 | 1 | 2 | 3 | append:1 | selections<=1 | PASS |
| zhtw-first-page-family | SHINE zh-TW built-in functional vocabulary | 家人 | 5.60 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-nurse | SHINE zh-TW built-in functional vocabulary | 護理師 | 6.90 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-yes | SHINE zh-TW built-in functional vocabulary | 是 | 5.20 | 1 | 2 | 4 | append:1 | selections<=1 | PASS |
| zhtw-first-page-not | SHINE zh-TW built-in functional vocabulary | 不 | 6.90 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| zhtw-first-page-help | SHINE zh-TW built-in functional vocabulary | 幫忙 | 8.20 | 1 | 2 | 6 | append:1 | selections<=1 | PASS |
| zhtw-first-page-pain | SHINE zh-TW built-in functional vocabulary | 痛 | 9.50 | 1 | 2 | 7 | append:1 | selections<=1 | PASS |
| zhtw-second-page-doctor | SHINE zh-TW built-in functional vocabulary | 更多 醫生 | 8.20 | 2 | 4 | 6 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-medicine | SHINE zh-TW built-in functional vocabulary | 更多 藥 | 9.90 | 2 | 4 | 7 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-position | SHINE zh-TW built-in functional vocabulary | 更多 姿勢 | 11.20 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-wait | SHINE zh-TW built-in functional vocabulary | 更多 等一下 | 12.50 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-can | SHINE zh-TW built-in functional vocabulary | 更多 可以 | 9.50 | 2 | 4 | 7 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-up | SHINE zh-TW built-in functional vocabulary | 更多 上 | 11.20 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-down | SHINE zh-TW built-in functional vocabulary | 更多 下 | 12.50 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-left | SHINE zh-TW built-in functional vocabulary | 更多 左 | 13.80 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-right | SHINE zh-TW built-in functional vocabulary | 更多 右 | 10.80 | 2 | 4 | 8 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-sit-up | SHINE zh-TW built-in functional vocabulary | 更多 坐起來 | 12.50 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-lie-down | SHINE zh-TW built-in functional vocabulary | 更多 躺下 | 13.80 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-turn-over | SHINE zh-TW built-in functional vocabulary | 更多 翻身 | 15.10 | 2 | 4 | 11 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-pillow | SHINE zh-TW built-in functional vocabulary | 更多 枕頭 | 12.10 | 2 | 4 | 9 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-mom | SHINE zh-TW built-in functional vocabulary | 更多 媽媽 | 13.80 | 2 | 4 | 10 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-second-page-dad | SHINE zh-TW built-in functional vocabulary | 更多 爸爸 | 15.10 | 2 | 4 | 11 | append:1, more-suggestions:1 | selections<=2 | PASS |
| zhtw-third-page-caregiver | SHINE zh-TW built-in functional vocabulary | 更多 更多 照顧者 | 16.40 | 3 | 6 | 12 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-friend | SHINE zh-TW built-in functional vocabulary | 更多 更多 朋友 | 18.10 | 3 | 6 | 13 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-me | SHINE zh-TW built-in functional vocabulary | 更多 更多 我 | 19.40 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-not-yes | SHINE zh-TW built-in functional vocabulary | 更多 更多 不是 | 20.70 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-want | SHINE zh-TW built-in functional vocabulary | 更多 更多 要 | 17.70 | 3 | 6 | 13 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-cannot | SHINE zh-TW built-in functional vocabulary | 更多 更多 不可以 | 19.40 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-good | SHINE zh-TW built-in functional vocabulary | 更多 更多 好 | 20.70 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-bad | SHINE zh-TW built-in functional vocabulary | 更多 更多 不好 | 22.00 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-know | SHINE zh-TW built-in functional vocabulary | 更多 更多 知道 | 19.00 | 3 | 6 | 14 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-dont-know | SHINE zh-TW built-in functional vocabulary | 更多 更多 不知道 | 20.70 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-like | SHINE zh-TW built-in functional vocabulary | 更多 更多 喜歡 | 22.00 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-dislike | SHINE zh-TW built-in functional vocabulary | 更多 更多 不喜歡 | 23.30 | 3 | 6 | 17 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-again | SHINE zh-TW built-in functional vocabulary | 更多 更多 再一次 | 20.30 | 3 | 6 | 15 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-third-page-finish | SHINE zh-TW built-in functional vocabulary | 更多 更多 結束 | 22.00 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-utterance-help-position | SHINE zh-TW telegraphic AAC utterances | 幫忙 更多 姿勢 | 20.70 | 3 | 6 | 15 | append:2, more-suggestions:1 | selections<=3 | PASS |
| zhtw-utterance-wait-repeat | SHINE zh-TW telegraphic AAC utterances | 更多 等一下 更多 更多 再一次 | 34.50 | 5 | 10 | 25 | append:2, more-suggestions:3 | selections<=5 | PASS |
| zhtw-utterance-dont-know-repeat | SHINE zh-TW telegraphic AAC utterances | 更多 更多 不知道 更多 更多 再一次 | 42.70 | 6 | 12 | 31 | append:2, more-suggestions:4 | selections<=6 | PASS |
| zhtw-utterance-sit-up-pillow | SHINE zh-TW telegraphic AAC utterances | 更多 坐起來 更多 枕頭 | 26.30 | 4 | 8 | 19 | append:2, more-suggestions:2 | selections<=4 | PASS |
| zhtw-utterance-nausea-doctor | SHINE zh-TW telegraphic AAC utterances | 想吐 更多 醫生 | 15.50 | 3 | 6 | 11 | append:2, more-suggestions:1 | selections<=3 | PASS |
| zhtw-utterance-finish | SHINE zh-TW telegraphic AAC utterances | 更多 更多 結束 | 22.00 | 3 | 6 | 16 | append:1, more-suggestions:2 | selections<=3 | PASS |
| zhtw-phonetic-home-podcast | SHINE zh-TW phonetic core regression | 聽 新 資料 夾 | 121.70 | 18 | 36 | 89 | append:13, commit-candidate:4, more-suggestions:1 | selections<=18 | PASS |
| zhtw-multilingual-home-podcast | SHINE zh-TW phonetic core regression | 聽  podcast  新 資料 夾 | 203.30 | 29 | 58 | 149 | append:20, close-category:1, commit-candidate:4, more-suggestions:1, open-category:1, space:2 | selections<=30 | PASS |
| zhtw-multilingual-audio-repair | SHINE zh-TW phonetic core regression | podcast  音量 小 | 140.70 | 21 | 42 | 103 | append:15, close-category:1, commit-candidate:2, more-suggestions:1, open-category:1, space:1 | selections<=23 | PASS |
| zhtw-phonetic-home-drink | SHINE zh-TW phonetic core regression | 冰 紅茶 少 冰 不要 太 甜 等 一下 喝 用 吸管 | 338.50 | 52 | 104 | 249 | append:37, commit-candidate:12, more-suggestions:3 | selections<=54 | PASS |
| zhtw-phonetic-home-audio-repair | SHINE zh-TW phonetic core regression | 音量 小 從 剛剛 那裡 | 167.90 | 26 | 52 | 123 | append:19, commit-candidate:5, more-suggestions:2 | selections<=28 | PASS |
| zhtw-phonetic-home-feeling | SHINE zh-TW phonetic core regression | 今天 比較 累 但是 心情 好 想 聽 你 講 這樣 很 舒服 謝謝 | 424.30 | 67 | 134 | 311 | append:50, commit-candidate:13, more-suggestions:4 | selections<=70 | PASS |
| project-core-go | Project Core Universal Core Vocabulary | go | 6.90 | 1 | 2 | 5 | append:1 | selections<=1 | PASS |
| project-core-like | Project Core Universal Core Vocabulary | like | 17.70 | 2 | 4 | 13 | append:2 | selections<=2 | PASS |
| project-core-refuse-drink | Project Core Universal Core Vocabulary | no drink | 4.70 | 2 | 4 | 3 | append:2 | selections<=4 | PASS |
| asha-wants-needs-help | ASHA AAC Practice Portal | help | 4.30 | 1 | 2 | 3 | append:1 | selections<=3 | PASS |
| asha-feelings-sick | ASHA AAC Practice Portal | feel sick | 25.90 | 4 | 8 | 19 | append:4 | selections<=4 | PASS |
| light-operational-repair | Light & McNaughton communicative competence model | UNDO | 0.00 | 1 | 2 | 0 | undo:1 | selections<=1 | PASS |
| shine-current-want-water | SHINE AAC current-app regression | I want water | 4.70 | 3 | 6 | 3 | append:3 | selections<=3 | PASS |

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
