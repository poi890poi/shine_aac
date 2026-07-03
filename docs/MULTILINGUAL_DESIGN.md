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
  - first rows: urgent needs, pronouns, actions, common care phrases
  - next rows: high-value Mandarin words/phrases
  - optional spelling/input rows: Zhuyin/Bopomofo or high-frequency Chinese characters
- Suggestions:
  - phrase completion rather than English-style word completion
  - common AAC phrases such as needs, pain, position, yes/no, caregiver calls
  - caregiver-editable personal vocabulary

Open design question: whether spelling should start with Zhuyin symbols, frequent Chinese characters, or phrase/category selection. For a motor-limited AAC user, phrase/category selection likely gives higher throughput than character-by-character input.

### Low-Effort First Version

The first `zh-TW` version should not try to solve full Chinese text entry. It should be a usable AAC phrase/word board:

- no auto-space
- 4 columns by default, unless testing shows Mandarin phrase labels need fewer columns
- same scanner mechanics as English
- same input adapters as English
- `zh-TW` TTS locale where available
- phrase-first suggestions
- caregiver-editable dictionary

Starter rows should prioritize communication value over linguistic completeness:

```text
是 / 不是 / 要 / 不要
我 / 你 / 幫忙 / 痛
喝水 / 吃飯 / 廁所 / 休息
熱 / 冷 / 累 / 睡覺
上 / 下 / 左 / 右
說 / 刪 / 清除 / 空格-or-punctuation
```

This starter board is intentionally not a translation of the English board. For example, `喝水` may be more useful than separate `喝` and `水` for a first scanning profile.

### Later Mandarin Text Entry Options

Possible text-entry strategies:

- Phrase board only: fastest first version, lowest cognitive and motor burden.
- High-frequency Chinese characters: compact but can be ambiguous and slow for real messages.
- Zhuyin/Bopomofo rows: familiar in Taiwan, but many selections per character.
- Hybrid phrase + Zhuyin: likely best long-term, but only after phrase AAC is stable.

Do not start with full Zhuyin input unless a real user needs open-ended Mandarin spelling. The AAC goal is communication throughput, not reproducing a phone keyboard.

### Hybrid Phrase + Zhuyin Design

The practical `zh-TW` text-entry path should keep the first screen phrase-first and add a separate `注音` mode for novel text. This keeps urgent communication fast while still giving literate users a way to say words that are not on the board.

Recommended staged flow:

```text
Phrase board
  -> 注音
  -> initial group
  -> initial, or 無聲母
  -> final/rime
  -> tone
  -> candidate characters / words / phrases
  -> commit candidate and return to phrase board
```

Candidate ranking should prefer useful AAC phrases over isolated characters when the Zhuyin buffer matches a common communicative intent. For example, a buffer for `ㄨㄛˇㄧㄠˋ` should suggest phrases such as `我要喝水`, `我要吃飯`, `我要上廁所`, and `我要休息` before forcing character-by-character output.

Design constraints:

- The main phrase board remains the emergency surface.
- `注音` mode is opt-in and easy to leave.
- Common phrase/core targets keep stable positions.
- Mandarin output does not insert automatic spaces.
- The composition buffer is separate from committed message text until a candidate is selected.
- Prediction dictionaries belong to the `zh-TW` profile, not to English defaults.

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
  "scanIntervalMs": 900,
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
  scanIntervalMs: 900,
  firstCellPauseMs: 900,
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
