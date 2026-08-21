package com.aarulya.store

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Privacy invariant: never request runtime or special permissions on first launch.
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        container.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 28f
            gravity = Gravity.CENTER
        })
        container.addView(TextView(this).apply {
            text = getString(R.string.privacy_summary)
            textSize = 16f
            gravity = Gravity.CENTER
        })
        setContentView(container)
    }
}
