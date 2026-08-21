package com.aarulya.store.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.aarulya.store.catalog.StoreApp
import com.aarulya.store.catalog.StoreCatalog

class StoreHomeView(
    private val context: Context,
    private val onAppSelected: (StoreApp) -> Unit
) {
    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }
    private var selectedCategory = "For You"
    private var query = ""

    fun build(): View {
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(248, 250, 252))
        }
        root.addView(buildHeader())
        root.addView(buildCategoryStrip())
        root.addView(ScrollView(context).apply {
            isFillViewport = true
            addView(content, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        ))
        render()
        return root
    }

    private fun buildHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(20), dp(22), dp(20), dp(12))
        setBackgroundColor(Color.WHITE)

        addView(TextView(context).apply {
            text = "Aarulya Store"
            textSize = 27f
            setTextColor(Color.rgb(17, 24, 39))
            setTypeface(typeface, Typeface.BOLD)
        })
        addView(TextView(context).apply {
            text = "Original Aarulya apps • verified before install"
            textSize = 14f
            setTextColor(Color.rgb(75, 85, 99))
            setPadding(0, dp(3), 0, dp(14))
        })
        addView(EditText(context).apply {
            hint = "Search apps or tell what you need"
            isSingleLine = true
            setPadding(dp(18), dp(12), dp(18), dp(12))
            background = rounded(Color.rgb(243, 244, 246), 18f)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    query = s?.toString().orEmpty()
                    render()
                }
                override fun afterTextChanged(s: Editable?) = Unit
            })
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
    }

    private fun buildCategoryStrip(): View = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        setBackgroundColor(Color.WHITE)
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(14), dp(4), dp(14), dp(12))
            StoreCatalog.categories.forEach { category ->
                addView(Button(context).apply {
                    text = category
                    isAllCaps = false
                    setTextColor(Color.rgb(31, 41, 55))
                    background = rounded(Color.rgb(239, 246, 255), 22f)
                    setOnClickListener {
                        selectedCategory = category
                        render()
                    }
                }, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    dp(44)
                ).apply { marginEnd = dp(8) })
            }
        })
    }

    private fun render() {
        content.removeAllViews()
        content.setPadding(dp(16), dp(16), dp(16), dp(32))

        if (selectedCategory == "For You" && query.isBlank()) {
            content.addView(sectionTitle("Featured for you"))
            StoreCatalog.featured().forEach { content.addView(appCard(it)) }
            content.addView(sectionTitle("All Aarulya apps"))
        } else {
            content.addView(sectionTitle(if (query.isBlank()) selectedCategory else "Search results"))
        }

        val results = StoreCatalog.search(query, selectedCategory)
        if (results.isEmpty()) {
            content.addView(TextView(context).apply {
                text = "No Aarulya app found. New original apps will appear here after security approval."
                textSize = 15f
                setTextColor(Color.rgb(75, 85, 99))
                setPadding(dp(10), dp(24), dp(10), dp(24))
            })
        } else {
            results.forEach { content.addView(appCard(it)) }
        }
    }

    private fun sectionTitle(value: String): TextView = TextView(context).apply {
        text = value
        textSize = 20f
        setTextColor(Color.rgb(17, 24, 39))
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(4), dp(10), 0, dp(10))
    }

    private fun appCard(app: StoreApp): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(16), dp(18), dp(16))
        background = rounded(Color.WHITE, 20f, Color.rgb(226, 232, 240))
        isClickable = true
        isFocusable = true
        setOnClickListener { onAppSelected(app) }

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(context).apply {
                text = app.name.take(1)
                textSize = 22f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
                background = rounded(Color.rgb(37, 99, 235), 16f)
            }, LinearLayout.LayoutParams(dp(54), dp(54)))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), 0, 0, 0)
                addView(TextView(context).apply {
                    text = app.name
                    textSize = 18f
                    setTextColor(Color.rgb(17, 24, 39))
                    setTypeface(typeface, Typeface.BOLD)
                })
                addView(TextView(context).apply {
                    text = "${app.category} • ${app.ageLabel}"
                    textSize = 13f
                    setTextColor(Color.rgb(100, 116, 139))
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(context).apply {
                text = app.statusLabel
                textSize = 12f
                setTextColor(Color.rgb(21, 128, 61))
                setPadding(dp(10), dp(6), dp(10), dp(6))
                background = rounded(Color.rgb(240, 253, 244), 14f)
            })
        })
        addView(TextView(context).apply {
            text = app.summary
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, dp(12), 0, dp(10))
        })
        addView(TextView(context).apply {
            text = "✓ ${app.trustLabel}   •   ${app.sizeLabel}"
            textSize = 12f
            setTextColor(Color.rgb(30, 64, 175))
        })
    }.also {
        it.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(12) }
    }

    private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        cornerRadius = dp(radiusDp.toInt()).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
