import test from "node:test";
import assert from "node:assert/strict";
import {
  CurrentConfigVersion,
  DefaultScanIntervalMs,
  DefaultSuggestionDictionary,
  DefaultTiles,
  LegacyAlphabetDefaultTiles,
  LegacyFirstCellPauseMsV6,
  LegacyFrequencyDefaultTilesV3,
  LegacySuggestionDictionaryV6,
  TileAction,
  boardRows,
  createBoardConfig,
  loadFirstCellPauseForConfig,
  loadSuggestionDictionaryForConfig,
  loadSymbolsForConfig,
  parseSymbols,
  serializeDictionary,
  serializeSymbols,
  suggestTiles,
  suggestionRow,
  tile
} from "../src/index.js";

test("default tiles include the full alphabet", () => {
  const labels = new Set(DefaultTiles.map((candidate) => candidate.label));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    assert.equal(labels.has(letter), true, `missing ${letter}`);
  }
});

test("default spelling letters start with common English frequency order", () => {
  const spellingStart = DefaultTiles.findIndex((candidate) => candidate.action === TileAction.Space) + 1;
  const letters = DefaultTiles.slice(spellingStart)
    .filter((candidate) => candidate.action === TileAction.Append && /^[A-Z]$/.test(candidate.label))
    .map((candidate) => candidate.label);
  assert.deepEqual(letters.slice(0, 8), ["E", "T", "A", "O", "I", "N", "S", "R"]);
});

test("legacy default layouts migrate to current frequency order", () => {
  for (const legacy of [LegacyAlphabetDefaultTiles, LegacyFrequencyDefaultTilesV3]) {
    const symbols = loadSymbolsForConfig(serializeSymbols(legacy), 3);
    const spellingStart = symbols.findIndex((candidate) => candidate.action === TileAction.Space) + 1;
    const letters = symbols.slice(spellingStart)
      .filter((candidate) => candidate.action === TileAction.Append && /^[A-Z]$/.test(candidate.label))
      .map((candidate) => candidate.label);
    assert.deepEqual(letters.slice(0, 8), ["E", "T", "A", "O", "I", "N", "S", "R"]);
  }
});

test("current-version custom layout is preserved", () => {
  const symbols = loadSymbolsForConfig(serializeSymbols(LegacyAlphabetDefaultTiles), CurrentConfigVersion);
  const spellingStart = symbols.findIndex((candidate) => candidate.action === TileAction.Space) + 1;
  const letters = symbols.slice(spellingStart)
    .filter((candidate) => candidate.action === TileAction.Append && /^[A-Z]$/.test(candidate.label))
    .map((candidate) => candidate.label);
  assert.deepEqual(letters.slice(0, 8), ["A", "B", "C", "D", "E", "F", "G", "H"]);
});

test("parser supports custom words and actions", () => {
  const symbols = parseSymbols(`
    WATCH=watch
    SPC=<space>
    DEL=<delete>
    UNDO=<undo>
    SAY=<speak>
    CLR=<clear>
  `);
  assert.equal(symbols.length, 6);
  assert.deepEqual(symbols[0], tile("WATCH", "watch"));
  assert.equal(symbols[1].action, TileAction.Space);
  assert.equal(symbols[2].action, TileAction.Backspace);
  assert.equal(symbols[3].action, TileAction.Undo);
  assert.equal(symbols[4].action, TileAction.Speak);
  assert.equal(symbols[5].action, TileAction.Clear);
});

test("board chunks symbols by column count after the fixed suggestion row", () => {
  const rows = boardRows(
    createBoardConfig({
      columns: 3,
      suggestionDictionary: [],
      symbols: [tile("A"), tile("B"), tile("C"), tile("D")]
    })
  );
  assert.deepEqual(rows.slice(1).map((row) => row.map((candidate) => candidate.label)), [["A", "B", "C"], ["D"]]);
});

test("suggestions complete current partial words", () => {
  const suggestions = suggestTiles("wa", DefaultSuggestionDictionary, 4).map((candidate) => candidate.label);
  assert.equal(suggestions.includes("WANT"), true);
  assert.equal(suggestions.includes("WATER"), true);
  assert.equal(suggestions.includes("WATCH"), true);
});

test("expanded default vocabulary includes movie", () => {
  const suggestions = suggestTiles("movi", DefaultSuggestionDictionary, 3).map((candidate) => candidate.label);
  assert.equal(suggestions.includes("MOVIE"), true);
});

test("expanded default vocabulary includes drink", () => {
  const suggestions = suggestTiles("dri", DefaultSuggestionDictionary, 3).map((candidate) => candidate.label);
  assert.equal(suggestions.includes("DRINK"), true);
});

test("suggestions prefer actions after pronouns", () => {
  const suggestions = suggestTiles("I ", DefaultSuggestionDictionary, 4).map((candidate) => candidate.label);
  assert.equal(suggestions.includes("WANT"), true);
  assert.equal(suggestions.includes("NEED"), true);
});

test("suggestion row keeps stable width with space and fallback letters", () => {
  const row = suggestionRow("want", DefaultSuggestionDictionary, 4);
  assert.deepEqual(row.map((candidate) => candidate.label), ["SPC", "E", "T", "A"]);
});

test("exact current word is not suggested again", () => {
  const suggestions = suggestTiles("want", DefaultSuggestionDictionary, 3);
  assert.equal(suggestions.some((candidate) => candidate.label === "WANT"), false);
});

test("suggestions prefer needs after want boundary", () => {
  const suggestions = suggestTiles("want ", DefaultSuggestionDictionary, 3).map((candidate) => candidate.label);
  assert.equal(suggestions.length, 3);
  assert.equal(suggestions.includes("WATER"), true);
  assert.equal(suggestions.includes("FOOD"), true);
});

test("suggestion row can offer undo without changing width", () => {
  const row = suggestionRow("wa", DefaultSuggestionDictionary, 4, true);
  assert.equal(row.length, 4);
  assert.equal(row[0].label, "UNDO");
  assert.equal(row[0].action, TileAction.Undo);
  assert.equal(row.map((candidate) => candidate.label).includes("SPC"), true);
});

test("legacy suggestion dictionary migrates but custom dictionary is preserved", () => {
  const migrated = loadSuggestionDictionaryForConfig(serializeDictionary(LegacySuggestionDictionaryV6), 6);
  assert.equal(migrated.map((candidate) => candidate.label).includes("MOVIE"), true);

  const custom = [tile("CUSTOM", "custom")];
  assert.deepEqual(loadSuggestionDictionaryForConfig(serializeDictionary(custom), 6), custom);
});

test("first-cell hold migration preserves custom values", () => {
  assert.equal(loadFirstCellPauseForConfig(LegacyFirstCellPauseMsV6, 6), DefaultScanIntervalMs);
  assert.equal(loadFirstCellPauseForConfig(1800, 6), 1800);
});
