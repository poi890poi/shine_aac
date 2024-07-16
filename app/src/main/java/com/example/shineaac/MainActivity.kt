package com.example.shineaac

import android.os.Bundle
import androidx.activity.ComponentActivity
import android.os.Handler
import android.os.Looper
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView

class MainActivity : ComponentActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private val scanInterval: Long = 400 // Change color every 2 seconds
    private var sacLevel = 0
    private var sacActive = -1
    private var sacPrev = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        startSwitchAccessScan()
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

    private fun switchAccessScan() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        while (true) {
            if (sacActive >= sacTableLayout.childCount) sacActive = 0
            else sacActive++
            val active = sacTableLayout.getChildAt(sacActive)
            if (active is TableRow) {
                setRowBackgroundColor(active, getColor(R.color.purple_200))
                break
            }
        }
        if (sacPrev >= 0) {
            val prev = sacTableLayout.getChildAt(sacPrev)
            if (prev is TableRow) setRowBackgroundColor(prev, getColor(R.color.ivory))
        }
        sacPrev = sacActive
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}