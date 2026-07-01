package com.example.shineaac

data class BoardConfig(
    val columns: Int = DefaultColumns,
    val scanIntervalMs: Float = DefaultScanIntervalMs,
    val symbols: List<CommunicationTile> = DefaultTiles
) {
    fun rows(): List<List<CommunicationTile>> = symbols.chunked(columns.coerceIn(2, 8))
}

enum class TileAction {
    Append,
    Space,
    Backspace,
    Clear,
    Speak
}

data class CommunicationTile(
    val label: String,
    val output: String = label,
    val action: TileAction = TileAction.Append
)

const val DefaultColumns = 4
const val DefaultScanIntervalMs = 900f

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

fun serializeSymbols(symbols: List<CommunicationTile>): String {
    return symbols.joinToString("\n") { tile ->
        when (tile.action) {
            TileAction.Append -> if (tile.output == tile.label) tile.label else "${tile.label}=${tile.output}"
            TileAction.Space -> "SPC=<space>"
            TileAction.Backspace -> "DEL=<delete>"
            TileAction.Clear -> "CLR=<clear>"
            TileAction.Speak -> "SAY=<speak>"
        }
    }
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
        normalizedLabel == "SAY" || normalizedValue == "<speak>" -> CommunicationTile("SAY", action = TileAction.Speak)
        label.isBlank() -> CommunicationTile(value)
        else -> CommunicationTile(label = label, output = value)
    }
}
