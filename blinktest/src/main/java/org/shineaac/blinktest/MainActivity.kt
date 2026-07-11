package org.shineaac.blinktest

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.FaceDetector
import android.media.ImageReader
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
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
    private lateinit var trackingText: TextView
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
    private var metric = Metric.Sampled
    private var manualThreshold = 0.25
    private var hysteresis = 0.03
    private var longBlinkMs = 650L
    private var doubleGapMs = 650L
    private var ignoreShortMs = 70L
    private var cooldownMs = 500L
    private var mirrorOverlayX = false

    private var openBaseline: Features? = null
    private var closedBaseline: Features? = null
    private var latestFeatures: Features? = null
    private var latestScore = 0.0
    private var lastTrackedRoi: TrackedRoi? = null
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
        trackingText = valueText("manual")
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
            addView(row("Tracking", trackingText))
            addView(buttonRow(
                button("Start Camera") { startCameraFlow() },
                button("Calibrate Open") { calibrateOpen() },
                button("Sample Closed in 3s") { sampleClosedAfterDelay() },
                button("Clear Log") { clearLog() }
            ))
            addView(buttonRow(
                button("Flip Box X") {
                    mirrorOverlayX = !mirrorOverlayX
                    addLog("box mirror X: ${if (mirrorOverlayX) "on" else "off"}")
                    lastTrackedRoi = null
                    updateRoi()
                }
            ))
            addView(sectionTitle("Manual Fallback Region"))
            addView(slider("X", 0, 90, roiXPct) { roiXPct = it; updateRoi() })
            addView(slider("Y", 0, 80, roiYPct) { roiYPct = it; updateRoi() })
            addView(slider("Width", 8, 80, roiWPct) { roiWPct = it; updateRoi() })
            addView(slider("Height", 5, 45, roiHPct) { roiHPct = it; updateRoi() })
            addView(sectionTitle("Detection"))
            addView(buttonRow(
                button("Sampled") { metric = Metric.Sampled; addLog("metric: sampled") },
                button("Contrast") { metric = Metric.ContrastDrop; addLog("metric: contrast") },
                button("Bright +") { metric = Metric.BrightnessRise; addLog("metric: brightness rise") },
                button("Bright -") { metric = Metric.BrightnessDrop; addLog("metric: brightness drop") }
            ))
            addView(buttonRow(
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
        val rawFrame = RawFrame.from(image)
        val rotations = mutableListOf<Int>()
        lastTrackedRoi?.rotation?.let { rotations.add(it) }
        rotations.addAll(listOf(0, 90, 270, 180))

        for (rotation in rotations.distinct()) {
            val frame = rawFrame.oriented(rotation)
            val face = detectFace(frame)
            if (face != null) {
                val roi = eyeBandForFace(frame, face, rotation)
                lastTrackedRoi = roi
                runOnUiThread {
                    trackingText.text = "face ${rotation}deg"
                    roiOverlay.setRoi(
                        (roi.x * 100 / frame.width).coerceIn(0, 99),
                        (roi.y * 100 / frame.height).coerceIn(0, 99),
                        (roi.w * 100 / frame.width).coerceIn(1, 100),
                        (roi.h * 100 / frame.height).coerceIn(1, 100),
                        mirrorOverlayX
                    )
                }
                return featuresFromRoi(frame, roi.x, roi.y, roi.w, roi.h)
            }
        }

        val last = lastTrackedRoi
        if (last != null && System.currentTimeMillis() - last.detectedAtMs < 1200) {
            val frame = rawFrame.oriented(last.rotation)
            runOnUiThread { trackingText.text = "last face" }
            return featuresFromRoi(frame, last.x, last.y, last.w, last.h)
        }

        val frame = rawFrame.oriented(0)
        val x0 = frame.width * roiXPct / 100
        val y0 = frame.height * roiYPct / 100
        val roiW = max(4, frame.width * roiWPct / 100)
        val roiH = max(4, frame.height * roiHPct / 100)
        runOnUiThread {
            trackingText.text = "manual fallback"
            updateRoi()
        }
        return featuresFromRoi(frame, x0, y0, roiW, roiH)
    }

    private fun detectFace(frame: OrientedFrame): FaceDetector.Face? {
        val width = if (frame.width % 2 == 0) frame.width else frame.width - 1
        if (width <= 0 || frame.height <= 0) return null
        val pixels = IntArray(width * frame.height)
        var target = 0
        for (y in 0 until frame.height) {
            val row = y * frame.width
            for (x in 0 until width) {
                val value = frame.luma[row + x].toInt() and 0xff
                pixels[target++] = Color.rgb(value, value, value)
            }
        }
        val bitmap = Bitmap.createBitmap(width, frame.height, Bitmap.Config.RGB_565)
        bitmap.setPixels(pixels, 0, width, 0, 0, width, frame.height)
        val faces = arrayOfNulls<FaceDetector.Face>(1)
        FaceDetector(width, frame.height, 1).findFaces(bitmap, faces)
        bitmap.recycle()
        return faces[0]
    }

    private fun eyeBandForFace(frame: OrientedFrame, face: FaceDetector.Face, rotation: Int): TrackedRoi {
        val midpoint = PointF()
        face.getMidPoint(midpoint)
        val eyesDistance = max(18f, face.eyesDistance())
        val roiW = clampInt((eyesDistance * 2.1f).toInt(), 20, frame.width)
        val roiH = clampInt((eyesDistance * 0.65f).toInt(), 12, frame.height)
        val x = clampInt((midpoint.x - roiW / 2f).toInt(), 0, frame.width - roiW)
        val y = clampInt((midpoint.y - roiH * 0.55f).toInt(), 0, frame.height - roiH)
        return TrackedRoi(rotation, x, y, roiW, roiH, System.currentTimeMillis())
    }

    private fun featuresFromRoi(frame: OrientedFrame, x0: Int, y0: Int, roiW: Int, roiH: Int): Features {
        val x1 = min(frame.width, x0 + roiW)
        val y1 = min(frame.height, y0 + roiH)

        var sum = 0.0
        var sumSquares = 0.0
        var edge = 0.0
        var count = 0
        var previous = -1

        for (y in y0 until y1) {
            val row = y * frame.width
            for (x in x0 until x1) {
                val raw = frame.luma[row + x].toInt() and 0xff
                val value = raw / 255.0
                sum += value
                sumSquares += value * value
                if (previous >= 0) edge += abs(value - previous / 255.0)
                previous = raw
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
            Metric.Sampled -> sampledClosedScore(features)
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

    private fun sampledClosedScore(features: Features): Double {
        val open = openBaseline
        val closedSample = closedBaseline
        if (open == null || closedSample == null) {
            return normalizedDrop(
                features.contrast + features.edge,
                (open ?: features).contrast + (open ?: features).edge
            )
        }
        val distOpen = featureDistance(features, open)
        val distClosed = featureDistance(features, closedSample)
        val denominator = distOpen + distClosed
        if (denominator <= 0.000001) return 0.0
        return clamp(distOpen / denominator, 0.0, 1.0)
    }

    private fun featureDistance(a: Features, b: Features): Double {
        val mean = (a.mean - b.mean) * 3.0
        val contrast = (a.contrast - b.contrast) * 6.0
        val edge = (a.edge - b.edge) * 10.0
        return sqrt(mean * mean + contrast * contrast + edge * edge)
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

    private fun sampleClosedAfterDelay() {
        addLog("close eyes now; sampling in 3 seconds")
        Handler(Looper.getMainLooper()).postDelayed({
            sampleClosed()
        }, 3000)
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
        roiOverlay.setRoi(roiXPct, roiYPct, roiWPct, roiHPct, mirrorOverlayX)
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

    private data class TrackedRoi(
        val rotation: Int,
        val x: Int,
        val y: Int,
        val w: Int,
        val h: Int,
        val detectedAtMs: Long
    )

    private data class OrientedFrame(
        val width: Int,
        val height: Int,
        val luma: ByteArray
    )

    private data class RawFrame(
        val width: Int,
        val height: Int,
        val luma: ByteArray
    ) {
        fun oriented(rotation: Int): OrientedFrame {
            return when (rotation) {
                90 -> {
                    val out = ByteArray(width * height)
                    var target = 0
                    for (x in 0 until width) {
                        for (y in height - 1 downTo 0) {
                            out[target++] = luma[y * width + x]
                        }
                    }
                    OrientedFrame(height, width, out)
                }
                180 -> {
                    val out = ByteArray(width * height)
                    var target = 0
                    for (index in luma.indices.reversed()) {
                        out[target++] = luma[index]
                    }
                    OrientedFrame(width, height, out)
                }
                270 -> {
                    val out = ByteArray(width * height)
                    var target = 0
                    for (x in width - 1 downTo 0) {
                        for (y in 0 until height) {
                            out[target++] = luma[y * width + x]
                        }
                    }
                    OrientedFrame(height, width, out)
                }
                else -> OrientedFrame(width, height, luma)
            }
        }

        companion object {
            fun from(image: Image): RawFrame {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val rowStride = plane.rowStride
                val pixelStride = plane.pixelStride
                val out = ByteArray(image.width * image.height)
                var target = 0
                for (y in 0 until image.height) {
                    for (x in 0 until image.width) {
                        out[target++] = buffer.get(y * rowStride + x * pixelStride)
                    }
                }
                return RawFrame(image.width, image.height, out)
            }
        }
    }

    private enum class Metric {
        Sampled,
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
        private var mirrorX = true

        fun setRoi(xPct: Int, yPct: Int, wPct: Int, hPct: Int, mirrorX: Boolean = true) {
            x = xPct
            y = yPct
            w = wPct
            h = hPct
            this.mirrorX = mirrorX
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val displayX = if (mirrorX) 100 - x - w else x
            val left = width * displayX / 100f
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

        fun clampInt(value: Int, minValue: Int, maxValue: Int): Int =
            min(maxValue, max(minValue, value))
    }
}
