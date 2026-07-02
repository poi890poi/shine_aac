package com.example.shineaac

data class BoardConfig(
    val columns: Int = DefaultColumns,
    val scanIntervalMs: Float = DefaultScanIntervalMs,
    val transitionPauseMs: Float = DefaultTransitionPauseMs,
    val firstCellPauseMs: Float = DefaultFirstCellPauseMs,
    val inputLatencyCompensationMs: Float = DefaultInputLatencyCompensationMs,
    val suggestionDictionary: List<CommunicationTile> = DefaultSuggestionDictionary,
    val symbols: List<CommunicationTile> = DefaultTiles
) {
    fun rows(message: String = "", canUndo: Boolean = false): List<List<CommunicationTile>> {
        val safeColumns = columns.coerceIn(2, 8)
        val suggestions = suggestionRow(message, suggestionDictionary, safeColumns, canUndo)
        val symbolRows = symbols.chunked(safeColumns)
        return listOf(suggestions) + symbolRows
    }
}

enum class TileAction {
    Append,
    Space,
    Backspace,
    Clear,
    Undo,
    Speak,
    Noop
}

data class CommunicationTile(
    val label: String,
    val output: String = label,
    val action: TileAction = TileAction.Append
)

const val DefaultColumns = 4
const val DefaultScanIntervalMs = 900f
const val DefaultTransitionPauseMs = 850f
const val DefaultFirstCellPauseMs = 1400f
const val DefaultInputLatencyCompensationMs = 250f
const val CurrentConfigVersion = 6

val DefaultSuggestionDictionary = listOf(
    CommunicationTile("I", "I"),
    CommunicationTile("YOU", "you"),
    CommunicationTile("WANT", "want"),
    CommunicationTile("NEED", "need"),
    CommunicationTile("HELP", "help"),
    CommunicationTile("STOP", "stop"),
    CommunicationTile("GO", "go"),
    CommunicationTile("YES", "yes"),
    CommunicationTile("NO", "no"),
    CommunicationTile("WATER", "water"),
    CommunicationTile("FOOD", "food"),
    CommunicationTile("TOILET", "toilet"),
    CommunicationTile("PAIN", "pain"),
    CommunicationTile("HOT", "hot"),
    CommunicationTile("COLD", "cold"),
    CommunicationTile("TIRED", "tired"),
    CommunicationTile("SLEEP", "sleep"),
    CommunicationTile("MORE", "more"),
    CommunicationTile("DONE", "done"),
    CommunicationTile("WATCH", "watch"),
    CommunicationTile("LOOK", "look"),
    CommunicationTile("MOVE", "move"),
    CommunicationTile("TURN", "turn"),
    CommunicationTile("UP", "up"),
    CommunicationTile("DOWN", "down"),
    CommunicationTile("LEFT", "left"),
    CommunicationTile("RIGHT", "right"),
    CommunicationTile("MOM", "mom"),
    CommunicationTile("DAD", "dad"),
    CommunicationTile("NURSE", "nurse"),
    CommunicationTile("DOCTOR", "doctor")
)

val DefaultTiles = listOf(
    CommunicationTile("YES", "yes"),
    CommunicationTile("NO", "no"),
    CommunicationTile("HELP", "help"),
    CommunicationTile("PAIN", "pain"),
    CommunicationTile("WATER", "water"),
    CommunicationTile("FOOD", "food"),
    CommunicationTile("I", "I"),
    CommunicationTile("YOU", "you"),
    CommunicationTile("WANT", "want"),
    CommunicationTile("NEED", "need"),
    CommunicationTile("GO", "go"),
    CommunicationTile("STOP", "stop"),
    CommunicationTile("WATCH", "watch"),
    CommunicationTile("LOOK", "look"),
    CommunicationTile("SAY", action = TileAction.Speak),
    CommunicationTile("DEL", action = TileAction.Backspace),
    CommunicationTile("CLR", action = TileAction.Clear),
    CommunicationTile("SPC", " ", TileAction.Space),
    CommunicationTile("E"),
    CommunicationTile("T"),
    CommunicationTile("A"),
    CommunicationTile("O"),
    CommunicationTile("I"),
    CommunicationTile("N"),
    CommunicationTile("S"),
    CommunicationTile("R"),
    CommunicationTile("H"),
    CommunicationTile("L"),
    CommunicationTile("D"),
    CommunicationTile("C"),
    CommunicationTile("U"),
    CommunicationTile("M"),
    CommunicationTile("F"),
    CommunicationTile("P"),
    CommunicationTile("G"),
    CommunicationTile("W"),
    CommunicationTile("Y"),
    CommunicationTile("B"),
    CommunicationTile("V"),
    CommunicationTile("K"),
    CommunicationTile("X"),
    CommunicationTile("J"),
    CommunicationTile("Q"),
    CommunicationTile("Z"),
    CommunicationTile("?")
)

val LegacyFrequencyDefaultTilesV3 = listOf(
    CommunicationTile("YES", "yes"),
    CommunicationTile("NO", "no"),
    CommunicationTile("HELP", "help"),
    CommunicationTile("PAIN", "pain"),
    CommunicationTile("WATER", "water"),
    CommunicationTile("FOOD", "food"),
    CommunicationTile("I", "I"),
    CommunicationTile("YOU", "you"),
    CommunicationTile("WANT", "want"),
    CommunicationTile("NEED", "need"),
    CommunicationTile("GO", "go"),
    CommunicationTile("STOP", "stop"),
    CommunicationTile("WATCH", "watch"),
    CommunicationTile("LOOK", "look"),
    CommunicationTile("SAY", action = TileAction.Speak),
    CommunicationTile("DEL", action = TileAction.Backspace),
    CommunicationTile("CLR", action = TileAction.Clear),
    CommunicationTile("SPC", " ", TileAction.Space),
    CommunicationTile("E"),
    CommunicationTile("T"),
    CommunicationTile("A"),
    CommunicationTile("O"),
    CommunicationTile("I"),
    CommunicationTile("N"),
    CommunicationTile("S"),
    CommunicationTile("H"),
    CommunicationTile("R"),
    CommunicationTile("D"),
    CommunicationTile("L"),
    CommunicationTile("C"),
    CommunicationTile("U"),
    CommunicationTile("M"),
    CommunicationTile("W"),
    CommunicationTile("F"),
    CommunicationTile("G"),
    CommunicationTile("Y"),
    CommunicationTile("P"),
    CommunicationTile("B"),
    CommunicationTile("V"),
    CommunicationTile("K"),
    CommunicationTile("J"),
    CommunicationTile("X"),
    CommunicationTile("Q"),
    CommunicationTile("Z"),
    CommunicationTile("?")
)

val LegacyAlphabetDefaultTiles = listOf(
    CommunicationTile("YES", "yes"),
    CommunicationTile("NO", "no"),
    CommunicationTile("HELP", "help"),
    CommunicationTile("PAIN", "pain"),
    CommunicationTile("WATER", "water"),
    CommunicationTile("FOOD", "food"),
    CommunicationTile("I", "I"),
    CommunicationTile("YOU", "you"),
    CommunicationTile("WANT", "want"),
    CommunicationTile("NEED", "need"),
    CommunicationTile("GO", "go"),
    CommunicationTile("STOP", "stop"),
    CommunicationTile("SPC", " ", TileAction.Space),
    CommunicationTile("A"),
    CommunicationTile("B"),
    CommunicationTile("C"),
    CommunicationTile("D"),
    CommunicationTile("E"),
    CommunicationTile("F"),
    CommunicationTile("G"),
    CommunicationTile("H"),
    CommunicationTile("I"),
    CommunicationTile("J"),
    CommunicationTile("K"),
    CommunicationTile("L"),
    CommunicationTile("M"),
    CommunicationTile("N"),
    CommunicationTile("O"),
    CommunicationTile("P"),
    CommunicationTile("Q"),
    CommunicationTile("R"),
    CommunicationTile("S"),
    CommunicationTile("T"),
    CommunicationTile("U"),
    CommunicationTile("V"),
    CommunicationTile("W"),
    CommunicationTile("X"),
    CommunicationTile("Y"),
    CommunicationTile("Z"),
    CommunicationTile("?"),
    CommunicationTile("DEL", action = TileAction.Backspace),
    CommunicationTile("SAY", action = TileAction.Speak),
    CommunicationTile("CLR", action = TileAction.Clear)
)

val SuggestionFallbackLetters = listOf("E", "T", "A", "O", "I", "N", "S", "R").map {
    CommunicationTile(it, it.lowercase())
}

val SpaceSuggestionTile = CommunicationTile("SPC", " ", TileAction.Space)

val UndoSuggestionTile = CommunicationTile("UNDO", action = TileAction.Undo)

fun loadSymbolsForConfig(storedSymbols: String?, storedVersion: Int): List<CommunicationTile> {
    val parsedSymbols = parseSymbols(storedSymbols ?: serializeSymbols(DefaultTiles))
    return if (
        storedVersion < CurrentConfigVersion &&
        (parsedSymbols == LegacyAlphabetDefaultTiles || parsedSymbols == LegacyFrequencyDefaultTilesV3)
    ) {
        DefaultTiles
    } else {
        parsedSymbols
    }
}

fun serializeDictionary(symbols: List<CommunicationTile>): String = serializeSymbols(symbols)

fun parseDictionary(text: String): List<CommunicationTile> {
    val parsed = text
        .lineSequence()
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .map(::parseSymbolLine)
        .toList()

    return parsed
        .filter { it.action == TileAction.Append }
        .ifEmpty { DefaultSuggestionDictionary }
}

fun suggestTiles(
    message: String,
    dictionary: List<CommunicationTile>,
    maxSuggestions: Int
): List<CommunicationTile> {
    val safeMax = maxSuggestions.coerceAtLeast(1)
    val text = message.lowercase()
    val trimmed = text.trim()
    val endsWithBoundary = message.isEmpty() || message.last().isWhitespace()
    val currentToken = if (endsWithBoundary) "" else trimmed.substringAfterLast(' ')
    val previousToken = if (endsWithBoundary) trimmed.substringAfterLast(' ') else trimmed.substringBeforeLast(' ', "")

    val ranked = when {
        currentToken.isNotBlank() -> dictionary.filter {
            val label = it.label.lowercase()
            val output = it.output.lowercase()
            (label.startsWith(currentToken) || output.startsWith(currentToken)) &&
                label != currentToken &&
                output != currentToken
        }
        previousToken.isNotBlank() -> dictionary.sortedBy { transitionRank(previousToken, it.output.lowercase()) }
        else -> dictionary
    }

    return ranked
        .distinctBy { it.label.uppercase() }
        .filterNot { it.output.isBlank() }
        .take(safeMax)
}

fun suggestionRow(
    message: String,
    dictionary: List<CommunicationTile>,
    columns: Int,
    canUndo: Boolean = false
): List<CommunicationTile> {
    val safeColumns = columns.coerceIn(2, 8)
    val suggestionCount = safeColumns.coerceAtMost(3)
    val commandSuggestions = buildList {
        if (canUndo) add(UndoSuggestionTile)
        if (message.isNotBlank() && !message.last().isWhitespace()) add(SpaceSuggestionTile)
    }
    val wordSuggestions = suggestTiles(message, dictionary, suggestionCount)
    val suggestions = (commandSuggestions + wordSuggestions + SuggestionFallbackLetters)
        .distinctBy { it.label.uppercase() }
        .take(suggestionCount)
    val emptyTiles = List(safeColumns - suggestions.size) {
        CommunicationTile(label = "", output = "", action = TileAction.Noop)
    }
    return suggestions + emptyTiles
}

private fun transitionRank(previousWord: String, candidate: String): Int {
    val actions = setOf("want", "need", "help", "go", "stop", "watch", "look", "move", "turn")
    val needs = setOf("water", "food", "toilet", "pain", "hot", "cold", "tired", "sleep", "more", "done")

    return when (previousWord) {
        "i", "you" -> if (candidate in actions) 0 else 2
        "want", "need" -> if (candidate in needs) 0 else 2
        "go", "turn", "move" -> if (candidate in setOf("up", "down", "left", "right")) 0 else 2
        else -> 1
    }
}

fun serializeSymbols(symbols: List<CommunicationTile>): String {
    return symbols.mapNotNull { tile ->
        when (tile.action) {
            TileAction.Append -> if (tile.output == tile.label) tile.label else "${tile.label}=${tile.output}"
            TileAction.Space -> "SPC=<space>"
            TileAction.Backspace -> "DEL=<delete>"
            TileAction.Clear -> "CLR=<clear>"
            TileAction.Undo -> "UNDO=<undo>"
            TileAction.Speak -> "SAY=<speak>"
            TileAction.Noop -> null
        }
    }.joinToString("\n")
}

fun parseSymbols(text: String): List<CommunicationTile> {
    return text
        .lineSequence()
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .map(::parseSymbolLine)
        .toList()
        .ifEmpty { DefaultTiles }
}

private fun parseSymbolLine(line: String): CommunicationTile {
    val label = line.substringBefore("=").trim()
    val value = line.substringAfter("=", label).trim()
    val normalizedLabel = label.uppercase()
    val normalizedValue = value.lowercase()

    return when {
        normalizedLabel == "SPC" || normalizedValue == "<space>" -> CommunicationTile("SPC", " ", TileAction.Space)
        normalizedLabel == "DEL" || normalizedValue == "<delete>" -> CommunicationTile("DEL", action = TileAction.Backspace)
        normalizedLabel == "CLR" || normalizedValue == "<clear>" -> CommunicationTile("CLR", action = TileAction.Clear)
        normalizedLabel == "UNDO" || normalizedValue == "<undo>" -> CommunicationTile("UNDO", action = TileAction.Undo)
        normalizedLabel == "SAY" || normalizedValue == "<speak>" -> CommunicationTile("SAY", action = TileAction.Speak)
        normalizedLabel == "<EMPTY>" || normalizedValue == "<empty>" -> CommunicationTile("", "", TileAction.Noop)
        label.isBlank() -> CommunicationTile(value)
        else -> CommunicationTile(label = label, output = value)
    }
}
