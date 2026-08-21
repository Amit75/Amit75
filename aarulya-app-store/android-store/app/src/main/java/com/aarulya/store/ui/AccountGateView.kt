package com.aarulya.store.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AccountGateView(
    private val context: Context,
    private val message: String? = null,
    private val onSignIn: () -> Unit
) {
    fun build(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(28), dp(32), dp(28), dp(32))
        setBackgroundColor(Color.rgb(248, 250, 252))

        addView(TextView(context).apply {
            text = "A"
            textSize = 34f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            background = rounded(Color.rgb(15, 30, 46), 28f, Color.rgb(245, 192, 106))
        }, LinearLayout.LayoutParams(dp(88), dp(88)))

        addView(TextView(context).apply {
            text = "Aarulya Store"
            textSize = 28f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.rgb(11, 15, 26))
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(20) })

        addView(TextView(context).apply {
            text = "Account verification is required. Guest browsing is disabled so downloads, devices, updates and evidence receipts stay bound to the correct user."
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, dp(12), 0, dp(16))
        })

        message?.let { value ->
            addView(TextView(context).apply {
                text = value
                textSize = 13f
                gravity = Gravity.CENTER
                setTextColor(Color.rgb(153, 27, 27))
                setPadding(dp(12), dp(10), dp(12), dp(10))
                background = rounded(Color.rgb(254, 242, 242), 14f)
            })
        }

        addView(Button(context).apply {
            text = "Sign in securely"
            isAllCaps = false
            textSize = 16f
            setTextColor(Color.WHITE)
            background = rounded(Color.rgb(30, 107, 255), 20f)
            setOnClickListener { onSignIn() }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(54)
        ).apply { topMargin = dp(18) })

        addView(TextView(context).apply {
            text = "No password, OTP, access token or recovery secret is stored in plaintext. Authentication opens only the trusted Aarulya identity origin."
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(100, 116, 139))
            setPadding(0, dp(18), 0, 0)
        })
    }

    private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        cornerRadius = dp(radiusDp.toInt()).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
