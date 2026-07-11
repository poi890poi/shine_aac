package org.shineaac.blinktest

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Paint
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.ImageReader
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class MainActivity : Activity() {
    private lateinit var preview: TextureView
    private lateinit var roiOverlay: RoiOverlay
    private lateinit var stateText: TextView
    private lateinit var scoreText: TextView
    private lateinit var eventCountText: TextView
    private lateinit var openText: TextView
    private lateinit var closedText: TextView
    private lateinit var thresholdText: TextView
    private lateinit var closureText: TextView
    private lateinit var logText: TextView
    private lateinit var autoThreshold: CheckBox

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var analysisSize = Size(320, 240)

    private var roiXPct = 28
    private var roiYPct = 30
    private var roiWPct = 44
    private var roiHPct = 16
    private var metric = Metric.ContrastDrop
    private var manualThreshold = 0.25
    private var hysteresis = 0.03
    private var longBlinkMs = 650L
    private var doubleGapMs = 650L
    private var ignoreShortMs = 70L
    private var cooldownMs = 500L

    private var openBaseline: Features? = null
    private var closedBaseline: Features? = null
    private var latestFeatures: Features? = null
    private var latestScore = 0.0
    private var closed = false
    private var closedStartedAt = 0L
    private var lastShortBlinkAt = 0L
    private var lastEventAt = 0L
    private var eventCount = 0
    private val logLines = java.util.ArrayDeque<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
    }

    override fun onDestroy() {
        closeCamera()
        super.onDestroy()
    }

    private fun buildUi() {
        preview = TextureView(this)
        roiOverlay = RoiOverlay(this)
        stateText = valueText("idle")
        scoreText = valueText("0.000")
        eventCountText = valueText("0")
        openText = valueText("not set")
        closedText = valueText("not set")
        thresholdText = valueText("0.250")
        closureText = valueText("none")
        logText = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.rgb(30, 38, 45))
            setPadding(12, 8, 12, 20)
        }
        autoThreshold = CheckBox(this).apply {
            text = "Auto threshold"
            isChecked = true
            setOnCheckedChangeListener { _, _ -> updateReadout() }
        }

        val previewFrame = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(preview, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(320)
            ))
            addView(roiOverlay, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(320)
            ))
        }

        val rootContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
            addView(previewFrame)
            addView(row("State", stateText, "Score", scoreText, "Events", eventCountText))
            addView(buttonRow(
                button("Start Camera") { startCameraFlow() },
                button("Calibrate Open") { calibrateOpen() },
                button("Sample Closed") { sampleClosed() },
                button("Clear Log") { clearLog() }
            ))
            addView(sectionTitle("Eye Region"))
            addView(slider("X", 0, 90, roiXPct) { roiXPct = it; updateRoi() })
            addView(slider("Y", 0, 80, roiYPct) { roiYPct = it; updateRoi() })
            addView(slider("Width", 8, 80, roiWPct) { roiWPct = it; updateRoi() })
            addView(slider("Height", 5, 45, roiHPct) { roiHPct = it; updateRoi() })
            addView(sectionTitle("Detection"))
            addView(buttonRow(
                button("Contrast") { metric = Metric.ContrastDrop; addLog("metric: contrast") },
                button("Bright +") { metric = Metric.BrightnessRise; addLog("metric: brightness rise") },
                button("Bright -") { metric = Metric.BrightnessDrop; addLog("metric: brightness drop") },
                button("Combined") { metric = Metric.Combined; addLog("metric: combined") }
            ))
            addView(autoThreshold)
            addView(slider("Manual threshold", 0, 1000, 250) { manualThreshold = it / 1000.0; updateReadout() })
            addView(slider("Hysteresis", 0, 250, 30) { hysteresis = it / 1000.0; updateReadout() })
            addView(sectionTitle("Events"))
            addView(slider("Long blink ms", 250, 3000, longBlinkMs.toInt()) { longBlinkMs = it.toLong() })
            addView(slider("Double gap ms", 150, 1500, doubleGapMs.toInt()) { doubleGapMs = it.toLong() })
            addView(slider("Ignore short ms", 0, 500, ignoreShortMs.toInt()) { ignoreShortMs = it.toLong() })
            addView(slider("Cooldown ms", 0, 2000, cooldownMs.toInt()) { cooldownMs = it.toLong() })
            addView(row("Open", openText))
            addView(row("Closed", closedText))
            addView(row("Threshold", thresholdText, "Last closure", closureText))
            addView(sectionTitle("Log"))
            addView(logText)
        }

        setContentView(ScrollView(this).apply { addView(rootContent) })
        updateRoi()
        updateReadout()
    }

    private fun startCameraFlow() {
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CameraPermissionRequestCode)
            return
        }
        startCamera()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CameraPermissionRequestCode &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            addLog("camera permission denied")
        }
    }

    private fun startCamera() {
        if (!preview.isAvailable) {
            preview.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                    openCamera()
                }

                override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) = Unit
                override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
                override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean = true
            }
            return
        }
        openCamera()
    }

    private fun openCamera() {
        closeCamera()
        cameraThread = HandlerThread("BlinkCamera").also { it.start() }
        cameraHandler = Handler(cameraThread!!.looper)

        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: manager.cameraIdList.first()

        imageReader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ reader ->
                reader.acquireLatestImage()?.use { analyzeImage(it) }
            }, cameraHandler)
        }

        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                createSession(camera)
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                addLog("camera error $error")
                camera.close()
                cameraDevice = null
            }
        }, cameraHandler)
    }

    private fun createSession(camera: CameraDevice) {
        val texture = preview.surfaceTexture ?: return
        texture.setDefaultBufferSize(analysisSize.width, analysisSize.height)
        val previewSurface = Surface(texture)
        val analysisSurface = imageReader?.surface ?: return
        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(previewSurface)
            addTarget(analysisSurface)
            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
        }

        camera.createCaptureSession(
            listOf(previewSurface, analysisSurface),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    session.setRepeatingRequest(request.build(), null, cameraHandler)
                    addLog("camera started")
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    addLog("camera configure failed")
                }
            },
            cameraHandler
        )
    }

    private fun closeCamera() {
        captureSession?.close()
        captureSession = null
        cameraDevice?.close()
        cameraDevice = null
        imageReader?.close()
        imageReader = null
        cameraThread?.quitSafely()
        cameraThread = null
        cameraHandler = null
    }

    private fun analyzeImage(image: Image) {
        val features = readFeatures(image)
        latestFeatures = features
        latestScore = score(features)
        val now = System.currentTimeMillis()
        updateBlinkState(now, latestScore)
        runOnUiThread { updateReadout() }
    }

    private fun readFeatures(image: Image): Features {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        val width = image.width
        val height = image.height
        val x0 = width * roiXPct / 100
        val y0 = height * roiYPct / 100
        val roiW = max(4, width * roiWPct / 100)
        val roiH = max(4, height * roiHPct / 100)
        val x1 = min(width, x0 + roiW)
        val y1 = min(height, y0 + roiH)

        var sum = 0.0
        var sumSquares = 0.0
        var edge = 0.0
        var count = 0
        var previous = -1

        for (y in y0 until y1) {
            for (x in x0 until x1) {
                val index = y * rowStride + x * pixelStride
                val value = (buffer.get(index).toInt() and 0xff) / 255.0
                sum += value
                sumSquares += value * value
                if (previous >= 0) edge += abs(value - previous / 255.0)
                previous = (buffer.get(index).toInt() and 0xff)
                count += 1
            }
        }

        val mean = if (count > 0) sum / count else 0.0
        val variance = if (count > 0) max(0.0, sumSquares / count - mean * mean) else 0.0
        return Features(mean, sqrt(variance), if (count > 0) edge / count else 0.0)
    }

    private fun score(features: Features): Double {
        val open = openBaseline ?: features
        return when (metric) {
            Metric.BrightnessRise -> clamp(features.mean - open.mean + 0.5, 0.0, 1.0)
            Metric.BrightnessDrop -> clamp(open.mean - features.mean + 0.5, 0.0, 1.0)
            Metric.Combined -> {
                val contrastDrop = normalizedDrop(features.contrast + features.edge, open.contrast + open.edge)
                val brightnessDelta = closedBaseline?.let {
                    normalizedToward(features.mean, open.mean, it.mean)
                } ?: clamp(abs(features.mean - open.mean) * 3.0, 0.0, 1.0)
                clamp(contrastDrop * 0.7 + brightnessDelta * 0.3, 0.0, 1.0)
            }
            Metric.ContrastDrop -> normalizedDrop(features.contrast + features.edge, open.contrast + open.edge)
        }
    }

    private fun updateBlinkState(now: Long, score: Double) {
        val threshold = activeThreshold()
        val closeAt = threshold + hysteresis
        val openAt = threshold - hysteresis
        if (!closed && score >= closeAt) {
            closed = true
            closedStartedAt = now
        } else if (closed && score <= openAt) {
            closed = false
            handleClosure(now, now - closedStartedAt)
        }
    }

    private fun handleClosure(now: Long, duration: Long) {
        runOnUiThread { closureText.text = "$duration ms" }
        if (duration < ignoreShortMs) return
        if (now - lastEventAt < cooldownMs) {
            lastShortBlinkAt = now
            return
        }
        if (duration >= longBlinkMs) {
            emitEvent("LONG BLINK ($duration ms)")
            lastShortBlinkAt = 0L
            return
        }
        if (lastShortBlinkAt > 0 && now - lastShortBlinkAt <= doubleGapMs) {
            emitEvent("DOUBLE BLINK (${now - lastShortBlinkAt} ms gap)")
            lastShortBlinkAt = 0L
            return
        }
        lastShortBlinkAt = now
        addLog("blink $duration ms")
    }

    private fun calibrateOpen() {
        val features = latestFeatures
        if (features == null) {
            addLog("start camera first")
            return
        }
        openBaseline = features
        closed = false
        addLog("open baseline captured")
        updateReadout()
    }

    private fun sampleClosed() {
        val features = latestFeatures
        if (features == null) {
            addLog("start camera first")
            return
        }
        closedBaseline = features
        addLog("closed sample captured")
        updateReadout()
    }

    private fun emitEvent(message: String) {
        lastEventAt = System.currentTimeMillis()
        eventCount += 1
        runOnUiThread {
            eventCountText.text = eventCount.toString()
            addLog(message)
        }
    }

    private fun addLog(message: String) {
        val line = "${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())} $message"
        runOnUiThread {
            logLines.addFirst(line)
            while (logLines.size > 24) logLines.removeLast()
            logText.text = logLines.joinToString("\n")
        }
    }

    private fun clearLog() {
        logLines.clear()
        eventCount = 0
        lastShortBlinkAt = 0L
        lastEventAt = 0L
        eventCountText.text = "0"
        closureText.text = "none"
        logText.text = ""
    }

    private fun updateReadout() {
        stateText.text = if (closed) "closed" else "open"
        scoreText.text = String.format("%.3f", latestScore)
        openText.text = formatFeatures(openBaseline)
        closedText.text = formatFeatures(closedBaseline)
        thresholdText.text = String.format("%.3f", activeThreshold())
    }

    private fun activeThreshold(): Double {
        if (!autoThreshold.isChecked) return manualThreshold
        val closedSample = closedBaseline
        return if (openBaseline != null && closedSample != null) {
            clamp(score(closedSample) * 0.5, 0.05, 0.95)
        } else {
            manualThreshold
        }
    }

    private fun formatFeatures(features: Features?): String {
        if (features == null) return "not set"
        return String.format("brightness %.3f, contrast %.3f, edge %.3f", features.mean, features.contrast, features.edge)
    }

    private fun updateRoi() {
        roiOverlay.setRoi(roiXPct, roiYPct, roiWPct, roiHPct)
    }

    private fun sectionTitle(text: String) = TextView(this).apply {
        this.text = text
        textSize = 18f
        setTextColor(Color.rgb(20, 60, 70))
        setPadding(0, 18, 0, 8)
    }

    private fun valueText(text: String) = TextView(this).apply {
        this.text = text
        textSize = 16f
        setTextColor(Color.rgb(20, 30, 36))
    }

    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text
        minHeight = dp(44)
        setOnClickListener { action() }
    }

    private fun buttonRow(vararg buttons: Button) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        for (button in buttons) {
            addView(button, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
    }

    private fun row(vararg values: Any) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(0, 8, 0, 8)
        var index = 0
        while (index < values.size) {
            val label = values[index] as String
            val value = values[index + 1] as TextView
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply {
                    text = label
                    textSize = 12f
                    setTextColor(Color.rgb(90, 104, 116))
                })
                addView(value)
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            index += 2
        }
    }

    private fun slider(label: String, minValue: Int, maxValue: Int, initial: Int, onChange: (Int) -> Unit) =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val labelView = TextView(this@MainActivity).apply {
                textSize = 14f
                setTextColor(Color.rgb(45, 58, 68))
            }
            val seek = SeekBar(this@MainActivity).apply {
                max = maxValue - minValue
                progress = initial - minValue
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar, progress: Int, fromUser: Boolean) {
                        val value = minValue + progress
                        labelView.text = "$label: $value"
                        onChange(value)
                    }

                    override fun onStartTrackingTouch(seekBar: SeekBar) = Unit
                    override fun onStopTrackingTouch(seekBar: SeekBar) = Unit
                })
            }
            labelView.text = "$label: $initial"
            addView(labelView)
            addView(seek)
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class Features(val mean: Double, val contrast: Double, val edge: Double)

    private enum class Metric {
        ContrastDrop,
        BrightnessRise,
        BrightnessDrop,
        Combined
    }

    private class RoiOverlay(context: Context) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(0, 168, 143)
            style = Paint.Style.STROKE
            strokeWidth = 4f
        }
        private var x = 28
        private var y = 30
        private var w = 44
        private var h = 16

        fun setRoi(xPct: Int, yPct: Int, wPct: Int, hPct: Int) {
            x = xPct
            y = yPct
            w = wPct
            h = hPct
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val left = width * x / 100f
            val top = height * y / 100f
            val right = left + width * w / 100f
            val bottom = top + height * h / 100f
            canvas.drawRect(left, top, right, bottom, paint)
        }
    }

    private companion object {
        const val CameraPermissionRequestCode = 2401

        fun clamp(value: Double, minValue: Double, maxValue: Double): Double =
            min(maxValue, max(minValue, value))

        fun normalizedDrop(value: Double, openValue: Double): Double {
            if (openValue <= 0.0001) return 0.0
            return clamp((openValue - value) / openValue, 0.0, 1.0)
        }

        fun normalizedToward(value: Double, openValue: Double, closedValue: Double): Double {
            val distance = closedValue - openValue
            if (abs(distance) <= 0.0001) return 0.0
            return clamp((value - openValue) / distance, 0.0, 1.0)
        }
    }
}
