# en-US Dictionary Report

Generated: 2026-08-09T12:39:31.816Z

## Scope

This report audits the active English dictionary foundation and its source-frequency order. Candidate-strip commands, layout, typo correction, autocorrection, and personal learning are outside this report.

## Replacement

| Metric | Previous built-in dictionary | Replacement |
|---|---:|---:|
| Unique entries | 280 | 34,251 |
| Increase | — | 12132.5% |
| Duplicate normalized entries | — | 0 |
| Invalid retained forms | — | 0 |

The replacement is a neutral frequency-ranked slice of the official Android Open Source Project LatinIME en-US dictionary. No word is promoted because it is AAC, medical, part of a demo, or mentioned in a complaint.

## Source policy

| Property | Value |
|---|---:|
| Source | AOSP LatinIME en_US |
| Source model version | 54 |
| Pinned source revision | `127336e9f29d69607eab55982324b210279ae8c5` |
| Decompressed source SHA-256 | `b039d9f26aa3e9e999f045158271728e6664f0123fc65a4d9a3725c4040c746c` |
| Raw source entries | 160,715 |
| Entries matching the supported word form | 117,617 |
| Supported entries suppressed at frequency 0 | 330 |
| Minimum retained frequency | 70 |
| Retained entries | 34,251 |

Supported forms are ordinary lowercase alphabetic words with optional internal apostrophes, plus the source forms `I`, `OK`, and `TV`. Proper names, arbitrary abbreviations, punctuation-only tokens, and every source entry with frequency 0 are excluded by rule.

Source: [AOSP LatinIME en_US_wordlist.combined.gz](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/127336e9f29d69607eab55982324b210279ae8c5/dictionaries/en_US_wordlist.combined.gz). AOSP documents dictionary frequency as a logarithmic 0–255 value in its [combined dictionary format](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/127336e9f29d69607eab55982324b210279ae8c5/dictionaries/sample.combined).

## Frequency distribution

| Frequency band | Entries |
|---|---:|
| 180–255 | 34 |
| 160–179 | 136 |
| 140–159 | 834 |
| 120–139 | 3,168 |
| 100–119 | 7,103 |
| 80–99 | 13,652 |
| 70–79 | 9,324 |

## Word-length distribution

| Length | Entries |
|---|---:|
| 1 | 2 |
| 2 | 66 |
| 3–5 | 5,306 |
| 6–8 | 14,985 |
| 9–12 | 12,347 |
| 13+ | 1,545 |

Contractions retained: 604.

## Prefix capacity

This is a property of the repaired dictionary in source-frequency order. It does not include current UI command keys or static-board exclusions.

| Typed characters | Distinct valid prefixes | Mean matching words | Prefixes with ≥4 matches | Mean unused slots in a 4-candidate strip |
|---:|---:|---:|---:|---:|
| 1 | 26 | 1317.35 | 100.0% | 0.00 |
| 2 | 281 | 121.88 | 75.8% | 0.61 |
| 3 | 2,060 | 16.59 | 67.0% | 0.75 |
| 4 | 6,633 | 5.08 | 39.6% | 1.43 |
| 5 | 11,305 | 2.82 | 22.2% | 1.94 |

## Frequency top-four reachability

For each retained word, this asks when that word first enters the four highest-frequency matches for its typed prefix. It intentionally does not apply any app-specific priority rule.

| Visible by | Words | Coverage |
|---|---:|---:|
| 1 character | 104 | 0.3% |
| 2 characters | 955 | 2.8% |
| 3 characters | 6,752 | 19.7% |
| 4 characters | 17,440 | 50.9% |
| 5 characters | 25,390 | 74.1% |
| Full spelling or earlier | 33,844 | 98.8% |

Words that never enter the frequency top four for any exact prefix: 407.

First examples: `act`, `com`, `opera`, `tho`, `ex`, `pro`, `add`, `critic`, `gene`, `count`, `met`, `connect`, `sing`, `thin`, `cap`, `ad`, `ban`, `paint`, `sit`, `tea`, `cat`, `collect`, `fun`, `inter`, `mini`, `settle`, `cent`, `arc`, `arch`, `bat`, `demo`, `employ`, `commit`, `ear`, `lab`, `auto`, `elect`, `facto`, `genera`, `reside`.

## Active ranking contract

The app preserves this source order for prefix completion and at word boundaries. It applies no handcrafted AAC tiers or word-to-word transition lists. Custom dictionaries preserve the order entered by the user.

## Static two-row suggestion decision

The English board always reserves exactly two suggestion rows, including at word boundaries and in the zh-TW English board. The row count and all following scanner-row positions therefore remain stable while the user spells or commits a word.

Ignoring word-width limits and labels already present on the static board, the first four source-ranked matches cover 19.5% of retained targets after three letters and 49.8% after four; the first eight cover 32.4% and 68.7%, respectively. These are dictionary reachability figures, not usage probabilities.

Long candidates still consume multiple visual columns but remain one scanner target. Packing considers a larger ranked candidate pool. If the next wide candidate cannot fit the remaining columns of a row, it is deferred to the following row while the highest-ranked later candidate that does fit fills the gap. The deferred candidate is reconsidered first on the next row. Empty space remains only when no remaining candidate can fit it.
