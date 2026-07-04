# Multilingual And Symbol-Set Design

Generated: 2026-07-03

## Principle

Language support should be profile-based, not a single translated board. A language profile owns its own layout, timing defaults, tokenizer, prediction dictionary, message spacing rules, speech voice, and display conventions.

```text
LanguageProfile
  id
  displayName
  writingSystem
  boardConfig
  suggestionProvider
  tokenizer
  messageComposer
  speechConfig
  symbolSet
```

The core should continue to expose platform-independent scanner and message rules, but those rules need profile hooks where languages differ.

The first version should be easy to switch in helper configuration: a `Language/Profile` selector should choose the active profile and load its board, suggestions, message-composition rules, and speech locale. The selector should not require a helper to manually paste layout text unless they want advanced customization.

## Isolation Rule

Languages must be developed as independent profiles. A change to Taiwan Mandarin must not mutate English defaults, and a change to graphical symbols must not mutate either text language.

Recommended source layout:

```text
packages/aac-core/src/
  scanner.js                 shared row/column scanning
  board.js                   shared board chunking and validation
  message.js                 shared message history, undo, delete, clear
  profiles/
    en-US/
      profile.js             English config and composition
      symbols.js             English board symbols
      dictionary.js          English suggestions
      tests.js               English profile tests
    zh-TW/
      profile.js             Taiwan Mandarin config and composition
      symbols.js             Taiwan Mandarin board symbols
      dictionary.js          Taiwan Mandarin suggestions
      tests.js               Taiwan Mandarin profile tests
    symbols-basic/
      profile.js             graphical symbol profile config
      symbols.js             symbol metadata
      tests.js               symbol profile tests
```

Current code is not split this way yet. When implementing language support, first extract the current English defaults into an `en-US` profile, then add `zh-TW` beside it. Do not add Mandarin words to the English dictionary as an interim shortcut.

## Shared Core Versus Profile Code

Shared core should own:

- scan state machine
- row/column traversal
- selected-row locking
- input latency compensation
- history, undo, delete, clear
- generic board validation
- generic config migration shell
- profile loading and profile selection

Profile code should own:

- default rows and columns
- default scan timing if the language/profile needs it
- tile labels, output text, and spoken text
- tokenizer
- message composition rules
- spacing or no-spacing behavior
- suggestion dictionary
- suggestion ranking
- punctuation rules
- speech locale
- symbol assets and category metadata

If a function needs to know whether spaces are inserted between words, it belongs in the profile layer. If a function only knows that a selected tile produced a message update, it can stay shared.

## Why Profiles Need Independent Row/Column/Speed

Row/column scanning cost depends on symbol frequency and message strategy. English, Taiwan Mandarin, and graphical symbols have different units:

- English: letters, whole words, and short phrases; spaces are meaningful and frequent.
- Taiwan Mandarin: characters, words, Zhuyin/Bopomofo input, common phrases, and punctuation; written text normally does not use spaces between words.
- Graphical symbols: meanings are represented by icons or categories; scan layout may prioritize needs/actions/categories rather than text frequency.

Therefore each profile can have:

- different column count
- different row ordering
- different scan speed and first-item hold
- different auto-spacing behavior
- different suggestion row strategy
- different speech voice/language

## Taiwan Mandarin Profile

### AAC Guidance Anchor

The `zh-TW` profile should be judged as an AAC language system, not as a translated keyboard. ASHA's AAC Practice Portal describes AAC systems as integrated combinations of symbols, access methods, strategies, and speech-generating output, and emphasizes that systems should be flexible as a person's language and physical needs change over time:

```text
https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/
```

Two ASHA points are especially relevant for Taiwan Mandarin:

- AAC assessment and intervention should be culturally and linguistically relevant. A Taiwan Mandarin user needs vocabulary, speech output, and literacy access that fit the language used at home and in the community, otherwise carryover and participation are limited.
- AAC systems may use alphabet-based methods with word or phrase prediction, single-meaning messages, semantic compaction, or combinations of these. For `zh-TW`, this supports a hybrid design: high-value phrase/core vocabulary for speed, plus Zhuyin/Bopomofo composition for novel text.

Thanks to ASHA for maintaining public clinical guidance that helps keep this design centered on functional communication rather than just software mechanics.

Recommended first Taiwan Mandarin profile:

- Display text: Traditional Chinese.
- Speech: Android TTS locale `zh-TW` where available.
- Message composition: no automatic spaces between Chinese words.
- Board strategy:
  - static board exposes dictionary-backed starting Zhuyin/Bopomofo symbols and a few essential controls
  - Chinese glyphs and phrases are selected from suggestion rows, not hidden pages
  - `更多` pages the suggestion rows only
- Suggestions:
  - 4 columns by 3 rows for `zh-TW` candidates
  - candidates come from the `zh-TW` frequency dictionary and include Zhuyin readings
  - exact phonetic matches appear before broader ranked backfill
  - candidate tiles may replace the typed Zhuyin suffix before inserting the glyph or phrase

The default `zh-TW` board should be intentionally minimalist, but it still needs a learnable route to words that are not visible on the first page. AAC output does not need to be perfectly grammatical or lexically exact to be successful. A user may choose an approximate word, a body-position word, or a nearby need word to communicate intent. The design should optimize for fast, high-information selections and predictable recovery from missing vocabulary.

### Dictionary Source Direction

The `zh-TW` dictionary should be expanded by importing better sources, not by hand-promoting or hand-removing individual phrases for specific Zhuyin keys. Per-symbol tuning is too likely to overfit the developer's examples and create new sparse or irrelevant pages elsewhere.

Preferred source direction:

- Use Taiwan Ministry of Education Mandarin dictionary data as the Taiwan-localized source for Traditional Chinese entries and pronunciations where licensing permits: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html
- Use a separate frequency/ranking source to trim suggestions to bounded AAC rows. Dictionary membership and AAC ranking should remain separate decisions.
- Treat CC-CEDICT as a broad fallback source only after license and attribution requirements are satisfied; it is useful and downloadable, but it is not Taiwan-specific and uses Pinyin rather than Zhuyin: https://cc-cedict.org/wiki/
- Generate Zhuyin keys mechanically from source pronunciations, then run systematic coverage tests over all imported keys instead of spot-testing examples.

### Scanning Timing

Default scanning should be conservative for disability access. ASHA describes AAC systems as combinations of symbols, selection techniques, and strategies that must fit an individual's physical, visual, cognitive, language, and communication needs. In row/column switch scanning, speed is not just a preference: it affects fatigue, timing errors, and whether the first cell in a selected row feels reachable.

Default timing:

```text
scan interval: 1300 ms
row-selected transition pause: 450 ms
first-cell hold: 1700 ms
```

Helpers can still customize faster timing for a specific user. The default should favor lower effort, lower timing precision, and stamina over maximum throughput.

### Current Simple Version

The current `zh-TW` version should not behave like a separate Chinese input method. It should keep the same mental model as English:

- no auto-space
- 4 columns by default; add rows before adding columns so labels remain readable and cell selection stays predictable
- same scanner mechanics as English
- same input adapters as English
- `zh-TW` TTS locale where available
- three suggestion rows for ranked glyph/phrase candidates
- dictionary-backed starting Zhuyin symbols on the static board
- valid following Zhuyin symbols in suggestion rows
- no second-layer or third-layer Zhuyin pages

Static rows expose visible input symbols and controls. They should not expose standalone finals that have no dictionary-backed first-symbol entries:

```text
是 / 不是 / 要 / 不要
ㄅ / ㄆ / ㄇ / ㄈ
ㄉ / ㄊ / ㄋ / ㄌ
...
ㄗ / ㄘ / ㄙ / ㄧ
ㄨ / ㄩ / 更多 / 說
刪 / 清除
```

Suggestion rows show ranked glyphs and phrases:

```text
input: ㄅ
suggestions: 不要 / 幫忙 / ㄧ / ㄨ / ㄚ / ...

input: ㄅㄧ
suggestions: 不要 / 不要動 / ... / 更多
select 不要 -> delete ㄅㄧ invisibly, then insert 不要
message: 不要
```

The hidden delete behavior is data on the candidate tile, not a visible symbol. Replacement suggestions should have distinct styling so helpers understand that they will replace the typed Zhuyin suffix.

Labels should be short words or compact phrases, not full polite sentences. For example, `喝水` is usually a better tile label than `我要喝水`; the user can still communicate intent without spending display space and scan time on `我要`.

Punctuation such as `。` is deliberately omitted from the default board because it consumes scan time without adding much communicative value.

### Suggestion Rows And More

The `zh-TW` board uses suggestion rows as the expansion area. It does not open category pages or a separate `注音` mode.

```text
row 1: ranked candidates
row 2: ranked candidates
row 3: ranked candidates, with 更多 in the last cell when another page exists
static board rows: unchanged Zhuyin symbols and controls
```

`更多` advances only the suggestion rows. It must not change the message, scanner mechanics, static board, or input mode. Page count is capped so scanning remains bounded.

Candidate commit rule:

```text
ㄅ selected -> message ㄅ
ㄧ selected -> message ㄅㄧ
不要 selected -> replace last 2 Zhuyin symbols, message 不要
```

This keeps one consistent behavior: every visible input symbol appends to the message, and every suggestion commits text. Chinese suggestions are special only because they may carry an invisible replacement length.

### Dictionary Requirements

The `zh-TW` dictionary must not be an ad hoc list of UI phrases. Each glyph or phrase entry needs:

```text
label
output
one or more Zhuyin keys
frequency or frequency rank
```

Ranking should use an existing solid Traditional Chinese/Taiwan Mandarin source where available, then AAC-specific ordering only as a transparent profile layer. The starter implementation keeps the existing phrase set but wraps it in ranked metadata and readings; the next data pass should replace the seed with an imported corpus-backed dictionary rather than hand-editing phrase additions.

### Zhuyin Suggestion Design

Zhuyin/Bopomofo is still the right literacy bridge for Taiwan Mandarin because it is used to teach pronunciation and as a common phonetic input method in Taiwan. However, a phone-style or textbook-style Zhuyin input method is not automatically a good AAC access method. The first implementation failed because it required too many abstract steps and exposed confusing controls such as `清音`; it also showed candidates that did not match the entered sound well enough.

The practical `zh-TW` path is direct visible input plus prediction:

```text
choose ㄅ
  -> message contains ㄅ
  -> suggestion rows show common ㄅ candidates, e.g. 幫忙 / 不是 / 不要
choose ㄧ
  -> message contains ㄅㄧ
  -> suggestion rows show matching phrase shortcuts, e.g. 不要
choose 不要
  -> message becomes 不要
```

The user is not asked to fully spell arbitrary Mandarin. Zhuyin acts as a predictable index into a small, high-value vocabulary. Tones and full finals are not mandatory. Candidate lists must be filtered by the current trailing Zhuyin buffer, with exact or shorter matching readings first.

The display should favor:

```text
matching candidates first
then broader useful backfill candidates
then 更多 when the capped next page is useful
```

For example, `ㄧㄡ` should not show only `右`; it should keep `右` near the front while also offering useful targets such as `有`, `又`, `有沒有`, and broader high-value choices. Likewise, phrase-initial shortcuts such as `ㄅㄧ` should surface `不要` without requiring the user to fully spell `ㄅㄨㄧㄠ`.

Candidate ranking should prefer useful AAC words and compact phrase targets over isolated characters when the Zhuyin prefix matches a common communicative intent. For example, after a `ㄨ` path, candidates such as `我`, `喝水`, `吃飯`, and `廁所` are more useful than a large homophone list.

Design constraints:

- The main phrase board remains the emergency surface.
- Common static symbols keep stable positions.
- Suggestion rows must not become empty dead ends. Each trailing Zhuyin buffer should expose useful candidates or ranked backfill before adding blank space.
- Mandarin output does not insert automatic spaces.
- The phonetic prefix is visible message text until a candidate replaces it.
- Prediction dictionaries belong to the `zh-TW` profile, not to English defaults.
- Inexact expression is acceptable. A small board that lets the user communicate roughly is better than a complete input method that is too slow to use.

## Graphical Symbols Profile

Graphical symbols should be treated as their own symbol set, not as decoration on an English board.

Each symbol tile should have:

```text
label: short text fallback
image: optional symbol asset
spokenText: what TTS says
outputText: what appears in the message
category: need/action/person/place/feeling/object
```

Board strategy:

- Keep categories stable.
- Put urgent and high-frequency needs first.
- Use symbols for recognition, but keep text fallback for helpers and tests.
- Allow a profile to output text, speak speech-only messages, or both.

## Data Format Direction

Move from one global `symbols` text area toward profile files:

```json
{
  "id": "zh-TW",
  "displayName": "Taiwan Mandarin",
  "columns": 4,
  "scanIntervalMs": 1300,
  "autoSpace": "none",
  "speechLocale": "zh-TW",
  "symbols": [],
  "dictionary": []
}
```

For compatibility, the existing custom text areas can remain as an advanced editor for the active profile.

Profile file requirements:

- Profiles must be serializable JSON-compatible data plus small pure functions.
- A profile must not import another profile's mutable arrays.
- Shared helpers may be imported from common core modules.
- Tests must assert that loading one profile does not modify another.
- Profile migration must preserve caregiver customizations for that profile only.

Example profile shape:

```js
export const zhTwProfile = {
  id: "zh-TW",
  displayName: "Taiwan Mandarin",
  writingSystem: "traditional-chinese",
  columns: 4,
  scanIntervalMs: 1300,
  firstCellPauseMs: 1700,
  autoSpace: "none",
  speechLocale: "zh-TW",
  composeMessage,
  suggestTiles,
  symbols,
  dictionary
};
```

## Implementation Plan

1. Extract the current English defaults into an `en-US` profile without changing behavior.
2. Add profile fields to `createBoardConfig`.
3. Add a helper configuration selector for the active profile.
4. Extract message composition into profile-aware functions: English auto-space, Mandarin no-space, symbol output rules.
5. Replace `DefaultSuggestionDictionary` with active-profile dictionaries.
6. Add `zh-TW` as an independent phrase-first profile.
7. Add `symbols-basic` as an independent graphical-symbol profile.
8. Add tests for each profile:
   - row/column layout is stable
   - auto-spacing differs by language
   - suggestions use the active profile
   - speech locale is passed to the platform shell
   - switching profiles does not mutate another profile
   - caregiver customizations are scoped to the active profile

## Required Tests Before Any Language PR Is Accepted

Each language/profile change must include:

- `en-US` regression test proving English still auto-spaces words.
- `zh-TW` test proving Mandarin does not auto-space words.
- profile switch test proving config can switch profile without manual layout paste.
- isolation test proving profile arrays are not shared by mutable reference.
- browser E2E or screenshot check if the labels are longer/wider than English.
- APK smoke test if native speech locale or Android storage is touched.

## AI Agent Warning

Do not implement Mandarin by simply adding Chinese words to the English suggestion dictionary. Do not implement graphical symbols by only adding emoji-like labels. Profiles must own composition, prediction, layout, and speech behavior.

When unsure, preserve English behavior and add a new profile-specific test before changing shared code.
