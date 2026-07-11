package org.shineaac.inputs

data class InputEvent(
    val intent: String,
    val source: String,
    val detail: String = ""
)

fun interface InputSink {
    fun onInput(event: InputEvent)
}

interface InputAdapter {
    fun start()
    fun stop()
}
