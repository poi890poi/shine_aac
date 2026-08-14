# zh-TW conversation benchmark

This benchmark evaluates first-page Zhuyin suggestion opportunities against the
50 naturalistic conversations in the NCCU Corpus of Spoken Taiwan Mandarin
(TM001-TM050). It is intentionally separate from demo scripts and handcrafted
communication cases.

Source: [NCCU Corpus of Spoken Taiwan Mandarin](https://spokentaiwanmandarin.nccu.edu.tw/).

## Reproducible corpus snapshot

- Corpus version: `NCCU-TM001-TM050-2026-03`
- Conversations: 50
- Mandarin turns after normalization: 25,693
- Han characters after normalization: 355,203
- Normalized SHA-256:
  `a15e8dc5ad537ec827c52fbe7b78d4b9aab3de7da10729007cf434732e45ead2`

The parser removes tagged L2-L6 code-switching spans and `((additional
remarks))`. It retains transcribed uncertain speech and overlap content, then
keeps Mandarin Han characters. Evaluation resets at each original speaker turn.

The repository does not redistribute the source transcripts. Supply a directory
containing the 50 official or archived official HTML transcript pages:

```powershell
npm run report:zhtw:conversation -- --corpus-dir C:\path\to\nccu-official-50
```

Use `--check` when evaluating a proposed ranker. The command exits unsuccessfully
if efficiency fails to improve by 5%, a held-out fold is unstable, character
coverage falls by more than 0.25 percentage point, or complete-turn reachability
falls by more than 1.5 points.

## Observability rules

The primary comparison:

- uses only the first suggestion page;
- never selects More;
- never intentionally traverses a one-symbol-per-glyph phrase abbreviation;
- accepts a phrase only when it is already visible during normal single-glyph
  Zhuyin composition;
- uses one fixed single-glyph pronunciation chosen independently of UI rank; and
- splits by complete conversation into five balanced ten-conversation folds.

The simulator still represents an opportunity ceiling because it assumes every
matching visible suggestion is recognized. User recognition and scanning time
require separate validation.

## Current decision

The initial unrestricted first-symbol reranker was rejected because it changed
too many positions and had no explicit stability budget. The accepted candidate
is deliberately bounded:

- at most two promotions after a single initial symbol;
- only the established four-column layout with the complete direct Zhuyin board
  is changed;
- no changes after later Zhuyin symbols or in context, repair, or paging logic;
- no phonetic continuation displacement;
- every one-symbol last-chance glyph remains protected;
- candidates require at least 20 observations in at least five training
  conversations; and
- promoted utility must be at least four times the displaced candidate's.

Utility is corpus token count multiplied by the selections avoided versus
composing the same output from normally reachable glyphs. The thresholds are
global; there are no label-specific promotions or exceptions.

Evidence is attached only to each label's source-ranked canonical first-symbol
path. An orthographic count therefore cannot promote a homograph under a rarer
alternate pronunciation.

Raw first-page coverage is not treated as equally valuable for every glyph. A
less useful glyph may move when it retains a longer normal composition path.
The benchmark therefore uses small explicit regression budgets while requiring
a much larger and fold-consistent efficiency improvement.

On this corpus, the held-out candidate improves character coverage from 95.91%
to 97.60%, complete-turn reachability from 66.91% to 78.03%, and selections per
covered character from 2.465 to 2.211 (10.29% fewer). All five held-out folds
improve on both coverage and selection efficiency.

## Known limitation

The transcript is orthographic, not pronunciation-annotated. The benchmark uses
the highest-source-frequency single-glyph reading and reports the policy in its
JSON output. Ambiguous readings require a separately versioned pronunciation
source before this can be treated as a phonetic gold standard. The 50
conversations are also one corpus domain, so they support this conservative
policy but not progressively looser reranking without independent validation.
