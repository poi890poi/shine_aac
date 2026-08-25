# zh-TW Phonetic Access Report

Generated: 2026-08-25T03:30:16.685Z

This report treats Zhuyin input as an AAC access graph with a complete, stable first-layer symbol inventory.
It measures whether all phonetic paths and dictionary-backed candidates remain reachable without hidden symbols or hand-crafted phrase shortcuts.

## Summary

- Recommendation columns: 4
- First-layer Zhuyin columns: 6
- Static Zhuyin symbols: 37 / 37
- Static symbol set: ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ ㄋ ㄌ ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ ㄓ ㄔ ㄕ ㄖ ㄗ ㄘ ㄙ ㄧ ㄨ ㄩ ㄚ ㄛ ㄜ ㄝ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄦ
- Dictionary entries analyzed: 60513
- Weighted first-symbol coverage: 100.00%
- Hidden continuation symbols with dictionary prefixes: 0
- Hidden continuation symbols with at least one blocked prefix: 0
- Visible dead-end continuations: 0
- Unreachable entries among top 500 source-ranked entries: 0

## Top First Symbols By Weighted Coverage

| Symbol | Static | Entries | Weight |
| --- | --- | ---: | ---: |
| ㄧ | yes | 3871 | 6855320.00 |
| ㄐ | yes | 4553 | 6748757.00 |
| ㄕ | yes | 4165 | 6171725.00 |
| ㄒ | yes | 3758 | 5941082.00 |
| ㄓ | yes | 3906 | 5819875.00 |
| ㄉ | yes | 3673 | 5372496.00 |
| ㄍ | yes | 3062 | 4272281.00 |
| ㄅ | yes | 3544 | 4072674.00 |
| ㄊ | yes | 2481 | 3929836.00 |
| ㄨ | yes | 2146 | 3407641.00 |
| ㄌ | yes | 2795 | 3351486.00 |
| ㄏ | yes | 2962 | 3343684.00 |
| ㄑ | yes | 2235 | 3340827.00 |
| ㄗ | yes | 1762 | 3002892.00 |
| ㄈ | yes | 2132 | 2695736.00 |
| ㄔ | yes | 2247 | 2657466.00 |

## Hidden Continuation Symbols

| Symbol | Entries | Prefixes | Visible Prefixes | All Visible |
| --- | ---: | ---: | ---: | --- |

## Visible Dead-End Continuations

No visible continuation symbols lead to a source-empty prefix.

## Blocked High-Rank Entries

No blocked phonetic paths found among the top 500 source-ranked entries.

## Design Meaning

- All 37 Zhuyin symbols remain visible in stable phonetic order on the first layer.
- Recommendation rows should contain output candidates and repairs, not duplicate first-layer Zhuyin symbols.
- `更多` pages output candidates only; no phonetic symbol depends on paging for discovery.
- Benchmark failures should change general weights, symbol coverage rules, or continuation ordering, not add phrase-specific shortcuts.
- The zh-TW profile remains grounded in Traditional Chinese/Zhuyin data and AAC target-size constraints.
