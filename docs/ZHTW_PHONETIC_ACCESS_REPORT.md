# zh-TW Phonetic Access Report

Generated: 2026-07-14T15:23:49.670Z

This report treats Zhuyin input as a constrained AAC access graph, not as a full keyboard IME.
It measures whether static first-level symbols and dynamic continuation suggestions keep dictionary-backed paths reachable without hand-crafted phrase shortcuts.

## Summary

- Columns: 4
- Static Zhuyin symbols: 24 / 37
- Static symbol set: ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ ㄋ ㄌ ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ ㄓ ㄔ ㄕ ㄖ ㄗ ㄘ ㄙ ㄧ ㄨ ㄩ
- Dictionary entries analyzed: 60000
- Weighted first-symbol coverage: 98.87%
- Hidden continuation symbols with dictionary prefixes: 13
- Hidden continuation symbols with at least one blocked prefix: 0
- Visible dead-end continuations: 0
- Unreachable entries among top 500 source-ranked entries: 2

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
| ㄚ | 3206 | 1102 | 1102 | yes |
| ㄛ | 2097 | 753 | 753 | yes |
| ㄜ | 2517 | 1156 | 1156 | yes |
| ㄝ | 2035 | 758 | 758 | yes |
| ㄞ | 2480 | 989 | 989 | yes |
| ㄟ | 3041 | 1020 | 1020 | yes |
| ㄠ | 3769 | 1388 | 1388 | yes |
| ㄡ | 2851 | 979 | 979 | yes |
| ㄢ | 7595 | 2818 | 2818 | yes |
| ㄣ | 4378 | 1639 | 1639 | yes |
| ㄤ | 3860 | 1562 | 1562 | yes |
| ㄥ | 6706 | 2342 | 2342 | yes |
| ㄦ | 273 | 131 | 131 | yes |

## Visible Dead-End Continuations

No visible continuation symbols lead to a source-empty prefix.

## Blocked High-Rank Entries

| Label | Key | Blocked Prefix | Blocked Symbol | Reason |
| --- | --- | --- | --- | --- |
| 而 | ㄦ |  | ㄦ | first-symbol-not-static |
| 二 | ㄦ |  | ㄦ | first-symbol-not-static |

## Design Meaning

- Top-level Zhuyin symbols should be selected by weighted dictionary coverage and AAC value, not by copying a full keyboard.
- Hidden symbols are acceptable only when they are reachable as valid continuations from visible prefixes.
- Benchmark failures should change general weights, symbol coverage rules, or continuation ordering, not add phrase-specific shortcuts.
- Japanese kana input is a useful analogy only at the level of progressive phonetic disclosure and candidate conversion; the zh-TW profile must remain grounded in Traditional Chinese/Zhuyin data.
