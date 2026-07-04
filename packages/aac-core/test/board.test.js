import test from "node:test";
import assert from "node:assert/strict";
import {
  CurrentConfigVersion,
  DefaultFirstCellPauseMs,
  DefaultScanIntervalMs,
  DefaultSuggestionDictionary,
  DefaultTiles,
  DefaultTransitionPauseMs,
  LanguageProfiles,
  LegacyAlphabetDefaultTiles,
  LegacyFirstCellPauseMsV6,
  LegacyFrequencyDefaultTilesV3,
  LegacySuggestionDictionaryV6,
  TileAction,
  ZhuyinInputSymbols,
  ZhuyinStaticInputSymbols,
  ZhTwFrequencyDictionary,
  applyTile,
  boardRows,
  createBoardConfig,
  loadFirstCellPauseForConfig,
  loadProfileSuggestionDictionaryForConfig,
  loadProfileSymbolsForConfig,
  loadScanIntervalForConfig,
  loadSuggestionDictionaryForConfig,
  loadSymbolsForConfig,
  loadTransitionPauseForConfig,
  parseSymbols,
  serializeDictionary,
  serializeSymbols,
  speechLabelForTile,
  suggestTiles,
  suggestionRow,
  tile,
  updateMessage
} from "../src/index.js";
import { ZhTwChewingDictionaryEntries } from "../src/data/zh-tw-chewing.generated.js";

const SuppressedZhTwSuggestionLabelsForTest = new Set(["是不是", "要不要"]);
const suggestionTilesAcrossPagesCache = new Map();
let zhTwPrefixStatsCache = null;

function findTile(rows, label) {
  const candidate = rows.flat().find((item) => item.label === label);
  assert.ok(candidate, `missing tile ${label}`);
  return candidate;
}

function findActionTile(rows, label, action) {
  const candidate = rows.flat().find((item) => item.label === label && item.action === action);
  assert.ok(candidate, `missing ${action} tile ${label}`);
  return candidate;
}

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

test("parser preserves category and Zhuyin group actions for editable layouts", () => {
  const symbols = parseSymbols(`
需要=<category:needs>
ㄅㄆㄇㄈ=<zhuyin-group:labial>
ㄅ=<zhuyin-symbol:ㄅ>
  `);

  assert.equal(symbols[0].action, TileAction.OpenCategory);
  assert.equal(symbols[1].action, TileAction.ZhuyinGroup);
  assert.equal(symbols[1].output, "labial");
  assert.equal(symbols[2].action, TileAction.ZhuyinSymbol);
  assert.equal(symbols[2].output, "ㄅ");
  assert.equal(serializeSymbols(symbols), [
    "需要=<category:needs>",
    "ㄅㄆㄇㄈ=<zhuyin-group:labial>",
    "ㄅ=<zhuyin-symbol:ㄅ>"
  ].join("\n"));
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

test("default suggestion dictionary is sourced from broad ranked vocabulary lists", () => {
  assert.ok(DefaultSuggestionDictionary.length > 150);
  for (const label of ["THE", "TIME", "PEOPLE", "BATHROOM", "VOICE"]) {
    assert.equal(DefaultSuggestionDictionary.some((candidate) => candidate.label === label), true);
  }
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

test("old built-in zh-TW board migrates to direct static Zhuyin symbols", () => {
  const oldZhTwBoard = [
    tile("是"),
    tile("不是"),
    tile("要"),
    tile("不要"),
    tile("我"),
    tile("你"),
    tile("幫忙"),
    tile("痛"),
    tile("喝水"),
    tile("吃飯"),
    tile("廁所"),
    tile("休息"),
    tile("熱"),
    tile("冷"),
    tile("累"),
    tile("睡覺"),
    tile("家人"),
    tile("護理師"),
    tile("醫生"),
    tile("藥"),
    tile("停"),
    tile("注音", "zhuyin", TileAction.EnterMode),
    tile("說", "SAY", TileAction.Speak),
    tile("刪", "DEL", TileAction.Backspace),
    tile("清除", "CLR", TileAction.Clear)
  ];

  const migrated = loadProfileSymbolsForConfig(serializeSymbols(oldZhTwBoard), 8, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.equal(labels.includes("ㄅ"), true);
  assert.equal(labels.includes("ㄧ"), true);
  assert.equal(labels.includes("ㄩ"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("ㄡ"), false);
  assert.equal(labels.includes("注音"), false);
  assert.equal(labels.includes("喝水"), false);
});

test("custom zh-TW board symbols are preserved during migration", () => {
  const custom = [tile("自訂"), tile("注音", "zhuyin", TileAction.EnterMode)];

  assert.deepEqual(loadProfileSymbolsForConfig(serializeSymbols(custom), 8, "zh-TW"), custom);
});

test("old built-in zh-TW dictionary migrates to short AAC labels", () => {
  const oldDictionary = [
    tile("我要喝水"),
    tile("我要吃飯"),
    tile("我要上廁所"),
    tile("我需要幫忙"),
    tile("我很痛"),
    tile("叫護理師")
  ];
  const migrated = loadProfileSuggestionDictionaryForConfig(serializeDictionary(oldDictionary), 8, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.equal(labels.includes("喝水"), true);
  assert.equal(labels.includes("廁所"), true);
  assert.equal(labels.includes("我要喝水"), false);
});

test("default scanning timing favors slower low-fatigue access", () => {
  const config = createBoardConfig();

  assert.equal(config.scanIntervalMs, 1300);
  assert.equal(config.transitionPauseMs, 0);
  assert.equal(config.firstCellPauseMs, 1700);
  assert.equal(config.firstCellPauseMs > config.scanIntervalMs, true);
});

test("legacy default scan timing migrates while custom values are preserved", () => {
  assert.equal(loadScanIntervalForConfig(900, 10), DefaultScanIntervalMs);
  assert.equal(loadTransitionPauseForConfig(0, 10), DefaultTransitionPauseMs);
  assert.equal(loadTransitionPauseForConfig(450, 11), DefaultTransitionPauseMs);
  assert.equal(loadFirstCellPauseForConfig(900, 10), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(LegacyFirstCellPauseMsV6, 6), DefaultFirstCellPauseMs);
  assert.equal(loadScanIntervalForConfig(1800, 10), 1800);
  assert.equal(loadTransitionPauseForConfig(850, 10), 850);
  assert.equal(loadFirstCellPauseForConfig(1800, 6), 1800);
});

test("English profile remains the default and auto-spaces words", () => {
  const config = createBoardConfig();

  assert.equal(config.profileId, "en-US");
  assert.equal(updateMessage("", tile("YES", "yes"), config), "yes ");
  assert.equal(updateMessage("yes ", tile("WATER", "water"), config), "yes water ");
});

test("zh-TW profile uses an independent direct Zhuyin board", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = config.symbols.map((candidate) => candidate.label);

  assert.equal(config.profileId, "zh-TW");
  assert.equal(config.speechLocale, "zh-TW");
  assert.equal(labels.includes("ㄅ"), true);
  assert.equal(labels.includes("ㄧ"), true);
  assert.equal(labels.includes("ㄩ"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("ㄦ"), false);
  assert.equal(labels.includes("注音"), false);
});

test("zh-TW static core row avoids redundant yes-no pairs", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const staticCoreLabels = boardRows(config).slice(4, 5).flat().map((candidate) => candidate.label);

  assert.deepEqual(staticCoreLabels, ["是", "不", "幫忙", "痛"]);
  assert.equal(staticCoreLabels.includes("不是"), false);
  assert.equal(staticCoreLabels.includes("不要"), false);
  assert.equal(staticCoreLabels.includes("要"), false);
});

test("zh-TW profile appends without automatic spaces", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });

  assert.equal(updateMessage("", tile("我"), config), "我");
  assert.equal(updateMessage("我", tile("要"), config), "我要");
  assert.equal(updateMessage("我要", tile("喝水"), config), "我要喝水");
});

test("zh-TW suggestions use four rows without a space tile", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });

  const initialRows = boardRows(config).slice(0, 4);
  assert.equal(initialRows.length, 4);
  assert.equal(initialRows.flat().some((candidate) => candidate.label === "SPC"), false);
  assert.equal(initialRows.flat().some((candidate) => candidate.label === "不"), false);
  assert.equal(initialRows.flat().some((candidate) => candidate.label === "不要"), false);
  assert.equal(initialRows.flat().some((candidate) => candidate.label === "幫忙"), false);
  assert.equal(initialRows.flat().some((candidate) => candidate.label === "痛"), false);

  const phraseRows = boardRows(config, "ㄏ", false, {}).slice(0, 4);
  assert.equal(phraseRows.flat().some((candidate) => candidate.label === "SPC"), false);
  assert.equal(phraseRows.flat().some((candidate) => candidate.action === TileAction.CommitCandidate), true);
  assert.equal(phraseRows.flat().some((candidate) => candidate.action === TileAction.Append), true);
});

test("zh-TW function labels are localized in runtime rows and persisted defaults", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rowsWithUndo = boardRows(config, "ㄅ", true).slice(0, 4).flat();

  assert.equal(rowsWithUndo.some((candidate) => candidate.label === "\u5fa9\u539f" && candidate.action === TileAction.Undo), true);
  assert.equal(rowsWithUndo.some((candidate) => candidate.label === "UNDO"), false);

  const serializedSymbols = serializeSymbols(config.symbols);
  assert.equal(serializedSymbols.includes("\u66f4\u591a=<more>"), true);
  assert.equal(serializedSymbols.includes("MORE=<more>"), false);
});

test("zh-TW MVP board with English MORE migrates to localized function label", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const oldMvpSymbols = config.symbols.map((candidate) =>
    candidate.action === TileAction.MoreSuggestions ? { ...candidate, label: "MORE" } : candidate
  );
  const migrated = loadProfileSymbolsForConfig(serializeSymbols(oldMvpSymbols), 10, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.equal(labels.includes("\u66f4\u591a"), true);
  assert.equal(labels.includes("MORE"), false);
});

test("zh-TW default board keeps direct Zhuyin symbols available without old pages", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = boardRows(config).flat().map((candidate) => candidate.label);

  assert.equal(labels.includes("ㄅ"), true);
  assert.equal(labels.includes("ㄧ"), true);
  assert.equal(labels.includes("ㄩ"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("ㄡ"), false);
  assert.equal(labels.includes("ㄅㄆㄇㄈ"), false);
  assert.equal(labels.includes("注音"), false);
  assert.equal(labels.includes("。"), false);
  assert.equal(labels.includes("謝謝"), false);
});

test("zh-TW direct Zhuyin input appends symbols, then replacement suggestions commit glyphs", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  let result = applyTile("", [], findActionTile(boardRows(config), "ㄅ", TileAction.Append), config, {});
  result = applyTile(result.message, result.messageHistory, findActionTile(boardRows(config, result.message, true, result), "ㄧ", TileAction.Append), config, result);

  assert.equal(result.message, "ㄅㄧ");

  const candidate = findActionTile(boardRows(config, result.message, true, result), "不要", TileAction.CommitCandidate);
  assert.equal(candidate.replaceLength, 2);

  result = applyTile(result.message, result.messageHistory, candidate, config, result);
  assert.equal(result.message, "不要");
  assert.deepEqual(result.messageHistory, ["", "ㄅ", "ㄅㄧ"]);
});

test("zh-TW suggestion rows offer valid following Zhuyin symbols", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "ㄅ", true, {});
  const following = findActionTile(rows, "ㄚ", TileAction.Append);
  let result = applyTile("ㄅ", [""], following, config, {});

  assert.equal(result.message, "ㄅㄚ");

  const candidate = findActionTile(boardRows(config, result.message, true, result), "爸", TileAction.CommitCandidate);
  assert.equal(candidate.replaceLength, 2);
  assert.equal(candidate.zhuyinKey.startsWith("ㄅㄚ"), true);
});

test("zh-TW standalone finals are not exposed as first-layer dead-end symbols", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = boardRows(config).flat().map((candidate) => candidate.label);
  const exactlessFinals = ZhuyinInputSymbols.filter((symbol) =>
    !ZhTwFrequencyDictionary.some((entry) => entry.keys.some((key) => key.startsWith(symbol)))
  );

  assert.ok(exactlessFinals.length > 0);
  for (const symbol of exactlessFinals) {
    assert.equal(labels.includes(symbol), false, `${symbol} should appear only as a valid follow-up suggestion`);
  }
});

test("zh-TW initial-only suggestions prioritize reachable phonetic continuations", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const candidates = boardRows(config, "ㄅ", false, {}).slice(0, 4).flat();

  assert.equal(candidates.some((candidate) => candidate.label === "ㄚ" && candidate.action === TileAction.Append), true);
  assert.equal(candidates.some((candidate) => candidate.label === "ㄢ" && candidate.action === TileAction.Append), true);
  assert.equal(candidates.some((candidate) => candidate.action === TileAction.CommitCandidate), true);
});

test("zh-TW phrase-initial shortcuts such as ㄅㄧ suggest 不要", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "ㄅㄧ", false, {});
  const labels = rows.slice(0, 4).flat().map((candidate) => candidate.label);
  const candidate = findActionTile(rows, "不要", TileAction.CommitCandidate);

  assert.equal(labels.includes("不要"), true);
  assert.equal(candidate.replaceLength, 2);
});

test("zh-TW sparse phonetic buffers backfill suggestion rows with useful replacements", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const visibleTargets = boardRows(config, "ㄧㄡ", false, {}).slice(0, 4).flat().filter((candidate) => candidate.action !== TileAction.Noop);
  const candidates = visibleTargets.filter((candidate) => candidate.action === TileAction.CommitCandidate);
  const labels = candidates.map((candidate) => candidate.label);

  assert.ok(visibleTargets.length >= 11);
  assert.equal(candidates.every((candidate) => candidate.replaceLength === 2), true);
  assert.equal(labels.includes("有"), true);
  assert.equal(labels.includes("又"), true);
  assert.equal(suggestionLabelsAcrossPages(config, "ㄧㄡ").includes("右"), true);
  assert.equal(suggestionLabelsAcrossPages(config, "ㄧㄡ").includes("幼"), true);
});

test("zh-TW typed buffers avoid unrelated prefix and global backfill", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = boardRows(config, "ㄇㄟ", false, {}).slice(0, 4).flat().map((candidate) => candidate.label);
  const secondPageLabels = boardRows(config, "ㄇㄟ", false, { suggestionPage: 1 }).slice(0, 4).flat().map((candidate) => candidate.label);

  assert.equal(secondPageLabels.includes("沒有"), true);
  assert.equal(labels.includes("沒"), true);
  assert.equal(labels.includes("每"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("慢"), false);
  assert.equal(labels.includes("門"), false);
  assert.equal(labels.includes("媽媽"), false);
  assert.equal(labels.includes("要"), false);
  assert.equal(labels.includes("不要"), false);
});

test("zh-TW continuation suggestions include common Zhuyin finals beyond current dictionary prefixes", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const afterWu = boardRows(config, "ㄨ", false, {}).slice(0, 4).flat().map((candidate) => candidate.label);
  const afterWei = boardRows(config, "ㄨㄟ", false, {}).slice(0, 4).flat().map((candidate) => candidate.label);

  assert.equal(afterWu.includes("ㄟ"), true);
  assert.equal(afterWei.includes("味"), true);
  assert.equal(afterWei.includes("未"), true);
});

test("zh-TW common full syllables have enough exact glyph candidates", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  for (const syllable of ["ㄇㄟ", "ㄨㄟ", "ㄧㄡ", "ㄒㄧㄠ"]) {
    const candidates = boardRows(config, syllable, false, {})
      .slice(0, 4)
      .flat()
      .filter((candidate) => candidate.action === TileAction.CommitCandidate && candidate.zhuyinKey === syllable);
    assert.ok(candidates.length >= 8, `${syllable} should have at least 8 exact glyph/phrase candidates, got ${candidates.map((candidate) => candidate.label).join(", ")}`);
  }
});

test("zh-TW suggestion analyzer keeps dictionary-backed pages dense and relevant", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const sparse = [];
  const irrelevant = [];
  const duplicateDefaults = [];

  for (const prefix of allZhTwDictionaryPrefixes()) {
    const firstPageTargets = visibleZhTwSuggestionTargets(config, prefix, 0);
    const allTargets = suggestionTilesAcrossPages(config, prefix, false)
      .filter((candidate) => candidate.action !== TileAction.Noop);
    const relevantTargetCount = zhTwRelevantTargetCountForPrefix(prefix);
    const expectedFirstPageDensity = Math.min(12, relevantTargetCount);

    if (firstPageTargets.length < expectedFirstPageDensity) {
      sparse.push(`${prefix}: visible=${firstPageTargets.length}, relevant=${relevantTargetCount}`);
    }

    for (const candidate of allTargets) {
      if (candidate.action === TileAction.CommitCandidate && !candidate.zhuyinKey.startsWith(prefix)) {
        irrelevant.push(`${prefix}: ${candidate.label}/${candidate.zhuyinKey}`);
      }
    }
  }

  for (const label of ["不", "幫忙", "痛"]) {
    if (visibleZhTwSuggestionTargets(config, "", 0).some((candidate) => candidate.label === label)) {
      duplicateDefaults.push(label);
    }
  }

  assert.deepEqual(sparse, []);
  assert.deepEqual(irrelevant, []);
  assert.deepEqual(duplicateDefaults, []);
});

test("zh-TW suggestion analyzer ranks exact syllable matches before longer phrase prefixes", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];

  for (const prefix of allZhTwDictionaryPrefixes()) {
    if (prefix.length <= 1) continue;
    const exactCount = zhTwExactKeyCountForPrefix(prefix);
    if (exactCount === 0) continue;

    const firstPageCommits = visibleZhTwSuggestionTargets(config, prefix, 0)
      .filter((candidate) => candidate.action === TileAction.CommitCandidate);
    const leadingCommits = firstPageCommits.slice(0, Math.min(8, exactCount));
    const nonExact = leadingCommits.find((candidate) => candidate.zhuyinKey.length !== prefix.length);
    if (nonExact) {
      failures.push(`${prefix}: ${nonExact.label}/${nonExact.zhuyinKey} before ${exactCount} exact matches`);
    }
  }

  assert.deepEqual(failures, []);
});

test("zh-TW suggestion analyzer caps IME-like candidates to three pages", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];

  for (const prefix of ["", ...allZhTwDictionaryPrefixes()]) {
    const seenPages = new Set();
    let state = { suggestionPage: 0 };

    for (let turn = 0; turn < 4; turn += 1) {
      const rows = boardRows(config, prefix, false, state).slice(0, 4).flat();
      const signature = rows.map((candidate) => `${candidate.action}:${candidate.label}:${candidate.output}`).join("|");
      seenPages.add(signature);

      const more = rows.find((candidate) => candidate.action === TileAction.MoreSuggestions);
      if (!more) break;
      state = applyTile(prefix, [], more, config, state);
    }

    if (seenPages.size > 3) {
      failures.push(`${prefix || "<base>"}: ${seenPages.size} pages`);
    }
  }

  assert.deepEqual(failures, []);
});

test("zh-TW source-backed analyzer exposes top Chewing candidates for each Zhuyin key", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];

  for (const [key, entries] of topChewingEntriesByZhuyinKey(5)) {
    if (key.length <= 1) continue;
    const labels = new Set(suggestionLabelsAcrossPages(config, key));
    const missing = entries
      .filter((entry) => !SuppressedZhTwSuggestionLabelsForTest.has(entry.label))
      .filter((entry) => !labels.has(entry.label))
      .map((entry) => `${entry.label}#${entry.sourceRank}`);
    if (missing.length > 0) {
      failures.push(`${key}: ${missing.join(", ")}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("zh-TW suppresses redundant yes-no question phrases from suggestions", () => {
  const config = createBoardConfig({
    profileId: "zh-TW",
    suggestionDictionary: [
      tile("是不是"),
      tile("要不要"),
      tile("幫忙")
    ]
  });
  const labels = boardRows(config).slice(0, 4).flat().map((candidate) => candidate.label);

  assert.equal(labels.includes("是不是"), false);
  assert.equal(labels.includes("要不要"), false);
});

test("zh-TW Zhuyin voice feedback uses Mandarin-readable names instead of raw symbols", () => {
  assert.equal(speechLabelForTile(findActionTile(boardRows(createBoardConfig({ profileId: "zh-TW" })), "ㄅ", TileAction.Append), "zh-TW"), "玻");
  assert.equal(speechLabelForTile({ label: "ㄨ", output: "ㄨ", action: TileAction.Append }, "zh-TW"), "烏");
  assert.equal(speechLabelForTile({ label: "ㄅㄆㄇㄈ", output: "labial", action: TileAction.ZhuyinGroup }, "zh-TW"), "玻 坡 摸 佛");
});

test("zh-TW 更多 pages only turn suggestion rows", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const firstPage = boardRows(config, "", false, {});
  const more = findActionTile(firstPage, "更多", TileAction.MoreSuggestions);
  const result = applyTile("", [], more, config, { suggestionPage: 0 });
  const secondPage = boardRows(config, "", false, result);

  assert.equal(result.suggestionPage, 1);
  assert.notDeepEqual(
    firstPage.slice(0, 4).flat().map((candidate) => candidate.label),
    secondPage.slice(0, 4).flat().map((candidate) => candidate.label)
  );
  assert.deepEqual(
    firstPage.slice(4).flat().map((candidate) => candidate.label),
    secondPage.slice(4).flat().map((candidate) => candidate.label)
  );
});

test("zh-TW 更多 preserves phonetic-buffer context instead of resetting to defaults", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const messages = ["ㄅ", "ㄅㄧ", "ㄧ", "ㄧㄡ", "ㄕ"];

  for (const message of messages) {
    const firstPage = boardRows(config, message, true, { suggestionPage: 0 });
    const more = firstPage.slice(0, 4).flat().find((candidate) => candidate.action === TileAction.MoreSuggestions);
    if (!more) continue;

    const result = applyTile(message, [""], more, config, { suggestionPage: 0 });
    const secondPage = boardRows(config, message, true, result);
    const suggestions = secondPage.slice(0, 4).flat().filter((candidate) => candidate.action !== TileAction.Noop);

    assert.equal(result.message, message);
    assert.equal(result.suggestionPage, 1);
    assert.equal(suggestions.some((candidate) => candidate.action === TileAction.CommitCandidate && candidate.matchType === "base"), false);
    for (const candidate of suggestions.filter((candidate) => candidate.action === TileAction.CommitCandidate)) {
      assert.equal(candidate.replaceLength, message.length, `${candidate.label} should replace ${message}, not reset to defaults`);
      assert.notEqual(candidate.matchType, "base", `${message} 更多 should not show base candidate ${candidate.label}`);
    }
  }
});

test("zh-TW frequency dictionary entries all provide Zhuyin and ranked metadata", () => {
  assert.ok(ZhTwFrequencyDictionary.length > 0);
  for (const entry of ZhTwFrequencyDictionary) {
    assert.ok(entry.keys.length > 0, `${entry.label} should include at least one Zhuyin key`);
    assert.equal(typeof entry.frequencyRank, "number");
    assert.equal(typeof entry.frequency, "number");
  }
});

test("zh-TW static Zhuyin symbols all have exact dictionary-backed suggestions", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  for (const symbol of ZhuyinStaticInputSymbols) {
    const targets = boardRows(config, symbol, false, {})
      .slice(0, 4)
      .flat()
      .filter((candidate) => candidate.action === TileAction.CommitCandidate && candidate.zhuyinKey.startsWith(symbol));
    assert.ok(targets.length > 0, `${symbol} should have at least one exact dictionary-backed candidate`);
  }
});

test("zh-TW top Chewing dictionary keys are discoverable through suggestion pages", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });

  for (const [, entries] of topChewingEntriesByZhuyinKey(3)) {
    for (const entry of entries.filter((candidate) => !SuppressedZhTwSuggestionLabelsForTest.has(candidate.label))) {
      const key = entry.key;
      if (key.length <= 1) continue;
      const labels = suggestionLabelsAcrossPages(config, key);
      assert.equal(labels.includes(entry.label), true, `${entry.label} should be discoverable from ${key}`);
    }
  }
});

test("zh-TW dictionary keys are progressively navigable by visible symbols and suggestions", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const baseLabels = new Set(boardRows(config).flat().filter((candidate) => candidate.action === TileAction.Append).map((candidate) => candidate.label));

  for (const [, entries] of topChewingEntriesByZhuyinKey(2)) {
    for (const entry of entries.filter((candidate) => !SuppressedZhTwSuggestionLabelsForTest.has(candidate.label))) {
      if (Array.from(entry.label).length !== 1) continue;
      const key = entry.key;
      if (key.length <= 1) continue;
      if (!baseLabels.has(key.at(0))) continue;

      for (let length = 1; length < key.length; length += 1) {
        const prefix = key.slice(0, length);
        const nextSymbol = key.at(length);
        const visible = suggestionTilesAcrossPages(config, prefix, true);
        const canContinue = visible.some((candidate) =>
          candidate.action === TileAction.Append &&
          candidate.output === nextSymbol
        ) || baseLabels.has(nextSymbol);
        const canAlreadyCommit = visible.some((candidate) =>
          candidate.action === TileAction.CommitCandidate &&
          candidate.label === entry.label &&
          candidate.replaceLength === prefix.length
        );

        assert.equal(
          canContinue || canAlreadyCommit,
          true,
          `${entry.label}:${key} should offer next symbol ${nextSymbol} or candidate after ${prefix}`
        );
      }
    }
  }
});

test("zh-TW suggestion rows do not show unrelated replacement backfill for source-empty standalone finals", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "ㄝ", true, {});
  const replacements = rows
    .slice(0, 4)
    .flat()
    .filter((candidate) => candidate.action === TileAction.CommitCandidate);

  assert.deepEqual(replacements, []);
});

test("language profiles do not share mutable default arrays", () => {
  assert.notEqual(LanguageProfiles["en-US"].symbols, LanguageProfiles["zh-TW"].symbols);
  assert.notEqual(LanguageProfiles["en-US"].suggestionDictionary, LanguageProfiles["zh-TW"].suggestionDictionary);
  assert.throws(() => LanguageProfiles["zh-TW"].symbols.push(tile("測試")));
});

function suggestionLabelsAcrossPages(config, message) {
  return suggestionTilesAcrossPages(config, message, false).map((candidate) => candidate.label);
}

function suggestionTilesAcrossPages(config, message, canUndo = false) {
  const cacheKey = `${config.profileId}\u0000${config.columns}\u0000${message}\u0000${canUndo}`;
  if (suggestionTilesAcrossPagesCache.has(cacheKey)) return suggestionTilesAcrossPagesCache.get(cacheKey);

  let state = { suggestionPage: 0 };
  const tiles = [];
  for (let page = 0; page < 3; page += 1) {
    const rows = boardRows(config, message, canUndo, state).slice(0, 4).flat();
    tiles.push(...rows);
    const more = rows.find((candidate) => candidate.action === TileAction.MoreSuggestions);
    if (!more) break;
    state = applyTile(message, canUndo ? [""] : [], more, config, state);
  }
  suggestionTilesAcrossPagesCache.set(cacheKey, tiles);
  return tiles;
}

function visibleZhTwSuggestionTargets(config, message, suggestionPage = 0) {
  return boardRows(config, message, false, { suggestionPage })
    .slice(0, 4)
    .flat()
    .filter((candidate) => candidate.action !== TileAction.Noop);
}

function allZhTwDictionaryPrefixes() {
  return [...new Set(
    ZhTwFrequencyDictionary.flatMap((entry) =>
      entry.keys.flatMap((key) =>
        Array.from({ length: key.length }, (_, index) => key.slice(0, index + 1))
      )
    )
  )];
}

function zhTwRelevantTargetCountForPrefix(prefix) {
  const stats = zhTwPrefixStats().get(prefix);
  if (!stats) return 0;
  const maxNextSymbols = prefix.length <= 1 ? 14 : 11;
  return stats.labels.size + Math.min(maxNextSymbols, stats.nextSymbols.size);
}

function zhTwExactKeyCountForPrefix(prefix) {
  return zhTwPrefixStats().get(prefix)?.exactLabels.size ?? 0;
}

function topChewingEntriesByZhuyinKey(limit) {
  const groups = new Map();
  for (const entry of ZhTwChewingDictionaryEntries) {
    if (!groups.has(entry.key)) groups.set(entry.key, []);
    groups.get(entry.key).push(entry);
  }
  return [...groups.entries()].map(([key, entries]) => [
    key,
    entries
      .sort((left, right) =>
        left.sourceRank - right.sourceRank ||
        left.label.length - right.label.length ||
        left.label.localeCompare(right.label, "zh-Hant")
      )
      .slice(0, limit)
  ]);
}

function zhTwPrefixStats() {
  if (zhTwPrefixStatsCache) return zhTwPrefixStatsCache;
  const stats = new Map();
  for (const entry of ZhTwFrequencyDictionary) {
    for (const key of entry.keys) {
      for (let length = 1; length <= key.length; length += 1) {
        const prefix = key.slice(0, length);
        if (!stats.has(prefix)) {
          stats.set(prefix, {
            labels: new Set(),
            exactLabels: new Set(),
            nextSymbols: new Set()
          });
        }
        const prefixStats = stats.get(prefix);
        if (!SuppressedZhTwSuggestionLabelsForTest.has(entry.label)) {
          prefixStats.labels.add(entry.label);
          if (key === prefix) prefixStats.exactLabels.add(entry.label);
        }
        const nextSymbol = key.at(length);
        if (nextSymbol) prefixStats.nextSymbols.add(nextSymbol);
      }
    }
  }
  zhTwPrefixStatsCache = stats;
  return stats;
}
