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

## Implementation Plan

1. Add profile fields to `createBoardConfig`.
2. Extract message composition into profile-aware functions: English auto-space, Mandarin no-space, symbol output rules.
3. Replace `DefaultSuggestionDictionary` with profile dictionaries.
4. Add profile selector in helper configuration.
5. Add `en-US`, `zh-TW`, and `symbols-basic` starter profiles.
6. Add tests for each profile:
   - row/column layout is stable
   - auto-spacing differs by language
   - suggestions use the active profile
   - speech locale is passed to the platform shell

## AI Agent Warning

Do not implement Mandarin by simply adding Chinese words to the English suggestion dictionary. Do not implement graphical symbols by only adding emoji-like labels. Profiles must own composition, prediction, layout, and speech behavior.
