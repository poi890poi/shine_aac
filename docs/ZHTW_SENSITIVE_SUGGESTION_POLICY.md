# zh-TW Sensitive Suggestion Policy

This policy reduces unsolicited exposure to a small, high-confidence set of sensitive labels without deleting vocabulary or changing deliberate full-pronunciation input.

## Scope

The runtime list is generated from `scripts/data/zhtw-sensitive-candidate-review.json`. That review records pinned discovery sources, aggregate evidence, Taiwan conversation counts, rejected false-positive examples, the decision, and its rationale. The generated file must not be edited directly.

The initial policy is intentionally small. Candidate discovery is broad, but visible ranking changes require at least two independent risk sources and a recorded semantic review. Ordinary meanings, identities, critical reporting language, and materially ambiguous labels are rejected or deferred. This keeps an external toxicity dataset from becoming an application blacklist.

## Runtime behavior

Selected labels are moved behind otherwise comparable candidates only when intent is weak:

- the Zhuyin key is incomplete;
- a multi-glyph word is reached through one-initial-per-glyph shorthand;
- a repaired key is being proposed; or
- a glyph-sequence completion is automatic.

A complete non-alias phonetic key preserves the source ranking. Every label remains composable from individual glyphs. Moving a label to a later `MORE` page is counted only as reduced unsolicited exposure, never as an efficiency improvement.

## Reproduction

Run:

```text
npm run generate:zhtw:sensitive
npm run check:zhtw:sensitive
```

Generation validates source references, candidate uniqueness, and the independent-source threshold. The output embeds the evidence version and SHA-256 hash, so any review change requires explicit regeneration and produces a reviewable diff.

The review evidence contains only derived counts, decisions, citations, and rationales. External research corpora are not redistributed.
