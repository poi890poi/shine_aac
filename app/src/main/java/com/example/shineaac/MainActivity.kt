package com.example.shineaac

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import androidx.activity.ComponentActivity


const val TAG = "MainActivity"

class MainActivity : ComponentActivity() {
    private val mHandler = Handler(Looper.getMainLooper())
    private val mScanInterval: Long = 750
    private val mRunnable = object : Runnable {
        override fun run() {
            switchAccessScan()
            mHandler.postDelayed(this, mScanInterval)
        }
    }
    private var mSacLevel = 0
    private var mSacActive = arrayOf(-1, -1, -1)
    private var mSacPrev = arrayOf(-1, -1, -1)

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
                    mHandler.removeCallbacks(mRunnable)
                    mSacLevel++
                    switchAccessScan()
                    startSwitchAccessScan()
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
        mHandler.postDelayed(mRunnable, mScanInterval)
    }

    private fun setStyle(view: View,
                         background: Int, strokeWidth: Int, strokeColor: Int) {
        val drawable = GradientDrawable()
        drawable.setColor(getColor(background))
        drawable.setStroke(strokeWidth, getColor(strokeColor))
        view.setBackground(drawable)
    }

    private fun setRowBackgroundColor(row: TableRow, color: Int) {
        setStyle(row, color, 2, R.color.black)
        for (j in 0 until row.childCount) {
            val t = row.getChildAt(j)
            if (t is TextView) {
                setStyle(t, color, 1, R.color.black)
            }
        }
    }

    private fun sacInput() {
        Log.v(TAG, "sac input " + mSacActive[0] + ", " + mSacActive[1])
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        val row = sacTableLayout.getChildAt(mSacActive[0]) as TableRow
        val cell = row.getChildAt(mSacActive[1]) as TextView
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
        mSacLevel = 0
        mSacActive[0] = -1
        mSacActive[1] = -1
    }

    private fun sacLvl1() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        val row = sacTableLayout.getChildAt(mSacActive[0]) as TableRow
        while (true) {
            if (mSacActive[1] >= row.childCount) mSacActive[1] = 0
            else mSacActive[1]++
            val cell = row.getChildAt(mSacActive[1])
            if (cell is TextView) {
                setStyle(cell, R.color.teal_700, 1, R.color.black)
                break
            }
        }
        if (mSacPrev[1] >= 0) {
            val prev = row.getChildAt(mSacPrev[1])
            setStyle(prev, R.color.purple_200, 1, R.color.black)
        }
        mSacPrev[1] = mSacActive[1]
    }

    private fun sacLvl0() {
        val sacTableLayout = findViewById<TableLayout>(R.id.sac_table_layout)
        while (true) {
            if (mSacActive[0] >= sacTableLayout.childCount) mSacActive[0] = 0
            else mSacActive[0]++
            val row = sacTableLayout.getChildAt(mSacActive[0])
            if (row is TableRow) {
                setRowBackgroundColor(row, R.color.purple_200)
                break
            }
        }
        if (mSacPrev[0] >= 0) {
            val prev = sacTableLayout.getChildAt(mSacPrev[0])
            if (prev is TableRow) setRowBackgroundColor(prev, R.color.ivory)
        }
        mSacPrev[0] = mSacActive[0]
    }

    private fun switchAccessScan() {
        when(mSacLevel) {
            0 -> sacLvl0()
            1 -> sacLvl1()
            2 -> sacInput()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mHandler.removeCallbacksAndMessages(null)
    }
}