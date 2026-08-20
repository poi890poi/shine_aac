import test from "node:test";
import assert from "node:assert/strict";
import {
  CurrentConfigVersion,
  DefaultFirstCellPauseMs,
  DefaultScanPassLimit,
  DefaultScanIntervalMs,
  DefaultSuggestionDictionary,
  DefaultTiles,
  DefaultTransitionPauseMs,
  LanguageProfiles,
  LegacyAlphabetDefaultTiles,
  LegacyFirstCellPauseMsV6,
  LegacyFrequencyDefaultTilesV3,
  LegacySuggestionDictionaryV6,
  ScanMode,
  ScanTimingPresets,
  TileAction,
  ZhuyinInputSymbols,
  ZhuyinStaticInputSymbols,
  ZhTwFrequencyDictionary,
  analyzeZhTwPhoneticAccess,
  applyTile,
  applyScanTimingPreset,
  boardRows,
  createBoardConfig,
  loadFirstCellPauseForConfig,
  loadProfileColumnsForConfig,
  loadProfileSuggestionDictionaryForConfig,
  loadProfileSymbolsForConfig,
  loadScanIntervalForConfig,
  loadSuggestionDictionaryForConfig,
  loadSymbolsForConfig,
  loadTransitionPauseForConfig,
  parseSymbols,
  serializeDictionary,
  serializeSymbols,
  scanTimingPresetIdForConfig,
  selectableCount,
  speechLabelForTile,
  suggestTiles,
  suggestionRow,
  tile,
  updateMessage
} from "../src/index.js";
import {
  EnUsFrequencyEntries,
  EnUsFrequencySource
} from "../src/data/en-us-frequency.generated.js";
import { ZhTwChewingDictionaryEntries } from "../src/data/zh-tw-chewing.generated.js";
import {
  MoeZhTwGlyphFrequencyEntries,
  MoeZhTwGlyphFrequencyMetadata
} from "../src/data/zh-tw-moe-glyph-frequency.generated.js";
import {
  ZhTwSpokenEvidenceEntries,
  ZhTwSpokenEvidenceMetadata
} from "../src/data/zh-tw-spoken.generated.js";
import {
  ZhTwSensitiveSuggestionEntries,
  ZhTwSensitiveSuggestionMetadata
} from "../src/data/zh-tw-sensitive.generated.js";

const SuppressedZhTwSuggestionLabelsForTest = new Set(["是不是", "要不要"]);
const WeakIntentSoftDemotionLabelsForTest = new Set(
  ZhTwSensitiveSuggestionEntries.map((entry) => entry.label)
);
const SimplePlusSNonPluralsForTest = new Set([
  "besides", "corps", "does", "economics", "hers", "his", "its", "mathematics", "news", "ours",
  "physics", "politics", "series", "sometimes", "species", "statistics", "theirs", "towards", "yours"
]);
const suggestionTilesAcrossPagesCache = new Map();
let zhTwPrefixStatsCache = null;
const ZhTwGoldenCommonGlyphs = Object.freeze(Array.from(
  "的一是不有我在人了中來他這上個們到說大為子和你地出道也時年得就那要下以生會自去家可小心天好想看用聽喝冰紅茶少甜等講新集音量從剛那裡今比累但舒謝"
));
const ZhTwGoldenDailyWords = Object.freeze([
  "不要",
  "謝謝",
  "可以",
  "一下",
  "今天",
  "比較",
  "但是",
  "心情",
  "舒服",
  "講話",
  "放鬆",
  "吸管",
  "音量",
  "剛剛",
  "那裡",
  "最新",
  "資料",
  "紅茶"
]);
const ZhTwAcademicDailyConversationCases = Object.freeze([
  // Source anchors:
  // - MagicData-RAMC describes spontaneous Mandarin dialogs across ordinary life,
  //   family life, education/health, digital devices, and other daily domains.
  // - VoiceBank-2023 describes Mandarin speech-impaired voice-banking prompts
  //   made from short paragraphs and common phrases.
  // These are short QC utterances selected from those domains, not copied corpus lines.
  Object.freeze({ domain: "ordinary-life", segments: Object.freeze(["我", "想", "喝", "水"]) }),
  Object.freeze({ domain: "ordinary-life", segments: Object.freeze(["我", "想", "休息", "一下"]) }),
  Object.freeze({ domain: "health-comfort", segments: Object.freeze(["今天", "比較", "累"]) }),
  Object.freeze({ domain: "care-help", segments: Object.freeze(["請", "幫", "我", "調整", "姿勢"]) }),
  Object.freeze({ domain: "home-media", segments: Object.freeze(["我", "想", "聽", "音樂"]) }),
  Object.freeze({ domain: "digital-devices", segments: Object.freeze(["音量", "小", "一點"]) }),
  Object.freeze({ domain: "health-comfort", segments: Object.freeze(["這樣", "很", "舒服"]) }),
  Object.freeze({ domain: "conversation-repair", segments: Object.freeze(["可以", "再", "說", "一次"]) }),
  Object.freeze({ domain: "agency", segments: Object.freeze(["我", "不想", "講話"]) }),
  Object.freeze({ domain: "social", segments: Object.freeze(["謝謝", "你", "陪", "我"]) }),
  Object.freeze({ domain: "home-media", segments: Object.freeze(["我", "想", "看", "電視"]) }),
  Object.freeze({ domain: "ordinary-life", segments: Object.freeze(["等", "一下", "再", "喝"]) })
]);

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
  assert.equal(DefaultTiles.filter((candidate) => candidate.label === "I").length, 1);
});

test("default spelling letters keep the complete common English frequency order without duplicating I", () => {
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

test("version 27 default English layout migrates away from its duplicate I key", () => {
  const legacyDefault = [...DefaultTiles];
  const iIndex = legacyDefault.findIndex((candidate) => candidate.label === "I");
  legacyDefault[iIndex] = tile("I", "i");
  const youIndex = legacyDefault.findIndex((candidate) => candidate.label === "YOU");
  legacyDefault.splice(youIndex, 0, tile("I", "I"));

  const migrated = loadProfileSymbolsForConfig(serializeSymbols(legacyDefault), 27, "en-US");

  assert.deepEqual(migrated, DefaultTiles);
  assert.equal(migrated.filter((candidate) => candidate.label === "I").length, 1);
});

test("version 28 default English layout moves its single I key into the alphabet", () => {
  const legacyDefault = DefaultTiles.filter((candidate) => candidate.label !== "I");
  const youIndex = legacyDefault.findIndex((candidate) => candidate.label === "YOU");
  legacyDefault.splice(youIndex, 0, tile("I", "I"));

  const migrated = loadProfileSymbolsForConfig(serializeSymbols(legacyDefault), 28, "en-US");
  const spellingStart = migrated.findIndex((candidate) => candidate.action === TileAction.Space) + 1;

  assert.deepEqual(migrated, DefaultTiles);
  assert.equal(migrated.slice(0, spellingStart).some((candidate) => candidate.label === "I"), false);
  assert.equal(migrated.slice(spellingStart, spellingStart + 5).at(-1).label, "I");
});

test("built-in layouts migrate away from visible backspace while custom backspace remains supported", () => {
  const englishV21 = [...DefaultTiles];
  const iIndex = englishV21.findIndex((candidate) => candidate.label === "I");
  englishV21[iIndex] = tile("I", "i");
  const youIndex = englishV21.findIndex((candidate) => candidate.label === "YOU");
  englishV21.splice(youIndex, 0, tile("I", "I"));
  englishV21.splice(
    englishV21.findIndex((candidate) => candidate.action === TileAction.Clear),
    0,
    tile("DEL", "DEL", TileAction.Backspace)
  );
  const migratedEnglish = loadProfileSymbolsForConfig(serializeSymbols(englishV21), 21, "en-US");
  assert.equal(migratedEnglish.some((candidate) => candidate.action === TileAction.Backspace), false);

  const zhTwV21 = [...LanguageProfiles["zh-TW"].symbols];
  zhTwV21.splice(
    zhTwV21.findIndex((candidate) => candidate.action === TileAction.Clear),
    0,
    tile("\u522a\u9664", "DEL", TileAction.Backspace)
  );
  const migratedZhTw = loadProfileSymbolsForConfig(serializeSymbols(zhTwV21), 21, "zh-TW");
  assert.equal(migratedZhTw.some((candidate) => candidate.action === TileAction.Backspace), false);

  const custom = loadProfileSymbolsForConfig("DEL=<delete>\nHELP=help", CurrentConfigVersion, "en-US");
  assert.equal(custom.some((candidate) => candidate.action === TileAction.Backspace), true);
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

test("parser and serializer preserve custom action labels", () => {
  const symbols = parseSymbols(`
\u7a7a\u683c=<space>
\u522a=<delete>
\u6e05\u9664=<clear>
\u5fa9\u539f=<undo>
\u8aaa=<speak>
  `);

  assert.deepEqual(symbols.map((candidate) => candidate.label), ["\u7a7a\u683c", "\u522a", "\u6e05\u9664", "\u5fa9\u539f", "\u8aaa"]);
  assert.equal(serializeSymbols(symbols), [
    "\u7a7a\u683c=<space>",
    "\u522a=<delete>",
    "\u6e05\u9664=<clear>",
    "\u5fa9\u539f=<undo>",
    "\u8aaa=<speak>"
  ].join("\n"));
});

test("current zh-TW configs saved with English action labels reload localized", () => {
  const stored = [
    "\u3105",
    "SAY=<speak>",
    "DEL=<delete>",
    "CLR=<clear>",
    "MORE=<more>"
  ].join("\n");
  const labels = loadProfileSymbolsForConfig(stored, CurrentConfigVersion, "zh-TW")
    .map((candidate) => candidate.label);

  assert.equal(labels.includes("\u6717\u8b80"), true);
  assert.equal(labels.includes("\u522a\u9664"), true);
  assert.equal(labels.includes("\u6e05\u9664"), true);
  assert.equal(labels.includes("\u66f4\u591a"), true);
  assert.equal(labels.includes("SAY"), false);
  assert.equal(labels.includes("DEL"), false);
  assert.equal(labels.includes("CLR"), false);
  assert.equal(labels.includes("MORE"), false);
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

test("board balances symbols within the column limit after the two fixed suggestion rows", () => {
  const rows = boardRows(
    createBoardConfig({
      columns: 3,
      suggestionDictionary: [],
      symbols: [tile("A"), tile("B"), tile("C"), tile("D")]
    })
  );
  assert.deepEqual(rows.slice(2).map((row) => row.map((candidate) => candidate.label)), [["A", "B"], ["C", "D"]]);
});

test("suggestions complete current partial words", () => {
  const suggestions = suggestTiles("wa", DefaultSuggestionDictionary, 4).map((candidate) => candidate.label);
  assert.deepEqual(suggestions, ["WAS", "WATER", "WAY", "WAIT"]);
});

test("suggestion row stops reading candidates after its visible results are filled", () => {
  const dictionary = [tile("ALPHA"), tile("BETA"), tile("GAMMA"), tile("DELTA")];
  Object.defineProperty(dictionary, 4, {
    configurable: true,
    get() {
      throw new Error("read beyond visible suggestions");
    }
  });
  dictionary.length = 5;

  assert.deepEqual(
    suggestionRow("", dictionary, 4).map((candidate) => candidate.label),
    ["ALPHA", "BETA", "GAMMA", "DELTA"]
  );
});

test("default suggestion dictionary is the active AOSP frequency corpus", () => {
  assert.equal(DefaultSuggestionDictionary.length, EnUsFrequencySource.retainedEntryCount);
  for (const label of ["THE", "TIME", "PEOPLE", "BATHROOM", "VOICE"]) {
    assert.equal(DefaultSuggestionDictionary.some((candidate) => candidate.label === label), true);
  }
});

test("active English dictionary is the filtered neutral AOSP frequency source", () => {
  assert.equal(EnUsFrequencyEntries.length, EnUsFrequencySource.retainedEntryCount);
  assert.equal(new Set(EnUsFrequencyEntries.map(([word]) => word.toLowerCase())).size, EnUsFrequencyEntries.length);
  assert.equal(EnUsFrequencyEntries.every(([, frequency]) => frequency >= EnUsFrequencySource.minimumFrequency), true);
  assert.equal(EnUsFrequencyEntries.every(([word]) => /^(?:[a-z]+(?:'[a-z]+)*|I|OK|TV)$/u.test(word)), true);
  assert.equal(EnUsFrequencyEntries.every(([, frequency], index) =>
    index === 0 || frequency <= EnUsFrequencyEntries[index - 1][1]
  ), true);
  const words = new Set(EnUsFrequencyEntries.map(([word]) => word));
  const retainedSimplePlurals = EnUsFrequencyEntries
    .map(([word]) => word)
    .filter((word) => word === word.toLowerCase() && word.length > 2 && word.endsWith("s") && !word.endsWith("ss") &&
      !SimplePlusSNonPluralsForTest.has(word) && words.has(word.slice(0, -1)));
  assert.deepEqual(retainedSimplePlurals, []);
  assert.equal(EnUsFrequencySource.simplePluralEntryCount > 0, true);
  for (const singular of ["book", "car", "dog", "movie"]) {
    assert.equal(words.has(singular), true);
    assert.equal(words.has(`${singular}s`), false);
  }
  for (const nonPlural of ["does", "hers", "his", "is", "its", "news", "ours", "species", "this", "yes", "yours"]) {
    assert.equal(words.has(nonPlural), true);
  }
});

test("completion ranking preserves AOSP source-frequency order", () => {
  assert.deepEqual(
    suggestTiles("l", DefaultSuggestionDictionary, 4).map((candidate) => candidate.label),
    ["LATER", "LIFE", "LOCATED", "LARGE"]
  );
});

test("expanded default vocabulary includes movie", () => {
  const suggestions = suggestTiles("movi", DefaultSuggestionDictionary, 3).map((candidate) => candidate.label);
  assert.equal(suggestions.includes("MOVIE"), true);
});

test("default vocabulary includes drink without manually promoting it", () => {
  assert.equal(DefaultSuggestionDictionary.some((candidate) => candidate.label === "DRINK"), true);
  assert.deepEqual(
    suggestTiles("dri", DefaultSuggestionDictionary, 4).map((candidate) => candidate.label),
    ["DRIVE", "DRIVER", "DRIVING", "DRIVEN"]
  );
});

test("word boundaries use the same AOSP unigram order without handcrafted transitions", () => {
  for (const message of ["I ", "feel ", "no ", "want "]) {
    assert.deepEqual(
      suggestTiles(message, DefaultSuggestionDictionary, 4).map((candidate) => candidate.label),
      ["THE", "TO", "OF", "AND"]
    );
  }
});

test("suggestion row keeps stable width with useful completions", () => {
  const row = suggestionRow("want", DefaultSuggestionDictionary, 4);
  assert.deepEqual(row.map((candidate) => candidate.label), ["SPC", "WANTED", "WANTING", "WANTON"]);
});

test("English suggestions omit every one-character candidate", () => {
  const dictionary = [
    tile("I", "I"),
    tile("A", "a"),
    tile("X", "xylophone"),
    tile("LONG", "l"),
    tile("USEFUL", "useful")
  ];

  assert.deepEqual(
    suggestTiles("", dictionary, 4).map((candidate) => candidate.label),
    ["USEFUL"]
  );
  assert.deepEqual(
    suggestionRow("", dictionary, 4).map((candidate) => candidate.label),
    ["USEFUL", "", "", ""]
  );
});

test("long word suggestions span columns and reduce the row without becoming extra scan cells", () => {
  const dictionary = [
    tile("ACCESSIBILITY", "accessibility"),
    tile("ACCESSIBLE", "accessible"),
    tile("ACCESS", "access"),
    tile("ACCENT", "accent")
  ];
  const row = suggestionRow("acc", dictionary, 4, false, {
    autoSpace: "none",
    suggestionColumnSpans: {
      ACCESSIBILITY: 2,
      ACCESSIBLE: 2,
      ACCESS: 1,
      ACCENT: 1
    }
  });

  assert.deepEqual(row.map((candidate) => candidate.label), ["ACCESSIBILITY", "ACCESSIBLE"]);
  assert.deepEqual(row.map((candidate) => candidate.columnSpan), [2, 2]);
  assert.equal(selectableCount(row), 2);
});

test("unused visual columns after a long suggestion remain nonselectable", () => {
  const row = suggestionRow("acc", [
    tile("ACCESSIBILITY", "accessibility"),
    tile("ACCESSIBLE", "accessible")
  ], 4, false, {
    autoSpace: "none",
    suggestionColumnSpans: { ACCESSIBILITY: 3, ACCESSIBLE: 2 }
  });

  assert.deepEqual(row.map((candidate) => candidate.label), ["ACCESSIBILITY", ""]);
  assert.deepEqual(row.map((candidate) => candidate.columnSpan), [3, 1]);
  assert.equal(selectableCount(row), 1);
});

test("suggestion row excludes same-action labels and semantic duplicates from the static board before limiting results", () => {
  const staticTiles = [
    tile("E", "e"),
    tile("T", "t"),
    tile("I", "i"),
    tile("空格", " ", TileAction.Space)
  ];
  const dictionary = [
    tile("E", "e"),
    tile("T", "t"),
    tile("I", "I"),
    tile("FRESH", "fresh"),
    tile("OTHER", "other"),
    tile("NEXT", "next")
  ];

  const row = suggestionRow("", dictionary, 4, false, {
    autoSpace: "word",
    excludeTiles: staticTiles
  });

  assert.deepEqual(row.map((candidate) => candidate.label), ["FRESH", "OTHER", "NEXT", ""]);
});

test("board recommendations never repeat a key already present on a custom static board", () => {
  const config = createBoardConfig({
    columns: 4,
    suggestionDictionary: [
      tile("WATER", "water"),
      tile("DRINK", "drink"),
      tile("E", "e"),
      tile("NEW", "new")
    ],
    symbols: [
      tile("WATER", "water"),
      tile("E", "e"),
      tile("空格", " ", TileAction.Space),
      tile("SAY", "SAY", TileAction.Speak)
    ]
  });

  const recommendations = boardRows(config, "", false).at(0)
    .filter((candidate) => candidate.action !== TileAction.Noop);

  assert.deepEqual(recommendations.map((candidate) => candidate.label), ["DRINK", "NEW"]);
});

test("exact current word is not suggested again", () => {
  const suggestions = suggestTiles("want", DefaultSuggestionDictionary, 3);
  assert.equal(suggestions.some((candidate) => candidate.label === "WANT"), false);
});

test("suggestions return source-frequency order after a word boundary", () => {
  const suggestions = suggestTiles("want ", DefaultSuggestionDictionary, 3).map((candidate) => candidate.label);
  assert.deepEqual(suggestions, ["THE", "TO", "OF"]);
});

test("suggestion row can offer undo without changing width", () => {
  const row = suggestionRow("wa", DefaultSuggestionDictionary, 4, true);
  assert.equal(row.length, 4);
  assert.equal(row[0].label, "UNDO");
  assert.equal(row[0].action, TileAction.Undo);
  assert.equal(row.map((candidate) => candidate.label).includes("SPC"), true);
});

test("English board keeps two ranked suggestion rows at every input stage", () => {
  const config = createBoardConfig({ profileId: "en-US" });
  const before = boardRows(config, "mo", true);
  const after = boardRows(config, "mov", true);
  const boundary = boardRows(config, "movie ", true);

  assert.equal(after.length, before.length);
  assert.equal(boundary.length, before.length);
  assert.deepEqual(
    after.slice(0, 2).map((row) => row.filter((candidate) => candidate.action !== TileAction.Noop).map((candidate) => candidate.label)),
    [
      ["UNDO", "MOVED", "MOVE", "MOVEMENT"],
      ["MOVIE", "MOVING", "MOVABLE", "MOVIE'S"]
    ]
  );
});

test("scan mode does not change board layout or suggestions", () => {
  const scenarios = [
    {
      profileId: "en-US",
      message: "movi",
      canUndo: true,
      config: { suggestionColumnSpans: { MOVIE: 2, MOVEMENT: 2 } },
      inputState: {}
    },
    {
      profileId: "en-US",
      message: "movie ",
      canUndo: true,
      config: {},
      inputState: {}
    },
    {
      profileId: "zh-TW",
      message: "我",
      canUndo: true,
      config: {},
      inputState: { suggestionPage: 1 }
    },
    {
      profileId: "zh-TW",
      message: "我 want",
      canUndo: true,
      config: { suggestionColumnSpans: { WANTED: 2, WANTING: 2 } },
      inputState: { activeCategory: "english" }
    }
  ];

  for (const scenario of scenarios) {
    const configFor = (scanMode) => createBoardConfig({
      profileId: scenario.profileId,
      ...scenario.config,
      scanMode
    });
    const rowColumnConfig = configFor(ScanMode.RowColumn);
    const blockRowColumnConfig = configFor(ScanMode.BlockRowColumn);

    assert.equal(blockRowColumnConfig.columns, rowColumnConfig.columns);
    assert.deepEqual(
      boardRows(
        blockRowColumnConfig,
        scenario.message,
        scenario.canUndo,
        scenario.inputState
      ),
      boardRows(
        rowColumnConfig,
        scenario.message,
        scenario.canUndo,
        scenario.inputState
      ),
      `${scenario.profileId} board presentation changed with scan mode`
    );
  }
});

test("English suggestion rows defer wide candidates and fill gaps with the next ranked short candidates", () => {
  const config = createBoardConfig({
    profileId: "en-US",
    columns: 4,
    suggestionDictionary: [
      tile("LONGFIRST", "longfirst"),
      tile("WIDENEXT", "widenext"),
      tile("ALPHA", "alpha"),
      tile("BRAVO", "bravo"),
      tile("CHARLIE", "charlie")
    ],
    suggestionColumnSpans: { LONGFIRST: 3, WIDENEXT: 2 },
    symbols: []
  });
  const rows = boardRows(config);

  assert.deepEqual(rows[0].map((candidate) => candidate.label), ["LONGFIRST", "ALPHA"]);
  assert.deepEqual(rows[0].map((candidate) => candidate.columnSpan), [3, 1]);
  assert.deepEqual(rows[1].map((candidate) => candidate.label), ["WIDENEXT", "BRAVO", "CHARLIE"]);
  assert.deepEqual(rows[1].map((candidate) => candidate.columnSpan), [2, 1, 1]);
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
  assert.equal(labels.includes("更多"), false);
  assert.equal(labels.includes("ㄡ"), true);
  assert.equal(labels.includes("注音"), false);
  assert.equal(labels.includes("喝水"), false);
});

test("previous direct zh-TW board migrates to English entry point", () => {
  const previousDirectBoard = [
    tile("\u662f"),
    tile("\u4e0d"),
    tile("\u5e6b\u5fd9"),
    tile("\u75db"),
    ...ZhuyinInputSymbols.slice(0, 24).map((symbol) => tile(symbol)),
    tile("\u66f4\u591a", "MORE", TileAction.MoreSuggestions),
    tile("\u8aaa", "SAY", TileAction.Speak),
    tile("\u522a", "DEL", TileAction.Backspace),
    tile("\u6e05\u9664", "CLR", TileAction.Clear)
  ];

  const migrated = loadProfileSymbolsForConfig(serializeSymbols(previousDirectBoard), 16, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.equal(labels.includes("英文"), true);
  assert.equal(labels.includes("E"), false);
  assert.equal(labels.includes("\u7a7a\u683c"), false);
});

test("version 18 built-in zh-TW board migrates all 37 Zhuyin symbols", () => {
  const version18Board = [
    tile("\u662f"),
    tile("\u4e0d"),
    tile("\u5e6b\u5fd9"),
    tile("\u75db"),
    ...ZhuyinInputSymbols.slice(0, 24).map((symbol) => tile(symbol)),
    tile("EN", "english", TileAction.OpenCategory),
    tile("\u8aaa", "SAY", TileAction.Speak),
    tile("\u522a", "DEL", TileAction.Backspace),
    tile("\u6e05\u9664", "CLR", TileAction.Clear)
  ];

  const migrated = loadProfileSymbolsForConfig(serializeSymbols(version18Board), 18, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.deepEqual(ZhuyinInputSymbols.filter((symbol) => !labels.includes(symbol)), []);
  assert.equal(labels.includes("\u3126"), true);
  assert.equal(labels.includes("\u3129"), true);
  assert.equal(
    loadProfileColumnsForConfig(4, 18, "zh-TW", serializeSymbols(version18Board)),
    6
  );
});

test("zh-TW column migration preserves custom column choices", () => {
  const custom = [tile("\u81ea\u8a02"), tile("\u8aaa", "SAY", TileAction.Speak)];

  assert.equal(loadProfileColumnsForConfig(4, 18, "zh-TW", serializeSymbols(custom)), 4);
  assert.equal(loadProfileColumnsForConfig(5, 19, "zh-TW", serializeSymbols(custom)), 5);
  assert.equal(loadProfileColumnsForConfig(3, 18, "zh-TW", serializeSymbols(custom)), 3);
});

test("version 19 built-in zh-TW board migrates to six maximum symbol columns", () => {
  const version19Board = createBoardConfig({ profileId: "zh-TW" }).symbols;

  assert.equal(loadProfileColumnsForConfig(5, 19, "zh-TW", serializeSymbols(version19Board)), 6);
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

test("default scanning gives first targets extra time", () => {
  const config = createBoardConfig();

  assert.equal(config.scanMode, ScanMode.RowColumn);
  assert.equal(config.scanIntervalMs, 1800);
  assert.equal(config.transitionPauseMs, 0);
  assert.equal(config.firstCellPauseMs, 2400);
  assert.equal(config.firstCellPauseMs > config.scanIntervalMs, true);
});

test("scan timing presets are named bundles over normal timing fields", () => {
  const defaultConfig = createBoardConfig();
  assert.equal(scanTimingPresetIdForConfig(defaultConfig), "default");

  const slowerConfig = applyScanTimingPreset(defaultConfig, "slower");
  assert.equal(slowerConfig.scanIntervalMs, ScanTimingPresets.slower.scanIntervalMs);
  assert.equal(slowerConfig.firstCellPauseMs, ScanTimingPresets.slower.firstCellPauseMs);
  assert.equal(scanTimingPresetIdForConfig(slowerConfig), "slower");

  const cameraConfig = applyScanTimingPreset(defaultConfig, "cameraLongBlink");
  assert.equal(cameraConfig.scanIntervalMs, ScanTimingPresets.cameraLongBlink.scanIntervalMs);
  assert.equal(cameraConfig.transitionPauseMs, ScanTimingPresets.cameraLongBlink.transitionPauseMs);
  assert.equal(cameraConfig.inputLatencyCompensationMs, ScanTimingPresets.cameraLongBlink.inputLatencyCompensationMs);
  assert.equal(scanTimingPresetIdForConfig(cameraConfig), "cameraLongBlink");

  const customConfig = createBoardConfig({ ...slowerConfig, firstCellPauseMs: slowerConfig.firstCellPauseMs + 50 });
  assert.equal(scanTimingPresetIdForConfig(customConfig), "custom");
});

test("legacy default scan timing migrates while custom values are preserved", () => {
  assert.equal(loadScanIntervalForConfig(900, 10), DefaultScanIntervalMs);
  assert.equal(loadScanIntervalForConfig(1300, 20), DefaultScanIntervalMs);
  assert.equal(loadTransitionPauseForConfig(0, 10), DefaultTransitionPauseMs);
  assert.equal(loadTransitionPauseForConfig(450, 11), DefaultTransitionPauseMs);
  assert.equal(loadFirstCellPauseForConfig(900, 10), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(1700, 20), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(2300, 23), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(LegacyFirstCellPauseMsV6, 6), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(1800, 24), DefaultFirstCellPauseMs);
  assert.equal(loadFirstCellPauseForConfig(1800, 29), DefaultFirstCellPauseMs);
  assert.equal(loadScanIntervalForConfig(1800, 10), 1800);
  assert.equal(loadTransitionPauseForConfig(850, 10), 850);
  assert.equal(loadFirstCellPauseForConfig(1800, 6), 1800);
  assert.equal(loadFirstCellPauseForConfig(1850, 29), 1850);
});

test("English profile remains the default and auto-spaces words", () => {
  const config = createBoardConfig();

  assert.equal(config.profileId, "en-US");
  assert.equal(updateMessage("", tile("YES", "yes"), config), "yes ");
  assert.equal(updateMessage("yes ", tile("WATER", "water"), config), "yes water ");
});

test("the single I key is a pronoun at a boundary and a spelling letter inside a word", () => {
  const config = createBoardConfig({ profileId: "en-US" });
  const iTile = DefaultTiles.find((candidate) => candidate.label === "I");

  assert.equal(updateMessage("", iTile, config), "I ");
  assert.equal(updateMessage("you ", iTile, config), "you I ");
  assert.equal(updateMessage("mov", iTile, config), "movi");
  assert.equal(updateMessage("聽", iTile, { ...config, embeddedEnglish: true }), "聽I ");
});

test("zh-TW profile uses an independent direct Zhuyin board", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = config.symbols.map((candidate) => candidate.label);

  assert.equal(config.profileId, "zh-TW");
  assert.equal(config.speechLocale, "zh-TW");
  assert.equal(labels.includes("ㄅ"), true);
  assert.equal(labels.includes("ㄧ"), true);
  assert.equal(labels.includes("ㄩ"), true);
  assert.equal(labels.includes("更多"), false);
  assert.equal(labels.includes("ㄦ"), true);
  assert.equal(labels.includes("注音"), false);
  assert.equal(config.columns, 6);
  assert.deepEqual(
    ZhuyinInputSymbols.filter((symbol) => !labels.includes(symbol)),
    []
  );
});

test("zh-TW uses four-column recommendations and seven stable first-layer Zhuyin rows", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config);
  const zhuyinRows = rows.filter((row) =>
    row.length > 0 && row.every((candidate) => ZhuyinInputSymbols.includes(candidate.output))
  );

  assert.deepEqual(rows.slice(0, 4).map((row) => row.length), [4, 4, 4, 4]);
  assert.deepEqual(zhuyinRows.map((row) => row.length), [6, 5, 5, 5, 6, 5, 5]);
  assert.deepEqual(zhuyinRows.flat().map((candidate) => candidate.output), ZhuyinInputSymbols);
  assert.deepEqual(zhuyinRows.map((row) => row.map((candidate) => candidate.output)), [
    ["ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ"],
    ["ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ"],
    ["ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ"],
    ["ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"],
    ["ㄧ", "ㄨ", "ㄩ", "ㄚ", "ㄛ", "ㄜ"],
    ["ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ"],
    ["ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"]
  ]);
  assert.deepEqual(rows.at(-1).map((candidate) => candidate.label), ["英文", "朗讀", "清除"]);
});

test("zh-TW static board includes only an English entry point", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = config.symbols.map((candidate) => candidate.label);

  assert.equal(labels.includes("英文"), true);
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    assert.equal(labels.includes(letter), false, `${letter} should not be first-level`);
  }
  assert.equal(labels.includes("\u7a7a\u683c"), false);
});

test("zh-TW English entry point reuses the independent four-column English input", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const opened = applyTile("", [], findActionTile(boardRows(config), "英文", TileAction.OpenCategory), config, {});
  const rows = boardRows(config, opened.message, false, opened);

  assert.equal(opened.activeCategory, "english");
  assert.deepEqual(rows[2].map((candidate) => candidate.label), ["\u6ce8\u97f3", "\u6717\u8b80", "\u5fa9\u539f", "\u6e05\u9664"]);
  assert.equal(rows.every((row) => row.length <= 4), true);
  assert.deepEqual(
    rows.slice(3).flat().filter((candidate) => candidate.action !== TileAction.Noop),
    DefaultTiles
  );
});

test("zh-TW keeps its complete final symbol row while English spelling rows avoid sparse rows", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const opened = applyTile("", [], findActionTile(boardRows(config), "英文", TileAction.OpenCategory), config, {});

  assert.deepEqual(sparseSelectableRows(boardRows(config).slice(4)), []);
  assert.deepEqual(sparseSelectableRows(boardRows(config, opened.message, false, opened)), []);
});

test("zh-TW English spelling category stays open while composing", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  let result = applyTile("", [], findActionTile(boardRows(config), "英文", TileAction.OpenCategory), config, {});

  result = applyTile(result.message, result.messageHistory, findActionTile(boardRows(config, result.message, true, result), "P", TileAction.Append), config, result);
  result = applyTile(result.message, result.messageHistory, findActionTile(boardRows(config, result.message, true, result), "O", TileAction.Append), config, result);
  result = applyTile(result.message, result.messageHistory, findActionTile(boardRows(config, result.message, true, result), "D", TileAction.Append), config, result);
  result = applyTile(result.message, result.messageHistory, findActionTile(boardRows(config, result.message, true, result), "SPC", TileAction.Space), config, result);

  assert.equal(result.message, "pod ");
  assert.equal(result.activeCategory, "english");
});

test("zh-TW English recommendations do not repeat static letters or the localized space key", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  let state = applyTile("", [], findActionTile(boardRows(config), "英文", TileAction.OpenCategory), config, {});

  for (const label of ["P", "O", "D", "C", "A"]) {
    const rows = boardRows(config, state.message, true, state);
    state = applyTile(state.message, state.messageHistory, findActionTile(rows, label, TileAction.Append), config, state);
  }

  const rows = boardRows(config, state.message, true, state);
  const recommendations = rows.slice(0, 2).flat().filter((candidate) => candidate.action !== TileAction.Noop);
  const staticTiles = rows.slice(2).flat().filter((candidate) => candidate.action !== TileAction.Noop);
  const staticLabels = new Set(staticTiles.map((candidate) => candidate.label.toLocaleUpperCase("en-US")));
  const staticSemantics = new Set(staticTiles.map((candidate) => `${candidate.action}\u0000${candidate.output}`));

  assert.deepEqual(recommendations.slice(0, 3).map((candidate) => candidate.label), ["PODCAST", "PODCASTING"]);
  assert.equal(rows[2].some((candidate) => candidate.label === "復原"), true);
  for (const candidate of recommendations) {
    assert.equal(staticLabels.has(candidate.label.toLocaleUpperCase("en-US")), false, `${candidate.label} repeats a visible static key`);
    assert.equal(staticSemantics.has(`${candidate.action}\u0000${candidate.output}`), false, `${candidate.label} repeats a static action`);
  }
});

test("zh-TW English category reuses English suggestions and removes mixed-script boundary spaces", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  let state = applyTile("聽", [], findActionTile(boardRows(config), "英文", TileAction.OpenCategory), config, {});

  for (const label of ["P", "H"]) {
    const rows = boardRows(config, state.message, state.messageHistory.length > 0, state);
    state = applyTile(state.message, state.messageHistory, findActionTile(rows, label, TileAction.Append), config, state);
  }

  let rows = boardRows(config, state.message, true, state);
  const completion = rows[0].find((candidate) => candidate.label === "PHOTO");
  assert.ok(completion, "English category should reuse the English completion dictionary");
  state = applyTile(state.message, state.messageHistory, completion, config, state);
  assert.equal(state.message, "聽photo ");

  rows = boardRows(config, state.message, true, state);
  state = applyTile(state.message, state.messageHistory, findActionTile(rows, "注音", TileAction.CloseCategory), config, state);
  assert.equal(state.message, "聽photo");
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
  assert.equal(phraseRows.flat().some((candidate) => candidate.action === TileAction.Append), false);
});

test("zh-TW unbuffered suggestions start with AAC-useful daily targets", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const firstPageLabels = boardRows(config).slice(0, 4).flat().map((candidate) => candidate.label);

  for (const label of ["喝水", "吃飯", "廁所", "休息", "睡覺", "不舒服"]) {
    assert.equal(firstPageLabels.includes(label), true, `${label} should be on the first unbuffered suggestion page`);
  }
  for (const label of ["之", "回", "新聞", "ㄅ", "ㄆ", "ㄇ"]) {
    assert.equal(firstPageLabels.includes(label), false, `${label} should not crowd out first-page AAC suggestions`);
  }
});

test("zh-TW empty input never expands the phonetic corpus as a fallback", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const reachableSuggestions = [0, 1, 2]
    .flatMap((suggestionPage) => boardRows(config, "", false, { suggestionPage }).slice(0, 4).flat())
    .filter((candidate) => ![TileAction.Noop, TileAction.MoreSuggestions].includes(candidate.action));

  assert.equal(reachableSuggestions.some((candidate) => candidate.matchType === "base"), false);
  assert.equal(reachableSuggestions.length, 44);
});

test("zh-TW nonempty Han input preserves bounded corpus backfill when context has no completion", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const suggestions = boardRows(config, "是不", false, { suggestionPage: 2 })
    .slice(0, 4)
    .flat();

  assert.equal(
    suggestions.some((candidate) => candidate.label === "之" && candidate.matchType === "base"),
    true
  );
});

test("zh-TW function labels are localized in runtime rows and persisted defaults", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rowsWithUndo = boardRows(config, "ㄅ", true).slice(0, 4).flat();

  assert.equal(rowsWithUndo.some((candidate) => candidate.label === "\u5fa9\u539f" && candidate.action === TileAction.Undo), true);
  assert.equal(rowsWithUndo.some((candidate) => candidate.label === "UNDO"), false);

  const serializedSymbols = serializeSymbols(config.symbols);
  assert.equal(serializedSymbols.includes("\u66f4\u591a=<more>"), false);
  assert.equal(serializedSymbols.includes("\u6717\u8b80=<speak>"), true);
  assert.equal(serializedSymbols.includes("\u522a\u9664=<delete>"), false);
  assert.equal(serializedSymbols.includes("\u6e05\u9664=<clear>"), true);
  assert.equal(serializedSymbols.includes("MORE=<more>"), false);
  assert.equal(serializedSymbols.includes("SAY=<speak>"), false);
  assert.equal(serializedSymbols.includes("DEL=<delete>"), false);
  assert.equal(serializedSymbols.includes("CLR=<clear>"), false);
});

test("zh-TW relies on localized undo without a separate composition-clear command", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const emptySuggestions = boardRows(config, "", false, {}).slice(0, 4).flat();
  const singleSuggestions = boardRows(config, "ㄅ", true, {}).slice(0, 4).flat();
  const multipleSuggestions = boardRows(config, "ㄅㄧ", true, {}).slice(0, 4).flat();

  assert.equal(emptySuggestions.some((candidate) => candidate.label === "重選"), false);
  assert.equal(singleSuggestions.some((candidate) => candidate.label === "重選"), false);
  assert.equal(multipleSuggestions.some((candidate) => candidate.label === "重選"), false);
  assert.equal(multipleSuggestions[0].label, "復原");
  assert.equal(speechLabelForTile(multipleSuggestions[0], "zh-TW"), "復原");
});

test("scan mode is opt-in and unknown stored values fall back safely", () => {
  assert.equal(
    createBoardConfig({ scanMode: ScanMode.BlockRowColumn }).scanMode,
    ScanMode.BlockRowColumn
  );
  assert.equal(
    createBoardConfig({ scanMode: "five-block-row-column" }).scanMode,
    ScanMode.BlockRowColumn
  );
  assert.equal(createBoardConfig({ profileId: "en-US", columns: 4 }).scanBlockCount, 4);
  assert.equal(createBoardConfig({ profileId: "en-US", columns: 6 }).scanBlockCount, 4);
  assert.equal(createBoardConfig({ profileId: "zh-TW", columns: 6 }).scanBlockCount, 4);
  assert.equal(createBoardConfig({ scanMode: "future-mode" }).scanMode, ScanMode.RowColumn);
});

test("boards default to two visible scan attempts and preserve explicit limits", () => {
  assert.equal(createBoardConfig().scanPassLimit, DefaultScanPassLimit);
  assert.equal(createBoardConfig({ scanPassLimit: 3 }).scanPassLimit, 3);
  assert.equal(createBoardConfig({ scanPassLimit: 0 }).scanPassLimit, 0);
});

test("zh-TW undo removes a trailing Zhuyin buffer one selection at a time", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  let state = {
    message: "我想ㄅㄆㄅ",
    messageHistory: ["我想", "我想ㄅ", "我想ㄅㄆ"]
  };

  for (const expected of ["我想ㄅㄆ", "我想ㄅ", "我想"]) {
    const undo = findActionTile(boardRows(config, state.message, true, state), "復原", TileAction.Undo);
    state = { ...state, ...applyTile(state.message, state.messageHistory, undo, config, state) };
    assert.equal(state.message, expected);
  }
});

test("zh-TW dead-end repair suggestions remain available after undo", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const suggestions = boardRows(config, "ㄅㄆㄅ", true, {}).slice(0, 4).flat();

  assert.equal(suggestions[0].label, "復原");
  assert.equal(suggestions.some((candidate) => candidate.label === "重選"), false);
  assert.equal(suggestions.some((candidate) => candidate.matchType === "repair"), true);
});

test("zh-TW MVP board with English MORE migrates away from static more control", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const oldMvpSymbols = [...config.symbols, tile("MORE", "MORE", TileAction.MoreSuggestions)];
  const migrated = loadProfileSymbolsForConfig(serializeSymbols(oldMvpSymbols), 10, "zh-TW");
  const labels = migrated.map((candidate) => candidate.label);

  assert.equal(labels.includes("\u66f4\u591a"), false);
  assert.equal(labels.includes("MORE"), false);
});

test("zh-TW default board keeps direct Zhuyin symbols available without old pages", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = boardRows(config).flat().map((candidate) => candidate.label);

  assert.equal(labels.includes("ㄅ"), true);
  assert.equal(labels.includes("ㄧ"), true);
  assert.equal(labels.includes("ㄩ"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("ㄡ"), true);
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

test("zh-TW committed Han text suggests dictionary-backed phrase continuations", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "電", false, {});
  const suggestions = rows.slice(0, 4).flat().filter((candidate) => candidate.action === TileAction.CommitCandidate);
  const labels = suggestions.map((candidate) => candidate.label);

  assert.equal(labels.includes("視"), true);
  assert.equal(labels.includes("影"), true);
  assert.equal(suggestions.every((candidate) => candidate.matchType === "context"), true);
  assert.equal(findActionTile(rows, "視", TileAction.CommitCandidate).sourceLabel, "電視");
  assert.equal(applyTile("電", [], findActionTile(rows, "視", TileAction.CommitCandidate), config, {}).message, "電視");
});

test("zh-TW direct first layer offers valid following Zhuyin symbols", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "ㄅ", true, {});
  const following = findActionTile(rows, "ㄚ", TileAction.Append);
  let result = applyTile("ㄅ", [""], following, config, {});

  assert.equal(result.message, "ㄅㄚ");

  const candidate = findActionTile(boardRows(config, result.message, true, result), "爸", TileAction.CommitCandidate);
  assert.equal(candidate.replaceLength, 2);
  assert.equal(candidate.zhuyinKey.startsWith("ㄅㄚ"), true);
});

test("zh-TW standalone finals remain visible and source-empty input is repairable", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const labels = boardRows(config).flat().map((candidate) => candidate.label);
  const exactlessFinals = ZhuyinInputSymbols.filter((symbol) =>
    !ZhTwFrequencyDictionary.some((entry) => entry.keys.some((key) => key.startsWith(symbol)))
  );

  assert.ok(exactlessFinals.length > 0);
  for (const symbol of exactlessFinals) {
    assert.equal(labels.includes(symbol), true, `${symbol} should remain directly available on the first layer`);
    const repairs = boardRows(config, symbol, true, {}).slice(0, 4).flat()
      .filter((candidate) => candidate.action === TileAction.CommitCandidate);
    assert.ok(repairs.length > 0, `${symbol} should offer a repair path when it has no exact entry`);
  }
});

test("zh-TW initial-only suggestions avoid duplicating first-layer Zhuyin symbols", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const candidates = boardRows(config, "ㄅ", false, {}).slice(0, 4).flat();

  assert.equal(candidates.some((candidate) => candidate.action === TileAction.Append), false);
  assert.equal(candidates.some((candidate) => candidate.action === TileAction.CommitCandidate), true);
});

test("custom zh-TW boards keep omitted continuation symbols reachable in recommendations", () => {
  const config = createBoardConfig({
    profileId: "zh-TW",
    columns: 4,
    symbols: [tile("\u3105"), tile("\u8aaa", "SAY", TileAction.Speak)]
  });
  const candidates = boardRows(config, "\u3105", false, {}).slice(0, 4).flat();

  assert.equal(
    candidates.some((candidate) => candidate.label === "\u311a" && candidate.action === TileAction.Append),
    true
  );
});

test("zh-TW recommendations contain candidates instead of duplicate static symbols", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const staticSymbols = new Set(ZhuyinStaticInputSymbols);

  for (const buffer of ["ㄅ", "ㄒㄧㄣㄨ"]) {
    const targets = boardRows(config, buffer, true, {}).slice(0, 4).flat()
      .filter((candidate) => candidate.action !== TileAction.Noop);

    assert.equal(
      targets.some((candidate) => candidate.action === TileAction.Append && staticSymbols.has(candidate.output)),
      false,
      `${buffer} should not duplicate a first-layer Zhuyin symbol`
    );
    assert.ok(
      targets.some((candidate) => candidate.action === TileAction.CommitCandidate),
      `${buffer} should retain useful candidates on the first page`
    );
  }
});

test("zh-TW completed syllables retain exact-candidate priority when no phonetic continuation is needed", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const targets = boardRows(config, "ㄩㄝ", true, {}).slice(0, 4).flat()
    .filter((candidate) => candidate.action !== TileAction.Noop);
  const firstContentTarget = targets.find((candidate) =>
    candidate.action === TileAction.Append || candidate.action === TileAction.CommitCandidate
  );

  assert.equal(firstContentTarget.action, TileAction.CommitCandidate);
  assert.equal(firstContentTarget.zhuyinKey, "ㄩㄝ");
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

  assert.equal(suggestionLabelsAcrossPages(config, "ㄇㄟ").includes("沒有"), true);
  assert.equal(labels.includes("沒"), true);
  assert.equal(labels.includes("每"), true);
  assert.equal(labels.includes("更多"), true);
  assert.equal(labels.includes("慢"), false);
  assert.equal(labels.includes("門"), false);
  assert.equal(labels.includes("媽媽"), false);
  assert.equal(labels.includes("要"), false);
  assert.equal(labels.includes("不要"), false);
});

test("zh-TW common finals stay on the first layer while completed buffers suggest candidates", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const firstLayer = boardRows(config).slice(4).flat().map((candidate) => candidate.label);
  const afterWei = boardRows(config, "ㄨㄟ", false, {}).slice(0, 4).flat().map((candidate) => candidate.label);

  assert.equal(firstLayer.includes("ㄟ"), true);
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
      .filter((entry) => !WeakIntentSoftDemotionLabelsForTest.has(entry.label))
      .filter((entry) => !labels.has(entry.label))
      .map((entry) => `${entry.label}#${entry.sourceRank}`);
    if (missing.length > 0) {
      failures.push(`${key}: ${missing.join(", ")}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("zh-TW single-symbol reranking keeps a source front and all top candidates reachable", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];
  let displacedCount = 0;

  for (const symbol of ZhuyinStaticInputSymbols) {
    const sourceEntries = sourceOrderedFirstSymbolEntries(symbol).slice(0, 14);
    if (sourceEntries.length < 14) continue;

    const firstPageLabels = new Set(
      boardRows(config, symbol, true, { suggestionPage: 0 }).slice(0, 4).flat()
        .filter((candidate) => candidate.action === TileAction.CommitCandidate)
        .map((candidate) => candidate.label)
    );
    const missingEntries = sourceEntries
      .filter((entry) => !firstPageLabels.has(entry.label))
    const missing = missingEntries.map((entry) => `${entry.label}#${entry.frequencyRank}`);
    displacedCount += missingEntries.length;

    const reachableLabels = new Set(suggestionLabelsAcrossPages(config, symbol));
    const unreachable = sourceEntries
      .filter((entry) => !reachableLabels.has(entry.label))
      .map((entry) => `${entry.label}#${entry.frequencyRank}`);
    if (missing.length > Math.floor(sourceEntries.length / 2) || unreachable.length > 0) {
      failures.push(
        `${symbol}: displaced=${missing.join(", ")}; unreachable=${unreachable.join(", ")}`
      );
    }
  }

  assert.deepEqual(failures, []);
  assert.ok(displacedCount > 0);
});

test("zh-TW spoken evidence is versioned and internally consistent", () => {
  assert.deepEqual(ZhTwSpokenEvidenceMetadata, {
    corpusVersion: "NCCU-TM001-TM050-2026-03",
    normalizedSha256: "a15e8dc5ad537ec827c52fbe7b78d4b9aab3de7da10729007cf434732e45ead2",
    conversations: 50,
    turns: 25693,
    hanCharacters: 355203
  });
  assert.ok(ZhTwSpokenEvidenceEntries.length > 0);
  for (const entry of ZhTwSpokenEvidenceEntries) {
    assert.ok(entry.tokenCount > 0);
    assert.ok(entry.conversationCount > 0 && entry.conversationCount <= 50);
    assert.ok(ZhuyinStaticInputSymbols.includes(entry.firstSymbol));
    assert.ok(entry.selectionSavings > 0);
    assert.equal(entry.utility, entry.tokenCount * entry.selectionSavings);
  }
});

test("zh-TW sensitive suggestion metadata is small, sourced, and versioned", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const weakFirstPageExposures = [];
  assert.equal(ZhTwSensitiveSuggestionMetadata.evidenceVersion, "2026-08-14.1");
  assert.equal(ZhTwSensitiveSuggestionMetadata.reviewedCandidateCount, 14);
  assert.equal(ZhTwSensitiveSuggestionMetadata.softDemotionCount, 10);
  assert.equal(ZhTwSensitiveSuggestionEntries.length, 10);
  assert.match(ZhTwSensitiveSuggestionMetadata.evidenceSha256, /^[0-9a-f]{64}$/u);
  for (const entry of ZhTwSensitiveSuggestionEntries) {
    assert.equal(entry.policy, "weak-intent-soft-demotion");
    assert.ok(entry.riskSources.length >= ZhTwSensitiveSuggestionMetadata.minimumIndependentRiskSources);

    const sourceEntries = ZhTwChewingDictionaryEntries.filter((candidate) => candidate.label === entry.label);
    const maximumKeyLength = Math.max(...sourceEntries.map((candidate) => Array.from(candidate.key).length));
    const deliberateKeys = sourceEntries
      .map((candidate) => candidate.key)
      .filter((key) => Array.from(key).length === maximumKeyLength);
    const weakestKey = sourceEntries
      .map((candidate) => candidate.key)
      .sort((left, right) => Array.from(left).length - Array.from(right).length)[0];
    if (boardRows(config, weakestKey, false, { suggestionPage: 0 })
      .slice(0, 4)
      .flat()
      .some((candidate) => candidate.label === entry.label)) {
      weakFirstPageExposures.push(entry.label);
    }
    assert.ok(
      deliberateKeys.some((key) => suggestionLabelsAcrossPages(
        config,
        key
      ).includes(entry.label)),
      `${entry.label} should remain reachable through deliberate full pronunciation`
    );
  }
  assert.ok(
    weakFirstPageExposures.length <= Math.ceil(ZhTwSensitiveSuggestionEntries.length / 4),
    `too many reviewed labels remain first-page weak-intent suggestions: ${weakFirstPageExposures.join(", ")}`
  );
});

test("zh-TW soft demotion respects intent and preserves ordinary negative controls", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const weakInitialLabels = new Set(suggestionLabelsAcrossPages(config, "ㄊㄧ"));
  const deliberateLabels = new Set(suggestionLabelsAcrossPages(config, "ㄊㄨㄥㄧ"));
  const negativeControlLabels = boardRows(config, "ㄌㄙ", false, { suggestionPage: 0 })
    .slice(0, 4)
    .flat()
    .map((candidate) => candidate.label);
  const firstContextPage = boardRows(config, "統", false, { suggestionPage: 0 })
    .slice(0, 4)
    .flat();
  const secondContextPage = boardRows(config, "統", false, { suggestionPage: 1 })
    .slice(0, 4)
    .flat();

  assert.equal(weakInitialLabels.has("統一"), false);
  assert.equal(deliberateLabels.has("統一"), true);
  assert.equal(negativeControlLabels.at(0), "垃圾");
  assert.equal(firstContextPage.some((candidate) => candidate.sourceLabel === "統一"), false);
  assert.equal(secondContextPage.some((candidate) => candidate.sourceLabel === "統一"), true);
});

test("zh-TW golden glyphs are source-backed and daily words are direct or glyph-composable", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];

  for (const label of [...new Set([...ZhTwGoldenCommonGlyphs, ...ZhTwGoldenDailyWords])]) {
    const entries = ZhTwFrequencyDictionary.filter((entry) => entry.label === label);
    const reachable = entries.some((entry) =>
      suggestionLabelsAcrossPages(config, entry.key).includes(label)
    );
    if (reachable) continue;

    const glyphs = Array.from(label);
    const composable = glyphs.length > 1 && glyphs.every((glyph) =>
      ZhTwFrequencyDictionary.some((entry) =>
        entry.label === glyph && entry.glyphToneCoverageKey === true
      )
    );
    if (!composable) failures.push(`${label}: neither direct nor glyph-composable`);
  }

  assert.deepEqual(failures, []);
});

test("zh-TW independently ranked top-2000 common glyphs are protected and reachable without tones", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const expectedGlyphs = MoeZhTwGlyphFrequencyEntries
    .filter(([, , rank]) => rank <= 2000)
    .map(([label]) => label);
  const protectedEntries = ZhTwFrequencyDictionary
    .filter((entry) => entry.glyphCoverageKey && entry.glyphFrequencyRank <= 2000);
  const protectedByLabel = new Map(protectedEntries.map((entry) => [entry.label, entry]));
  const entriesByKey = new Map();

  assert.deepEqual(MoeZhTwGlyphFrequencyMetadata, {
    sourcePageUrl: "https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm",
    sourceZipUrl: "https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/download/shrest18.zip",
    commonStandardGlyphCount: 4808,
    rankedCommonGlyphCount: 4343
  });
  assert.equal(expectedGlyphs.length, 1995);
  assert.equal(protectedByLabel.size, expectedGlyphs.length);

  for (const label of expectedGlyphs) {
    const entry = protectedByLabel.get(label);
    assert.ok(entry, `${label} should have a protected source-backed reading`);
    if (!entriesByKey.has(entry.key)) entriesByKey.set(entry.key, []);
    entriesByKey.get(entry.key).push(entry);
  }

  const failures = [];
  for (const [key, entries] of entriesByKey) {
    const visibleLabels = new Set(
      suggestionTilesAcrossPages(config, key, true)
        .filter((candidate) => candidate.action === TileAction.CommitCandidate)
        .map((candidate) => candidate.label)
    );
    for (const entry of entries) {
      if (!visibleLabels.has(entry.label)) failures.push(`${entry.label}:${key}`);
    }
  }

  assert.deepEqual(failures, []);
  assert.ok(suggestionLabelsAcrossPages(config, "ㄐㄧ").includes("擊"));
  assert.ok(suggestionLabelsAcrossPages(config, "ㄐㄧㄝ").includes("姐"));
});

test("zh-TW tone fallback makes every independently ranked MOE glyph reachable", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const toneProtectedEntries = ZhTwFrequencyDictionary
    .filter((entry) => entry.glyphToneCoverageKey === true);
  const failures = [];
  let directCount = 0;
  let toneFallbackCount = 0;

  assert.equal(toneProtectedEntries.length, MoeZhTwGlyphFrequencyEntries.length);
  assert.equal(toneProtectedEntries.length, 4343);

  for (const entry of toneProtectedEntries) {
    const normalTiles = suggestionTilesAcrossPages(config, entry.key, true);
    if (normalTiles.some((candidate) =>
      candidate.action === TileAction.CommitCandidate && candidate.output === entry.label
    )) {
      directCount += 1;
      continue;
    }

    const toneMark = entry.toneKey.at(-1);
    const toneControl = normalTiles.find((candidate) =>
      candidate.toneFallback === true && candidate.output === toneMark
    );
    if (!toneControl) {
      failures.push(`${entry.label}:${entry.key}:missing-${toneMark}`);
      continue;
    }
    const tonedTiles = suggestionTilesAcrossPages(config, entry.toneKey, true);
    if (!tonedTiles.some((candidate) =>
      candidate.action === TileAction.CommitCandidate && candidate.output === entry.label
    )) {
      failures.push(`${entry.label}:${entry.toneKey}:unreachable`);
      continue;
    }
    toneFallbackCount += 1;
  }

  assert.deepEqual(failures, []);
  assert.ok(directCount > toneFallbackCount);
  assert.ok(toneFallbackCount > 0);
});

test("zh-TW tone fallback remains optional and replaces the complete toned buffer", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const firstPage = boardRows(config, "ㄈㄨ", true, { suggestionPage: 0 }).slice(0, 4).flat();
  const normalTiles = suggestionTilesAcrossPages(config, "ㄈㄨ", true);
  const fourthTone = normalTiles.find((candidate) =>
    candidate.toneFallback === true && candidate.output === "ˋ"
  );

  assert.equal(firstPage.some((candidate) => candidate.toneFallback === true), false);
  assert.ok(fourthTone);
  assert.equal(speechLabelForTile(fourthTone, "zh-TW"), "四聲");

  const toned = applyTile("ㄈㄨ", ["ㄈ"], fourthTone, config, {});
  assert.equal(toned.message, "ㄈㄨˋ");
  const glyph = suggestionTilesAcrossPages(config, toned.message, true)
    .find((candidate) => candidate.action === TileAction.CommitCandidate && candidate.output === "咐");
  assert.ok(glyph);
  assert.equal(applyTile(toned.message, toned.messageHistory, glyph, config, {}).message, "咐");
});

test("zh-TW tone coverage retains source-backed zero-weight standalone readings", () => {
  const expected = new Map([
    ["嚀", "ㄋㄧㄥˊ"],
    ["嚨", "ㄌㄨㄥˊ"],
    ["囌", "ㄙㄨˉ"],
    ["榷", "ㄑㄩㄝˋ"]
  ]);
  const actual = new Map(
    ZhTwFrequencyDictionary
      .filter((entry) => expected.has(entry.label))
      .map((entry) => [entry.label, entry.toneKey])
  );

  assert.deepEqual(actual, expected);
});

test("zh-TW protected glyph lane retains leading source-ranked phrase predictions", () => {
  const firstPage = boardRows(createBoardConfig({ profileId: "zh-TW" }), "ㄐㄧ", true, { suggestionPage: 0 })
    .slice(0, 4)
    .flat();

  assert.ok(firstPage.some((candidate) => candidate.label === "建議"));
  assert.ok(firstPage.some((candidate) => candidate.label === "機"));
});

test("zh-TW academic daily conversation cases are composable through normal suggestions", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const failures = [];

  for (const testCase of ZhTwAcademicDailyConversationCases) {
    for (const segment of testCase.segments) {
      if (isZhTwLabelReachable(config, segment)) continue;
      if (Array.from(segment).every((character) => isZhTwLabelReachable(config, character))) continue;

      failures.push(`${testCase.domain}: ${testCase.segments.join("")} cannot compose ${segment}`);
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
  assert.equal(speechLabelForTile({ label: "EN", output: "english", action: TileAction.OpenCategory }, "zh-TW"), "英文");
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

test("zh-TW 復原 returns to the candidate page used before a mistaken selection", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const message = "ㄇㄟ";
  const history = [""];
  const firstPage = boardRows(config, message, true, { suggestionPage: 0 });
  const more = findActionTile(firstPage, "更多", TileAction.MoreSuggestions);
  const secondPageState = applyTile(message, history, more, config, {
    suggestionPage: 0,
    suggestionPageHistory: []
  });
  const secondPage = boardRows(config, message, true, secondPageState);
  const mistakenCandidate = secondPage
    .slice(0, 4)
    .flat()
    .find((candidate) => candidate.action === TileAction.CommitCandidate);
  assert.ok(mistakenCandidate);

  const committed = applyTile(message, history, mistakenCandidate, config, secondPageState);
  assert.deepEqual(committed.suggestionPageHistory, [1]);
  const undo = findActionTile(boardRows(config, committed.message, true, committed), "復原", TileAction.Undo);
  const restored = applyTile(committed.message, committed.messageHistory, undo, config, committed);

  assert.equal(restored.message, message);
  assert.equal(restored.suggestionPage, 1);
  assert.deepEqual(
    boardRows(config, restored.message, true, restored).slice(0, 4).flat().map((candidate) => candidate.label),
    secondPage.slice(0, 4).flat().map((candidate) => candidate.label)
  );
});

test("zh-TW frequency dictionary entries all provide Zhuyin and ranked metadata", () => {
  assert.ok(ZhTwFrequencyDictionary.length > 0);
  for (const entry of ZhTwFrequencyDictionary) {
    assert.ok(entry.keys.length > 0, `${entry.label} should include at least one Zhuyin key`);
    assert.equal(typeof entry.frequencyRank, "number");
    assert.equal(typeof entry.frequency, "number");
  }
});

test("zh-TW static Zhuyin symbols provide exact candidates or source-backed repairs", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  for (const symbol of ZhuyinStaticInputSymbols) {
    const targets = boardRows(config, symbol, false, {})
      .slice(0, 4)
      .flat()
      .filter((candidate) => candidate.action === TileAction.CommitCandidate);
    assert.ok(targets.length > 0, `${symbol} should have at least one candidate or repair`);
    assert.equal(
      targets.every((candidate) => candidate.zhuyinKey?.startsWith(symbol) || candidate.matchType === "repair"),
      true,
      `${symbol} should not show unrelated candidates`
    );
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

test("zh-TW static and continuation symbols preserve broad phonetic access coverage", () => {
  const analysis = analyzeZhTwPhoneticAccess({ topEntryLimit: 500 });
  const hiddenWithPrefixes = analysis.hiddenSymbolStats.filter((stat) => stat.prefixCount > 0);
  const hiddenWithNoVisiblePath = hiddenWithPrefixes.filter((stat) => stat.visiblePrefixCount === 0);

  assert.equal(analysis.staticSymbolCount, 37);
  assert.equal(analysis.inputSymbolCount, 37);
  assert.equal(analysis.staticCoverageRatio, 1);
  assert.deepEqual(analysis.hiddenSymbolStats, []);
  assert.deepEqual(hiddenWithNoVisiblePath, []);
  assert.deepEqual(analysis.visibleDeadEndContinuations, []);
  assert.ok(
    analysis.unreachableTopEntries.length <= 5,
    `top source-ranked entries should remain broadly reachable, got ${analysis.unreachableTopEntries.map((entry) => `${entry.label}:${entry.key}`).join(", ")}`
  );
});

test("zh-TW suggestion rows do not show unrelated replacement backfill for source-empty standalone finals", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const rows = boardRows(config, "ㄝ", true, {});
  const replacements = rows
    .slice(0, 4)
    .flat()
    .filter((candidate) => candidate.action === TileAction.CommitCandidate);

  assert.ok(replacements.length > 0);
  assert.equal(replacements.every((candidate) => candidate.matchType === "repair"), true);
  assert.equal(replacements.every((candidate) => candidate.originalBuffer === "ㄝ"), true);
  assert.equal(replacements.every((candidate) => candidate.replaceLength === 1), true);
});

test("zh-TW source-empty buffers offer whole-buffer repairs with the last symbol tried first", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const buffer = "ㄅㄆㄅ";
  const repairs = suggestionTilesAcrossPages(config, buffer, true)
    .filter((candidate) => candidate.action === TileAction.CommitCandidate);

  assert.ok(repairs.length > 0);
  assert.equal(repairs.every((candidate) => candidate.matchType === "repair"), true);
  assert.equal(repairs.every((candidate) => candidate.originalBuffer === buffer), true);
  assert.equal(repairs.every((candidate) => candidate.replaceLength === buffer.length), true);
  assert.equal(repairs[0].repairIndex, buffer.length - 1);
  assert.deepEqual(new Set(repairs.map((candidate) => candidate.repairIndex)), new Set([0, 1, 2]));
  assert.equal(repairs.some((candidate) => candidate.repairKind === "substitute" && candidate.repairIndex === 0), true);
});

test("zh-TW repairs can discard an accidental last symbol and commit a corrected candidate", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const buffer = "ㄅㄚㄆ";
  const rows = boardRows(config, buffer, true, {});
  const candidate = findActionTile(rows, "把", TileAction.CommitCandidate);

  assert.equal(candidate.matchType, "repair");
  assert.equal(candidate.correctedKey, "ㄅㄚ");
  assert.equal(candidate.repairKind, "delete");
  assert.equal(candidate.repairIndex, 2);
  assert.equal(applyTile(buffer, ["ㄅㄚ"], candidate, config, {}).message, "把");
});

test("zh-TW valid buffers keep exact suggestions without fuzzy repair candidates", () => {
  const config = createBoardConfig({ profileId: "zh-TW" });
  const candidates = suggestionTilesAcrossPages(config, "ㄅㄚ", true)
    .filter((candidate) => candidate.action === TileAction.CommitCandidate);

  assert.ok(candidates.length > 0);
  assert.equal(candidates.some((candidate) => candidate.matchType === "repair"), false);
});

test("language profiles do not share mutable default arrays", () => {
  assert.notEqual(LanguageProfiles["en-US"].symbols, LanguageProfiles["zh-TW"].symbols);
  assert.notEqual(LanguageProfiles["en-US"].suggestionDictionary, LanguageProfiles["zh-TW"].suggestionDictionary);
  assert.throws(() => LanguageProfiles["zh-TW"].symbols.push(tile("測試")));
});

function suggestionLabelsAcrossPages(config, message) {
  return suggestionTilesAcrossPages(config, message, false).map((candidate) => candidate.label);
}

function isZhTwLabelReachable(config, label) {
  return ZhTwFrequencyDictionary
    .filter((entry) => entry.label === label)
    .some((entry) => suggestionLabelsAcrossPages(config, entry.key).includes(label));
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

function sparseSelectableRows(rows) {
  return rows
    .map((row, index) => ({
      index,
      labels: row.filter((candidate) => candidate.action !== TileAction.Noop).map((candidate) => candidate.label)
    }))
    .filter((row) => row.labels.length > 0 && row.labels.length < 3)
    .map((row) => `${row.index}: ${row.labels.join(", ")}`);
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
  return stats.labels.size;
}

function zhTwExactKeyCountForPrefix(prefix) {
  return zhTwPrefixStats().get(prefix)?.exactLabels.size ?? 0;
}

function topFrequencyEntriesByZhuyinPrefix(prefix, limit) {
  const seenLabels = new Set();
  const entries = [];
  for (const entry of ZhTwFrequencyDictionary) {
    if (SuppressedZhTwSuggestionLabelsForTest.has(entry.label)) continue;
    if (!entry.keys.some((key) => key.startsWith(prefix))) continue;
    if (seenLabels.has(entry.label)) continue;

    seenLabels.add(entry.label);
    entries.push(entry);
    if (entries.length >= limit) break;
  }
  return entries;
}

function sourceOrderedFirstSymbolEntries(symbol) {
  const entries = topFrequencyEntriesByZhuyinPrefix(symbol, ZhTwFrequencyDictionary.length)
    .map((entry) => ({
      ...entry,
      zhuyinKey: entry.keys
        .filter((key) => key.startsWith(symbol))
        .sort((left, right) => left.length - right.length)[0]
    }));
  return [
    ...entries.slice(0, 8),
    ...entries.slice(8).filter((entry) => entry.zhuyinKey.length === 1),
    ...entries.slice(8).filter((entry) => entry.zhuyinKey.length !== 1)
  ];
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
