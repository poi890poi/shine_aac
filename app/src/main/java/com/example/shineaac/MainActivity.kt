package com.example.shineaac

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.MotionEvent
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import androidx.activity.ComponentActivity


const val TAG = "MainActivity"

class MainActivity : ComponentActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private val scanInterval: Long = 750 // Change color every 2 seconds
    private var sacLevel = 0
    private var sacActive = arrayOf(-1, -1, -1)
    private var sacPrev = arrayOf(-1, -1, -1)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        onTouchHandler()
        startSwitchAccessScan()
    }

    private fun onTouchHandler() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        sacTableLayout.setOnTouchListener { v, event ->
            Log.v(TAG, "event=" + event);
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    // Handle touch down event
                    sacLevel++
                    true
                }
                MotionEvent.ACTION_UP -> {
                    // Handle touch up event
                    v.performClick()
                    true
                }
                else -> false
            }
        }
    }

    private fun startSwitchAccessScan() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                switchAccessScan()
                handler.postDelayed(this, scanInterval)
            }
        }, scanInterval)
    }

    private fun setRowBackgroundColor(row: TableRow, color: Int) {
        for (j in 0 until row.childCount) {
            val t = row.getChildAt(j)
            if (t is TextView) {
                t.setBackgroundColor(color)
            }
        }
    }

    private fun sacInput() {
        Log.v(TAG, "sac input " + sacActive[0] + ", " + sacActive[1])
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        val row = sacTableLayout.getChildAt(sacActive[0]) as TableRow
        val cell = row.getChildAt(sacActive[1]) as TextView
        val sacInput = findViewById<TextView>(R.id.sac_input)
        val txt = cell.text.toString()
        when (txt) {
            getString(R.string.symbol_clear) -> {
                sacInput.setText("")
            }
            getString(R.string.symbol_space) -> {
                sacInput.append(" ")
            }
            getString(R.string.symbol_backspace) -> {
                sacInput.setText(sacInput.text.substring(0, sacInput.text.length - 1))
            }
            getString(R.string.symbol_question) -> {
                sacInput.append("?")
            }
            else -> {
                sacInput.append(txt)
            }
        }
        sacLevel = 0
        sacActive[0] = -1
        sacActive[1] = -1
    }

    private fun sacLvl1() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        val row = sacTableLayout.getChildAt(sacActive[0]) as TableRow
        while (true) {
            if (sacActive[1] >= row.childCount) sacActive[1] = 0
            else sacActive[1]++
            val cell = row.getChildAt(sacActive[1])
            if (cell is TextView) {
                cell.setBackgroundColor(getColor(R.color.teal_700))
                break
            }
        }
        if (sacPrev[1] >= 0) {
            val prev = row.getChildAt(sacPrev[1])
            prev.setBackgroundColor(getColor(R.color.purple_200))
        }
        sacPrev[1] = sacActive[1]
    }

    private fun sacLvl0() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        while (true) {
            if (sacActive[0] >= sacTableLayout.childCount) sacActive[0] = 0
            else sacActive[0]++
            val row = sacTableLayout.getChildAt(sacActive[0])
            if (row is TableRow) {
                setRowBackgroundColor(row, getColor(R.color.purple_200))
                break
            }
        }
        if (sacPrev[0] >= 0) {
            val prev = sacTableLayout.getChildAt(sacPrev[0])
            if (prev is TableRow) setRowBackgroundColor(prev, getColor(R.color.ivory))
        }
        sacPrev[0] = sacActive[0]
    }

    private fun switchAccessScan() {
        when(sacLevel) {
            0 -> sacLvl0()
            1 -> sacLvl1()
            2 -> sacInput()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}