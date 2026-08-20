# zh-TW Dictionary Inventory Report

Generated: 2026-08-20T05:55:03.115Z

This is the fast inventory report. It estimates broad source-dictionary reachability and efficiency from the phonetic access graph instead of running real-time scanning or full virtual utterance benchmarks.

## Inventory

| Metric | Value | Meaning |
| --- | ---: | --- |
| Source dictionary entries | 60000 | Generated New Chewing entries after SHINE length/key limits |
| Unique source labels | 33529 | Unique glyph, word, and phrase labels |
| Available Zhuyin symbols | 37 | Full zh-TW phonetic symbol inventory |
| Static first-level Zhuyin symbols | 37 | All symbols visible without paging |
| Dynamic continuation Zhuyin symbols | 0 | Hidden symbols required for phonetic input |
| Source glyph labels | 6065 | Unique single-Han-character labels in the dictionary |
| Source multi-glyph word/phrase labels | 27464 | Unique labels longer than one Han character |
| Unique Han characters appearing anywhere | 6283 | Character inventory across all labels |

## Fast Reachability Estimates

| Metric | Value | Target / Use |
| --- | ---: | --- |
| Entry phonetic-path reachability | 60000 / 60000 (100.00%) | Broad graph reachability before candidate rank/page limits |
| Weighted phonetic-path reachability | 100.00% | Frequency-weighted view of source entries |
| Direct glyph candidate reachability | 5484 / 6065 (90.42%) | Single glyph can be committed directly within 3 pages |
| Direct word/phrase candidate reachability | 27407 / 27464 (99.79%) | Multi-glyph label can be committed directly within 3 pages |
| Word/phrase composability from glyphs | 26949 / 27464 (98.12%) | Multi-glyph label can be built from direct glyph candidates |
| Word/phrase direct-or-composable reachability | 27458 / 27464 (99.98%) | Core coverage view for multi-glyph expressions |
| All-label direct-or-composable reachability | 32942 / 33529 (98.25%) | Core coverage view for all labels |
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

## Independent MOE Common-Glyph Guardrail

These buckets use the Taiwan Ministry of Education frequency table rather than the New Chewing source rank. Phrases are not coverage requirements because they remain constructible from reachable glyphs.

| Reference Set | Count | Direct Reachable | Direct % |
| --- | ---: | ---: | ---: |
| MOE frequency rank <= 1000 | 999 | 999 | 100.00% |
| MOE frequency rank <= 2000 | 1995 | 1995 | 100.00% |
| MOE frequency rank <= 3000 | 2963 | 2827 | 95.41% |
| All MOE frequency entries | 4343 | 3627 | 83.51% |

## Fast Efficiency Estimates

| Label Set | Count | Median Activations | P90 Activations | Average Activations | Median Selections | P90 Selections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct glyph candidates | 5484 | 8 | 10 | 7.34 | 4 | 5 |
| Direct word/phrase candidates | 27407 | 8 | 10 | 8.27 | 4 | 5 |
| Best word/phrase direct-or-composed | 27458 | 8 | 10 | 8.28 | 4 | 5 |
| Best all-label direct-or-composed | 32942 | 8 | 10 | 8.12 | 4 | 5 |

## Previous-Version Comparison

Baseline: Previous pre-efficiency baseline. Use this section to review systemic dictionary, coverage, and efficiency movement before accepting ranking/data changes.

| Metric | Previous | Current | Difference | Change |
| --- | ---: | ---: | ---: | ---: |
| Source dictionary entries | 60000 | 60000 | 0 | 0.00% |
| Unique source labels | 33523 | 33529 | +6 | 0.02% |
| Entry phonetic-path reachability | 98.46% | 100.00% | +1.54 pp | 1.56% |
| Weighted phonetic-path reachability | 98.87% | 100.00% | +1.13 pp | 1.14% |
| Direct glyph candidate reachability | 85.30% | 90.42% | +5.12 pp | 6.00% |
| Direct word/phrase candidate reachability | 98.22% | 99.79% | +1.57 pp | 1.60% |
| Word/phrase direct-or-composable reachability | 98.41% | 99.98% | +1.57 pp | 1.59% |
| All-label direct-or-composable reachability | 96.04% | 98.25% | +2.21 pp | 2.30% |
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

壹 輯 膉 疫 毅 逸 姬 誼 奕 衪 揖 懿 裕 鋊 衧 极 飢 机 隅 御 几 嶧 撫 郋 醴 羲 鬱 祺 晰 栗 俞 獄 翊 嫕 蝠 掑 邾 煜 釔 緝

### MOE Frequency-Ranked Glyphs Not Directly Reachable

咐 肢 斧 璧 嘩 寂 獄 喃 婿 艱 嘰 吩 紂 蜘 嚷 砝 碌 飢 壹 瑚 嬸 寓 吱 姪 犧 啼 乞 陌 裕 愧 熄 誼 溉 撫 彿 蜴 噢 逝 鋸 儡

### Words/Phrases Not Directly Reachable

義式 十時 祇是 醫治 一紙 一只 意指 抑止 失事 意旨 懿旨 施以 以至 失誤 以示 旨意 實是 制止 異質 食指 師事 制式 直視 直式 執事 巫士 巫師 職事 執意 時勢 智識 依依 飾物 軼事 示意 一隅 釋義 史實 舞獅 之無

### Words/Phrases Not Composable From Direct Glyphs

胰液 編輯 編輯器 苗栗縣 百身莫贖 專輯 置喙 輻射 霹靂 聯誼 悽悽 淒淒 古蹟 中壢市 起誓 苗栗 蒞臨 邏輯 癲癇 聯誼會 標幟 暴戾 栗子 免疫 疫苗 時艱 中壢 公寓 秩序 實蹟 彷彿 稽核 汐止區 汐止鎮 抑制 蠹魚 易幟 寂寞 苗栗市 祕笈

## Method

- Direct candidate estimate assumes 4 columns, 4 suggestion rows, and 3 suggestion pages.
- One page can expose up to 15 direct candidates because one slot is reserved for more-suggestions when paging is needed.
- Phonetic-path reachability checks that every key symbol is available in the complete static first-layer inventory.
- Direct candidate reachability estimates whether a label appears within the first reachable suggestion pages after composing its key.
- Composable reachability treats long labels as possible when every component glyph has a direct candidate path.
- Efficiency is estimated as two switch activations per selected tile. It intentionally excludes real-time row/cell waits; virtual communication benchmarks cover realistic scan path cost.
- Runtime for this report: 1264 ms on this machine.
