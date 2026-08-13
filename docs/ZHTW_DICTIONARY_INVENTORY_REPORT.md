# zh-TW Dictionary Inventory Report

Generated: 2026-08-13T14:22:17.109Z

This is the fast inventory report. It estimates broad source-dictionary reachability and efficiency from the phonetic access graph instead of running real-time scanning or full virtual utterance benchmarks.

## Inventory

| Metric | Value | Meaning |
| --- | ---: | --- |
| Source dictionary entries | 60000 | Generated New Chewing entries after SHINE length/key limits |
| Unique source labels | 33523 | Unique glyph, word, and phrase labels |
| Available Zhuyin symbols | 37 | Full zh-TW phonetic symbol inventory |
| Static first-level Zhuyin symbols | 37 | All symbols visible without paging |
| Dynamic continuation Zhuyin symbols | 0 | Hidden symbols required for phonetic input |
| Source glyph labels | 6054 | Unique single-Han-character labels in the dictionary |
| Source multi-glyph word/phrase labels | 27469 | Unique labels longer than one Han character |
| Unique Han characters appearing anywhere | 6283 | Character inventory across all labels |

## Fast Reachability Estimates

| Metric | Value | Target / Use |
| --- | ---: | --- |
| Entry phonetic-path reachability | 60000 / 60000 (100.00%) | Broad graph reachability before candidate rank/page limits |
| Weighted phonetic-path reachability | 100.00% | Frequency-weighted view of source entries |
| Direct glyph candidate reachability | 5460 / 6054 (90.19%) | Single glyph can be committed directly within 3 pages |
| Direct word/phrase candidate reachability | 27412 / 27469 (99.79%) | Multi-glyph label can be committed directly within 3 pages |
| Word/phrase composability from glyphs | 26781 / 27469 (97.50%) | Multi-glyph label can be built from direct glyph candidates |
| Word/phrase direct-or-composable reachability | 27463 / 27469 (99.98%) | Core coverage view for multi-glyph expressions |
| All-label direct-or-composable reachability | 32923 / 33523 (98.21%) | Core coverage view for all labels |
| Composition-only word/phrase labels | 51 | Reachable through glyph composition but not direct candidate pages |

## Top Entity Buckets

These rows are the main efficiency guardrail. They emphasize high-source-rank glyphs and words/phrases before broad long-tail coverage.

| Entity Set | Count | Direct Reachable | Direct % | Direct/Composable Reachable | Direct/Composable % | Median Activations | P90 Activations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Top 100 glyphs | 100 | 100 | 100.00% | 100 | 100.00% | 6 | 8 |
| Top 500 glyphs | 500 | 500 | 100.00% | 500 | 100.00% | 6 | 8 |
| Top 1000 glyphs | 1000 | 1000 | 100.00% | 1000 | 100.00% | 6 | 8 |
| Top 100 words/phrases | 100 | 100 | 100.00% | 100 | 100.00% | 6 | 6 |
| Top 500 words/phrases | 500 | 500 | 100.00% | 500 | 100.00% | 6 | 6 |
| Top 1000 words/phrases | 1000 | 1000 | 100.00% | 1000 | 100.00% | 6 | 6 |
| Top 5000 words/phrases | 5000 | 5000 | 100.00% | 5000 | 100.00% | 6 | 8 |

## Fast Efficiency Estimates

| Label Set | Count | Median Activations | P90 Activations | Average Activations | Median Selections | P90 Selections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct glyph candidates | 5460 | 8 | 10 | 7.35 | 4 | 5 |
| Direct word/phrase candidates | 27412 | 8 | 10 | 8.27 | 4 | 5 |
| Best word/phrase direct-or-composed | 27463 | 8 | 10 | 8.27 | 4 | 5 |
| Best all-label direct-or-composed | 32923 | 8 | 10 | 8.12 | 4 | 5 |

## Previous-Version Comparison

Baseline: Previous pre-efficiency baseline. Use this section to review systemic dictionary, coverage, and efficiency movement before accepting ranking/data changes.

| Metric | Previous | Current | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Source dictionary entries | 60000 | 60000 | 0 | 0.00% |
| Unique source labels | 33523 | 33523 | 0 | 0.00% |
| Entry phonetic-path reachability | 98.46% | 100.00% | +1.54 pp | 1.56% |
| Weighted phonetic-path reachability | 98.87% | 100.00% | +1.13 pp | 1.14% |
| Direct glyph candidate reachability | 85.30% | 90.19% | +4.89 pp | 5.73% |
| Direct word/phrase candidate reachability | 98.22% | 99.79% | +1.57 pp | 1.60% |
| Word/phrase direct-or-composable reachability | 98.41% | 99.98% | +1.57 pp | 1.59% |
| All-label direct-or-composable reachability | 96.04% | 98.21% | +2.17 pp | 2.26% |
| Top 500 glyph direct reachability | 98.60% | 100.00% | +1.40 pp | 1.42% |
| Top 500 word/phrase direct reachability | 99.20% | 100.00% | +0.80 pp | 0.81% |
| Direct glyph median activations | 8 | 8 | 0 | 0.00% |
| Direct word/phrase median activations | 8 | 8 | 0 | 0.00% |
| Best all-label median activations | 8 | 8 | 0 | 0.00% |
| Direct glyph P90 activations | 10 | 10 | 0 | 0.00% |
| Direct word/phrase P90 activations | 12 | 10 | -2 | -16.67% |
| Best all-label P90 activations | 10 | 10 | 0 | 0.00% |

## Sample Gaps

These samples are diagnostic, not hand-tuning instructions.

### Glyphs Not Directly Reachable

輯 籍 祭 逸 擊 憶 役 姬 翼 肌 誼 奕 衪 揖 懿 疾 激 跡 极 飢 机 御 几 嶧 悉 郋 祈 羲 鬱 祺 晰 俞 獄 翊 伏 嫕 蝠 掑 邾 煜

### Words/Phrases Not Directly Reachable

義式 十時 祇是 醫治 一紙 一只 意指 抑止 失事 意旨 懿旨 施以 以至 失誤 以示 旨意 實是 制止 異質 食指 師事 制式 直視 直式 執事 巫士 巫師 職事 執意 時勢 智識 依依 飾物 軼事 示意 一隅 釋義 史實 舞獅 之無

### Words/Phrases Not Composable From Direct Glyphs

胰液 聯絡 書籍 連絡 編輯 編輯器 百身莫贖 疾病 小姐 專輯 垃圾 置喙 記憶體 玻璃 幼稚園 輻射 霹靂 聯誼 悽悽 淒淒 玉山 刺激 記憶 衝擊 攻擊 熟悉 古蹟 中壢市 起誓 射擊 設籍 老闆 蒞臨 邏輯 癲癇 聯誼會 標幟 暴戾 肌肉 免役

## Method

- Direct candidate estimate assumes 4 columns, 4 suggestion rows, and 3 suggestion pages.
- One page can expose up to 15 direct candidates because one slot is reserved for more-suggestions when paging is needed.
- Phonetic-path reachability checks that every key symbol is available in the complete static first-layer inventory.
- Direct candidate reachability estimates whether a label appears within the first reachable suggestion pages after composing its key.
- Composable reachability treats long labels as possible when every component glyph has a direct candidate path.
- Efficiency is estimated as two switch activations per selected tile. It intentionally excludes real-time row/cell waits; virtual communication benchmarks cover realistic scan path cost.
- Runtime for this report: 1178 ms on this machine.
