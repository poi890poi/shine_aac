# zh-TW Phonetic Access Report

Generated: 2026-08-08T12:01:06.423Z

This report treats Zhuyin input as an AAC access graph with a complete, stable first-layer symbol inventory.
It measures whether all phonetic paths and dictionary-backed candidates remain reachable without hidden symbols or hand-crafted phrase shortcuts.

## Summary

- Recommendation columns: 4
- First-layer Zhuyin columns: 6
- Static Zhuyin symbols: 37 / 37
- Static symbol set: ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ ㄋ ㄌ ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ ㄓ ㄔ ㄕ ㄖ ㄗ ㄘ ㄙ ㄧ ㄨ ㄩ ㄚ ㄛ ㄜ ㄝ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄦ
- Dictionary entries analyzed: 60000
- Weighted first-symbol coverage: 100.00%
- Hidden continuation symbols with dictionary prefixes: 0
- Hidden continuation symbols with at least one blocked prefix: 0
- Visible dead-end continuations: 0
- Unreachable entries among top 500 source-ranked entries: 0

## Top First Symbols By Weighted Coverage

| Symbol | Static | Entries | Weight |
| --- | --- | ---: | ---: |
| ㄧ | yes | 3843 | 6854236.00 |
| ㄐ | yes | 4524 | 6753670.00 |
| ㄕ | yes | 4146 | 6171006.00 |
| ㄒ | yes | 3739 | 5941008.00 |
| ㄓ | yes | 3870 | 5818278.00 |
| ㄉ | yes | 3653 | 5371430.00 |
| ㄍ | yes | 3032 | 4271002.00 |
| ㄅ | yes | 3524 | 4071870.00 |
| ㄊ | yes | 2460 | 3928947.00 |
| ㄨ | yes | 2128 | 3406720.00 |
| ㄌ | yes | 2756 | 3350392.00 |
| ㄏ | yes | 2935 | 3342284.00 |
| ㄑ | yes | 2217 | 3340220.00 |
| ㄗ | yes | 1755 | 3002579.00 |
| ㄈ | yes | 2120 | 2695200.00 |
| ㄔ | yes | 2225 | 2656625.00 |

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
