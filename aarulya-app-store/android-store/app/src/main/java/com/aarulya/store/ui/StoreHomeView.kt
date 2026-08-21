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
    private val topTabs = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
    }
    private val bottomNavigation = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
    }
    private var selectedTopTab = "For You"
    private var selectedBottomDestination = "Apps"
    private var selectedCategory: String? = null
    private var query = ""

    fun build(): View {
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(248, 250, 252))
        }
        root.addView(buildHeader())
        root.addView(buildTopTabs())
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
        root.addView(bottomNavigation, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(68)
        ))
        render()
        return root
    }

    private fun buildHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(20), dp(20), dp(20), dp(12))
        setBackgroundColor(Color.WHITE)

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(context).apply {
                text = "A"
                textSize = 20f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setTypeface(typeface, Typeface.BOLD)
                background = rounded(Color.rgb(15, 30, 46), 16f, Color.rgb(245, 192, 106))
            }, LinearLayout.LayoutParams(dp(48), dp(48)))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), 0, 0, 0)
                addView(TextView(context).apply {
                    text = "Aarulya Store"
                    textSize = 25f
                    setTextColor(Color.rgb(11, 15, 26))
                    setTypeface(typeface, Typeface.BOLD)
                })
                addView(TextView(context).apply {
                    text = "Original apps • proof before download"
                    textSize = 13f
                    setTextColor(Color.rgb(75, 85, 99))
                })
            })
        })

        addView(EditText(context).apply {
            hint = "Search apps or describe what you need"
            isSingleLine = true
            setPadding(dp(18), dp(12), dp(18), dp(12))
            background = rounded(Color.rgb(243, 244, 246), 18f)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    query = s?.toString().orEmpty()
                    if (query.isNotBlank()) selectedBottomDestination = "Search"
                    render()
                }
                override fun afterTextChanged(s: Editable?) = Unit
            })
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(16) })
    }

    private fun buildTopTabs(): View = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        setBackgroundColor(Color.WHITE)
        addView(topTabs, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
    }

    private fun render() {
        renderNavigation()
        content.removeAllViews()
        content.setPadding(dp(16), dp(16), dp(16), dp(32))

        if (query.isNotBlank()) {
            renderSearchResults()
            return
        }

        when (selectedTopTab) {
            "Top Charts" -> renderTopCharts()
            "Kids" -> renderAppList("Kids & family", StoreCatalog.kids())
            "Categories" -> renderCategories()
            else -> renderPrimaryDestination()
        }
    }

    private fun renderNavigation() {
        topTabs.removeAllViews()
        topTabs.setPadding(dp(14), dp(4), dp(14), dp(10))
        StoreCatalog.topTabs.forEach { tab ->
            val selected = tab == selectedTopTab
            topTabs.addView(Button(context).apply {
                text = tab
                isAllCaps = false
                setTextColor(if (selected) Color.WHITE else Color.rgb(31, 41, 55))
                background = rounded(
                    if (selected) Color.rgb(30, 107, 255) else Color.rgb(239, 246, 255),
                    22f
                )
                setOnClickListener {
                    selectedTopTab = tab
                    selectedCategory = null
                    render()
                }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(44)
            ).apply { marginEnd = dp(8) })
        }

        bottomNavigation.removeAllViews()
        bottomNavigation.setPadding(dp(6), dp(4), dp(6), dp(6))
        bottomNavigation.setBackgroundColor(Color.WHITE)
        StoreCatalog.bottomDestinations.forEach { destination ->
            val selected = destination == selectedBottomDestination
            bottomNavigation.addView(TextView(context).apply {
                text = destination
                textSize = 12f
                gravity = Gravity.CENTER
                setTypeface(typeface, if (selected) Typeface.BOLD else Typeface.NORMAL)
                setTextColor(if (selected) Color.rgb(30, 107, 255) else Color.rgb(100, 116, 139))
                background = if (selected) rounded(Color.rgb(239, 246, 255), 18f) else null
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    selectedBottomDestination = destination
                    selectedTopTab = "For You"
                    selectedCategory = null
                    render()
                }
            }, LinearLayout.LayoutParams(0, dp(56), 1f).apply {
                marginStart = dp(2)
                marginEnd = dp(2)
            })
        }
    }

    private fun renderPrimaryDestination() {
        when (selectedBottomDestination) {
            "You" -> renderAccountState()
            "Search" -> renderSearchPrompt()
            "Games" -> renderAppList("Original Aarulya games", StoreCatalog.forBottomDestination("Games"))
            "Books" -> renderAppList("Books with rights evidence", StoreCatalog.forBottomDestination("Books"))
            else -> {
                content.addView(sectionTitle("Featured for you"))
                StoreCatalog.featured().forEach { content.addView(appCard(it)) }
                content.addView(sectionTitle("All Aarulya apps"))
                StoreCatalog.forBottomDestination("Apps").forEach { content.addView(appCard(it)) }
            }
        }
    }

    private fun renderSearchResults() {
        val results = StoreCatalog.search(query)
        renderAppList("Search results", results)
    }

    private fun renderTopCharts() {
        content.addView(sectionTitle("Top Charts"))
        val chartApps = StoreCatalog.verifiedTopCharts()
        if (chartApps.isEmpty()) {
            content.addView(infoCard(
                "No verified chart data yet",
                "Rankings will appear only after real verified installs, retention, crash-free quality, verified ratings and abuse filtering are operational. Sponsored placement can never enter organic charts."
            ))
            return
        }
        chartApps.forEachIndexed { index, app ->
            content.addView(TextView(context).apply {
                text = "#${index + 1}"
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.rgb(30, 64, 175))
            })
            content.addView(appCard(app))
        }
    }

    private fun renderCategories() {
        content.addView(sectionTitle("Categories"))
        content.addView(HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                StoreCatalog.categories.forEach { category ->
                    val selected = category == selectedCategory
                    addView(Button(context).apply {
                        text = category
                        isAllCaps = false
                        setTextColor(if (selected) Color.WHITE else Color.rgb(31, 41, 55))
                        background = rounded(
                            if (selected) Color.rgb(15, 30, 46) else Color.rgb(241, 245, 249),
                            20f
                        )
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
        })

        val category = selectedCategory
        if (category == null) {
            content.addView(infoCard(
                "Choose a category",
                "Every app remains unavailable until its own ownership, privacy, security, signing and release evidence passes."
            ))
        } else {
            renderAppList(category, StoreCatalog.search("", category))
        }
    }

    private fun renderAccountState() {
        content.addView(sectionTitle("You"))
        content.addView(infoCard(
            "Account required for the first release",
            "Guest browsing is disabled. Sign-in, devices, downloads, update history and privacy controls will become active only after production identity verification is connected. No demo account or fake login is provided."
        ))
    }

    private fun renderSearchPrompt() {
        content.addView(sectionTitle("Search"))
        content.addView(infoCard(
            "Find by name or need",
            "Use the search field above. Search may match an Aarulya app name, category, package or the task described in its summary."
        ))
    }

    private fun renderAppList(title: String, apps: List<StoreApp>) {
        content.addView(sectionTitle(title))
        if (apps.isEmpty()) {
            content.addView(infoCard(
                "Nothing verified here yet",
                "New original Aarulya apps will appear only after the required release evidence passes."
            ))
        } else {
            apps.forEach { content.addView(appCard(it)) }
        }
    }

    private fun sectionTitle(value: String): TextView = TextView(context).apply {
        text = value
        textSize = 20f
        setTextColor(Color.rgb(17, 24, 39))
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(4), dp(10), 0, dp(10))
    }

    private fun infoCard(title: String, body: String): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(18), dp(18), dp(18))
        background = rounded(Color.WHITE, 20f, Color.rgb(226, 232, 240))
        addView(TextView(context).apply {
            text = title
            textSize = 17f
            setTextColor(Color.rgb(17, 24, 39))
            setTypeface(typeface, Typeface.BOLD)
        })
        addView(TextView(context).apply {
            text = body
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, dp(8), 0, 0)
        })
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
                background = rounded(Color.rgb(15, 30, 46), 16f, Color.rgb(245, 192, 106))
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
                setTextColor(Color.rgb(146, 64, 14))
                setPadding(dp(10), dp(6), dp(10), dp(6))
                background = rounded(Color.rgb(255, 247, 237), 14f)
            })
        })
        addView(TextView(context).apply {
            text = app.summary
            textSize = 14f
            setTextColor(Color.rgb(71, 85, 105))
            setPadding(0, dp(12), 0, dp(10))
        })
        addView(TextView(context).apply {
            text = "Evidence: ${app.trustLabel}   •   Size: ${app.sizeLabel}"
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
