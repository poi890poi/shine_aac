package org.shineaac.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class BlinkTestActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var pendingPermissionRequest: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val view = WebView(this).apply {
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        if (hasCameraPermission()) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                        } else {
                            pendingPermissionRequest = request
                            ActivityCompat.requestPermissions(
                                this@BlinkTestActivity,
                                arrayOf(Manifest.permission.CAMERA),
                                CameraPermissionRequestCode
                            )
                        }
                    } else {
                        request.deny()
                    }
                }
            }
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            loadUrl("file:///android_asset/www/apps/blink-test/index.html")
        }

        webView = view
        setContentView(view)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != CameraPermissionRequestCode) return

        val request = pendingPermissionRequest ?: return
        pendingPermissionRequest = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } else {
            request.deny()
        }
    }

    override fun onDestroy() {
        pendingPermissionRequest?.deny()
        pendingPermissionRequest = null
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
    }

    private companion object {
        const val CameraPermissionRequestCode = 2401
    }
}
