package org.shineaac.inputs

/** Optional, APK-only telemetry sink for diagnosing the real camera-switch pipeline. */
fun interface CameraSwitchDiagnostics {
    fun record(event: String, fields: Map<String, Any?>)
}

