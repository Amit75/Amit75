package com.aarulya.store.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.aarulya.store.R

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

        addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_aarulya_mark)
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = "Aarulya Store logo"
        }, LinearLayout.LayoutParams(dp(92), dp(92)))

        addView(label("Aarulya Store", 28f, Color.rgb(11, 15, 26), Typeface.BOLD).apply {
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(20) })

        addView(label(
            "Secure sign-in keeps downloads, devices, updates and evidence receipts bound to the correct account.",
            15f,
            Color.rgb(71, 85, 105),
            Typeface.NORMAL
        ).apply {
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.1f)
            setPadding(0, dp(12), 0, dp(16))
        })

        message?.let { value ->
            addView(label(value, 13f, Color.rgb(153, 27, 27), Typeface.NORMAL).apply {
                gravity = Gravity.CENTER
                setPadding(dp(12), dp(11), dp(12), dp(11))
                background = rounded(Color.rgb(254, 242, 242), 14f, Color.rgb(254, 202, 202))
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }

        addView(label("Sign in securely", 16f, Color.WHITE, Typeface.BOLD).apply {
            gravity = Gravity.CENTER
            background = clickableRounded(Color.rgb(30, 107, 255), 20f)
            contentDescription = "Sign in securely to Aarulya Store"
            isClickable = true
            isFocusable = true
            setOnClickListener { onSignIn() }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(56)
        ).apply { topMargin = dp(18) })

        addView(label(
            "No password, OTP, access token or recovery secret is stored in plaintext.",
            12f,
            Color.rgb(100, 116, 139),
            Typeface.NORMAL
        ).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(18), 0, 0)
        })
    }

    private fun label(value: String, size: Float, color: Int, style: Int): TextView = TextView(context).apply {
        text = value
        textSize = size
        includeFontPadding = false
        setTextColor(color)
        setTypeface(typeface, style)
    }

    private fun clickableRounded(fill: Int, radiusDp: Float): RippleDrawable = RippleDrawable(
        ColorStateList.valueOf(Color.argb(42, 255, 255, 255)),
        rounded(fill, radiusDp),
        rounded(Color.WHITE, radiusDp)
    )

    private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        cornerRadius = dp(radiusDp.toInt()).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
