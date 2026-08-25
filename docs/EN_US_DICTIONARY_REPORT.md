# en-US Dictionary Report

Generated: 2026-08-25T03:30:37.014Z

## Scope

This report audits the active English dictionary foundation and its source-frequency order. Candidate-strip commands, layout, typo correction, autocorrection, and personal learning are outside this report.

## Replacement

| Metric | Previous built-in dictionary | Replacement |
|---|---:|---:|
| Unique entries | 280 | 27,717 |
| Increase | — | 9798.9% |
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
| Simple +s plurals removed during generation | 6,534 |
| Minimum retained frequency | 70 |
| Retained entries | 27,717 |

Supported forms are ordinary lowercase alphabetic words with optional internal apostrophes, plus the source forms `I`, `OK`, and `TV`. Proper names, arbitrary abbreviations, punctuation-only tokens, and every source entry with frequency 0 are excluded by rule. A frequency-qualified word ending in `s` is also excluded when its exact base (the word without that final `s`) is frequency-qualified. A small explicit exception set preserves suffix collisions and non-plurals such as `his`, `its`, `does`, `news`, `species`, and possessive pronouns.

Source: [AOSP LatinIME en_US_wordlist.combined.gz](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/127336e9f29d69607eab55982324b210279ae8c5/dictionaries/en_US_wordlist.combined.gz). AOSP documents dictionary frequency as a logarithmic 0–255 value in its [combined dictionary format](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/127336e9f29d69607eab55982324b210279ae8c5/dictionaries/sample.combined).

## Frequency distribution

| Frequency band | Entries |
|---|---:|
| 180–255 | 34 |
| 160–179 | 135 |
| 140–159 | 748 |
| 120–139 | 2,614 |
| 100–119 | 5,616 |
| 80–99 | 10,945 |
| 70–79 | 7,625 |

## Word-length distribution

| Length | Entries |
|---|---:|
| 1 | 2 |
| 2 | 66 |
| 3–5 | 4,279 |
| 6–8 | 11,968 |
| 9–12 | 10,115 |
| 13+ | 1,287 |

Contractions retained: 604.

## Prefix capacity

This is a property of the repaired dictionary in source-frequency order. It does not include current UI command keys or static-board exclusions.

| Typed characters | Distinct valid prefixes | Mean matching words | Prefixes with ≥4 matches | Mean unused slots in a 4-candidate strip |
|---:|---:|---:|---:|---:|
| 1 | 26 | 1066.04 | 100.0% | 0.00 |
| 2 | 281 | 98.63 | 74.7% | 0.65 |
| 3 | 2,058 | 13.43 | 62.8% | 0.88 |
| 4 | 6,440 | 4.22 | 33.9% | 1.61 |
| 5 | 10,623 | 2.41 | 18.3% | 2.10 |

## Frequency top-four reachability

For each retained word, this asks when that word first enters the four highest-frequency matches for its typed prefix. It intentionally does not apply any app-specific priority rule.

| Visible by | Words | Coverage |
|---|---:|---:|
| 1 character | 104 | 0.4% |
| 2 characters | 944 | 3.4% |
| 3 characters | 6,469 | 23.3% |
| 4 characters | 15,835 | 57.1% |
| 5 characters | 22,062 | 79.6% |
| Full spelling or earlier | 27,412 | 98.9% |

Words that never enter the frequency top four for any exact prefix: 305.

First examples: `act`, `com`, `opera`, `tho`, `ex`, `pro`, `add`, `gene`, `count`, `cap`, `ad`, `ban`, `sit`, `tea`, `cat`, `fun`, `inter`, `mini`, `cent`, `arc`, `arch`, `bat`, `demo`, `ear`, `auto`, `elect`, `genera`, `miss`, `per`, `tech`, `trans`, `rid`, `disco`, `edit`, `persona`, `bet`, `den`, `invest`, `rat`, `aft`.

## Active ranking contract

The app preserves this source order for prefix completion and at word boundaries. It applies no handcrafted AAC tiers or word-to-word transition lists. Custom dictionaries preserve the order entered by the user.
