# SHINE AAC Quality Target Metrics

This document defines target metrics in real-world communication units. It is intentionally separate from implementation tests so benchmark growth does not become special-case app logic.

## Evidence Basis

- ASHA AAC Practice Portal: AAC supports expression of thoughts, wants and needs, feelings, and ideas; AAC systems include symbols, selection techniques, and strategies; message banking includes words, phrases, sentences, and sounds.
- Light & McNaughton communicative competence model: AAC competence spans linguistic, operational, social, and strategic domains.
- Project Core Universal Core Vocabulary: 36 core words can be used alone or in combination across purposes, topics, and partners.
- BASPRO / TMNews: a Chinese speech-script benchmark used 400 ten-character sentences and reported 84% real-world syllable coverage with 0.96 syllable-distribution cosine similarity.
- SHINE zh-TW data: Chewing-backed Traditional Chinese/Zhuyin dictionary plus current product functional phrases.

## Target Metrics

| Metric | Target | Why |
| --- | ---: | --- |
| Direct phonetic symbols | >= 98% weighted first-symbol coverage | A constrained AAC layout should cover high-frequency entry starts without copying a full keyboard. |
| Dead-end continuation symbols | 0 | A visible phonetic continuation must lead to at least one glyph or phrase candidate. |
| Top glyph reachability | >= 99% of unique glyphs in top 500 source-ranked zh-TW entries | Glyph access is the minimum viable backstop for phrase generation. |
| Top phrase reachability | >= 95% of unique phrases in top 500 source-ranked zh-TW entries | Phrase access measures useful compression beyond single characters. |
| Functional phrase surface | 80-120 phrases | 10 communication areas x 8-12 phrases each. Current 48 phrases are useful but too small for broader disability communication needs. |
| Multi-concept AAC utterances | 120 benchmark utterances | 10 communication areas x 12 source-backed or reviewed utterance probes each. This is a SHINE product target, not an academic constant. |
| Corpus-style zh-TW sentence audit | reference scale: 400 sentences | BASPRO/TMNews used 20 sets x 20 sentences for a phonetic-balanced Chinese script. This is a reference scale, not a SHINE release target. |
| Median urgent phrase time | <= 10 seconds | Short urgent needs should be fast enough for care interaction. |
| Average benchmark time | <= 15 seconds | Keeps everyday short communication practical for one-switch scanning. |
| Median switch activations | <= 4 activations | Preserves motor effort for users with fatigue or limited reliable movement. |
| Average switch activations | <= 6 activations | Prevents broad benchmark improvements from hiding high-effort paths. |

## Current Gap Policy

- Do not add generated sentence filler to satisfy utterance counts.
- Prefer Taiwan zh-TW corpus lines or clinician/caregiver-reviewed utterances.
- English AAC material may define communication functions, but it should not be treated as Taiwan Mandarin sentence evidence.
- Benchmark failures should change general layout, ranking, or access policies, not add phrase-specific rules.

## Communication Areas Behind 80-120 And 120

| Area | Phrase Target | Utterance Target |
| --- | ---: | ---: |
| Basic needs | 8-12 | 12 |
| Body comfort and status | 8-12 | 12 |
| Care and medical support | 8-12 | 12 |
| Positioning and environment | 8-12 | 12 |
| Refusal, consent, and control | 8-12 | 12 |
| People and relationship | 8-12 | 12 |
| Preference and choice | 8-12 | 12 |
| Conversation repair and pacing | 8-12 | 12 |
| Social closeness and etiquette | 8-12 | 12 |
| Operational app control | 8-12 | 12 |

The phrase target is a minimum surface inventory. The utterance target checks whether those phrases can combine into real communication paths with tolerable time and switch effort.
