package com.example.shineaac

import android.os.Bundle
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
                symbols = parseSymbols(prefs.getString("symbols", serializeSymbols(DefaultTiles)) ?: serializeSymbols(DefaultTiles))
            )
        )
    }
    val boardConfig = boardConfigState.value
    val board = boardConfig.rows()
    var message by rememberSaveable { mutableStateOf("") }
    var scannerState by remember { mutableStateOf(ScannerState()) }
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
            .putString("symbols", serializeSymbols(safeConfig.symbols))
            .apply()
        scannerState = ScannerState()
    }

    fun speak() {
        val text = message.trim()
        if (text.isNotEmpty() && ttsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-message")
        }
    }

    fun applyTile(tile: CommunicationTile) {
        message = updateMessage(message, tile)
        if (tile.action == TileAction.Speak) speak()
    }

    fun pressSwitch() {
        when (val confirmation = scannerState.confirm(board.size) { row -> board[row].size }) {
            is ScannerConfirmation.NoSelection -> scannerState = confirmation.nextState
            is ScannerConfirmation.Selected -> {
                scannerState = confirmation.nextState
                applyTile(board[confirmation.rowIndex][confirmation.cellIndex])
            }
        }
    }

    LaunchedEffect(boardConfig.scanIntervalMs, scannerState, showConfig) {
        if (showConfig) return@LaunchedEffect
        delay(boardConfig.scanIntervalMs.toLong())
        scannerState = scannerState.advance(board.size) { row -> board[row].size }
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
                scanIntervalMs = boardConfig.scanIntervalMs,
                ttsReady = ttsReady,
                onConfig = { showConfig = true }
            )
            CommunicationBoard(
                board = board,
                scannerState = scannerState
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
        TileAction.Speak -> current
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
    scanIntervalMs: Float,
    ttsReady: Boolean,
    onConfig: () -> Unit
) {
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
                text = message.ifBlank { " " },
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
                    text = if (scannerState.stage == ScanStage.Rows) "Scan rows" else "Scan symbols",
                    color = Color(0xFF27343B),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${(scanIntervalMs / 1000f).formatOneDecimal()}s",
                    color = Color(0xFF27343B),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (ttsReady) "Voice ready" else "Voice loading",
                    color = Color(0xFF27343B),
                    fontSize = 17.sp,
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
    scannerState: ScannerState
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
                    val isActiveRow = scannerState.stage == ScanStage.Rows && scannerState.rowIndex == rowIndex
                    val isActiveCell = scannerState.stage == ScanStage.Cells &&
                        scannerState.rowIndex == rowIndex &&
                        scannerState.cellIndex == cellIndex
                    CommunicationTileButton(
                        tile = tile,
                        highlighted = isActiveRow || isActiveCell,
                        selected = isActiveCell,
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
            OutlinedTextField(
                value = symbolsText,
                onValueChange = { symbolsText = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                label = { Text("Symbols, one per line. Use LABEL=spoken text for words.") }
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onReset,
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

@Composable
private fun CommunicationTileButton(
    tile: CommunicationTile,
    highlighted: Boolean,
    selected: Boolean,
    modifier: Modifier = Modifier
) {
    val background = when {
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
