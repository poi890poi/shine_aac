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
export const DefaultScanIntervalMs = 1300;
export const DefaultTransitionPauseMs = 0;
export const DefaultFirstCellPauseMs = 1700;
export const LegacyFirstCellPauseMsV6 = 1400;
export const DefaultInputLatencyCompensationMs = 250;
export const CurrentConfigVersion = 14;
const PreviousDefaultScanIntervalMs = 900;
const PreviousDefaultTransitionPauseMs = 450;
const PreviousDefaultFirstCellPauseMs = 900;
export const DefaultProfileId = "en-US";
export const AutoSpaceMode = Object.freeze({
  Word: "word",
  None: "none"
});

export function tile(label, output = label, action = TileAction.Append) {
  return { label, output, action };
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
  "ㄥ": "ㄥ"
});

export function speechLabelForTile(candidate, profileId = DefaultProfileId) {
  if (profileId === "zh-TW") {
    if (candidate.action === TileAction.Space) return "空格";
    if (candidate.action === TileAction.Backspace) return "刪除";
    if (candidate.action === TileAction.Clear) return "清除";
    if (candidate.action === TileAction.Undo) return "復原";
    if (candidate.action === TileAction.Speak) return "說出";
    if (candidate.action === TileAction.EnterMode) return "用注音找字";
    if (candidate.action === TileAction.ExitMode) return "返回";
    if (candidate.action === TileAction.OpenCategory) return candidate.label;
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

export const DefaultTiles = Object.freeze([
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
const zhuyinClearTile = Object.freeze(tile("重選", "clear", TileAction.ZhuyinClear));
const ZhTwSuggestionRowCount = 4;
const MaxZhTwSuggestionPages = 3;
const ZhTwImmediateCandidateCountBeforeNextSymbols = 2;
const ZhuyinFollowingSymbolOrder = Object.freeze([
  "ㄧ", "ㄨ", "ㄩ",
  "ㄚ", "ㄛ", "ㄜ", "ㄝ",
  "ㄞ", "ㄟ", "ㄠ", "ㄡ",
  "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ",
  "ㄅ", "ㄆ", "ㄇ", "ㄈ",
  "ㄉ", "ㄊ", "ㄋ", "ㄌ",
  "ㄍ", "ㄎ", "ㄏ",
  "ㄐ", "ㄑ", "ㄒ",
  "ㄓ", "ㄔ", "ㄕ", "ㄖ",
  "ㄗ", "ㄘ", "ㄙ"
]);
const zhuyinEntry = (label, output, key, ...aliases) => Object.freeze({
  label,
  output,
  key,
  keys: Object.freeze([key, ...aliases])
});
const MinZhuyinTargets = 8;
const MaxZhuyinCandidateTargets = 20;
const ZhTwCoreResponseTiles = Object.freeze([
  tile("是"),
  tile("不是"),
  tile("要"),
  tile("不要")
]);
const ZhTwSuppressedSuggestionLabels = new Set(["是不是", "要不要"]);

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
const ZhuyinContinuationSymbols = Object.freeze({
  "ㄧ": Object.freeze(["ㄚ", "ㄝ", "ㄠ", "ㄡ", "ㄢ", "ㄣ", "ㄤ", "ㄥ"]),
  "ㄨ": Object.freeze(["ㄚ", "ㄛ", "ㄞ", "ㄟ", "ㄢ", "ㄣ", "ㄤ", "ㄥ"]),
  "ㄩ": Object.freeze(["ㄝ", "ㄢ", "ㄣ"])
});

export const ZhuyinLookupDictionary = Object.freeze([
  zhuyinEntry("我", "我", "ㄨㄛ"),
  zhuyinEntry("你", "你", "ㄋㄧ"),
  zhuyinEntry("要", "要", "ㄧㄠ"),
  zhuyinEntry("不要", "不要", "ㄅㄨㄧㄠ", "ㄅㄧ"),
  zhuyinEntry("是", "是", "ㄕ"),
  zhuyinEntry("不是", "不是", "ㄅㄨㄕ"),
  zhuyinEntry("幫忙", "幫忙", "ㄅㄤㄇㄤ", "ㄅㄇ"),
  zhuyinEntry("痛", "痛", "ㄊㄨㄥ"),
  zhuyinEntry("喝水", "喝水", "ㄏㄜㄕㄨㄟ", "ㄏㄕ"),
  zhuyinEntry("吃飯", "吃飯", "ㄔㄈㄢ", "ㄔㄈ"),
  zhuyinEntry("廁所", "廁所", "ㄘㄜㄙㄨㄛ", "ㄘㄙ"),
  zhuyinEntry("休息", "休息", "ㄒㄧㄡㄒㄧ", "ㄒㄒ"),
  zhuyinEntry("熱", "熱", "ㄖㄜ"),
  zhuyinEntry("冷", "冷", "ㄌㄥ"),
  zhuyinEntry("累", "累", "ㄌㄟ"),
  zhuyinEntry("睡覺", "睡覺", "ㄕㄨㄟㄐㄧㄠ", "ㄕㄐ"),
  zhuyinEntry("家人", "家人", "ㄐㄧㄚㄖㄣ", "ㄐㄖ"),
  zhuyinEntry("護理師", "護理師", "ㄏㄨㄌㄧㄕ", "ㄏㄌㄕ"),
  zhuyinEntry("醫生", "醫生", "ㄧㄕㄥ", "ㄧㄕ"),
  zhuyinEntry("藥", "藥", "ㄧㄠ"),
  zhuyinEntry("停", "停", "ㄊㄧㄥ"),
  zhuyinEntry("上", "上", "ㄕㄤ"),
  zhuyinEntry("下", "下", "ㄒㄧㄚ"),
  zhuyinEntry("左", "左", "ㄗㄨㄛ"),
  zhuyinEntry("右", "右", "ㄧㄡ"),
  zhuyinEntry("喝水", "喝水", "ㄨㄛㄧㄠㄏㄜㄕㄨㄟ", "ㄨㄧㄏㄕ"),
  zhuyinEntry("吃飯", "吃飯", "ㄨㄛㄧㄠㄔㄈㄢ", "ㄨㄧㄔㄈ"),
  zhuyinEntry("廁所", "廁所", "ㄨㄛㄧㄠㄘㄜㄙㄨㄛ", "ㄨㄧㄘㄙ"),
  zhuyinEntry("痛", "痛", "ㄨㄛㄏㄣㄊㄨㄥ", "ㄨㄏㄊ"),
  zhuyinEntry("家人", "家人", "ㄐㄧㄠㄐㄧㄚㄖㄣ", "ㄐㄐㄖ"),
  zhuyinEntry("護理師", "護理師", "ㄐㄧㄠㄏㄨㄌㄧㄕ", "ㄐㄏㄌㄕ"),
  zhuyinEntry("不舒服", "不舒服", "ㄅㄨㄕㄨㄈㄨ", "ㄅㄕㄈ"),
  zhuyinEntry("被子", "被子", "ㄅㄟㄗ"),
  zhuyinEntry("幫我", "幫我", "ㄅㄤㄨㄛ", "ㄅㄨ"),
  zhuyinEntry("不要動", "不要動", "ㄅㄨㄧㄠㄉㄨㄥ", "ㄅㄧㄉ"),
  zhuyinEntry("抱", "抱", "ㄅㄠ"),
  zhuyinEntry("爸爸", "爸爸", "ㄅㄚㄅㄚ"),
  zhuyinEntry("怕", "怕", "ㄆㄚ"),
  zhuyinEntry("朋友", "朋友", "ㄆㄥㄧㄡ"),
  zhuyinEntry("陪我", "陪我", "ㄆㄟㄨㄛ"),
  zhuyinEntry("旁邊", "旁邊", "ㄆㄤㄅㄧㄢ"),
  zhuyinEntry("平躺", "平躺", "ㄆㄧㄥㄊㄤ"),
  zhuyinEntry("拍照", "拍照", "ㄆㄞㄓㄠ"),
  zhuyinEntry("媽媽", "媽媽", "ㄇㄚㄇㄚ"),
  zhuyinEntry("沒有", "沒有", "ㄇㄟㄧㄡ"),
  zhuyinEntry("沒", "沒", "ㄇㄟ"),
  zhuyinEntry("每", "每", "ㄇㄟ"),
  zhuyinEntry("美", "美", "ㄇㄟ"),
  zhuyinEntry("妹", "妹", "ㄇㄟ"),
  zhuyinEntry("梅", "梅", "ㄇㄟ"),
  zhuyinEntry("媒", "媒", "ㄇㄟ"),
  zhuyinEntry("眉", "眉", "ㄇㄟ"),
  zhuyinEntry("煤", "煤", "ㄇㄟ"),
  zhuyinEntry("枚", "枚", "ㄇㄟ"),
  zhuyinEntry("玫", "玫", "ㄇㄟ"),
  zhuyinEntry("莓", "莓", "ㄇㄟ"),
  zhuyinEntry("霉", "霉", "ㄇㄟ"),
  zhuyinEntry("昧", "昧", "ㄇㄟ"),
  zhuyinEntry("媚", "媚", "ㄇㄟ"),
  zhuyinEntry("寐", "寐", "ㄇㄟ"),
  zhuyinEntry("魅", "魅", "ㄇㄟ"),
  zhuyinEntry("湄", "湄", "ㄇㄟ"),
  zhuyinEntry("酶", "酶", "ㄇㄟ"),
  zhuyinEntry("慢", "慢", "ㄇㄢ"),
  zhuyinEntry("門", "門", "ㄇㄣ"),
  zhuyinEntry("毛巾", "毛巾", "ㄇㄠㄐㄧㄣ"),
  zhuyinEntry("明白", "明白", "ㄇㄧㄥㄅㄞ"),
  zhuyinEntry("飯", "飯", "ㄈㄢ"),
  zhuyinEntry("翻身", "翻身", "ㄈㄢㄕㄣ"),
  zhuyinEntry("風扇", "風扇", "ㄈㄥㄕㄢ"),
  zhuyinEntry("放下", "放下", "ㄈㄤㄒㄧㄚ"),
  zhuyinEntry("發燒", "發燒", "ㄈㄚㄕㄠ"),
  zhuyinEntry("方向", "方向", "ㄈㄤㄒㄧㄤ"),
  zhuyinEntry("等一下", "等一下", "ㄉㄥㄧㄒㄧㄚ", "ㄉㄧㄒ"),
  zhuyinEntry("燈", "燈", "ㄉㄥ"),
  zhuyinEntry("電話", "電話", "ㄉㄧㄢㄏㄨㄚ"),
  zhuyinEntry("電視", "電視", "ㄉㄧㄢㄕ"),
  zhuyinEntry("打開", "打開", "ㄉㄚㄎㄞ"),
  zhuyinEntry("多一點", "多一點", "ㄉㄨㄛㄧㄉㄧㄢ", "ㄉㄧㄉ"),
  zhuyinEntry("頭", "頭", "ㄊㄡ"),
  zhuyinEntry("躺下", "躺下", "ㄊㄤㄒㄧㄚ"),
  zhuyinEntry("聽", "聽", "ㄊㄧㄥ"),
  zhuyinEntry("太熱", "太熱", "ㄊㄞㄖㄜ"),
  zhuyinEntry("推", "推", "ㄊㄨㄟ"),
  zhuyinEntry("拿", "拿", "ㄋㄚ"),
  zhuyinEntry("尿布", "尿布", "ㄋㄧㄠㄅㄨ"),
  zhuyinEntry("哪裡", "哪裡", "ㄋㄚㄌㄧ"),
  zhuyinEntry("難受", "難受", "ㄋㄢㄕㄡ"),
  zhuyinEntry("奶", "奶", "ㄋㄞ"),
  zhuyinEntry("弄好", "弄好", "ㄋㄨㄥㄏㄠ"),
  zhuyinEntry("來", "來", "ㄌㄞ"),
  zhuyinEntry("亮", "亮", "ㄌㄧㄤ"),
  zhuyinEntry("拉", "拉", "ㄌㄚ"),
  zhuyinEntry("聯絡", "聯絡", "ㄌㄧㄢㄌㄨㄛ"),
  zhuyinEntry("離開", "離開", "ㄌㄧㄎㄞ"),
  zhuyinEntry("給我", "給我", "ㄍㄟㄨㄛ"),
  zhuyinEntry("關", "關", "ㄍㄨㄢ"),
  zhuyinEntry("更高", "更高", "ㄍㄥㄍㄠ"),
  zhuyinEntry("感覺", "感覺", "ㄍㄢㄐㄩㄝ"),
  zhuyinEntry("蓋被", "蓋被", "ㄍㄞㄅㄟ"),
  zhuyinEntry("過來", "過來", "ㄍㄨㄛㄌㄞ"),
  zhuyinEntry("可以", "可以", "ㄎㄜㄧ"),
  zhuyinEntry("口渴", "口渴", "ㄎㄡㄎㄜ"),
  zhuyinEntry("開", "開", "ㄎㄞ"),
  zhuyinEntry("看", "看", "ㄎㄢ"),
  zhuyinEntry("快", "快", "ㄎㄨㄞ"),
  zhuyinEntry("咳嗽", "咳嗽", "ㄎㄜㄙㄡ"),
  zhuyinEntry("好", "好", "ㄏㄠ"),
  zhuyinEntry("呼吸", "呼吸", "ㄏㄨㄒㄧ"),
  zhuyinEntry("換", "換", "ㄏㄨㄢ"),
  zhuyinEntry("回家", "回家", "ㄏㄨㄟㄐㄧㄚ"),
  zhuyinEntry("後面", "後面", "ㄏㄡㄇㄧㄢ"),
  zhuyinEntry("叫人", "叫人", "ㄐㄧㄠㄖㄣ", "ㄐㄖ"),
  zhuyinEntry("今天", "今天", "ㄐㄧㄣㄊㄧㄢ"),
  zhuyinEntry("近一點", "近一點", "ㄐㄧㄣㄧㄉㄧㄢ", "ㄐㄧㄉ"),
  zhuyinEntry("急", "急", "ㄐㄧ"),
  zhuyinEntry("繼續", "繼續", "ㄐㄧㄒㄩ"),
  zhuyinEntry("加", "加", "ㄐㄧㄚ"),
  zhuyinEntry("請", "請", "ㄑㄧㄥ"),
  zhuyinEntry("起來", "起來", "ㄑㄧㄌㄞ"),
  zhuyinEntry("前", "前", "ㄑㄧㄢ"),
  zhuyinEntry("清楚", "清楚", "ㄑㄧㄥㄔㄨ"),
  zhuyinEntry("輕一點", "輕一點", "ㄑㄧㄥㄧㄉㄧㄢ", "ㄑㄧㄉ"),
  zhuyinEntry("去", "去", "ㄑㄩ"),
  zhuyinEntry("想吐", "想吐", "ㄒㄧㄤㄊㄨ", "ㄒㄊ"),
  zhuyinEntry("小便", "小便", "ㄒㄧㄠㄅㄧㄢ", "ㄒㄅ"),
  zhuyinEntry("需要", "需要", "ㄒㄩㄧㄠ"),
  zhuyinEntry("小心", "小心", "ㄒㄧㄠㄒㄧㄣ"),
  zhuyinEntry("吸痰", "吸痰", "ㄒㄧㄊㄢ"),
  zhuyinEntry("洗澡", "洗澡", "ㄒㄧㄗㄠ"),
  zhuyinEntry("知道", "知道", "ㄓㄉㄠ"),
  zhuyinEntry("這裡", "這裡", "ㄓㄜㄌㄧ"),
  zhuyinEntry("轉", "轉", "ㄓㄨㄢ"),
  zhuyinEntry("枕頭", "枕頭", "ㄓㄣㄊㄡ"),
  zhuyinEntry("站", "站", "ㄓㄢ"),
  zhuyinEntry("找", "找", "ㄓㄠ"),
  zhuyinEntry("床", "床", "ㄔㄨㄤ"),
  zhuyinEntry("穿", "穿", "ㄔㄨㄢ"),
  zhuyinEntry("抽痰", "抽痰", "ㄔㄡㄊㄢ"),
  zhuyinEntry("出去", "出去", "ㄔㄨㄑㄩ"),
  zhuyinEntry("長", "長", "ㄔㄤ"),
  zhuyinEntry("水", "水", "ㄕㄨㄟ"),
  zhuyinEntry("說", "說", "ㄕㄨㄛ"),
  zhuyinEntry("舒服", "舒服", "ㄕㄨㄈㄨ"),
  zhuyinEntry("身體", "身體", "ㄕㄣㄊㄧ"),
  zhuyinEntry("手", "手", "ㄕㄡ"),
  zhuyinEntry("少一點", "少一點", "ㄕㄠㄧㄉㄧㄢ", "ㄕㄧㄉ"),
  zhuyinEntry("人", "人", "ㄖㄣ"),
  zhuyinEntry("讓我", "讓我", "ㄖㄤㄨㄛ", "ㄖㄨ"),
  zhuyinEntry("日", "日", "ㄖ"),
  zhuyinEntry("柔一點", "柔一點", "ㄖㄡㄧㄉㄧㄢ"),
  zhuyinEntry("容易", "容易", "ㄖㄨㄥㄧ"),
  zhuyinEntry("坐", "坐", "ㄗㄨㄛ"),
  zhuyinEntry("走", "走", "ㄗㄡ"),
  zhuyinEntry("再一次", "再一次", "ㄗㄞㄧㄘ"),
  zhuyinEntry("怎麼", "怎麼", "ㄗㄣㄇㄜ"),
  zhuyinEntry("姿勢", "調整姿勢", "ㄗㄕ"),
  zhuyinEntry("早", "早", "ㄗㄠ"),
  zhuyinEntry("擦", "擦", "ㄘㄚ"),
  zhuyinEntry("餐", "餐", "ㄘㄢ"),
  zhuyinEntry("刺痛", "刺痛", "ㄘㄊㄨㄥ"),
  zhuyinEntry("側邊", "側邊", "ㄘㄜㄅㄧㄢ"),
  zhuyinEntry("次", "次", "ㄘ"),
  zhuyinEntry("送", "送", "ㄙㄨㄥ"),
  zhuyinEntry("酸", "酸", "ㄙㄨㄢ"),
  zhuyinEntry("三", "三", "ㄙㄢ"),
  zhuyinEntry("速度", "速度", "ㄙㄨㄉㄨ"),
  zhuyinEntry("鬆", "鬆", "ㄙㄨㄥ"),
  zhuyinEntry("鬆一點", "鬆一點", "ㄙㄨㄥㄧㄉㄧㄢ"),
  zhuyinEntry("痠痛", "痠痛", "ㄙㄨㄢㄊㄨㄥ"),
  zhuyinEntry("所有", "所有", "ㄙㄨㄛㄧㄡ"),
  zhuyinEntry("算了", "算了", "ㄙㄨㄢㄌㄜ"),
  zhuyinEntry("衣服", "衣服", "ㄧㄈㄨ"),
  zhuyinEntry("眼睛", "眼睛", "ㄧㄢㄐㄧㄥ"),
  zhuyinEntry("有", "有", "ㄧㄡ"),
  zhuyinEntry("又", "又", "ㄧㄡ"),
  zhuyinEntry("有沒有", "有沒有", "ㄧㄡㄇㄟㄧㄡ", "ㄧㄇㄧ"),
  zhuyinEntry("有空", "有空", "ㄧㄡㄎㄨㄥ", "ㄧㄎ"),
  zhuyinEntry("有痛", "有痛", "ㄧㄡㄊㄨㄥ", "ㄧㄊ"),
  zhuyinEntry("有需要", "有需要", "ㄧㄡㄒㄩㄧㄠ", "ㄧㄒ"),
  zhuyinEntry("由", "由", "ㄧㄡ"),
  zhuyinEntry("油", "油", "ㄧㄡ"),
  zhuyinEntry("友", "友", "ㄧㄡ"),
  zhuyinEntry("游", "游", "ㄧㄡ"),
  zhuyinEntry("幼", "幼", "ㄧㄡ"),
  zhuyinEntry("優", "優", "ㄧㄡ"),
  zhuyinEntry("憂", "憂", "ㄧㄡ"),
  zhuyinEntry("郵", "郵", "ㄧㄡ"),
  zhuyinEntry("尤", "尤", "ㄧㄡ"),
  zhuyinEntry("悠", "悠", "ㄧㄡ"),
  zhuyinEntry("幽", "幽", "ㄧㄡ"),
  zhuyinEntry("誘", "誘", "ㄧㄡ"),
  zhuyinEntry("猶", "猶", "ㄧㄡ"),
  zhuyinEntry("遊", "遊", "ㄧㄡ"),
  zhuyinEntry("一點", "一點", "ㄧㄉㄧㄢ"),
  zhuyinEntry("音樂", "音樂", "ㄧㄣㄩㄝ"),
  zhuyinEntry("外面", "外面", "ㄨㄞㄇㄧㄢ"),
  zhuyinEntry("晚上", "晚上", "ㄨㄢㄕㄤ"),
  zhuyinEntry("問", "問", "ㄨㄣ"),
  zhuyinEntry("溫度", "溫度", "ㄨㄣㄉㄨ"),
  zhuyinEntry("無法", "無法", "ㄨㄈㄚ"),
  zhuyinEntry("未", "未", "ㄨㄟ"),
  zhuyinEntry("味", "味", "ㄨㄟ"),
  zhuyinEntry("位", "位", "ㄨㄟ"),
  zhuyinEntry("為", "為", "ㄨㄟ"),
  zhuyinEntry("胃", "胃", "ㄨㄟ"),
  zhuyinEntry("餵", "餵", "ㄨㄟ"),
  zhuyinEntry("衛", "衛", "ㄨㄟ"),
  zhuyinEntry("微", "微", "ㄨㄟ"),
  zhuyinEntry("危", "危", "ㄨㄟ"),
  zhuyinEntry("委", "委", "ㄨㄟ"),
  zhuyinEntry("尾", "尾", "ㄨㄟ"),
  zhuyinEntry("維", "維", "ㄨㄟ"),
  zhuyinEntry("圍", "圍", "ㄨㄟ"),
  zhuyinEntry("威", "威", "ㄨㄟ"),
  zhuyinEntry("偉", "偉", "ㄨㄟ"),
  zhuyinEntry("違", "違", "ㄨㄟ"),
  zhuyinEntry("暈", "暈", "ㄩㄣ"),
  zhuyinEntry("遠", "遠", "ㄩㄢ"),
  zhuyinEntry("浴室", "浴室", "ㄩㄕ"),
  zhuyinEntry("願意", "願意", "ㄩㄢㄧ"),
  zhuyinEntry("越來越", "越來越", "ㄩㄝㄌㄞㄩㄝ")
]);

export const ZhTwFrequencyDictionary = Object.freeze(
  ZhuyinLookupDictionary.map((entry, index) => Object.freeze({
    ...entry,
    frequencyRank: index + 1,
    frequency: 1 / (index + 1)
  }))
);

export const ZhuyinStaticInputSymbols = Object.freeze(
  ZhuyinInputSymbols.filter((symbol) =>
    ZhTwFrequencyDictionary.some((entry) => entryKeys(entry).some((key) => key.startsWith(symbol)))
  )
);

export const ZhTwPhraseCategories = Object.freeze({
  needs: Object.freeze({
    label: "需要",
    tiles: Object.freeze([
      tile("喝水"),
      tile("吃飯"),
      tile("廁所"),
      tile("休息"),
      tile("睡覺"),
      tile("不要"),
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
      tile("不要"),
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
  })
});

export const ZhTwTiles = Object.freeze([
  ...ZhTwCoreResponseTiles,
  ...ZhuyinStaticInputSymbols.map((symbol) => tile(symbol)),
  zhTwMoreSuggestionsTile,
  tile("說", "SAY", TileAction.Speak),
  tile("刪", "DEL", TileAction.Backspace),
  tile("清除", "CLR", TileAction.Clear)
]);

export const ZhTwSuggestionDictionary = Object.freeze([
  ...ZhTwCoreResponseTiles,
  ...ZhTwTiles.filter((candidate) => candidate.action === TileAction.Append),
  ...Object.values(ZhTwPhraseCategories).flatMap((category) => category.tiles),
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
  tile("不舒服")
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
    columns: 4,
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

export function boardRows(config = createBoardConfig(), message = "", canUndo = false, inputState = {}) {
  const normalized = createBoardConfig(config);
  const safeColumns = clampInt(normalized.columns, 2, 8);
  if (normalized.profileId === "zh-TW") {
    return [
      ...zhTwSuggestionRows(message, safeColumns, canUndo, inputState),
      ...chunk(normalized.symbols, safeColumns)
    ];
  }

  const suggestions = suggestionRow(message, normalized.suggestionDictionary, safeColumns, canUndo, normalized);
  return [suggestions, ...chunk(normalized.symbols, safeColumns)];
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
          return "SPC=<space>";
        case TileAction.Backspace:
          return "DEL=<delete>";
        case TileAction.Clear:
          return "CLR=<clear>";
        case TileAction.Undo:
          return "UNDO=<undo>";
        case TileAction.Speak:
          return "SAY=<speak>";
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

function migrateSymbolsForConfig(parsedSymbols, storedVersion, profileId = DefaultProfileId) {
  if (profileId === "zh-TW" && shouldMigrateBuiltInZhTwSymbols(parsedSymbols, storedVersion)) {
    return ZhTwTiles;
  }
  if (
    storedVersion < CurrentConfigVersion &&
    (sameTiles(parsedSymbols, LegacyAlphabetDefaultTiles) || sameTiles(parsedSymbols, LegacyFrequencyDefaultTilesV3))
  ) {
    return DefaultTiles;
  }
  return parsedSymbols;
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
  const labels = new Set(symbols.map((candidate) => candidate.label));
  const hasDirectZhuyinBoard = ZhuyinStaticInputSymbols.every((symbol) => labels.has(symbol)) &&
    !labels.has("注音") &&
    !labels.has("ㄅㄆㄇㄈ");
  const hasCurrentDirectBoard = hasDirectZhuyinBoard && labels.has("\u66f4\u591a");
  if (hasCurrentDirectBoard) return false;
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
    (storedPauseMs === LegacyFirstCellPauseMsV6 || storedPauseMs === PreviousDefaultFirstCellPauseMs)
  ) {
    return DefaultFirstCellPauseMs;
  }
  return storedPauseMs;
}

export function loadScanIntervalForConfig(storedScanMs, storedVersion) {
  if (storedVersion < CurrentConfigVersion && storedScanMs === PreviousDefaultScanIntervalMs) {
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
  if (options.autoSpace === AutoSpaceMode.None) {
    return suggestTilesWithoutSpaces(message, dictionary, safeMax);
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

  return distinctBy(ranked, (candidate) => candidate.label.toUpperCase())
    .filter((candidate) => candidate.output.trim().length > 0)
    .slice(0, safeMax);
}

function suggestTilesWithoutSpaces(message, dictionary, maxSuggestions) {
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

  return distinctBy(ranked.length > 0 ? ranked : dictionary, (candidate) => candidate.label)
    .filter((candidate) => candidate.output.trim().length > 0)
    .slice(0, maxSuggestions);
}

export function suggestionRow(message, dictionary, columns, canUndo = false, options = {}) {
  const safeColumns = clampInt(columns, 2, 8);
  const suggestionCount = Math.min(safeColumns, 4);
  const commandSuggestions = [];
  if (canUndo) commandSuggestions.push(UndoSuggestionTile);
  if (options.autoSpace !== AutoSpaceMode.None && message.trim().length > 0 && !/\s$/.test(message)) {
    commandSuggestions.push(SpaceSuggestionTile);
  }

  const suggestions = distinctBy(
    [
      ...commandSuggestions,
      ...suggestTiles(message, dictionary, suggestionCount, options),
      ...(options.autoSpace === AutoSpaceMode.None ? [] : SuggestionFallbackLetters)
    ],
    (candidate) => candidate.label.toUpperCase()
  ).slice(0, suggestionCount);

  return [
    ...suggestions,
    ...Array.from({ length: safeColumns - suggestions.length }, () => tile("", "", TileAction.Noop))
  ];
}

function zhTwSuggestionRows(message, columns, canUndo = false, inputState = {}) {
  const safeColumns = clampInt(columns, 2, 8);
  const pageSize = safeColumns * ZhTwSuggestionRowCount;
  const commandSuggestions = canUndo ? [zhTwUndoSuggestionTile] : [];
  const allSuggestions = zhTwSuggestionTiles(message, pageSize - commandSuggestions.length);
  const totalSuggestions = distinctBy([...commandSuggestions, ...allSuggestions], (candidate) => zhTwSuggestionKey(candidate));
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

function zhTwSuggestionTiles(message, targetCount = DefaultColumns * ZhTwSuggestionRowCount) {
  const buffer = trailingZhuyinBuffer(message);
  const candidates = buffer
    ? zhTwBufferedSuggestionTiles(buffer, targetCount)
    : ZhTwFrequencyDictionary
      .map((entry) => zhTwCandidateTile(entry, 0, entry.key, "base"));

  return distinctBy(candidates, (candidate) => `${candidate.label}\u0000${candidate.output}`)
    .filter((candidate) => !ZhTwSuppressedSuggestionLabels.has(candidate.label));
}

function zhTwBufferedSuggestionTiles(buffer, targetCount) {
  const exactCandidates = ZhTwFrequencyDictionary
    .map((entry) => zhTwCandidateForBuffer(entry, buffer))
    .filter(Boolean)
    .sort(zhTwCandidateRank);
  const nextSymbols = zhTwNextSymbolTiles(buffer);
  const orderedCandidates = [
    ...exactCandidates.slice(0, ZhTwImmediateCandidateCountBeforeNextSymbols),
    ...nextSymbols,
    ...exactCandidates.slice(ZhTwImmediateCandidateCountBeforeNextSymbols)
  ];

  return distinctBy(
    orderedCandidates,
    (candidate) => `${candidate.action}\u0000${candidate.label}\u0000${candidate.output}`
  );
}

function zhTwCandidateForBuffer(entry, buffer) {
  const matchingKey = entryKeys(entry)
    .filter((key) => key.startsWith(buffer))
    .sort((left, right) => left.length - right.length)[0];
  if (!matchingKey) return null;
  return zhTwCandidateTile(entry, buffer.length, matchingKey, "exact");
}

function zhTwNextSymbolTiles(buffer) {
  return distinctBy(
    [
      ...(ZhuyinContinuationSymbols[buffer] ?? []),
      ...ZhTwFrequencyDictionary
      .flatMap((entry) => entryKeys(entry))
      .filter((key) => key.startsWith(buffer) && key.length > buffer.length)
      .map((key) => key.at(buffer.length))
      .filter((symbol) => ZhuyinInputSymbolSet.has(symbol))
    ],
    (symbol) => symbol
  )
    .sort((left, right) => zhuyinFollowingSymbolRank(left) - zhuyinFollowingSymbolRank(right))
    .map((symbol) => tile(symbol, symbol, TileAction.Append));
}

function zhuyinFollowingSymbolRank(symbol) {
  const index = ZhuyinFollowingSymbolOrder.indexOf(symbol);
  return index >= 0 ? index : ZhuyinFollowingSymbolOrder.length;
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

function zhTwCandidateRank(left, right) {
  return left.frequencyRank - right.frequencyRank;
}

function trailingZhuyinBuffer(message) {
  let buffer = "";
  for (const character of Array.from(message).reverse()) {
    if (!ZhuyinInputSymbolSet.has(character)) break;
    buffer = character + buffer;
  }
  return buffer;
}

function zhTwSuggestionPageCount(message, columns, canUndo = false) {
  const safeColumns = clampInt(columns, 2, 8);
  const pageSize = safeColumns * ZhTwSuggestionRowCount;
  const count = zhTwSuggestionTiles(message, pageSize - (canUndo ? 1 : 0)).length + (canUndo ? 1 : 0);
  return zhTwSuggestionPageCountForTotal(count, pageSize);
}

function zhTwSuggestionPageCountForTotal(total, pageSize) {
  if (total <= pageSize) return 1;
  return clampInt(Math.ceil(total / Math.max(1, pageSize - 1)), 1, MaxZhTwSuggestionPages);
}

function zhTwSuggestionKey(candidate) {
  return `${candidate.action}\u0000${candidate.label}\u0000${candidate.output}`;
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

function categorySuggestionRows(categoryId, columns) {
  const category = ZhTwPhraseCategories[categoryId];
  if (!category) return [];
  const commandRow = paddedRow([
    categoryCloseTile,
    tile(category.label, category.label, TileAction.Noop)
  ], columns);
  return [commandRow, ...chunk(category.tiles, columns)];
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
    const currentTokenStart = current.lastIndexOf(" ") + 1;
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
  return `${current.trimEnd()} ${token} `;
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
      ? zhTwSuggestionPageCount(message, normalized.columns, messageHistory.length > 0)
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
    return {
      message,
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
    return { message: previous, messageHistory: messageHistory.slice(0, -1), effect: "undo", suggestionPage: 0 };
  }
  if (selectedTile.action === TileAction.Speak) {
    return { message, messageHistory, effect: "speak" };
  }

  const nextMessage = updateMessage(message, selectedTile, config);
  if (nextMessage === message) return { message, messageHistory, effect: "none" };
  return {
    message: nextMessage,
    messageHistory: [...messageHistory, message].slice(-24),
    effect: "message",
    activeCategory: null,
    suggestionPage: 0
  };
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

  if (normalizedLabel === "SPC" || normalizedValue === "<space>") return tile("SPC", " ", TileAction.Space);
  if (normalizedLabel === "DEL" || normalizedValue === "<delete>") return tile("DEL", "DEL", TileAction.Backspace);
  if (normalizedLabel === "CLR" || normalizedValue === "<clear>") return tile("CLR", "CLR", TileAction.Clear);
  if (normalizedLabel === "UNDO" || normalizedValue === "<undo>") return tile("UNDO", "UNDO", TileAction.Undo);
  if (normalizedLabel === "SAY" || normalizedValue === "<speak>") return tile("SAY", "SAY", TileAction.Speak);
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
  const actions = new Set(["want", "need", "help", "go", "stop", "watch", "look", "move", "turn", "drink", "eat", "call"]);
  const needs = new Set(["water", "drink", "food", "toilet", "bathroom", "pain", "hot", "cold", "tired", "sleep", "medicine", "more", "done"]);
  if (previousWord === "i" || previousWord === "you") return actions.has(candidate) ? 0 : 2;
  if (previousWord === "want" || previousWord === "need") return needs.has(candidate) ? 0 : 2;
  if (previousWord === "go" || previousWord === "turn" || previousWord === "move") {
    return new Set(["up", "down", "left", "right"]).has(candidate) ? 0 : 2;
  }
  return 1;
}

function completionRank(currentToken, candidate) {
  const output = candidate.output.toLowerCase();
  return aacPriorityWords.has(output) ? 0 : 1;
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
