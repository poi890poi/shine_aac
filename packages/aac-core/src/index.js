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
  Noop: "noop"
});

export const DefaultColumns = 4;
export const DefaultScanIntervalMs = 900;
export const DefaultTransitionPauseMs = 0;
export const DefaultFirstCellPauseMs = 900;
export const LegacyFirstCellPauseMsV6 = 1400;
export const DefaultInputLatencyCompensationMs = 250;
export const CurrentConfigVersion = 7;

export function tile(label, output = label, action = TileAction.Append) {
  return { label, output, action };
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

export const DefaultSuggestionDictionary = Object.freeze([
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

export function createBoardConfig(overrides = {}) {
  return {
    columns: DefaultColumns,
    scanIntervalMs: DefaultScanIntervalMs,
    transitionPauseMs: DefaultTransitionPauseMs,
    firstCellPauseMs: DefaultFirstCellPauseMs,
    inputLatencyCompensationMs: DefaultInputLatencyCompensationMs,
    suggestionDictionary: DefaultSuggestionDictionary,
    symbols: DefaultTiles,
    ...overrides
  };
}

export function boardRows(config = createBoardConfig(), message = "", canUndo = false) {
  const normalized = createBoardConfig(config);
  const safeColumns = clampInt(normalized.columns, 2, 8);
  const suggestions = suggestionRow(message, normalized.suggestionDictionary, safeColumns, canUndo);
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
  if (storedVersion < CurrentConfigVersion && sameTiles(parsedDictionary, LegacySuggestionDictionaryV6)) {
    return DefaultSuggestionDictionary;
  }
  return parsedDictionary;
}

export function loadFirstCellPauseForConfig(storedPauseMs, storedVersion) {
  if (storedVersion < CurrentConfigVersion && storedPauseMs === LegacyFirstCellPauseMsV6) {
    return DefaultFirstCellPauseMs;
  }
  return storedPauseMs;
}

export function suggestTiles(message, dictionary, maxSuggestions) {
  const safeMax = Math.max(1, Math.trunc(maxSuggestions));
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

export function suggestionRow(message, dictionary, columns, canUndo = false) {
  const safeColumns = clampInt(columns, 2, 8);
  const suggestionCount = Math.min(safeColumns, 4);
  const commandSuggestions = [];
  if (canUndo) commandSuggestions.push(UndoSuggestionTile);
  if (message.trim().length > 0 && !/\s$/.test(message)) commandSuggestions.push(SpaceSuggestionTile);

  const suggestions = distinctBy(
    [
      ...commandSuggestions,
      ...suggestTiles(message, dictionary, suggestionCount),
      ...SuggestionFallbackLetters
    ],
    (candidate) => candidate.label.toUpperCase()
  ).slice(0, suggestionCount);

  return [
    ...suggestions,
    ...Array.from({ length: safeColumns - suggestions.length }, () => tile("", "", TileAction.Noop))
  ];
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

export function updateMessage(current, selectedTile) {
  switch (selectedTile.action) {
    case TileAction.Append:
      return appendToken(current, selectedTile.output);
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

export function appendToken(current, token) {
  if (token.length > 1 && current.length > 0 && !/\s$/.test(current)) {
    const currentTokenStart = current.lastIndexOf(" ") + 1;
    const currentToken = current.slice(currentTokenStart);
    if (
      currentToken.length > 0 &&
      token.toLowerCase().startsWith(currentToken.toLowerCase()) &&
      token.toLowerCase() !== currentToken.toLowerCase()
    ) {
      return current.slice(0, currentTokenStart) + token;
    }
  }
  if (token.length === 1 && /\p{L}/u.test(token)) return current + token;
  if (current.trim().length === 0) return token;
  if (current.endsWith(" ")) return current + token;
  return `${current} ${token}`;
}

export function createSession(overrides = {}) {
  return {
    config: createBoardConfig(),
    message: "",
    messageHistory: [],
    scannerState: createScannerState(),
    lockedRow: null,
    lastSelection: null,
    ...overrides
  };
}

export function visibleBoard(session) {
  const rows = boardRows(session.config, session.message, session.messageHistory.length > 0);
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
    const freshRows = boardRows(session.config, session.message, session.messageHistory.length > 0);
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
  const applied = applyTile(session.message, session.messageHistory, selectedTile);
  return {
    ...session,
    message: applied.message,
    messageHistory: applied.messageHistory,
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

export function applyTile(message, messageHistory, selectedTile) {
  if (selectedTile.action === TileAction.Noop) {
    return { message, messageHistory, effect: "none" };
  }
  if (selectedTile.action === TileAction.Undo) {
    const previous = messageHistory.at(-1);
    if (previous === undefined) return { message, messageHistory, effect: "none" };
    return { message: previous, messageHistory: messageHistory.slice(0, -1), effect: "undo" };
  }
  if (selectedTile.action === TileAction.Speak) {
    return { message, messageHistory, effect: "speak" };
  }

  const nextMessage = updateMessage(message, selectedTile);
  if (nextMessage === message) return { message, messageHistory, effect: "none" };
  return {
    message: nextMessage,
    messageHistory: [...messageHistory, message].slice(-24),
    effect: "message"
  };
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
  return output.length - currentToken.length;
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
