import { ZhTwChewingDictionaryEntries } from "./data/zh-tw-chewing.generated.js";

export const ScanStage = Object.freeze({
  Rows: "Rows",
  RowSelected: "RowSelected",
  FirstCell: "FirstCell",
  Cells: "Cells"
});

export const TileAction = Object.freeze({
  Append: "append",
  Space: "space",
  Backspace: "backspace",
  Clear: "clear",
  Undo: "undo",
  Speak: "speak",
  EnterMode: "enter-mode",
  ExitMode: "exit-mode",
  OpenCategory: "open-category",
  CloseCategory: "close-category",
  ZhuyinGroup: "zhuyin-group",
  ZhuyinSymbol: "zhuyin-symbol",
  ZhuyinClear: "zhuyin-clear",
  CommitCandidate: "commit-candidate",
  MoreSuggestions: "more-suggestions",
  Noop: "noop"
});

export const DefaultColumns = 4;
export const DefaultScanIntervalMs = 1800;
export const DefaultTransitionPauseMs = 0;
export const DefaultFirstCellPauseMs = DefaultScanIntervalMs;
export const LegacyFirstCellPauseMsV6 = 1400;
export const DefaultInputLatencyCompensationMs = 250;
export const ScanTimingPresets = Object.freeze({
  default: Object.freeze({
    id: "default",
    label: "Default switch",
    scanIntervalMs: DefaultScanIntervalMs,
    transitionPauseMs: DefaultTransitionPauseMs,
    firstCellPauseMs: DefaultFirstCellPauseMs,
    inputLatencyCompensationMs: DefaultInputLatencyCompensationMs
  }),
  slower: Object.freeze({
    id: "slower",
    label: "Slower switch",
    scanIntervalMs: 2400,
    transitionPauseMs: 0,
    firstCellPauseMs: 3000,
    inputLatencyCompensationMs: 350
  }),
  cameraLongBlink: Object.freeze({
    id: "cameraLongBlink",
    label: "Camera long blink",
    scanIntervalMs: 2600,
    transitionPauseMs: 800,
    firstCellPauseMs: 3200,
    inputLatencyCompensationMs: 200
  }),
  firstCellSupport: Object.freeze({
    id: "firstCellSupport",
    label: "First symbol support",
    scanIntervalMs: DefaultScanIntervalMs,
    transitionPauseMs: 0,
    firstCellPauseMs: 3000,
    inputLatencyCompensationMs: 300
  }),
  cancelable: Object.freeze({
    id: "cancelable",
    label: "Cancelable row",
    scanIntervalMs: 1500,
    transitionPauseMs: 650,
    firstCellPauseMs: 2100,
    inputLatencyCompensationMs: DefaultInputLatencyCompensationMs
  })
});
export const CurrentConfigVersion = 24;
const LegacyDefaultScanIntervalMs = 900;
const PreviousDefaultScanIntervalMs = 1300;
const PreviousDefaultTransitionPauseMs = 450;
const LegacyDefaultFirstCellPauseMs = 900;
const EarlierDefaultFirstCellPauseMs = 1700;
const PreviousDefaultFirstCellPauseMs = 2300;
export const DefaultProfileId = "en-US";
export const AutoSpaceMode = Object.freeze({
  Word: "word",
  None: "none"
});

export function tile(label, output = label, action = TileAction.Append) {
  return { label, output, action };
}

export function compactTextHistorySnapshots(entries, options = {}) {
  const validEntries = Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry.text === "string")
    : [];
  if (validEntries.length === 0) return [];

  const compacted = [];
  let terminal = { ...validEntries[0] };
  for (const entry of validEntries.slice(1)) {
    const next = { ...entry };
    if (textHistorySnapshotsShareSession(terminal, next)) {
      terminal = next;
    } else {
      compacted.push(terminal);
      terminal = next;
    }
  }
  compacted.push(terminal);

  const currentText = String(options.currentText ?? "");
  const currentProfileId = String(options.currentProfileId ?? "");
  return compacted.map((entry, index) => {
    const isLast = index === compacted.length - 1;
    if (!isLast) return { ...entry, closed: true };

    const currentMatchesLastSession = currentText.length > 0 &&
      (!currentProfileId || !entry.profileId || entry.profileId === currentProfileId) &&
      textHistorySnapshotsShareSession(entry, {
        text: currentText,
        profileId: currentProfileId || entry.profileId,
        effect: "message"
      });
    const remainsOpen = entry.effect !== "reset" &&
      (entry.closed === false || currentMatchesLastSession);
    return { ...entry, closed: !remainsOpen };
  });
}

function textHistorySnapshotsShareSession(previous, next) {
  if (previous.effect === "reset") return false;
  if (previous.profileId && next.profileId && previous.profileId !== next.profileId) return false;

  const previousText = String(previous.text ?? "");
  const nextText = String(next.text ?? "");
  if (previousText === nextText) return true;
  if (previous.effect === "undo" || next.effect === "undo") return true;
  if (previousText.startsWith(nextText) || nextText.startsWith(previousText)) return true;

  const zhuyinBuffer = trailingZhuyinBuffer(previousText);
  if (zhuyinBuffer.length === 0) return false;
  const stableText = previousText.slice(0, previousText.length - zhuyinBuffer.length);
  return stableText.length === 0 || nextText.startsWith(stableText);
}

export const ZhuyinSpeechNames = Object.freeze({
  "ㄅ": "玻",
  "ㄆ": "坡",
  "ㄇ": "摸",
  "ㄈ": "佛",
  "ㄉ": "得",
  "ㄊ": "特",
  "ㄋ": "呢",
  "ㄌ": "勒",
  "ㄍ": "哥",
  "ㄎ": "科",
  "ㄏ": "喝",
  "ㄐ": "基",
  "ㄑ": "七",
  "ㄒ": "西",
  "ㄓ": "知",
  "ㄔ": "吃",
  "ㄕ": "詩",
  "ㄖ": "日",
  "ㄗ": "資",
  "ㄘ": "疵",
  "ㄙ": "思",
  "ㄧ": "衣",
  "ㄨ": "烏",
  "ㄩ": "迂",
  "ㄚ": "啊",
  "ㄛ": "喔",
  "ㄜ": "鵝",
  "ㄝ": "欸",
  "ㄞ": "唉",
  "ㄟ": "欸",
  "ㄠ": "凹",
  "ㄡ": "歐",
  "ㄢ": "安",
  "ㄣ": "恩",
  "ㄤ": "昂",
  "ㄥ": "鞥",
  "ㄦ": "兒"
});

export function speechLabelForTile(candidate, profileId = DefaultProfileId) {
  if (profileId === "zh-TW") {
    if (candidate.action === TileAction.Space) return "空格";
    if (candidate.action === TileAction.Backspace) return "刪除";
    if (candidate.action === TileAction.Clear) return "清除";
    if (candidate.action === TileAction.Undo) return "復原";
    if (candidate.action === TileAction.Speak) return "朗讀";
    if (candidate.action === TileAction.EnterMode) return "用注音找字";
    if (candidate.action === TileAction.ExitMode) return "返回";
    if (candidate.action === TileAction.OpenCategory) {
      return candidate.output === "english" || candidate.label.toUpperCase() === "EN"
        ? "英文"
        : candidate.label;
    }
    if (candidate.action === TileAction.CloseCategory) return "返回";
    if (candidate.action === TileAction.ZhuyinGroup || candidate.action === TileAction.ZhuyinSymbol) {
      return zhuyinSpeech(candidate.label || candidate.output);
    }
    if (candidate.action === TileAction.ZhuyinClear) return "重選";
    if (candidate.action === TileAction.CommitCandidate) return candidate.output.trim() || candidate.label;
    if (candidate.action === TileAction.MoreSuggestions) return "更多";
    if (isZhuyinLabel(candidate.label || candidate.output)) return zhuyinSpeech(candidate.label || candidate.output);
  }
  if (candidate.action === TileAction.Space) return "space";
  if (candidate.action === TileAction.Backspace) return "delete";
  if (candidate.action === TileAction.Clear) return "clear";
  if (candidate.action === TileAction.Undo) return "undo";
  if (candidate.action === TileAction.Speak) return "speak";
  if (candidate.action === TileAction.EnterMode) return "enter mode";
  if (candidate.action === TileAction.ExitMode) return "exit mode";
  if (candidate.action === TileAction.OpenCategory) return candidate.label;
  if (candidate.action === TileAction.CloseCategory) return "close category";
  if (candidate.action === TileAction.ZhuyinClear) return "clear composition";
  if (candidate.action === TileAction.CommitCandidate) return candidate.output.trim() || candidate.label;
  if (candidate.action === TileAction.MoreSuggestions) return "more";
  return candidate.output.trim() || candidate.label;
}

function zhuyinSpeech(label) {
  const symbols = Array.from(label).filter((character) => ZhuyinSpeechNames[character]);
  if (symbols.length === 0) return label;
  return symbols.map((symbol) => ZhuyinSpeechNames[symbol]).join(" ");
}

function isZhuyinLabel(label) {
  const symbols = Array.from(label);
  return symbols.length > 0 && symbols.every((character) => ZhuyinSpeechNames[character]);
}

export const LegacySuggestionDictionaryV6 = Object.freeze([
  tile("I", "I"),
  tile("YOU", "you"),
  tile("WANT", "want"),
  tile("NEED", "need"),
  tile("HELP", "help"),
  tile("STOP", "stop"),
  tile("GO", "go"),
  tile("YES", "yes"),
  tile("NO", "no"),
  tile("DRINK", "drink"),
  tile("WATER", "water"),
  tile("FOOD", "food"),
  tile("TOILET", "toilet"),
  tile("PAIN", "pain"),
  tile("HOT", "hot"),
  tile("COLD", "cold"),
  tile("TIRED", "tired"),
  tile("SLEEP", "sleep"),
  tile("MORE", "more"),
  tile("DONE", "done"),
  tile("WATCH", "watch"),
  tile("LOOK", "look"),
  tile("MOVE", "move"),
  tile("TURN", "turn"),
  tile("UP", "up"),
  tile("DOWN", "down"),
  tile("LEFT", "left"),
  tile("RIGHT", "right"),
  tile("MOM", "mom"),
  tile("DAD", "dad"),
  tile("NURSE", "nurse"),
  tile("DOCTOR", "doctor")
]);

export const LegacySuggestionDictionaryV7 = Object.freeze([
  ...LegacySuggestionDictionaryV6,
  tile("MOVIE", "movie"),
  tile("MUSIC", "music"),
  tile("TV", "TV"),
  tile("VIDEO", "video"),
  tile("GAME", "game"),
  tile("BOOK", "book"),
  tile("PHONE", "phone"),
  tile("TABLET", "tablet"),
  tile("HOME", "home"),
  tile("BED", "bed"),
  tile("CHAIR", "chair"),
  tile("ROOM", "room"),
  tile("LIGHT", "light"),
  tile("FAN", "fan"),
  tile("OPEN", "open"),
  tile("CLOSE", "close"),
  tile("CHANGE", "change"),
  tile("AGAIN", "again"),
  tile("WAIT", "wait"),
  tile("SORRY", "sorry"),
  tile("THANKS", "thanks"),
  tile("PLEASE", "please"),
  tile("GOOD", "good"),
  tile("BAD", "bad"),
  tile("OK", "OK"),
  tile("LIKE", "like"),
  tile("DON'T", "don't"),
  tile("FEEL", "feel"),
  tile("SICK", "sick"),
  tile("MEDICINE", "medicine"),
  tile("BATHROOM", "bathroom"),
  tile("SHOWER", "shower"),
  tile("CLOTHES", "clothes"),
  tile("BLANKET", "blanket"),
  tile("PILLOW", "pillow"),
  tile("CALL", "call"),
  tile("FAMILY", "family"),
  tile("FRIEND", "friend"),
  tile("QUESTION", "question"),
  tile("WHAT", "what"),
  tile("WHERE", "where"),
  tile("WHEN", "when"),
  tile("WHY", "why"),
  tile("HOW", "how")
]);

export const AacCoreVocabularyWords = Object.freeze([
  "I", "you", "we", "they", "he", "she", "it", "me", "my", "your", "mine", "this", "that", "here", "there",
  "want", "need", "help", "stop", "go", "come", "look", "watch", "turn", "move", "give", "get", "make", "put",
  "take", "open", "close", "eat", "drink", "sleep", "feel", "know", "think", "like", "don't", "can", "do", "is",
  "yes", "no", "not", "more", "all", "some", "again", "done", "now", "later", "good", "bad", "big", "little",
  "hot", "cold", "up", "down", "in", "out", "on", "off", "with", "without", "and", "or", "because", "what",
  "where", "when", "why", "how", "please", "thanks"
]);

export const ProjectCoreUniversalCoreWords = Object.freeze([
  "all", "can", "different", "do", "done", "get", "go", "good", "he", "help", "here", "I",
  "in", "it", "like", "look", "make", "more", "not", "on", "open", "put", "same", "she",
  "some", "stop", "that", "turn", "up", "want", "what", "when", "where", "who", "why", "you"
]);

export const CommonEnglishServiceWords = Object.freeze([
  "the", "be", "to", "of", "and", "a", "in", "have", "it", "for", "not", "on", "with", "as", "at", "by",
  "from", "but", "about", "into", "over", "after", "before", "between", "through", "during", "under", "around",
  "time", "person", "year", "way", "day", "thing", "man", "woman", "child", "world", "life", "hand", "eye",
  "place", "work", "week", "case", "point", "problem", "fact", "home", "room", "bed", "chair", "door", "phone",
  "water", "food", "medicine", "bathroom", "toilet", "pain", "family", "friend", "doctor", "nurse", "name",
  "question", "answer", "people", "school", "house", "car", "money", "book", "music", "movie", "game", "TV",
  "light", "fan", "blanket", "pillow", "clothes", "shirt", "pants", "shoes", "shower", "breakfast", "lunch",
  "dinner", "snack", "coffee", "tea", "milk", "juice", "left", "right", "front", "back", "side", "first", "last",
  "new", "old", "long", "short", "great", "small", "different", "same", "high", "low", "early", "young", "important",
  "public", "able", "own", "other", "right", "wrong", "ready", "busy", "tired", "sick", "happy", "sad", "angry",
  "scared", "sorry", "funny", "nice", "hard", "easy", "fast", "slow", "safe", "hurt", "clean", "dirty", "dry", "wet",
  "say", "tell", "ask", "use", "find", "try", "call", "leave", "keep", "let", "begin", "start", "finish", "wait",
  "change", "show", "hear", "listen", "read", "write", "sit", "stand", "walk", "run", "play", "rest", "wash", "wear",
  "bring", "buy", "choose", "remember", "forget", "live", "stay", "talk", "work", "happen", "seem", "become"
]);

export const AacFringeStarterWords = Object.freeze([
  "mom", "dad", "parent", "sister", "brother", "caregiver", "teacher", "therapist", "tablet", "video", "internet",
  "homework", "hospital", "clinic", "kitchen", "outside", "inside", "morning", "afternoon", "night", "today",
  "tomorrow", "yesterday", "wheelchair", "switch", "charger", "battery", "volume", "voice"
]);

export const DefaultSuggestionDictionary = Object.freeze(
  distinctBy(
    [
      ...LegacySuggestionDictionaryV7,
      ...wordTiles(AacCoreVocabularyWords),
      ...wordTiles(CommonEnglishServiceWords),
      ...wordTiles(AacFringeStarterWords)
    ],
    (candidate) => candidate.label.toUpperCase()
  )
);

const frequencyLetters = ["E", "T", "A", "O", "I", "N", "S", "R", "H", "L", "D", "C", "U", "M", "F", "P", "G", "W", "Y", "B", "V", "K", "X", "J", "Q", "Z"];
const letterTile = (label) => tile(label, label.toLowerCase());

const DefaultTilesWithBackspaceV21 = Object.freeze([
  tile("YES", "yes"),
  tile("NO", "no"),
  tile("HELP", "help"),
  tile("PAIN", "pain"),
  tile("WATER", "water"),
  tile("FOOD", "food"),
  tile("I", "I"),
  tile("YOU", "you"),
  tile("WANT", "want"),
  tile("NEED", "need"),
  tile("GO", "go"),
  tile("STOP", "stop"),
  tile("WATCH", "watch"),
  tile("LOOK", "look"),
  tile("SAY", "SAY", TileAction.Speak),
  tile("DEL", "DEL", TileAction.Backspace),
  tile("CLR", "CLR", TileAction.Clear),
  tile("SPC", " ", TileAction.Space),
  ...frequencyLetters.map(letterTile)
]);
export const DefaultTiles = Object.freeze(
  DefaultTilesWithBackspaceV21.filter((candidate) => candidate.action !== TileAction.Backspace)
);

export const LegacyFrequencyDefaultTilesV3 = Object.freeze([
  tile("YES", "yes"),
  tile("NO", "no"),
  tile("HELP", "help"),
  tile("PAIN", "pain"),
  tile("WATER", "water"),
  tile("FOOD", "food"),
  tile("I", "I"),
  tile("YOU", "you"),
  tile("WANT", "want"),
  tile("NEED", "need"),
  tile("GO", "go"),
  tile("STOP", "stop"),
  tile("WATCH", "watch"),
  tile("LOOK", "look"),
  tile("SAY", "SAY", TileAction.Speak),
  tile("DEL", "DEL", TileAction.Backspace),
  tile("CLR", "CLR", TileAction.Clear),
  tile("SPC", " ", TileAction.Space),
  ..."ETAOINSRHDLCUMWFGYPBVKJXQZ".split("").map(letterTile),
  tile("?")
]);

export const LegacyAlphabetDefaultTiles = Object.freeze([
  tile("YES", "yes"),
  tile("NO", "no"),
  tile("HELP", "help"),
  tile("PAIN", "pain"),
  tile("WATER", "water"),
  tile("FOOD", "food"),
  tile("I", "I"),
  tile("YOU", "you"),
  tile("WANT", "want"),
  tile("NEED", "need"),
  tile("GO", "go"),
  tile("STOP", "stop"),
  tile("SPC", " ", TileAction.Space),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => tile(letter)),
  tile("?"),
  tile("DEL", "DEL", TileAction.Backspace),
  tile("SAY", "SAY", TileAction.Speak),
  tile("CLR", "CLR", TileAction.Clear)
]);

export const SuggestionFallbackLetters = Object.freeze(
  ["E", "T", "A", "O", "I", "N", "S", "R"].map(letterTile)
);
export const SpaceSuggestionTile = Object.freeze(tile("SPC", " ", TileAction.Space));
export const UndoSuggestionTile = Object.freeze(tile("UNDO", "UNDO", TileAction.Undo));
export const MoreSuggestionsTile = Object.freeze(tile("MORE", "MORE", TileAction.MoreSuggestions));
const zhTwUndoSuggestionTile = Object.freeze(tile("復原", "UNDO", TileAction.Undo));
const zhTwMoreSuggestionsTile = Object.freeze(tile("更多", "MORE", TileAction.MoreSuggestions));

const boardModeTile = (label = "返回") => tile(label, "board", TileAction.ExitMode);
const zhuyinModeTile = (label = "注音") => tile(label, "zhuyin", TileAction.EnterMode);
const categoryTile = (label, categoryId) => tile(label, categoryId, TileAction.OpenCategory);
const zhuyinGroupTile = (label, groupId) => tile(label, groupId, TileAction.ZhuyinGroup);
const zhuyinSymbolTile = (label, output, kind) => ({ label, output, action: TileAction.ZhuyinSymbol, zhuyinKind: kind });
const categoryCloseTile = Object.freeze(tile("返回", "category", TileAction.CloseCategory));
const zhuyinCategoryCloseTile = Object.freeze(tile("注音", "category", TileAction.CloseCategory));
const zhuyinClearTile = Object.freeze(tile("重選", "clear", TileAction.ZhuyinClear));
const ZhTwSuggestionRowCount = 4;
const MaxZhTwSuggestionPages = 3;
const MaxZhTwContextChars = 3;
const zhuyinEntry = (label, output, key, ...aliases) => Object.freeze({
  label,
  output,
  key,
  keys: Object.freeze([key, ...aliases])
});
const chewingZhuyinEntry = (entry) => Object.freeze({
  label: entry.label,
  output: entry.output,
  key: entry.key,
  keys: Object.freeze([entry.key]),
  source: entry.source,
  sourceRank: entry.sourceRank,
  frequency: entry.frequency
});
const MinZhuyinTargets = 8;
const MaxZhuyinCandidateTargets = 20;
const ZhTwCoreResponseTiles = Object.freeze([
  tile("是"),
  tile("不"),
  tile("幫忙"),
  tile("痛")
]);
const ZhTwCoreResponseLabels = new Set(ZhTwCoreResponseTiles.map((candidate) => candidate.label));
const ZhTwSuppressedSuggestionLabels = new Set(["是不是", "要不要"]);
const EnglishCategoryId = "english";

export const ZhuyinInitialGroups = Object.freeze([
  Object.freeze({ id: "labial", label: "ㄅㄆㄇㄈ", symbols: Object.freeze(["ㄅ", "ㄆ", "ㄇ", "ㄈ"]) }),
  Object.freeze({ id: "alveolar", label: "ㄉㄊㄋㄌ", symbols: Object.freeze(["ㄉ", "ㄊ", "ㄋ", "ㄌ"]) }),
  Object.freeze({ id: "velar", label: "ㄍㄎㄏ", symbols: Object.freeze(["ㄍ", "ㄎ", "ㄏ"]) }),
  Object.freeze({ id: "palatal", label: "ㄐㄑㄒ", symbols: Object.freeze(["ㄐ", "ㄑ", "ㄒ"]) }),
  Object.freeze({ id: "retroflex", label: "ㄓㄔㄕㄖ", symbols: Object.freeze(["ㄓ", "ㄔ", "ㄕ", "ㄖ"]) }),
  Object.freeze({ id: "dental", label: "ㄗㄘㄙ", symbols: Object.freeze(["ㄗ", "ㄘ", "ㄙ"]) }),
  Object.freeze({ id: "zero", label: "ㄧㄨㄩ", symbols: Object.freeze(["ㄧ", "ㄨ", "ㄩ"]) })
]);

export const ZhuyinInputSymbols = Object.freeze([
  "ㄅ", "ㄆ", "ㄇ", "ㄈ",
  "ㄉ", "ㄊ", "ㄋ", "ㄌ",
  "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ",
  "ㄓ", "ㄔ", "ㄕ", "ㄖ",
  "ㄗ", "ㄘ", "ㄙ",
  "ㄧ", "ㄨ", "ㄩ",
  "ㄚ", "ㄛ", "ㄜ", "ㄝ",
  "ㄞ", "ㄟ", "ㄠ", "ㄡ",
  "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ"
]);

const ZhuyinInputSymbolSet = new Set(ZhuyinInputSymbols);
const ZhuyinInitialSymbolSet = new Set(ZhuyinInputSymbols.slice(0, 21));
const ZhuyinContinuationSymbols = Object.freeze({
  "ㄧ": Object.freeze(["ㄚ", "ㄝ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ"]),
  "ㄨ": Object.freeze(["ㄚ", "ㄛ", "ㄞ", "ㄟ", "ㄢ", "ㄣ", "ㄤ", "ㄥ"]),
  "ㄩ": Object.freeze(["ㄝ", "ㄢ", "ㄣ"])
});

export const ZhuyinLookupDictionary = Object.freeze([
  ...ZhTwChewingDictionaryEntries.map(chewingZhuyinEntry)
]);

export const ZhTwFrequencyDictionary = Object.freeze(
  ZhuyinLookupDictionary.map((entry, index) => Object.freeze({
    ...entry,
    frequencyRank: entry.sourceRank ?? index + 1,
    frequency: entry.frequency ?? 1 / (index + 1)
  }))
);
const ZhTwDictionaryByPrefix = buildZhTwDictionaryByPrefix(ZhTwFrequencyDictionary);
const ZhTwNextSymbolsByPrefix = buildZhTwNextSymbolsByPrefix(ZhTwFrequencyDictionary);
const ZhTwPhraseCompletionsByPrefix = buildZhTwPhraseCompletionsByPrefix(ZhTwFrequencyDictionary);
const ZhTwValidPrefixSet = zhTwValidPrefixSet(ZhTwFrequencyDictionary);

const LegacyZhuyinStaticInputSymbolsV18 = Object.freeze(
  ZhuyinInputSymbols.slice(0, 24)
);

export const ZhuyinStaticInputSymbols = ZhuyinInputSymbols;

export function zhTwVisibleNextSymbolsForPrefix(
  prefix,
  columns = DefaultColumns,
  staticSymbols = ZhuyinStaticInputSymbols
) {
  const staticSet = new Set(staticSymbols);
  return zhTwNextSymbolTiles(prefix, columns)
    .map((candidate) => candidate.output)
    .filter((symbol) => !staticSet.has(symbol));
}

export function analyzeZhTwPhoneticAccess(options = {}) {
  const dictionary = options.dictionary ?? ZhTwFrequencyDictionary;
  const staticSymbols = options.staticSymbols ?? ZhuyinStaticInputSymbols;
  const columns = options.columns ?? DefaultColumns;
  const topEntryLimit = Math.max(1, Math.trunc(options.topEntryLimit ?? 500));
  const staticSet = new Set(staticSymbols);
  const totalWeight = dictionary.reduce((sum, entry) => sum + zhTwAccessWeight(entry), 0);
  const firstSymbolStats = ZhuyinInputSymbols.map((symbol) => zhTwFirstSymbolAccessStats(symbol, dictionary, staticSet));
  const staticCoverageWeight = firstSymbolStats
    .filter((stat) => stat.static)
    .reduce((sum, stat) => sum + stat.weight, 0);
  const hiddenSymbolStats = ZhuyinInputSymbols
    .filter((symbol) => !staticSet.has(symbol))
    .map((symbol) => zhTwHiddenSymbolAccessStats(symbol, dictionary, staticSet, columns));
  const visibleDeadEndContinuations = zhTwVisibleDeadEndContinuations(dictionary, staticSet, columns);
  const topEntries = dictionary
    .slice()
    .sort((left, right) => left.frequencyRank - right.frequencyRank)
    .slice(0, topEntryLimit);
  const unreachableTopEntries = topEntries
    .map((entry) => zhTwEntryAccessPath(entry, staticSet, columns))
    .filter((result) => !result.reachable);

  return Object.freeze({
    columns,
    staticSymbolCount: staticSymbols.length,
    inputSymbolCount: ZhuyinInputSymbols.length,
    dictionaryEntryCount: dictionary.length,
    totalWeight,
    staticCoverageWeight,
    staticCoverageRatio: totalWeight > 0 ? staticCoverageWeight / totalWeight : 0,
    firstSymbolStats: Object.freeze(firstSymbolStats),
    hiddenSymbolStats: Object.freeze(hiddenSymbolStats),
    visibleDeadEndContinuations: Object.freeze(visibleDeadEndContinuations),
    topFirstSymbolsByWeight: Object.freeze(
      firstSymbolStats
        .slice()
        .sort((left, right) => right.weight - left.weight)
    ),
    topEntryLimit,
    unreachableTopEntries: Object.freeze(unreachableTopEntries)
  });
}

export const ZhTwPhraseCategories = Object.freeze({
  needs: Object.freeze({
    label: "需要",
    tiles: Object.freeze([
      tile("喝水"),
      tile("吃飯"),
      tile("廁所"),
      tile("休息"),
      tile("睡覺"),
      tile("不"),
      tile("幫忙"),
      tile("停")
    ])
  }),
  body: Object.freeze({
    label: "身體",
    tiles: Object.freeze([
      tile("痛"),
      tile("不舒服"),
      tile("熱"),
      tile("冷"),
      tile("累"),
      tile("想吐"),
      tile("頭暈"),
      tile("怕")
    ])
  }),
  care: Object.freeze({
    label: "照護",
    tiles: Object.freeze([
      tile("幫忙"),
      tile("家人"),
      tile("護理師"),
      tile("醫生"),
      tile("藥"),
      tile("姿勢", "調整姿勢"),
      tile("等一下"),
      tile("可以")
    ])
  }),
  position: Object.freeze({
    label: "位置",
    tiles: Object.freeze([
      tile("上"),
      tile("下"),
      tile("左"),
      tile("右"),
      tile("坐起來"),
      tile("躺下"),
      tile("翻身"),
      tile("枕頭")
    ])
  }),
  people: Object.freeze({
    label: "人",
    tiles: Object.freeze([
      tile("家人"),
      tile("媽媽"),
      tile("爸爸"),
      tile("護理師"),
      tile("醫生"),
      tile("照顧者"),
      tile("朋友"),
      tile("我")
    ])
  }),
  quick: Object.freeze({
    label: "常用",
    tiles: Object.freeze([
      tile("是"),
      tile("不是"),
      tile("要"),
      tile("不"),
      tile("停"),
      tile("等一下"),
      tile("可以"),
      tile("不可以")
    ])
  }),
  talk: Object.freeze({
    label: "表達",
    tiles: Object.freeze([
      tile("好"),
      tile("不好"),
      tile("知道"),
      tile("不知道"),
      tile("喜歡"),
      tile("不喜歡"),
      tile("再一次"),
      tile("結束")
    ])
  }),
  [EnglishCategoryId]: Object.freeze({
    label: "英文",
    tiles: Object.freeze([
      ...frequencyLetters.map(letterTile),
      tile("\u7a7a\u683c", " ", TileAction.Space),
      tile("?")
    ])
  })
});

const ZhTwTilesWithBackspaceV21 = Object.freeze([
  ...ZhTwCoreResponseTiles,
  ...ZhuyinStaticInputSymbols.map((symbol) => tile(symbol)),
  categoryTile("英文", EnglishCategoryId),
  tile("朗讀", "SAY", TileAction.Speak),
  tile("刪除", "DEL", TileAction.Backspace),
  tile("清除", "CLR", TileAction.Clear)
]);
export const ZhTwTiles = Object.freeze(
  ZhTwTilesWithBackspaceV21.filter((candidate) => candidate.action !== TileAction.Backspace)
);

const LegacyZhTwTilesV18 = Object.freeze([
  ...ZhTwCoreResponseTiles,
  ...LegacyZhuyinStaticInputSymbolsV18.map((symbol) => tile(symbol)),
  categoryTile("EN", EnglishCategoryId),
  tile("說", "SAY", TileAction.Speak),
  tile("刪", "DEL", TileAction.Backspace),
  tile("清除", "CLR", TileAction.Clear)
]);

export const ZhTwSuggestionDictionary = Object.freeze([
  ...ZhTwCoreResponseTiles,
  ...Object.entries(ZhTwPhraseCategories)
    .filter(([id]) => id !== EnglishCategoryId)
    .flatMap(([, category]) => category.tiles),
  tile("喝水"),
  tile("吃飯"),
  tile("廁所"),
  tile("休息"),
  tile("睡覺"),
  tile("痛"),
  tile("熱"),
  tile("冷"),
  tile("累"),
  tile("家人"),
  tile("護理師"),
  tile("醫生"),
  tile("藥"),
  tile("姿勢", "調整姿勢"),
  tile("可以"),
  tile("不可以"),
  tile("媽媽"),
  tile("爸爸"),
  tile("不舒服"),
  ...ZhTwTiles.filter((candidate) => candidate.action === TileAction.Append)
]);

export const LanguageProfiles = Object.freeze({
  "en-US": Object.freeze({
    id: "en-US",
    displayName: "English",
    writingSystem: "latin",
    columns: DefaultColumns,
    scanIntervalMs: DefaultScanIntervalMs,
    transitionPauseMs: DefaultTransitionPauseMs,
    firstCellPauseMs: DefaultFirstCellPauseMs,
    inputLatencyCompensationMs: DefaultInputLatencyCompensationMs,
    autoSpace: AutoSpaceMode.Word,
    speechLocale: "en-US",
    suggestionDictionary: DefaultSuggestionDictionary,
    symbols: DefaultTiles
  }),
  "zh-TW": Object.freeze({
    id: "zh-TW",
    displayName: "繁體中文（台灣）",
    writingSystem: "traditional-chinese",
    columns: 6,
    scanIntervalMs: DefaultScanIntervalMs,
    transitionPauseMs: DefaultTransitionPauseMs,
    firstCellPauseMs: DefaultFirstCellPauseMs,
    inputLatencyCompensationMs: DefaultInputLatencyCompensationMs,
    autoSpace: AutoSpaceMode.None,
    speechLocale: "zh-TW",
    suggestionDictionary: ZhTwSuggestionDictionary,
    symbols: ZhTwTiles
  })
});

export function languageProfileForId(profileId = DefaultProfileId) {
  return LanguageProfiles[profileId] ?? LanguageProfiles[DefaultProfileId];
}

export function createBoardConfig(overrides = {}) {
  const profile = languageProfileForId(overrides.profileId);
  const { profileId: _profileId, ...safeOverrides } = overrides;
  return {
    profileId: profile.id,
    autoSpace: profile.autoSpace,
    speechLocale: profile.speechLocale,
    columns: profile.columns,
    scanIntervalMs: profile.scanIntervalMs,
    transitionPauseMs: profile.transitionPauseMs,
    firstCellPauseMs: profile.firstCellPauseMs,
    inputLatencyCompensationMs: profile.inputLatencyCompensationMs,
    suggestionDictionary: profile.suggestionDictionary,
    symbols: profile.symbols,
    ...safeOverrides
  };
}

export function scanTimingPresetForId(presetId) {
  return ScanTimingPresets[presetId] ?? ScanTimingPresets.default;
}

export function scanTimingPresetIdForConfig(config = createBoardConfig()) {
  const normalized = createBoardConfig(config);
  for (const preset of Object.values(ScanTimingPresets)) {
    if (
      normalized.scanIntervalMs === preset.scanIntervalMs &&
      normalized.transitionPauseMs === preset.transitionPauseMs &&
      normalized.firstCellPauseMs === preset.firstCellPauseMs &&
      normalized.inputLatencyCompensationMs === preset.inputLatencyCompensationMs
    ) {
      return preset.id;
    }
  }
  return "custom";
}

export function applyScanTimingPreset(config = createBoardConfig(), presetId = "default") {
  const preset = scanTimingPresetForId(presetId);
  return createBoardConfig({
    ...config,
    scanIntervalMs: preset.scanIntervalMs,
    transitionPauseMs: preset.transitionPauseMs,
    firstCellPauseMs: preset.firstCellPauseMs,
    inputLatencyCompensationMs: preset.inputLatencyCompensationMs
  });
}

export function boardRows(config = createBoardConfig(), message = "", canUndo = false, inputState = {}) {
  const normalized = createBoardConfig(config);
  const safeColumns = clampInt(normalized.columns, 2, 8);
  if (normalized.profileId === "zh-TW") {
    if (inputState.activeCategory) {
      const categoryRows = categorySuggestionRows(
        inputState.activeCategory,
        safeColumns,
        zhTwSuggestionColumnCount(safeColumns),
        message,
        canUndo
      );
      if (categoryRows.length > 0) return categoryRows;
    }
    const suggestionColumns = zhTwSuggestionColumnCount(safeColumns);
    return [
      ...zhTwSuggestionRows(
        message,
        normalized.suggestionDictionary,
        suggestionColumns,
        canUndo,
        inputState,
        normalized.symbols
      ),
      ...zhTwFirstLayerRows(normalized.symbols, safeColumns)
    ];
  }

  const suggestions = suggestionRow(message, normalized.suggestionDictionary, safeColumns, canUndo, {
    ...normalized,
    excludeTiles: normalized.symbols
  });
  return [suggestions, ...chunk(normalized.symbols, safeColumns)];
}

function zhTwSuggestionColumnCount(symbolColumns) {
  return Math.min(clampInt(symbolColumns, 2, 8), DefaultColumns);
}

function zhTwFirstLayerRows(symbols, symbolColumns) {
  const firstZhuyinIndex = symbols.findIndex(isZhuyinInputTile);
  if (firstZhuyinIndex < 0) return chunk(symbols, symbolColumns);

  const zhuyinTiles = symbols.slice(firstZhuyinIndex, firstZhuyinIndex + ZhuyinInputSymbols.length);
  const hasCanonicalZhuyinBlock = zhuyinTiles.length === ZhuyinInputSymbols.length &&
    zhuyinTiles.every((candidate, index) =>
      isZhuyinInputTile(candidate) && candidate.output === ZhuyinInputSymbols[index]
    );
  if (!hasCanonicalZhuyinBlock) return chunk(symbols, symbolColumns);

  const compactColumns = zhTwSuggestionColumnCount(symbolColumns);
  return [
    ...chunk(symbols.slice(0, firstZhuyinIndex), compactColumns),
    ...zhTwSymbolRows(zhuyinTiles, symbolColumns),
    ...chunk(symbols.slice(firstZhuyinIndex + ZhuyinInputSymbols.length), compactColumns)
  ];
}

function zhTwSymbolRows(items, maxColumns) {
  const safeMaxColumns = clampInt(maxColumns, 2, 8);
  if (items.length === ZhuyinInputSymbols.length && safeMaxColumns === 6) {
    // Preserve the conventional linear order. Among the 21 possible placements
    // of two six-key rows, this stable pattern minimizes corpus-weighted row +
    // cell scan cost without teaching users a new symbol order.
    return chunkByRowSizes(items, [6, 5, 5, 5, 6, 5, 5]);
  }
  return balancedChunk(items, safeMaxColumns);
}

function chunkByRowSizes(items, rowSizes) {
  const rows = [];
  let offset = 0;
  for (const rowSize of rowSizes) {
    rows.push(items.slice(offset, offset + rowSize));
    offset += rowSize;
  }
  return offset === items.length ? rows : balancedChunk(items, Math.max(...rowSizes));
}

function balancedChunk(items, maxColumns) {
  if (items.length === 0) return [];
  const safeMaxColumns = clampInt(maxColumns, 2, 8);
  const rowCount = Math.ceil(items.length / safeMaxColumns);
  const baseRowSize = Math.floor(items.length / rowCount);
  const widerRowCount = items.length % rowCount;
  const rows = [];
  let offset = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSize = baseRowSize + (rowIndex < widerRowCount ? 1 : 0);
    rows.push(items.slice(offset, offset + rowSize));
    offset += rowSize;
  }
  return rows;
}

function isZhuyinInputTile(candidate) {
  return candidate?.action === TileAction.Append && ZhuyinInputSymbolSet.has(candidate.output);
}

export function parseDictionary(text) {
  const parsed = parseSymbols(text).filter((candidate) => candidate.action === TileAction.Append);
  return parsed.length > 0 ? parsed : DefaultSuggestionDictionary;
}

export function parseSymbols(text) {
  if (typeof text !== "string") return DefaultTiles;
  const parsed = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseSymbolLine);
  return parsed.length > 0 ? parsed : DefaultTiles;
}

export function serializeDictionary(symbols) {
  return serializeSymbols(symbols);
}

export function serializeSymbols(symbols) {
  return symbols
    .map((candidate) => {
      switch (candidate.action) {
        case TileAction.Append:
          return candidate.output === candidate.label ? candidate.label : `${candidate.label}=${candidate.output}`;
        case TileAction.Space:
          return `${candidate.label || "SPC"}=<space>`;
        case TileAction.Backspace:
          return `${candidate.label || "DEL"}=<delete>`;
        case TileAction.Clear:
          return `${candidate.label || "CLR"}=<clear>`;
        case TileAction.Undo:
          return `${candidate.label || "UNDO"}=<undo>`;
        case TileAction.Speak:
          return `${candidate.label || "SAY"}=<speak>`;
        case TileAction.EnterMode:
          return `${candidate.label}=<mode:${candidate.output}>`;
        case TileAction.ExitMode:
          return `${candidate.label}=<mode:board>`;
        case TileAction.OpenCategory:
          return `${candidate.label}=<category:${candidate.output}>`;
        case TileAction.CloseCategory:
          return `${candidate.label}=<category:close>`;
        case TileAction.ZhuyinGroup:
          return `${candidate.label}=<zhuyin-group:${candidate.output}>`;
        case TileAction.ZhuyinSymbol:
          return `${candidate.label}=<zhuyin-symbol:${candidate.output}>`;
        case TileAction.CommitCandidate:
          return candidate.output === candidate.label ? candidate.label : `${candidate.label}=${candidate.output}`;
        case TileAction.MoreSuggestions:
          return `${candidate.label || "MORE"}=<more>`;
        case TileAction.Noop:
          return null;
        default:
          return null;
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function loadSymbolsForConfig(storedSymbols, storedVersion) {
  const parsedSymbols = parseSymbols(storedSymbols ?? serializeSymbols(DefaultTiles));
  return migrateSymbolsForConfig(parsedSymbols, storedVersion);
}

export function loadProfileSymbolsForConfig(storedSymbols, storedVersion, profileId = DefaultProfileId) {
  const profile = languageProfileForId(profileId);
  const parsedSymbols = parseSymbols(storedSymbols ?? serializeSymbols(profile.symbols));
  return migrateSymbolsForConfig(parsedSymbols, storedVersion, profile.id);
}

export function loadProfileColumnsForConfig(
  storedColumns,
  storedVersion,
  profileId = DefaultProfileId,
  storedSymbols = ""
) {
  const profile = languageProfileForId(profileId);
  const columns = clampInt(storedColumns, 2, 8);
  const previousBuiltInColumns = storedVersion >= 19 ? 5 : DefaultColumns;
  if (profile.id !== "zh-TW" || columns !== previousBuiltInColumns || storedVersion >= CurrentConfigVersion) {
    return columns;
  }
  const parsedSymbols = String(storedSymbols).trim().length > 0
    ? parseSymbols(storedSymbols)
    : LegacyZhTwTilesV18;
  return shouldMigrateBuiltInZhTwSymbols(parsedSymbols, storedVersion) ? profile.columns : columns;
}

function migrateSymbolsForConfig(parsedSymbols, storedVersion, profileId = DefaultProfileId) {
  if (profileId === "zh-TW" && shouldMigrateBuiltInZhTwSymbols(parsedSymbols, storedVersion)) {
    return ZhTwTiles;
  }
  if (profileId === "zh-TW") {
    return localizeZhTwStandardActionLabels(parsedSymbols);
  }
  if (
    storedVersion < CurrentConfigVersion &&
    (
      sameTiles(parsedSymbols, LegacyAlphabetDefaultTiles) ||
      sameTiles(parsedSymbols, LegacyFrequencyDefaultTilesV3) ||
      sameTiles(parsedSymbols, DefaultTilesWithBackspaceV21)
    )
  ) {
    return DefaultTiles;
  }
  return parsedSymbols;
}

function localizeZhTwStandardActionLabels(symbols) {
  return symbols.map((candidate) => {
    if (candidate.action === TileAction.Space && candidate.label === "SPC") return tile("空格", " ", TileAction.Space);
    if (candidate.action === TileAction.OpenCategory && candidate.output === EnglishCategoryId) return categoryTile("英文", EnglishCategoryId);
    if (candidate.action === TileAction.Backspace && ["DEL", "刪"].includes(candidate.label)) return tile("刪除", "DEL", TileAction.Backspace);
    if (candidate.action === TileAction.Clear && candidate.label === "CLR") return tile("清除", "CLR", TileAction.Clear);
    if (candidate.action === TileAction.Undo && candidate.label === "UNDO") return tile("復原", "UNDO", TileAction.Undo);
    if (candidate.action === TileAction.Speak && ["SAY", "說"].includes(candidate.label)) return tile("朗讀", "SAY", TileAction.Speak);
    if (candidate.action === TileAction.MoreSuggestions && candidate.label === "MORE") return zhTwMoreSuggestionsTile;
    return candidate;
  });
}

export function loadSuggestionDictionaryForConfig(storedDictionary, storedVersion) {
  const parsedDictionary = parseDictionary(storedDictionary ?? serializeDictionary(DefaultSuggestionDictionary));
  return migrateSuggestionDictionaryForConfig(parsedDictionary, storedVersion);
}

export function loadProfileSuggestionDictionaryForConfig(storedDictionary, storedVersion, profileId = DefaultProfileId) {
  const profile = languageProfileForId(profileId);
  const parsedDictionary = parseDictionary(storedDictionary ?? serializeDictionary(profile.suggestionDictionary));
  return migrateSuggestionDictionaryForConfig(parsedDictionary, storedVersion, profile.id);
}

function migrateSuggestionDictionaryForConfig(parsedDictionary, storedVersion, profileId = DefaultProfileId) {
  if (profileId === "zh-TW" && shouldMigrateBuiltInZhTwDictionary(parsedDictionary, storedVersion)) {
    return ZhTwSuggestionDictionary;
  }
  if (
    storedVersion < CurrentConfigVersion &&
    (sameTiles(parsedDictionary, LegacySuggestionDictionaryV6) || sameTiles(parsedDictionary, LegacySuggestionDictionaryV7))
  ) {
    return DefaultSuggestionDictionary;
  }
  return parsedDictionary;
}

function shouldMigrateBuiltInZhTwSymbols(symbols, storedVersion) {
  if (storedVersion >= CurrentConfigVersion) return false;
  if (sameTiles(symbols, LegacyZhTwTilesV18)) return true;
  if (sameTiles(symbols, ZhTwTilesWithBackspaceV21)) return true;
  if (sameTiles(symbols, ZhTwTiles)) return true;
  const labels = new Set(symbols.map((candidate) => candidate.label));
  const hasDirectZhuyinBoard = LegacyZhuyinStaticInputSymbolsV18.every((symbol) => labels.has(symbol)) &&
    !labels.has("注音") &&
    !labels.has("ㄅㄆㄇㄈ");
  const hasEnglishStaticBoard = frequencyLetters.every((letter) => labels.has(letter)) &&
    labels.has("\u7a7a\u683c");
  const hasEnglishEntryPoint = symbols.some((candidate) =>
    ["EN", "英文"].includes(candidate.label) &&
    candidate.action === TileAction.OpenCategory &&
    candidate.output === EnglishCategoryId
  );
  const hasCurrentDirectBoard = hasDirectZhuyinBoard && labels.has("\u66f4\u591a") && labels.has("不") && !labels.has("不要");
  if (hasCurrentDirectBoard) return !hasEnglishEntryPoint || hasEnglishStaticBoard;
  if (hasDirectZhuyinBoard && labels.has("MORE")) return true;

  const oldDefaultSignals = [
    "我", "你", "喝水", "吃飯", "廁所", "休息", "睡覺", "護理師", "醫生", "藥", "謝謝", "。"
  ].filter((label) => labels.has(label)).length;
  const oldCategorySignals = ["需要", "身體", "照護", "位置"].filter((label) => labels.has(label)).length;
  const oldZhuyinModeSignals = ["注音", "ㄅㄆㄇㄈ", "ㄧㄨㄩ"].filter((label) => labels.has(label)).length;
  return oldDefaultSignals >= 4 || oldCategorySignals >= 3 || oldZhuyinModeSignals >= 2;
}

function shouldMigrateBuiltInZhTwDictionary(dictionary, storedVersion) {
  if (storedVersion >= CurrentConfigVersion) return false;
  const labels = new Set(dictionary.map((candidate) => candidate.label));
  const oldLongPhraseSignals = ["我要喝水", "我要吃飯", "我要上廁所", "我需要幫忙", "我很痛", "叫護理師"]
    .filter((label) => labels.has(label)).length;
  if (oldLongPhraseSignals >= 2) return true;

  const previousSeedSignals = ["沒有", "媽媽", "慢", "門", "有沒有", "有需要"]
    .filter((label) => labels.has(label)).length;
  return previousSeedSignals >= 4 && (!labels.has("沒") || !labels.has("每") || !labels.has("由") || !labels.has("未"));
}

export function loadFirstCellPauseForConfig(storedPauseMs, storedVersion) {
  if (
    storedVersion < CurrentConfigVersion &&
    (
      storedPauseMs === LegacyFirstCellPauseMsV6 ||
      storedPauseMs === LegacyDefaultFirstCellPauseMs ||
      storedPauseMs === EarlierDefaultFirstCellPauseMs ||
      storedPauseMs === PreviousDefaultFirstCellPauseMs
    )
  ) {
    return DefaultFirstCellPauseMs;
  }
  return storedPauseMs;
}

export function loadScanIntervalForConfig(storedScanMs, storedVersion) {
  if (
    storedVersion < CurrentConfigVersion &&
    (storedScanMs === LegacyDefaultScanIntervalMs || storedScanMs === PreviousDefaultScanIntervalMs)
  ) {
    return DefaultScanIntervalMs;
  }
  return storedScanMs;
}

export function loadTransitionPauseForConfig(storedPauseMs, storedVersion) {
  if (storedVersion < CurrentConfigVersion && storedPauseMs === PreviousDefaultTransitionPauseMs) {
    return DefaultTransitionPauseMs;
  }
  return storedPauseMs;
}

export function suggestTiles(message, dictionary, maxSuggestions, options = {}) {
  const safeMax = Math.max(1, Math.trunc(maxSuggestions));
  return nonredundantTiles(
    rankedSuggestionCandidates(message, dictionary, options),
    options.excludeTiles,
    safeMax
  );
}

function rankedSuggestionCandidates(message, dictionary, options = {}) {
  if (options.autoSpace === AutoSpaceMode.None) {
    return rankedSuggestionCandidatesWithoutSpaces(message, dictionary);
  }

  const text = message.toLowerCase();
  const trimmed = text.trim();
  const endsWithBoundary = message.length === 0 || /\s$/.test(message);
  const currentToken = endsWithBoundary ? "" : trimmed.substring(trimmed.lastIndexOf(" ") + 1);
  const previousToken = endsWithBoundary
    ? trimmed.substring(trimmed.lastIndexOf(" ") + 1)
    : trimmed.includes(" ")
      ? trimmed.substring(0, trimmed.lastIndexOf(" ")).substring(trimmed.substring(0, trimmed.lastIndexOf(" ")).lastIndexOf(" ") + 1)
      : "";

  const ranked = currentToken
    ? dictionary
      .filter((candidate) => {
        const label = candidate.label.toLowerCase();
        const output = candidate.output.toLowerCase();
        return (label.startsWith(currentToken) || output.startsWith(currentToken)) &&
          label !== currentToken &&
          output !== currentToken;
      })
      .sort((left, right) => completionRank(currentToken, left) - completionRank(currentToken, right))
    : previousToken
      ? [...dictionary].sort((left, right) =>
          transitionRank(previousToken, left.output.toLowerCase()) -
          transitionRank(previousToken, right.output.toLowerCase())
        )
      : dictionary;

  return candidatesWithOutput(ranked);
}

function rankedSuggestionCandidatesWithoutSpaces(message, dictionary) {
  const currentText = message.replace(/\s+/g, "");
  const ranked = currentText
    ? dictionary
      .filter((candidate) => {
        const label = candidate.label.replace(/\s+/g, "");
        const output = candidate.output.replace(/\s+/g, "");
        return (label.startsWith(currentText) || output.startsWith(currentText)) &&
          label !== currentText &&
          output !== currentText;
      })
      .sort((left, right) => left.output.length - right.output.length)
    : dictionary;

  return candidatesWithOutput(ranked.length > 0 ? ranked : dictionary);
}

export function suggestionRow(message, dictionary, columns, canUndo = false, options = {}) {
  const safeColumns = clampInt(columns, 2, 8);
  const suggestionCount = Math.min(safeColumns, 4);
  const commandSuggestions = [];
  if (canUndo) commandSuggestions.push(UndoSuggestionTile);
  if (options.autoSpace !== AutoSpaceMode.None && message.trim().length > 0 && !/\s$/.test(message)) {
    commandSuggestions.push(SpaceSuggestionTile);
  }

  const suggestions = nonredundantTiles(
    concatenateTileCandidates(
      commandSuggestions,
      rankedSuggestionCandidates(message, dictionary, options),
      options.autoSpace === AutoSpaceMode.None ? [] : SuggestionFallbackLetters
    ),
    options.excludeTiles,
    suggestionCount
  );

  return [
    ...suggestions,
    ...Array.from({ length: safeColumns - suggestions.length }, () => tile("", "", TileAction.Noop))
  ];
}

function zhTwSuggestionRows(message, dictionary, columns, canUndo = false, inputState = {}, staticTiles = ZhTwTiles) {
  const safeColumns = clampInt(columns, 2, 8);
  const pageSize = safeColumns * ZhTwSuggestionRowCount;
  const totalSuggestions = zhTwReachableSuggestions(
    message,
    dictionary,
    safeColumns,
    canUndo,
    staticTiles
  );
  const pageCount = zhTwSuggestionPageCountForTotal(totalSuggestions.length, pageSize);
  const page = floorMod(clampInt(inputState.suggestionPage ?? 0, 0, MaxZhTwSuggestionPages - 1), pageCount);
  const needsMore = pageCount > 1;
  const usablePageSize = needsMore ? pageSize - 1 : pageSize;
  const pageSuggestions = totalSuggestions.slice(page * usablePageSize, page * usablePageSize + usablePageSize);
  const visibleSuggestions = needsMore
    ? [...pageSuggestions, zhTwMoreSuggestionsTile]
    : pageSuggestions;

  return chunk(padSuggestions(visibleSuggestions, pageSize), safeColumns);
}

function zhTwCommandSuggestionTiles(message, canUndo) {
  const buffer = trailingZhuyinBuffer(message);
  return [
    ...(canUndo ? [zhTwUndoSuggestionTile] : []),
    ...(buffer.length > 1 ? [zhuyinClearTile] : [])
  ];
}

function zhTwSuggestionTiles(
  message,
  dictionary = ZhTwSuggestionDictionary,
  columns = DefaultColumns,
  staticTiles = ZhTwTiles
) {
  const buffer = trailingZhuyinBuffer(message);
  const candidates = buffer
    ? zhTwBufferedSuggestionTiles(buffer, columns, staticTiles)
    : zhTwUnbufferedSuggestionTiles(message, dictionary);

  return candidatesWithoutSuppressedLabels(candidates);
}

function zhTwUnbufferedSuggestionTiles(message, dictionary = ZhTwSuggestionDictionary) {
  const contextCompletions = zhTwContextCompletionTiles(message);
  if (contextCompletions.length > 0) return contextCompletions;

  return dictionary
    .filter((candidate) => candidate.action !== TileAction.Noop)
    .filter((candidate) => !ZhTwCoreResponseLabels.has(candidate.label));
}

function zhTwBufferedSuggestionTiles(buffer, columns, staticTiles = ZhTwTiles) {
  const rankedCandidates = distinctBy(
    (ZhTwDictionaryByPrefix.get(buffer) ?? [])
      .map((entry) => zhTwCandidateForBuffer(entry, buffer))
      .filter(Boolean)
      .sort((left, right) => zhTwCandidateRankForBuffer(left, right, buffer)),
    (candidate) => `${candidate.label}\u0000${candidate.output}`
  );
  const staticSymbols = new Set(staticTiles.filter(isZhuyinInputTile).map((candidate) => candidate.output));
  const nextSymbols = zhTwNextSymbolTiles(buffer)
    .filter((candidate) => !staticSymbols.has(candidate.output));
  if (rankedCandidates.length === 0 && nextSymbols.length === 0) {
    return zhTwRepairSuggestionTiles(buffer, columns);
  }
  const exactCandidateCount = rankedCandidates
    .filter((candidate) => candidate.zhuyinKey.length === buffer.length)
    .length;
  const priorityNextSymbolCount = nextSymbols
    .filter((candidate) => !ZhuyinInitialSymbolSet.has(candidate.output))
    .length;
  const immediateCandidateCount = zhTwImmediateCandidateCount(
    buffer,
    columns,
    nextSymbols.length,
    exactCandidateCount,
    priorityNextSymbolCount
  );
  const firstPageNextSymbolCount = zhTwFirstPageNextSymbolCount(buffer, columns, nextSymbols.length, immediateCandidateCount);
  const firstPageNextSymbols = nextSymbols.slice(0, firstPageNextSymbolCount);
  const overflowNextSymbols = nextSymbols.slice(firstPageNextSymbolCount);
  const firstPagePhoneticNextSymbols = firstPageNextSymbols
    .filter((candidate) => !ZhuyinInitialSymbolSet.has(candidate.output));
  const firstPageInitialNextSymbols = firstPageNextSymbols
    .filter((candidate) => ZhuyinInitialSymbolSet.has(candidate.output));
  const overflowPhoneticNextSymbols = overflowNextSymbols
    .filter((candidate) => !ZhuyinInitialSymbolSet.has(candidate.output));
  const overflowInitialNextSymbols = overflowNextSymbols
    .filter((candidate) => ZhuyinInitialSymbolSet.has(candidate.output));
  const remainingCandidates = rankedCandidates.slice(immediateCandidateCount);
  const laterCandidates = buffer.length <= 1
    ? [
      ...remainingCandidates.filter((candidate) => candidate.zhuyinKey.length === buffer.length),
      ...remainingCandidates.filter((candidate) => candidate.zhuyinKey.length !== buffer.length)
    ]
    : remainingCandidates;
  const orderedCandidates = [
    // When the buffer can still form a phonetic syllable, completing that input is
    // fundamental. Glyph and phrase candidates are speculative until the user commits one.
    ...firstPagePhoneticNextSymbols,
    ...rankedCandidates.slice(0, immediateCandidateCount),
    ...overflowPhoneticNextSymbols,
    ...firstPageInitialNextSymbols,
    ...laterCandidates,
    ...overflowInitialNextSymbols
  ];

  return distinctBy(
    orderedCandidates,
    (candidate) => `${candidate.action}\u0000${candidate.label}\u0000${candidate.output}`
  );
}

function zhTwRepairSuggestionTiles(buffer, columns) {
  const safeColumns = clampInt(columns, 2, 8);
  const repairs = zhTwRepairPrefixes(buffer)
    .map((repair) => ({
      ...repair,
      candidates: distinctBy(
        (ZhTwDictionaryByPrefix.get(repair.correctedKey) ?? [])
          .map((entry) => zhTwRepairCandidateForBuffer(entry, buffer, repair))
          .filter(Boolean)
          .sort((left, right) => zhTwCandidateRankForBuffer(left, right, repair.correctedKey)),
        (candidate) => `${candidate.label}\u0000${candidate.output}`
      )
    }))
    .filter((repair) => repair.candidates.length > 0);
  const repairsByDistance = new Map();
  for (const repair of repairs) {
    if (!repairsByDistance.has(repair.distanceFromEnd)) repairsByDistance.set(repair.distanceFromEnd, []);
    repairsByDistance.get(repair.distanceFromEnd).push(repair);
  }
  const candidateGroups = [...repairsByDistance.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, group]) => zhTwInterleaveRepairCandidates(group, safeColumns));
  const pageSize = safeColumns * ZhTwSuggestionRowCount;
  const maxRepairCandidates = Math.max(1, (pageSize - 1) * MaxZhTwSuggestionPages - 1);
  const ordered = [];

  for (let index = 0; ordered.length < maxRepairCandidates; index += 1) {
    let added = false;
    for (const group of candidateGroups) {
      const candidate = group[index];
      if (!candidate) continue;
      added = true;
      if (ordered.some((existing) => existing.label === candidate.label && existing.output === candidate.output)) continue;
      ordered.push(candidate);
      if (ordered.length >= maxRepairCandidates) break;
    }
    if (!added) break;
  }

  return ordered;
}

function zhTwInterleaveRepairCandidates(repairs, preferredCandidateCount) {
  const orderedRepairs = repairs.slice().sort((left, right) =>
    left.kindRank - right.kindRank ||
    left.bestFrequencyRank - right.bestFrequencyRank ||
    left.correctedKey.localeCompare(right.correctedKey)
  );
  const candidates = [];
  for (const repair of orderedRepairs) {
    candidates.push(...repair.candidates.slice(0, preferredCandidateCount));
  }
  for (let index = preferredCandidateCount; ; index += 1) {
    let added = false;
    for (const repair of orderedRepairs) {
      const candidate = repair.candidates[index];
      if (!candidate) continue;
      candidates.push(candidate);
      added = true;
    }
    if (!added) return candidates;
  }
}

function zhTwRepairPrefixes(buffer) {
  const repairsByKey = new Map();
  const addRepair = (correctedKey, repairKind, repairIndex, kindRank) => {
    if (!correctedKey || correctedKey === buffer || !ZhTwDictionaryByPrefix.has(correctedKey)) return;
    const distanceFromEnd = Math.max(0, buffer.length - 1 - repairIndex);
    const bestFrequencyRank = (ZhTwDictionaryByPrefix.get(correctedKey) ?? [])
      .reduce((best, entry) => Math.min(best, entry.frequencyRank), Number.POSITIVE_INFINITY);
    const repair = Object.freeze({
      correctedKey,
      repairKind,
      repairIndex,
      distanceFromEnd,
      kindRank,
      bestFrequencyRank
    });
    const existing = repairsByKey.get(correctedKey);
    if (!existing || zhTwRepairPrefixRank(repair, existing) < 0) repairsByKey.set(correctedKey, repair);
  };

  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    addRepair(`${buffer.slice(0, index)}${buffer.slice(index + 1)}`, "delete", index, 0);
    for (const symbol of ZhuyinInputSymbols) {
      addRepair(`${buffer.slice(0, index)}${symbol}${buffer.slice(index + 1)}`, "substitute", index, 1);
    }
  }
  for (let index = buffer.length - 2; index >= 0; index -= 1) {
    addRepair(
      `${buffer.slice(0, index)}${buffer.at(index + 1)}${buffer.at(index)}${buffer.slice(index + 2)}`,
      "transpose",
      index + 1,
      2
    );
  }
  for (let index = buffer.length; index >= 0; index -= 1) {
    for (const symbol of ZhuyinInputSymbols) {
      addRepair(`${buffer.slice(0, index)}${symbol}${buffer.slice(index)}`, "insert", Math.min(index, buffer.length - 1), 3);
    }
  }

  return [...repairsByKey.values()].sort(zhTwRepairPrefixRank);
}

function zhTwRepairPrefixRank(left, right) {
  return left.distanceFromEnd - right.distanceFromEnd ||
    left.kindRank - right.kindRank ||
    left.bestFrequencyRank - right.bestFrequencyRank ||
    left.correctedKey.localeCompare(right.correctedKey);
}

function zhTwRepairCandidateForBuffer(entry, buffer, repair) {
  const matchingKey = entryKeys(entry)
    .filter((key) => key.startsWith(repair.correctedKey))
    .sort((left, right) => left.length - right.length)[0];
  if (!matchingKey) return null;
  return Object.freeze({
    ...zhTwCandidateTile(entry, buffer.length, matchingKey, "repair"),
    originalBuffer: buffer,
    correctedKey: repair.correctedKey,
    repairKind: repair.repairKind,
    repairIndex: repair.repairIndex
  });
}

function zhTwImmediateCandidateCount(
  buffer,
  columns,
  nextSymbolCount = 0,
  exactCandidateCount = 0,
  priorityNextSymbolCount = nextSymbolCount
) {
  const safeColumns = clampInt(columns, 2, 8);
  const preferredCount = zhTwPreferredCandidateCountBeforeNextSymbols(
    buffer,
    safeColumns,
    exactCandidateCount,
    priorityNextSymbolCount
  );
  if (!zhTwNeedsPhoneticContinuationSpace(buffer)) return preferredCount;

  const firstPageUsableCount = safeColumns * ZhTwSuggestionRowCount - 1;
  const minimumCandidateCount = zhTwMinimumCandidateCountBeforeNextSymbols(buffer, safeColumns);
  const firstPageNextSymbolBudget = Math.max(0, firstPageUsableCount - preferredCount);
  return clampInt(
    firstPageUsableCount - Math.min(nextSymbolCount, firstPageNextSymbolBudget),
    minimumCandidateCount,
    preferredCount
  );
}

function zhTwFirstPageNextSymbolCount(buffer, columns, nextSymbolCount, candidateCount) {
  if (!zhTwNeedsPhoneticContinuationSpace(buffer)) return 0;

  const safeColumns = clampInt(columns, 2, 8);
  const firstPageUsableCount = safeColumns * ZhTwSuggestionRowCount - 1;
  return clampInt(firstPageUsableCount - candidateCount, 0, nextSymbolCount);
}

function zhTwCandidateForBuffer(entry, buffer) {
  const matchingKey = entryKeys(entry)
    .filter((key) => key.startsWith(buffer))
    .sort((left, right) => left.length - right.length)[0];
  if (!matchingKey) return null;
  return zhTwCandidateTile(entry, buffer.length, matchingKey, "exact");
}

function zhTwNextSymbolTiles(buffer) {
  const symbols = distinctBy(
    [
      ...(ZhTwNextSymbolsByPrefix.get(buffer) ?? []),
      ...(ZhuyinContinuationSymbols[buffer] ?? [])
    ],
    (symbol) => symbol
  ).filter((symbol) => ZhTwValidPrefixSet.has(`${buffer}${symbol}`));
  const orderedSymbols = zhTwNeedsPhoneticContinuationSpace(buffer)
    ? [
      ...symbols.filter((symbol) => !ZhuyinInitialSymbolSet.has(symbol)),
      ...symbols.filter((symbol) => ZhuyinInitialSymbolSet.has(symbol))
    ]
    : symbols;
  return orderedSymbols.map((symbol) => tile(symbol, symbol, TileAction.Append));
}

function zhTwPreferredCandidateCountBeforeNextSymbols(
  buffer,
  columns,
  exactCandidateCount,
  priorityNextSymbolCount
) {
  const establishedCount = columns * 2;
  if (buffer.length <= 1) return establishedCount;
  const firstPageUsableCount = columns * ZhTwSuggestionRowCount - 1;
  // Multi-symbol buffers always show 重選 and may also show 復原, so reserve both command slots.
  const availableWithCommandsAndContinuations = firstPageUsableCount - 2 - priorityNextSymbolCount;
  if (
    exactCandidateCount >= columns * 3 &&
    availableWithCommandsAndContinuations >= establishedCount + 2
  ) {
    return establishedCount + 2;
  }
  if (exactCandidateCount < columns) return Math.max(columns, establishedCount - 2);
  return establishedCount;
}

function zhTwMinimumCandidateCountBeforeNextSymbols(buffer, columns) {
  return columns;
}

function zhTwNeedsPhoneticContinuationSpace(buffer) {
  return buffer.length <= 1 || ["ㄧ", "ㄨ", "ㄩ"].includes(buffer.at(-1));
}

function zhTwCandidateTile(entry, replaceLength, matchingKey, matchType) {
  return Object.freeze({
    label: entry.label,
    output: entry.output,
    action: TileAction.CommitCandidate,
    replaceLength,
    zhuyinKey: matchingKey,
    matchType,
    keys: entry.keys,
    frequencyRank: entry.frequencyRank,
    frequency: entry.frequency
  });
}

function zhTwContextCompletionTiles(message) {
  const context = trailingHanContext(message);
  if (!context) return [];

  return distinctBy(
    (ZhTwPhraseCompletionsByPrefix.get(context) ?? [])
      .filter((entry) => !ZhTwSuppressedSuggestionLabels.has(entry.label))
      .map((entry) => zhTwContextCompletionTile(entry, context)),
    (candidate) => `${candidate.label}\u0000${candidate.output}`
  );
}

function zhTwContextCompletionTile(entry, context) {
  const suffix = Array.from(entry.label).slice(Array.from(context).length).join("");
  return Object.freeze({
    label: suffix,
    output: suffix,
    action: TileAction.CommitCandidate,
    replaceLength: 0,
    zhuyinKey: entry.key,
    matchType: "context",
    sourceLabel: entry.label,
    keys: entry.keys,
    frequencyRank: entry.frequencyRank,
    frequency: entry.frequency
  });
}

function zhTwCandidateRank(left, right) {
  return left.frequencyRank - right.frequencyRank;
}

function zhTwCandidateRankForBuffer(left, right, buffer) {
  if (buffer.length <= 1) return zhTwCandidateRank(left, right);

  const leftIsExactKey = left.zhuyinKey.length === buffer.length;
  const rightIsExactKey = right.zhuyinKey.length === buffer.length;
  if (leftIsExactKey !== rightIsExactKey) return leftIsExactKey ? -1 : 1;
  return zhTwCandidateRank(left, right);
}

function trailingZhuyinBuffer(message) {
  let buffer = "";
  for (const character of Array.from(message).reverse()) {
    if (!ZhuyinInputSymbolSet.has(character)) break;
    buffer = character + buffer;
  }
  return buffer;
}

function trailingHanContext(message) {
  let context = "";
  for (const character of Array.from(message).reverse()) {
    if (!isHanCharacter(character)) break;
    context = character + context;
    if (Array.from(context).length >= MaxZhTwContextChars) break;
  }
  return context;
}

function isHanCharacter(character) {
  return /^\p{Script=Han}$/u.test(character);
}

function zhTwSuggestionPageCount(message, dictionary, columns, canUndo = false, staticTiles = ZhTwTiles) {
  const safeColumns = clampInt(columns, 2, 8);
  const pageSize = safeColumns * ZhTwSuggestionRowCount;
  const count = zhTwReachableSuggestions(
    message,
    dictionary,
    safeColumns,
    canUndo,
    staticTiles
  ).length;
  return zhTwSuggestionPageCountForTotal(count, pageSize);
}

function zhTwReachableSuggestions(message, dictionary, columns, canUndo, staticTiles) {
  const pageSize = columns * ZhTwSuggestionRowCount;
  const reachableLimit = (pageSize - 1) * MaxZhTwSuggestionPages;
  return nonredundantTiles(
    concatenateTileCandidates(
      zhTwCommandSuggestionTiles(message, canUndo),
      zhTwSuggestionTiles(message, dictionary, columns, staticTiles)
    ),
    staticTiles,
    reachableLimit
  );
}

function zhTwSuggestionPageCountForTotal(total, pageSize) {
  if (total <= pageSize) return 1;
  return clampInt(Math.ceil(total / Math.max(1, pageSize - 1)), 1, MaxZhTwSuggestionPages);
}

function padSuggestions(suggestions, size) {
  return [
    ...suggestions.slice(0, size),
    ...Array.from({ length: Math.max(0, size - suggestions.length) }, () => tile("", "", TileAction.Noop))
  ];
}

function zhuyinRows(inputState, columns) {
  const state = normalizeZhuyinState(inputState);
  const commandRow = zhuyinCommandRow(state, columns);
  const bodyRows = state.zhuyinStage === "initialGroup"
    ? zhuyinInitialGroupRows(columns)
    : zhuyinLookupRows(state, columns);

  return [commandRow, ...bodyRows];
}

function categorySuggestionRows(categoryId, columns, commandColumns = columns, message = "", canUndo = false) {
  const category = ZhTwPhraseCategories[categoryId];
  if (!category) return [];
  if (categoryId === EnglishCategoryId) {
    const commandTiles = [
      zhuyinCategoryCloseTile,
      tile("朗讀", "SAY", TileAction.Speak),
      tile("復原", "UNDO", TileAction.Undo),
      tile("清除", "CLR", TileAction.Clear)
    ];
    const suggestions = suggestionRow(
      trailingEnglishCategoryText(message),
      DefaultSuggestionDictionary,
      commandColumns,
      canUndo,
      {
        autoSpace: AutoSpaceMode.Word,
        excludeTiles: [...commandTiles, ...category.tiles]
      }
    ).map((candidate) => {
      if (candidate.action === TileAction.Undo) return zhTwUndoSuggestionTile;
      if (candidate.action === TileAction.Space) return tile("空格", " ", TileAction.Space);
      return candidate;
    });
    return [suggestions, paddedRow(commandTiles, commandColumns), ...chunk(category.tiles, columns)];
  }
  const commandTiles = [categoryCloseTile, tile(category.label, category.label, TileAction.Noop)];
  const commandRow = paddedRow(commandTiles, commandColumns);
  return [commandRow, ...chunk(category.tiles, columns)];
}

function trailingEnglishCategoryText(message) {
  return message.match(/[A-Za-z']+(?:\s+[A-Za-z']+)*\s*$/u)?.[0] ?? "";
}

function zhuyinCommandRow(state, columns) {
  const label = state.zhuyinBuffer ? `找 ${state.zhuyinBuffer}` : "找讀音";
  const row = [zhuyinClearTile, boardModeTile(), tile(label, label, TileAction.Noop)];
  return paddedRow(row.slice(0, columns), columns);
}

function zhuyinInitialGroupRows(columns) {
  return chunk(ZhuyinInitialGroups.map((group) => zhuyinGroupTile(group.label, group.id)), columns);
}

function zhuyinLookupRows(state, columns) {
  const matchingEntries = zhuyinEntriesForState(state);
  const candidateEntries = zhuyinCandidateEntriesForState(state, matchingEntries);
  const candidateTiles = candidateEntries.map((entry) => tile(entry.label, entry.output, TileAction.CommitCandidate));
  const nextSymbolTiles = nextZhuyinSymbolsForState(state)
    .map((symbol) => zhuyinSymbolTile(symbol, symbol, "prefix"));
  return chunk([...candidateTiles, ...nextSymbolTiles], columns);
}

function zhuyinEntriesForState(state) {
  let entries;
  if (state.zhuyinBuffer) {
    entries = ZhuyinLookupDictionary.filter((entry) => entryMatchesPrefix(entry, state.zhuyinBuffer));
    return distinctBy(entries, (entry) => `${entry.label}\u0000${entry.output}`);
  }
  const group = ZhuyinInitialGroups.find((candidate) => candidate.id === state.zhuyinGroup);
  entries = !group
    ? ZhuyinLookupDictionary
    : ZhuyinLookupDictionary.filter((entry) => group.symbols.some((symbol) => entryMatchesPrefix(entry, symbol)));
  return distinctBy(entries, (entry) => `${entry.label}\u0000${entry.output}`);
}

function zhuyinCandidateEntriesForState(state, matchingEntries) {
  const primary = distinctBy(matchingEntries, (entry) => `${entry.label}\u0000${entry.output}`);
  if (!state.zhuyinBuffer || primary.length >= MinZhuyinTargets) {
    return primary.slice(0, MaxZhuyinCandidateTargets);
  }

  return distinctBy(
    [
      ...primary,
      ...zhuyinFallbackEntriesForState(state, primary)
    ],
    (entry) => `${entry.label}\u0000${entry.output}`
  ).slice(0, MaxZhuyinCandidateTargets);
}

function zhuyinFallbackEntriesForState(state, primaryEntries) {
  const primaryKeys = new Set(primaryEntries.map((entry) => `${entry.label}\u0000${entry.output}`));
  const fallbackPrefixes = distinctBy(
    [
      state.zhuyinBuffer.slice(0, -1),
      state.zhuyinBuffer.at(0),
      ...(ZhuyinInitialGroups.find((candidate) => candidate.id === state.zhuyinGroup)?.symbols ?? [])
    ].filter(Boolean),
    (prefix) => prefix
  );

  return fallbackPrefixes
    .flatMap((prefix) => ZhuyinLookupDictionary.filter((entry) => entryMatchesPrefix(entry, prefix)))
    .filter((entry) => !primaryKeys.has(`${entry.label}\u0000${entry.output}`));
}

function nextZhuyinSymbolsForState(state) {
  const entries = zhuyinEntriesForState(state);
  if (!state.zhuyinBuffer) {
    const group = ZhuyinInitialGroups.find((candidate) => candidate.id === state.zhuyinGroup);
    return group?.symbols ?? [];
  }

  return distinctBy(
    entries
      .flatMap((entry) => entryKeys(entry).map((key) => key.at(state.zhuyinBuffer.length)))
      .filter(Boolean),
    (symbol) => symbol
  ).slice(0, 8);
}

function entryKeys(entry) {
  return entry.keys ?? [entry.key];
}

function buildZhTwDictionaryByPrefix(dictionary) {
  const map = new Map();
  for (const entry of dictionary) {
    for (const key of entryKeys(entry)) {
      for (let length = 1; length <= key.length; length += 1) {
        const prefix = key.slice(0, length);
        if (!map.has(prefix)) map.set(prefix, []);
        map.get(prefix).push(entry);
      }
    }
  }
  return map;
}

function buildZhTwNextSymbolsByPrefix(dictionary) {
  const map = new Map();
  for (const entry of dictionary) {
    for (const key of entryKeys(entry)) {
      for (let length = 1; length < key.length; length += 1) {
        const prefix = key.slice(0, length);
        const symbol = key.at(length);
        if (!ZhuyinInputSymbolSet.has(symbol)) continue;
        if (!map.has(prefix)) map.set(prefix, new Set());
        map.get(prefix).add(symbol);
      }
    }
  }
  return new Map([...map.entries()].map(([prefix, symbols]) => [prefix, [...symbols]]));
}

function buildZhTwPhraseCompletionsByPrefix(dictionary) {
  const map = new Map();
  for (const entry of dictionary) {
    const characters = Array.from(entry.label);
    if (characters.length <= 1) continue;
    for (let length = 1; length < Math.min(characters.length, MaxZhTwContextChars + 1); length += 1) {
      const prefix = characters.slice(0, length).join("");
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix).push(entry);
    }
  }
  return map;
}

function zhTwFirstSymbolAccessStats(symbol, dictionary, staticSet) {
  const entries = dictionary.filter((entry) => entryKeys(entry).some((key) => key.at(0) === symbol));
  const weight = entries.reduce((sum, entry) => sum + zhTwAccessWeight(entry), 0);
  return Object.freeze({
    symbol,
    static: staticSet.has(symbol),
    entryCount: entries.length,
    weight
  });
}

function zhTwHiddenSymbolAccessStats(symbol, dictionary, staticSet, columns) {
  const prefixMap = new Map();
  let entryCount = 0;
  let visiblePrefixCount = 0;
  let reachableWeight = 0;
  for (const entry of dictionary) {
    let entryUsesSymbol = false;
    for (const key of entryKeys(entry)) {
      for (let index = 1; index < key.length; index += 1) {
        if (key.at(index) !== symbol) continue;
        const prefix = key.slice(0, index);
        if (!staticSet.has(key.at(0))) continue;
        entryUsesSymbol = true;
        if (!prefixMap.has(prefix)) {
          const visible = zhTwVisibleNextSymbolsForPrefix(prefix, columns, staticSet).includes(symbol);
          prefixMap.set(prefix, visible);
          if (visible) visiblePrefixCount += 1;
        }
        if (prefixMap.get(prefix)) reachableWeight += zhTwAccessWeight(entry);
      }
    }
    if (entryUsesSymbol) entryCount += 1;
  }

  return Object.freeze({
    symbol,
    entryCount,
    prefixCount: prefixMap.size,
    visiblePrefixCount,
    allPrefixesVisible: prefixMap.size === visiblePrefixCount,
    reachableWeight
  });
}

function zhTwEntryAccessPath(entry, staticSet, columns) {
  const paths = entryKeys(entry).map((key) => zhTwKeyAccessPath(entry, key, staticSet, columns));
  return paths.find((path) => path.reachable) ?? paths[0] ?? Object.freeze({
    label: entry.label,
    key: "",
    reachable: false,
    blockedAt: 0,
    blockedSymbol: "",
    reason: "missing-key"
  });
}

function zhTwVisibleDeadEndContinuations(dictionary, staticSet, columns) {
  const checked = new Set();
  const deadEnds = [];
  const validPrefixSet = zhTwValidPrefixSet(dictionary);
  const prefixes = distinctBy(
    dictionary.flatMap((entry) =>
      entryKeys(entry).flatMap((key) =>
        Array.from({ length: Math.max(0, key.length - 1) }, (_, index) => key.slice(0, index + 1))
      )
    ),
    (prefix) => prefix
  );

  for (const prefix of prefixes) {
    if (!prefix || !staticSet.has(prefix.at(0))) continue;
    for (const symbol of zhTwVisibleNextSymbolsForPrefix(prefix, columns, staticSet)) {
      const nextPrefix = `${prefix}${symbol}`;
      const key = `${prefix}\u0000${symbol}`;
      if (checked.has(key)) continue;
      checked.add(key);
      if (validPrefixSet.has(nextPrefix)) continue;
      deadEnds.push(Object.freeze({
        prefix,
        symbol,
        nextPrefix,
        reason: "no-candidate-or-continuation"
      }));
    }
  }

  return deadEnds;
}

function zhTwValidPrefixSet(dictionary) {
  const prefixes = new Set();
  for (const entry of dictionary) {
    for (const key of entryKeys(entry)) {
      for (let length = 1; length <= key.length; length += 1) {
        prefixes.add(key.slice(0, length));
      }
    }
  }
  return prefixes;
}

function zhTwKeyAccessPath(entry, key, staticSet, columns) {
  if (!key || !staticSet.has(key.at(0))) {
    return Object.freeze({
      label: entry.label,
      key,
      reachable: false,
      blockedAt: 0,
      blockedSymbol: key?.at(0) ?? "",
      reason: "first-symbol-not-static"
    });
  }

  for (let index = 1; index < key.length; index += 1) {
    const symbol = key.at(index);
    const prefix = key.slice(0, index);
    const available = staticSet.has(symbol) || zhTwVisibleNextSymbolsForPrefix(prefix, columns, staticSet).includes(symbol);
    if (!available) {
      return Object.freeze({
        label: entry.label,
        key,
        reachable: false,
        blockedAt: index,
        blockedSymbol: symbol,
        prefix,
        reason: "hidden-continuation-not-visible"
      });
    }
  }

  return Object.freeze({
    label: entry.label,
    key,
    reachable: true
  });
}

function zhTwAccessWeight(entry) {
  const frequency = Number(entry.frequency ?? 0);
  if (Number.isFinite(frequency) && frequency > 0) return frequency;
  const rank = Math.max(1, Number(entry.frequencyRank ?? entry.sourceRank ?? 1));
  return 1 / rank;
}

function entryMatchesPrefix(entry, prefix) {
  return entryKeys(entry).some((key) => key.startsWith(prefix));
}

export function createScannerState(overrides = {}) {
  return {
    stage: ScanStage.Rows,
    rowIndex: 0,
    cellIndex: 0,
    ...overrides
  };
}

export function advanceScanner(state, rowCount, columnCountForRow) {
  if (rowCount <= 0) return state;
  switch (state.stage) {
    case ScanStage.Rows:
      return {
        ...state,
        rowIndex: nextSelectableRow(state.rowIndex, rowCount, columnCountForRow),
        cellIndex: 0
      };
    case ScanStage.RowSelected:
      return { ...state, stage: ScanStage.FirstCell, cellIndex: 0 };
    case ScanStage.FirstCell: {
      const columns = Math.max(1, columnCountForRow(state.rowIndex));
      return { ...state, stage: ScanStage.Cells, cellIndex: columns === 1 ? 0 : 1 };
    }
    case ScanStage.Cells: {
      const columns = Math.max(1, columnCountForRow(state.rowIndex));
      return { ...state, cellIndex: floorMod(state.cellIndex + 1, columns) };
    }
    default:
      return state;
  }
}

export function confirmScanner(state, rowCount, columnCountForRow) {
  if (rowCount <= 0) return { type: "none", nextState: state };
  switch (state.stage) {
    case ScanStage.Rows: {
      const safeRow = clampInt(state.rowIndex, 0, rowCount - 1);
      return {
        type: "none",
        nextState: { ...state, stage: ScanStage.RowSelected, rowIndex: safeRow, cellIndex: 0 }
      };
    }
    case ScanStage.RowSelected: {
      const safeRow = clampInt(state.rowIndex, 0, rowCount - 1);
      return {
        type: "none",
        nextState: createScannerState({ stage: ScanStage.Rows, rowIndex: safeRow, cellIndex: 0 })
      };
    }
    case ScanStage.FirstCell: {
      const safeRow = clampInt(state.rowIndex, 0, rowCount - 1);
      return {
        type: "selected",
        rowIndex: safeRow,
        cellIndex: 0,
        nextState: createScannerState({ stage: ScanStage.Rows, rowIndex: safeRow, cellIndex: 0 })
      };
    }
    case ScanStage.Cells: {
      const safeRow = clampInt(state.rowIndex, 0, rowCount - 1);
      const columns = Math.max(1, columnCountForRow(safeRow));
      return {
        type: "selected",
        rowIndex: safeRow,
        cellIndex: clampInt(state.cellIndex, 0, columns - 1),
        nextState: createScannerState({ stage: ScanStage.Rows, rowIndex: safeRow, cellIndex: 0 })
      };
    }
    default:
      return { type: "none", nextState: state };
  }
}

export function confirmWithLatencyCompensation(state, rowCount, columnCountForRow, elapsedInHighlightMs, compensationWindowMs) {
  const compensatedState = elapsedInHighlightMs >= 0 && elapsedInHighlightMs < compensationWindowMs
    ? previousHighlight(state, rowCount, columnCountForRow)
    : state;
  return confirmScanner(compensatedState, rowCount, columnCountForRow);
}

export function updateMessage(current, selectedTile, options = {}) {
  switch (selectedTile.action) {
    case TileAction.Append:
      return appendToken(current, selectedTile, options);
    case TileAction.Space:
      return current.trimEnd() + " ";
    case TileAction.Backspace:
      return current.slice(0, -1);
    case TileAction.Clear:
      return "";
    case TileAction.Undo:
    case TileAction.Speak:
    case TileAction.Noop:
    default:
      return current;
  }
}

export function appendToken(current, selectedTile, options = {}) {
  const token = selectedTile.output;
  if (options.autoSpace === AutoSpaceMode.None) return current + token;

  const isSpellingLetter = token.length === 1 &&
    selectedTile.label.length === 1 &&
    selectedTile.output === selectedTile.label.toLowerCase() &&
    /\p{L}/u.test(token);
  if (isSpellingLetter) return current + token;

  if (token.length > 1 && current.length > 0 && !/\s$/.test(current)) {
    const currentTokenStart = options.embeddedEnglish
      ? trailingEnglishTokenStart(current)
      : current.lastIndexOf(" ") + 1;
    const currentToken = current.slice(currentTokenStart);
    if (
      currentToken.length > 0 &&
      token.toLowerCase().startsWith(currentToken.toLowerCase()) &&
      token.toLowerCase() !== currentToken.toLowerCase()
    ) {
      return `${current.slice(0, currentTokenStart)}${token} `;
    }
  }
  if (current.trim().length === 0) return `${token} `;
  if (current.endsWith(" ")) return `${current}${token} `;
  if (options.embeddedEnglish && /\p{Script=Han}$/u.test(current)) return `${current}${token} `;
  return `${current.trimEnd()} ${token} `;
}

function trailingEnglishTokenStart(text) {
  const match = text.match(/[A-Za-z']+$/u);
  return match ? match.index : text.length;
}

export function createSession(overrides = {}) {
  return {
    config: createBoardConfig(),
    message: "",
    messageHistory: [],
    inputMode: "board",
    activeCategory: null,
    zhuyinBuffer: "",
    zhuyinStage: "initialGroup",
    zhuyinGroup: null,
    suggestionPage: 0,
    suggestionPageHistory: [],
    scannerState: createScannerState(),
    lockedRow: null,
    lastSelection: null,
    ...overrides
  };
}

export function visibleBoard(session) {
  const rows = boardRows(session.config, session.message, session.messageHistory.length > 0, session);
  return withLockedRow(rows, session.scannerState, session.lockedRow);
}

export function advanceSession(session) {
  const rows = visibleBoard(session);
  const nextState = advanceScanner(session.scannerState, rows.length, (row) => selectableCount(rows[row]));
  return {
    ...session,
    scannerState: nextState,
    lockedRow: nextState.stage === ScanStage.Rows ? null : session.lockedRow,
    lastSelection: null
  };
}

export function pressSwitch(session, elapsedInHighlightMs) {
  const rows = visibleBoard(session);
  const confirmation = confirmWithLatencyCompensation(
    session.scannerState,
    rows.length,
    (row) => selectableCount(rows[row]),
    elapsedInHighlightMs,
    session.config.inputLatencyCompensationMs
  );

  if (confirmation.type === "none") {
    const isLockingRow =
      session.scannerState.stage === ScanStage.Rows &&
      confirmation.nextState.stage === ScanStage.RowSelected;
    const freshRows = boardRows(session.config, session.message, session.messageHistory.length > 0, session);
    if (isLockingRow && session.config.transitionPauseMs <= 0) {
      const lockedRow = freshRows[confirmation.nextState.rowIndex];
      const nextState = advanceScanner(confirmation.nextState, rows.length, (row) => selectableCount(row === confirmation.nextState.rowIndex ? lockedRow : rows[row]));
      return {
        ...session,
        scannerState: nextState,
        lockedRow,
        lastSelection: null
      };
    }
    return {
      ...session,
      scannerState: confirmation.nextState,
      lockedRow: confirmation.nextState.stage === ScanStage.Rows
        ? null
        : isLockingRow
          ? freshRows[confirmation.nextState.rowIndex]
          : session.lockedRow,
      lastSelection: null
    };
  }

  const selectedTile = rows[confirmation.rowIndex][confirmation.cellIndex];
  const applied = applyTile(session.message, session.messageHistory, selectedTile, session.config, session);
  return {
    ...session,
    message: applied.message,
    messageHistory: applied.messageHistory,
    inputMode: applied.inputMode ?? session.inputMode,
    activeCategory: Object.hasOwn(applied, "activeCategory") ? applied.activeCategory : session.activeCategory,
    zhuyinBuffer: applied.zhuyinBuffer ?? session.zhuyinBuffer,
    zhuyinStage: applied.zhuyinStage ?? session.zhuyinStage,
    zhuyinGroup: applied.zhuyinGroup ?? session.zhuyinGroup,
    suggestionPage: applied.suggestionPage ?? session.suggestionPage,
    suggestionPageHistory: applied.suggestionPageHistory ?? session.suggestionPageHistory,
    scannerState: confirmation.nextState,
    lockedRow: null,
    lastSelection: {
      rowIndex: confirmation.rowIndex,
      cellIndex: confirmation.cellIndex,
      tile: selectedTile,
      effect: applied.effect
    }
  };
}

export function applyTile(message, messageHistory, selectedTile, config = createBoardConfig(), inputState = {}) {
  if (selectedTile.action === TileAction.MoreSuggestions) {
    const normalized = createBoardConfig(config);
    const pageCount = normalized.profileId === "zh-TW"
      ? zhTwSuggestionPageCount(
        message,
        normalized.suggestionDictionary,
        zhTwSuggestionColumnCount(normalized.columns),
        messageHistory.length > 0,
        normalized.symbols
      )
      : 1;
    return {
      message,
      messageHistory,
      effect: "suggestion-page",
      suggestionPage: floorMod((inputState.suggestionPage ?? 0) + 1, pageCount)
    };
  }
  if (selectedTile.action === TileAction.Noop) {
    return { message, messageHistory, effect: "none" };
  }
  if (selectedTile.action === TileAction.EnterMode) {
    return {
      message,
      messageHistory,
      effect: "mode",
      inputMode: selectedTile.output,
      activeCategory: null,
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.ExitMode) {
    return {
      message,
      messageHistory,
      effect: "mode",
      inputMode: "board",
      activeCategory: null,
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.OpenCategory) {
    return {
      message,
      messageHistory,
      effect: "category",
      inputMode: "board",
      activeCategory: selectedTile.output,
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.CloseCategory) {
    const nextMessage = inputState.activeCategory === EnglishCategoryId
      ? message.replace(/(?<=[A-Za-z'])\s+$/u, "")
      : message;
    return {
      message: nextMessage,
      messageHistory,
      effect: "category",
      inputMode: "board",
      activeCategory: null,
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.ZhuyinGroup) {
    return {
      message,
      messageHistory,
      effect: "zhuyin",
      inputMode: "zhuyin",
      zhuyinBuffer: normalizeZhuyinState(inputState).zhuyinBuffer,
      zhuyinStage: "lookup",
      zhuyinGroup: selectedTile.output
    };
  }
  if (selectedTile.action === TileAction.ZhuyinSymbol) {
    return {
      message,
      messageHistory,
      effect: "zhuyin",
      inputMode: "zhuyin",
      ...nextZhuyinState(inputState, selectedTile)
    };
  }
  if (selectedTile.action === TileAction.ZhuyinClear) {
    const directBuffer = trailingZhuyinBuffer(message);
    if (directBuffer.length > 0) {
      const nextMessage = message.slice(0, message.length - directBuffer.length);
      return {
        message: nextMessage,
        messageHistory: [...messageHistory, message].slice(-24),
        suggestionPageHistory: pushSuggestionPageHistory(inputState),
        effect: "message",
        inputMode: "board",
        activeCategory: null,
        suggestionPage: 0,
        ...emptyZhuyinState()
      };
    }
    return {
      message,
      messageHistory,
      effect: "zhuyin",
      inputMode: "zhuyin",
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.CommitCandidate) {
    const nextMessage = commitCandidateMessage(message, selectedTile, config);
    return {
      message: nextMessage,
      messageHistory: nextMessage === message ? messageHistory : [...messageHistory, message].slice(-24),
      suggestionPageHistory: nextMessage === message
        ? normalizeSuggestionPageHistory(inputState)
        : pushSuggestionPageHistory(inputState),
      effect: nextMessage === message ? "none" : "message",
      inputMode: "board",
      activeCategory: null,
      suggestionPage: 0,
      ...emptyZhuyinState()
    };
  }
  if (selectedTile.action === TileAction.Undo) {
    const previous = messageHistory.at(-1);
    if (previous === undefined) return { message, messageHistory, effect: "none" };
    const suggestionPageHistory = normalizeSuggestionPageHistory(inputState);
    return {
      message: previous,
      messageHistory: messageHistory.slice(0, -1),
      effect: "undo",
      suggestionPage: suggestionPageHistory.at(-1) ?? 0,
      suggestionPageHistory: suggestionPageHistory.slice(0, -1)
    };
  }
  if (selectedTile.action === TileAction.Speak) {
    return { message, messageHistory, effect: "speak" };
  }

  const embeddedEnglish = config.profileId === "zh-TW" && inputState.activeCategory === EnglishCategoryId;
  const nextMessage = updateMessage(
    message,
    selectedTile,
    embeddedEnglish ? { ...config, autoSpace: AutoSpaceMode.Word, embeddedEnglish: true } : config
  );
  if (nextMessage === message) return { message, messageHistory, effect: "none" };
  return {
    message: nextMessage,
    messageHistory: [...messageHistory, message].slice(-24),
    suggestionPageHistory: pushSuggestionPageHistory(inputState),
    effect: "message",
    activeCategory: inputState.activeCategory ?? null,
    suggestionPage: 0
  };
}

function normalizeSuggestionPageHistory(inputState) {
  return Array.isArray(inputState.suggestionPageHistory)
    ? inputState.suggestionPageHistory
      .filter(Number.isInteger)
      .map((page) => Math.max(0, page))
      .slice(-24)
    : [];
}

function pushSuggestionPageHistory(inputState) {
  return [
    ...normalizeSuggestionPageHistory(inputState),
    Math.max(0, Number.isInteger(inputState.suggestionPage) ? inputState.suggestionPage : 0)
  ].slice(-24);
}

function commitCandidateMessage(message, selectedTile, config) {
  const replaceLength = clampInt(selectedTile.replaceLength ?? 0, 0, message.length);
  const baseMessage = replaceLength > 0 ? message.slice(0, message.length - replaceLength) : message;
  return appendToken(baseMessage, selectedTile, config);
}

export function selectableCount(row) {
  return row.filter((candidate) => candidate.action !== TileAction.Noop).length;
}

export function withLockedRow(rows, scannerState, lockedRow) {
  if (!lockedRow || scannerState.stage === ScanStage.Rows || scannerState.rowIndex < 0 || scannerState.rowIndex >= rows.length) {
    return rows;
  }
  return rows.map((row, index) => index === scannerState.rowIndex ? lockedRow : row);
}

export function scanDurationForStage(state, config = createBoardConfig()) {
  switch (state.stage) {
    case ScanStage.RowSelected:
      return config.transitionPauseMs;
    case ScanStage.FirstCell:
      return config.firstCellPauseMs;
    default:
      return config.scanIntervalMs;
  }
}

function parseSymbolLine(line) {
  const separatorIndex = line.indexOf("=");
  const label = (separatorIndex >= 0 ? line.slice(0, separatorIndex) : line).trim();
  const value = (separatorIndex >= 0 ? line.slice(separatorIndex + 1) : label).trim();
  const normalizedLabel = label.toUpperCase();
  const normalizedValue = value.toLowerCase();

  if (normalizedLabel === "SPC" || normalizedValue === "<space>") return tile(label || "SPC", " ", TileAction.Space);
  if (normalizedLabel === "DEL" || normalizedValue === "<delete>") return tile(label || "DEL", "DEL", TileAction.Backspace);
  if (normalizedLabel === "CLR" || normalizedValue === "<clear>") return tile(label || "CLR", "CLR", TileAction.Clear);
  if (normalizedLabel === "UNDO" || normalizedValue === "<undo>") return tile(label || "UNDO", "UNDO", TileAction.Undo);
  if (normalizedLabel === "SAY" || normalizedValue === "<speak>") return tile(label || "SAY", "SAY", TileAction.Speak);
  if (normalizedValue === "<more>") return tile(label || "MORE", "MORE", TileAction.MoreSuggestions);
  if (normalizedValue === "<mode:zhuyin>") return tile(label || "注音", "zhuyin", TileAction.EnterMode);
  if (normalizedValue === "<mode:board>") return tile(label || "返回", "board", TileAction.ExitMode);
  const categoryMatch = normalizedValue.match(/^<category:([^>]+)>$/);
  if (categoryMatch?.[1] === "close") return tile(label || "返回", "category", TileAction.CloseCategory);
  if (categoryMatch) return tile(label || categoryMatch[1], categoryMatch[1], TileAction.OpenCategory);
  const zhuyinGroupMatch = normalizedValue.match(/^<zhuyin-group:([^>]+)>$/);
  if (zhuyinGroupMatch) return tile(label || zhuyinGroupMatch[1], zhuyinGroupMatch[1], TileAction.ZhuyinGroup);
  const zhuyinSymbolMatch = value.match(/^<zhuyin-symbol:([^>]+)>$/);
  if (zhuyinSymbolMatch) return zhuyinSymbolTile(label || zhuyinSymbolMatch[1], zhuyinSymbolMatch[1], "prefix");
  if (normalizedLabel === "<EMPTY>" || normalizedValue === "<empty>") return tile("", "", TileAction.Noop);
  if (!label) return tile(value);
  return tile(label, value);
}

function previousHighlight(state, rowCount, columnCountForRow) {
  if (rowCount <= 0) return state;
  if (state.stage !== ScanStage.Cells) return state;
  const columns = Math.max(1, columnCountForRow(state.rowIndex));
  return { ...state, cellIndex: floorMod(state.cellIndex - 1, columns) };
}

function emptyZhuyinState() {
  return {
    zhuyinBuffer: "",
    zhuyinStage: "initialGroup",
    zhuyinGroup: null
  };
}

function normalizeZhuyinState(state = {}) {
  return {
    zhuyinBuffer: typeof state.zhuyinBuffer === "string" ? state.zhuyinBuffer : "",
    zhuyinStage: typeof state.zhuyinStage === "string" ? state.zhuyinStage : "initialGroup",
    zhuyinGroup: typeof state.zhuyinGroup === "string" ? state.zhuyinGroup : null
  };
}

function nextZhuyinState(inputState, selectedTile) {
  const state = normalizeZhuyinState(inputState);
  if (selectedTile.zhuyinKind !== "prefix") return state;
  return {
    zhuyinBuffer: state.zhuyinBuffer + selectedTile.output,
    zhuyinStage: "lookup",
    zhuyinGroup: state.zhuyinGroup
  };
}

function paddedRow(row, columns) {
  return [
    ...row,
    ...Array.from({ length: Math.max(0, columns - row.length) }, () => tile("", "", TileAction.Noop))
  ];
}

function nextSelectableRow(rowIndex, rowCount, columnCountForRow) {
  for (let offset = 1; offset <= rowCount; offset += 1) {
    const candidate = floorMod(rowIndex + offset, rowCount);
    if (columnCountForRow(candidate) > 0) return candidate;
  }
  return rowIndex;
}

function transitionRank(previousWord, candidate) {
  if (previousWord === "i" || previousWord === "you") {
    return orderedTransitionRank(candidate, PronounTransitionWords);
  }
  if (previousWord === "want") {
    return orderedTransitionRank(candidate, WantTransitionWords);
  }
  if (previousWord === "need") {
    return orderedTransitionRank(candidate, NeedTransitionWords);
  }
  if (previousWord === "feel") {
    return orderedTransitionRank(candidate, FeelingTransitionWords);
  }
  if (previousWord === "no" || previousWord === "not" || previousWord === "don't") {
    return orderedTransitionRank(candidate, RefusalTransitionWords);
  }
  if (previousWord === "go" || previousWord === "turn" || previousWord === "move") {
    return orderedTransitionRank(candidate, DirectionTransitionWords);
  }
  return 4;
}

function orderedTransitionRank(candidate, orderedWords) {
  const index = orderedWords.indexOf(candidate);
  return index >= 0 ? index : orderedWords.length + 1;
}

function completionRank(currentToken, candidate) {
  const output = candidate.output.toLowerCase();
  if (projectCoreUniversalCorePriorityWords.has(output)) return 0;
  return aacPriorityWords.has(output) ? 1 : 2;
}

function wordTiles(words) {
  return words.map((word) => tile(labelForWord(word), word));
}

function labelForWord(word) {
  if (word === "I") return "I";
  if (word === "TV") return "TV";
  return word.toUpperCase();
}

const aacPriorityWords = new Set([
  ...LegacySuggestionDictionaryV7.map((candidate) => candidate.output.toLowerCase()),
  ...AacCoreVocabularyWords.map((word) => word.toLowerCase()),
  ...AacFringeStarterWords.map((word) => word.toLowerCase())
]);

const projectCoreUniversalCorePriorityWords = new Set(
  ProjectCoreUniversalCoreWords.map((word) => word.toLowerCase())
);

const PronounTransitionWords = Object.freeze([
  "want", "need", "feel", "like", "go", "help", "stop", "look", "watch", "make", "get", "do"
]);
const WantTransitionWords = Object.freeze([
  "drink", "water", "food", "bathroom", "toilet", "more", "music", "movie", "TV", "book", "game", "phone"
]);
const NeedTransitionWords = Object.freeze([
  "help", "drink", "water", "food", "bathroom", "toilet", "medicine", "sleep", "blanket", "pillow", "family", "doctor"
]);
const FeelingTransitionWords = Object.freeze([
  "sick", "tired", "good", "bad", "happy", "sad", "angry", "scared", "hot", "cold", "pain", "hurt"
]);
const RefusalTransitionWords = Object.freeze([
  "drink", "food", "medicine", "help", "more", "go", "stop", "touch", "move", "bathroom", "shower"
]);
const DirectionTransitionWords = Object.freeze(["up", "down", "left", "right", "in", "out", "on", "off"]);

function nonredundantTiles(items, unavailableTiles = [], maxResults = Number.POSITIVE_INFINITY) {
  const unavailable = Array.isArray(unavailableTiles) ? unavailableTiles : [];
  const unavailableKeys = unavailable.map(tileDeduplicationKeys);
  const unavailableSemantics = new Set(unavailableKeys.map((keys) => keys.semantic).filter(Boolean));
  const unavailableActionLabels = new Set(unavailableKeys.map((keys) => keys.actionLabel).filter(Boolean));
  const visibleLabels = new Set();
  const semantics = new Set();

  const result = [];
  for (const candidate of items) {
    if (!candidate || candidate.action === TileAction.Noop) continue;
    const { label, semantic, actionLabel } = tileDeduplicationKeys(candidate);
    if (
      (semantic && unavailableSemantics.has(semantic)) ||
      unavailableActionLabels.has(actionLabel) ||
      (label && visibleLabels.has(label)) ||
      (semantic && semantics.has(semantic))
    ) continue;
    if (label) visibleLabels.add(label);
    if (semantic) semantics.add(semantic);
    result.push(candidate);
    if (result.length >= maxResults) break;
  }
  return result;
}

function* concatenateTileCandidates(...groups) {
  for (const group of groups) {
    yield* group;
  }
}

function* candidatesWithOutput(items) {
  for (const candidate of items) {
    if (candidate.output.trim().length > 0) yield candidate;
  }
}

function* candidatesWithoutSuppressedLabels(items) {
  for (const candidate of items) {
    if (!ZhTwSuppressedSuggestionLabels.has(candidate.label)) yield candidate;
  }
}

function tileDeduplicationKeys(candidate) {
  if (!candidate || candidate.action === TileAction.Noop) {
    return { label: "", semantic: "", actionLabel: "" };
  }
  const action = String(candidate.action ?? TileAction.Append);
  const label = normalizedTileLabel(candidate);
  return {
    label,
    semantic: `${action}\u0000${String(candidate.output ?? "").normalize("NFKC")}`,
    actionLabel: label ? `${action}\u0000${label}` : ""
  };
}

function normalizedTileLabel(candidate) {
  return String(candidate?.label ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleUpperCase("en-US");
}

function distinctBy(items, keyForItem) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyForItem(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sameTiles(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function floorMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
