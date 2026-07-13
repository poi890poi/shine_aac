# zh-TW Dictionary Inventory Report

Generated: 2026-07-11T03:50:00.415Z

This is the fast inventory report. It estimates broad source-dictionary reachability and efficiency from the phonetic access graph instead of running real-time scanning or full virtual utterance benchmarks.

## Inventory

| Metric | Value | Meaning |
| --- | ---: | --- |
| Source dictionary entries | 60000 | Generated New Chewing entries after SHINE length/key limits |
| Unique source labels | 33523 | Unique glyph, word, and phrase labels |
| Available Zhuyin symbols | 37 | Full zh-TW phonetic symbol inventory |
| Static first-level Zhuyin symbols | 24 | Visible without continuation |
| Dynamic continuation Zhuyin symbols | 13 | Hidden first-level symbols that can appear as continuations |
| Source glyph labels | 6054 | Unique single-Han-character labels in the dictionary |
| Source multi-glyph word/phrase labels | 27469 | Unique labels longer than one Han character |
| Unique Han characters appearing anywhere | 6283 | Character inventory across all labels |

## Fast Reachability Estimates

| Metric | Value | Target / Use |
| --- | ---: | --- |
| Entry phonetic-path reachability | 59077 / 60000 (98.46%) | Broad graph reachability before candidate rank/page limits |
| Weighted phonetic-path reachability | 98.87% | Frequency-weighted view of source entries |
| Direct glyph candidate reachability | 5164 / 6054 (85.30%) | Single glyph can be committed directly within 3 pages |
| Direct word/phrase candidate reachability | 26979 / 27469 (98.22%) | Multi-glyph label can be committed directly within 3 pages |
| Word/phrase composability from glyphs | 25448 / 27469 (92.64%) | Multi-glyph label can be built from direct glyph candidates |
| Word/phrase direct-or-composable reachability | 27032 / 27469 (98.41%) | Core coverage view for multi-glyph expressions |
| All-label direct-or-composable reachability | 32196 / 33523 (96.04%) | Core coverage view for all labels |
| Composition-only word/phrase labels | 53 | Reachable through glyph composition but not direct candidate pages |

## Top Entity Buckets

These rows are the main efficiency guardrail. They emphasize high-source-rank glyphs and words/phrases before broad long-tail coverage.

| Entity Set | Count | Direct Reachable | Direct % | Direct/Composable Reachable | Direct/Composable % | Median Activations | P90 Activations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Top 100 glyphs | 100 | 98 | 98.00% | 98 | 98.00% | 6 | 8 |
| Top 500 glyphs | 500 | 493 | 98.60% | 493 | 98.60% | 6 | 8 |
| Top 1000 glyphs | 1000 | 979 | 97.90% | 979 | 97.90% | 6 | 8 |
| Top 100 words/phrases | 100 | 100 | 100.00% | 100 | 100.00% | 6 | 6 |
| Top 500 words/phrases | 500 | 496 | 99.20% | 496 | 99.20% | 6 | 6 |
| Top 1000 words/phrases | 1000 | 993 | 99.30% | 993 | 99.30% | 6 | 8 |
| Top 5000 words/phrases | 5000 | 4941 | 98.82% | 4943 | 98.86% | 6 | 8 |

## Fast Efficiency Estimates

| Label Set | Count | Median Activations | P90 Activations | Average Activations | Median Selections | P90 Selections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct glyph candidates | 5164 | 8 | 10 | 7.73 | 4 | 5 |
| Direct word/phrase candidates | 26979 | 8 | 12 | 8.46 | 4 | 6 |
| Best word/phrase direct-or-composed | 27032 | 8 | 12 | 8.47 | 4 | 6 |
| Best all-label direct-or-composed | 32196 | 8 | 10 | 8.35 | 4 | 5 |

## Sample Gaps

These samples are diagnostic, not hand-tuning instructions.

### Glyphs Not Directly Reachable

而 二 啊 阿 愛 安 偶 喔 按 暗 案 移 耳 爾 億 益 堨 歐 兒 溢 藝 極 議 嗯 恩 績 伊 壹 額 積 哦 艾 雞 奧 譯 史 屎 駛 異 釋

### Words/Phrases Not Directly Reachable

二十 安全 兒童 而且 安裝 歐洲 二段 而言 安排 愛情 二年 按鍵 案件 而是 按件 暗箭 澳洲 二月 耳朵 二日 而已 二路 案例 而不 二次 按下 二百 二期 偶像 愛心 俄羅斯 二屆 安定 安定區 二千 兒子 阿多諾 阿里山 二手 二樓

### Words/Phrases Not Composable From Direct Glyphs

胰液 第二 移向 移項 檔案 聯絡 建議 書籍 二十 安全 藝術 娛樂 會議 兒童 金額 歷史 而且 蕃薯 兩岸 連絡 資本額 編輯 編輯器 特殊 藝文 苗栗縣 安裝 積極 百身莫贖 專案 十二月 請按 方案 十二 成績 疾病 然而 小姐 障礙 星期二

## Method

- Direct candidate estimate assumes 4 columns, 4 suggestion rows, and 3 suggestion pages.
- One page can expose up to 15 direct candidates because one slot is reserved for more-suggestions when paging is needed.
- Phonetic-path reachability checks whether each key symbol is either static or visible as a valid continuation.
- Direct candidate reachability estimates whether a label appears within the first reachable suggestion pages after composing its key.
- Composable reachability treats long labels as possible when every component glyph has a direct candidate path.
- Efficiency is estimated as two switch activations per selected tile. It intentionally excludes real-time row/cell waits; virtual communication benchmarks cover realistic scan path cost.
- Runtime for this report: 3432 ms on this machine.
