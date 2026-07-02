package com.example.shineaac

import android.os.Bundle
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.shineaac.ui.theme.SHINEAACTheme
import java.util.Locale
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SHINEAACTheme(dynamicColor = false) {
                ShineAacApp()
            }
        }
    }
}

@Composable
private fun ShineAacApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("shine_aac_config", android.content.Context.MODE_PRIVATE) }
    val boardConfigState = remember {
        mutableStateOf(
            BoardConfig(
                columns = prefs.getInt("columns", DefaultColumns),
                scanIntervalMs = prefs.getFloat("scanIntervalMs", DefaultScanIntervalMs),
                transitionPauseMs = prefs.getFloat("transitionPauseMs", DefaultTransitionPauseMs),
                firstCellPauseMs = prefs.getFloat("firstCellPauseMs", DefaultFirstCellPauseMs),
                inputLatencyCompensationMs = prefs.getFloat(
                    "inputLatencyCompensationMs",
                    DefaultInputLatencyCompensationMs
                ),
                suggestionDictionary = parseDictionary(
                    prefs.getString(
                        "suggestionDictionary",
                        serializeDictionary(DefaultSuggestionDictionary)
                    ) ?: serializeDictionary(DefaultSuggestionDictionary)
                ),
                symbols = loadSymbolsForConfig(
                    storedSymbols = prefs.getString("symbols", null),
                    storedVersion = prefs.getInt("configVersion", 0)
                )
            )
        )
    }
    val boardConfig = boardConfigState.value
    var message by rememberSaveable { mutableStateOf("") }
    var messageHistory by remember { mutableStateOf(emptyList<String>()) }
    val board = boardConfig.rows(message, canUndo = messageHistory.isNotEmpty())
    var scannerState by remember { mutableStateOf(ScannerState()) }
    var highlightStartedAtMs by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    var progressNowMs by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    var showConfig by rememberSaveable { mutableStateOf(false) }
    var ttsReady by remember { mutableStateOf(false) }
    var tts: TextToSpeech? by remember { mutableStateOf(null) }

    DisposableEffect(context) {
        val engine = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
        }
        engine.language = Locale.getDefault()
        tts = engine
        onDispose {
            engine.stop()
            engine.shutdown()
        }
    }

    fun saveConfig(nextConfig: BoardConfig) {
        val safeConfig = nextConfig.copy(columns = nextConfig.columns.coerceIn(2, 8))
        boardConfigState.value = safeConfig
        prefs.edit()
            .putInt("columns", safeConfig.columns)
            .putFloat("scanIntervalMs", safeConfig.scanIntervalMs)
            .putFloat("transitionPauseMs", safeConfig.transitionPauseMs)
            .putFloat("firstCellPauseMs", safeConfig.firstCellPauseMs)
            .putFloat("inputLatencyCompensationMs", safeConfig.inputLatencyCompensationMs)
            .putString("suggestionDictionary", serializeDictionary(safeConfig.suggestionDictionary))
            .putString("symbols", serializeSymbols(safeConfig.symbols))
            .putInt("configVersion", CurrentConfigVersion)
            .apply()
        scannerState = ScannerState()
        highlightStartedAtMs = SystemClock.elapsedRealtime()
    }

    fun speak() {
        val text = message.trim()
        if (text.isNotEmpty() && ttsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-message")
        }
    }

    fun applyTile(tile: CommunicationTile) {
        if (tile.action == TileAction.Noop) return
        if (tile.action == TileAction.Undo) {
            val previous = messageHistory.lastOrNull() ?: return
            message = previous
            messageHistory = messageHistory.dropLast(1)
            return
        }
        if (tile.action == TileAction.Speak) {
            speak()
            return
        }

        val nextMessage = updateMessage(message, tile)
        if (nextMessage != message) {
            messageHistory = (messageHistory + message).takeLast(24)
            message = nextMessage
        }
    }

    fun setScannerState(nextState: ScannerState) {
        scannerState = nextState
        highlightStartedAtMs = SystemClock.elapsedRealtime()
    }

    LaunchedEffect(message, messageHistory, boardConfig.suggestionDictionary, boardConfig.columns) {
        val suggestionRowHasTargets = board.firstOrNull()?.selectableCount() ?: 0 > 0
        if (suggestionRowHasTargets) {
            setScannerState(ScannerState(rowIndex = 0))
            return@LaunchedEffect
        }
        val currentRowIsEmpty = board.getOrNull(scannerState.rowIndex)?.selectableCount() == 0
        if (currentRowIsEmpty) {
            setScannerState(ScannerState(rowIndex = firstSelectableRow(board)))
        }
    }

    fun pressSwitch() {
        val elapsedInHighlightMs = SystemClock.elapsedRealtime() - highlightStartedAtMs
        val confirmation = scannerState.confirmWithLatencyCompensation(
            rowCount = board.size,
            columnCountForRow = { row -> board[row].selectableCount() },
            elapsedInHighlightMs = elapsedInHighlightMs,
            compensationWindowMs = boardConfig.inputLatencyCompensationMs
        )

        when (confirmation) {
            is ScannerConfirmation.NoSelection -> setScannerState(confirmation.nextState)
            is ScannerConfirmation.Selected -> {
                setScannerState(confirmation.nextState)
                applyTile(board[confirmation.rowIndex][confirmation.cellIndex])
            }
        }
    }

    LaunchedEffect(
        boardConfig.scanIntervalMs,
        boardConfig.transitionPauseMs,
        boardConfig.firstCellPauseMs,
        boardConfig.inputLatencyCompensationMs,
        message,
        scannerState,
        showConfig
    ) {
        if (showConfig) return@LaunchedEffect
        val delayMs = when (scannerState.stage) {
            ScanStage.RowSelected -> boardConfig.transitionPauseMs
            ScanStage.FirstCell -> boardConfig.firstCellPauseMs
            else -> boardConfig.scanIntervalMs
        }
        delay(delayMs.toLong())
        setScannerState(scannerState.advance(board.size) { row -> board[row].selectableCount() })
    }

    LaunchedEffect(scannerState, highlightStartedAtMs, showConfig) {
        if (showConfig) return@LaunchedEffect
        while (true) {
            progressNowMs = SystemClock.elapsedRealtime()
            delay(50)
        }
    }

    if (showConfig) {
        ConfigScreen(
            config = boardConfig,
            onSave = {
                saveConfig(it)
                showConfig = false
            },
            onCancel = { showConfig = false },
            onReset = { saveConfig(BoardConfig()) }
        )
        return
    }

    Surface(
        modifier = Modifier
            .fillMaxSize()
            .clickable(onClick = ::pressSwitch)
            .semantics {
                contentDescription = "Switch input. Tap anywhere to select the highlighted row or symbol."
            },
        color = Color(0xFFF7F7F2)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MessagePanel(
                message = message,
                scannerState = scannerState,
                ttsReady = ttsReady,
                onConfig = { showConfig = true }
            )
            CommunicationBoard(
                board = board,
                scannerState = scannerState,
                progress = scanProgress(
                    scannerState = scannerState,
                    highlightStartedAtMs = highlightStartedAtMs,
                    nowMs = progressNowMs,
                    scanIntervalMs = boardConfig.scanIntervalMs,
                    transitionPauseMs = boardConfig.transitionPauseMs,
                    firstCellPauseMs = boardConfig.firstCellPauseMs
                ),
                latencyFraction = latencyFraction(
                    scannerState = scannerState,
                    scanIntervalMs = boardConfig.scanIntervalMs,
                    transitionPauseMs = boardConfig.transitionPauseMs,
                    firstCellPauseMs = boardConfig.firstCellPauseMs,
                    inputLatencyCompensationMs = boardConfig.inputLatencyCompensationMs
                )
            )
        }
    }
}

private fun updateMessage(current: String, tile: CommunicationTile): String {
    return when (tile.action) {
        TileAction.Append -> appendToken(current, tile.output)
        TileAction.Space -> current.trimEnd() + " "
        TileAction.Backspace -> current.dropLast(1)
        TileAction.Clear -> ""
        TileAction.Undo -> current
        TileAction.Speak -> current
        TileAction.Noop -> current
    }
}

private fun appendToken(current: String, token: String): String {
    if (token.length == 1 && token.first().isLetter()) return current + token.lowercase()
    if (current.isBlank()) return token
    if (current.endsWith(" ")) return current + token
    return "$current $token"
}

@Composable
private fun MessagePanel(
    message: String,
    scannerState: ScannerState,
    ttsReady: Boolean,
    onConfig: () -> Unit
) {
    var cursorVisible by remember { mutableStateOf(true) }
    LaunchedEffect(message) {
        while (true) {
            delay(500)
            cursorVisible = !cursorVisible
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = message + if (cursorVisible) "|" else " ",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .background(Color(0xFFF0F4F8), RoundedCornerShape(6.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                color = Color(0xFF17202A),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = scanPhaseLabel(scannerState.stage),
                    color = Color(0xFF27343B),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (ttsReady) "Voice" else "...",
                    color = Color(0xFF27343B),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onConfig) {
                    Text("Config")
                }
            }
        }
    }
}

@Composable
private fun CommunicationBoard(
    board: List<List<CommunicationTile>>,
    scannerState: ScannerState,
    progress: Float,
    latencyFraction: Float
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        board.forEachIndexed { rowIndex, row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                row.forEachIndexed { cellIndex, tile ->
                    val isActiveRow = (scannerState.stage == ScanStage.Rows || scannerState.stage == ScanStage.RowSelected) &&
                        scannerState.rowIndex == rowIndex
                    val isActiveCell = (scannerState.stage == ScanStage.Cells || scannerState.stage == ScanStage.FirstCell) &&
                        scannerState.rowIndex == rowIndex &&
                        scannerState.cellIndex == cellIndex
                    CommunicationTileButton(
                        tile = tile,
                        highlighted = isActiveRow || isActiveCell,
                        selected = isActiveCell,
                        progress = if (isActiveRow || isActiveCell) progress else 0f,
                        latencyFraction = if (isActiveCell) latencyFraction else 0f,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun ConfigScreen(
    config: BoardConfig,
    onSave: (BoardConfig) -> Unit,
    onCancel: () -> Unit,
    onReset: () -> Unit
) {
    var columnsText by rememberSaveable { mutableStateOf(config.columns.toString()) }
    var speed by rememberSaveable { mutableStateOf(config.scanIntervalMs) }
    var transitionPause by rememberSaveable { mutableStateOf(config.transitionPauseMs) }
    var firstCellPause by rememberSaveable { mutableStateOf(config.firstCellPauseMs) }
    var inputLatencyCompensation by rememberSaveable { mutableStateOf(config.inputLatencyCompensationMs) }
    var dictionaryText by rememberSaveable { mutableStateOf(serializeDictionary(config.suggestionDictionary)) }
    var symbolsText by rememberSaveable { mutableStateOf(serializeSymbols(config.symbols)) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFFF7F7F2)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Configuration",
                color = Color(0xFF17202A),
                fontSize = 28.sp,
                fontWeight = FontWeight.Black
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = columnsText,
                    onValueChange = { columnsText = it.filter { char -> char.isDigit() }.take(1) },
                    modifier = Modifier.weight(1f),
                    label = { Text("Columns") },
                    singleLine = true
                )
                Column(modifier = Modifier.weight(2f)) {
                    Text(
                        text = "Switch speed ${(speed / 1000f).formatOneDecimal()}s",
                        fontWeight = FontWeight.Bold
                    )
                    Slider(
                        value = speed,
                        onValueChange = { speed = it },
                        valueRange = 450f..2500f,
                        steps = 40
                    )
                }
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Row-to-symbol pause ${(transitionPause / 1000f).formatOneDecimal()}s",
                    fontWeight = FontWeight.Bold
                )
                Slider(
                    value = transitionPause,
                    onValueChange = { transitionPause = it },
                    valueRange = 0f..2200f,
                    steps = 22
                )
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "First-symbol hold ${(firstCellPause / 1000f).formatOneDecimal()}s",
                    fontWeight = FontWeight.Bold
                )
                Slider(
                    value = firstCellPause,
                    onValueChange = { firstCellPause = it },
                    valueRange = 600f..3200f,
                    steps = 26
                )
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Input latency compensation ${(inputLatencyCompensation / 1000f).formatOneDecimal()}s",
                    fontWeight = FontWeight.Bold
                )
                Slider(
                    value = inputLatencyCompensation,
                    onValueChange = { inputLatencyCompensation = it },
                    valueRange = 0f..700f,
                    steps = 14
                )
            }
            OutlinedTextField(
                value = dictionaryText,
                onValueChange = { dictionaryText = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.65f),
                label = { Text("Suggestion dictionary, one word or LABEL=spoken text per line.") }
            )
            OutlinedTextField(
                value = symbolsText,
                onValueChange = { symbolsText = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                label = { Text("Board symbols, one per line. Use LABEL=spoken text for words.") }
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        val defaultConfig = BoardConfig()
                        columnsText = defaultConfig.columns.toString()
                        speed = defaultConfig.scanIntervalMs
                        transitionPause = defaultConfig.transitionPauseMs
                        firstCellPause = defaultConfig.firstCellPauseMs
                        inputLatencyCompensation = defaultConfig.inputLatencyCompensationMs
                        dictionaryText = serializeDictionary(defaultConfig.suggestionDictionary)
                        symbolsText = serializeSymbols(defaultConfig.symbols)
                        onReset()
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Reset")
                }
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Cancel")
                }
                OutlinedButton(
                    onClick = {
                        onSave(
                            BoardConfig(
                                columns = columnsText.toIntOrNull()?.coerceIn(2, 8) ?: DefaultColumns,
                                scanIntervalMs = speed,
                                transitionPauseMs = transitionPause,
                                firstCellPauseMs = firstCellPause,
                                inputLatencyCompensationMs = inputLatencyCompensation,
                                suggestionDictionary = parseDictionary(dictionaryText),
                                symbols = parseSymbols(symbolsText)
                            )
                        )
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Save")
                }
            }
        }
    }
}

private fun scanPhaseLabel(stage: ScanStage): String {
    return when (stage) {
        ScanStage.Rows -> "Rows"
        ScanStage.RowSelected -> "Cancel"
        ScanStage.FirstCell -> "First"
        ScanStage.Cells -> "Symbols"
    }
}

private fun scanProgress(
    scannerState: ScannerState,
    highlightStartedAtMs: Long,
    nowMs: Long,
    scanIntervalMs: Float,
    transitionPauseMs: Float,
    firstCellPauseMs: Float
): Float {
    val elapsedMs = (nowMs - highlightStartedAtMs).coerceAtLeast(0)
    val durationMs = scanDurationForStage(scannerState, scanIntervalMs, transitionPauseMs, firstCellPauseMs)
    return (elapsedMs.toFloat() / durationMs.coerceAtLeast(1f)).coerceIn(0f, 1f)
}

private fun latencyFraction(
    scannerState: ScannerState,
    scanIntervalMs: Float,
    transitionPauseMs: Float,
    firstCellPauseMs: Float,
    inputLatencyCompensationMs: Float
): Float {
    if (scannerState.stage != ScanStage.Cells) return 0f
    val durationMs = scanDurationForStage(scannerState, scanIntervalMs, transitionPauseMs, firstCellPauseMs)
    return (inputLatencyCompensationMs / durationMs.coerceAtLeast(1f)).coerceIn(0f, 1f)
}

private fun List<CommunicationTile>.selectableCount(): Int = count { it.action != TileAction.Noop }

private fun firstSelectableRow(board: List<List<CommunicationTile>>): Int {
    return board.indexOfFirst { it.selectableCount() > 0 }.coerceAtLeast(0)
}

private fun scanDurationForStage(
    scannerState: ScannerState,
    scanIntervalMs: Float,
    transitionPauseMs: Float,
    firstCellPauseMs: Float
): Float {
    return when (scannerState.stage) {
        ScanStage.RowSelected -> transitionPauseMs
        ScanStage.FirstCell -> firstCellPauseMs
        else -> scanIntervalMs
    }
}

@Composable
private fun CommunicationTileButton(
    tile: CommunicationTile,
    highlighted: Boolean,
    selected: Boolean,
    progress: Float,
    latencyFraction: Float,
    modifier: Modifier = Modifier
) {
    val background = when {
        tile.action == TileAction.Noop -> Color(0xFFF0F2F3)
        selected -> Color(0xFFF4D35E)
        highlighted -> Color(0xFF9BC1BC)
        tile.action != TileAction.Append -> Color(0xFFE8ECEF)
        else -> Color.White
    }
    val border = when {
        selected -> Color(0xFF111111)
        highlighted -> Color(0xFF1F7A8C)
        else -> Color(0xFFB9C1C8)
    }

    Box(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(8.dp))
            .background(background)
            .border(width = if (highlighted) 4.dp else 1.dp, color = border, shape = RoundedCornerShape(8.dp))
            .semantics { contentDescription = tile.label },
        contentAlignment = Alignment.Center
    ) {
        if (highlighted && progress > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(progress)
                    .background(Color(0x332D6A4F))
                    .align(Alignment.CenterStart)
            )
        }
        if (latencyFraction > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(latencyFraction)
                    .background(Color(0x44F4D35E))
                    .align(Alignment.CenterStart)
            )
        }
        Text(
            text = tile.label,
            modifier = Modifier.padding(4.dp),
            color = Color(0xFF182026),
            textAlign = TextAlign.Center,
            fontSize = when {
                tile.label.length >= 9 -> 11.sp
                tile.label.length >= 7 -> 13.sp
                tile.label.length >= 5 -> 16.sp
                tile.label.length >= 4 -> 19.sp
                else -> 26.sp
            },
            fontWeight = FontWeight.Black,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun Float.formatOneDecimal(): String = String.format(Locale.US, "%.1f", this)
