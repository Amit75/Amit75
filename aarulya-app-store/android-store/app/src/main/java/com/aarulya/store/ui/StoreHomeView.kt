package com.aarulya.store.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.aarulya.store.R
import com.aarulya.store.catalog.StoreApp
import com.aarulya.store.catalog.StoreCatalog

class StoreHomeView(
    private val context: Context,
    private val onAppSelected: (StoreApp) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingSearch: Runnable? = null
    private val content = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    private val topTabs = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
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
            setBackgroundColor(SURFACE)
            addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
                override fun onViewAttachedToWindow(view: View) = Unit
                override fun onViewDetachedFromWindow(view: View) {
                    pendingSearch?.let(mainHandler::removeCallbacks)
                    pendingSearch = null
                }
            })
        }
        root.addView(buildHeader())
        root.addView(buildTopTabs())
        root.addView(ScrollView(context).apply {
            isFillViewport = true
            isSmoothScrollingEnabled = true
            clipToPadding = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
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
            dp(70)
        ))
        render(animate = false)
        return root
    }

    private fun buildHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(20), dp(18), dp(20), dp(12))
        setBackgroundColor(Color.WHITE)
        elevation = dp(2).toFloat()

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(ImageView(context).apply {
                setImageResource(R.drawable.ic_aarulya_mark)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Aarulya Store logo"
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            }, LinearLayout.LayoutParams(dp(52), dp(52)))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), 0, 0, 0)
                addView(label("Aarulya Store", 25f, INK, Typeface.BOLD))
                addView(label("Original apps • proof before download", 13f, MUTED, Typeface.NORMAL).apply {
                    setPadding(0, dp(3), 0, 0)
                })
            })
        })

        addView(EditText(context).apply {
            hint = "Search apps or describe what you need"
            contentDescription = "Search Aarulya apps"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            textSize = 15f
            includeFontPadding = false
            setTextColor(INK)
            setHintTextColor(Color.rgb(100, 116, 139))
            setPadding(dp(18), dp(13), dp(18), dp(13))
            background = clickableRounded(Color.rgb(243, 246, 250), 18f, Color.rgb(226, 232, 240))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    val next = s?.toString().orEmpty()
                    pendingSearch?.let(mainHandler::removeCallbacks)
                    pendingSearch = Runnable {
                        query = next
                        if (query.isNotBlank()) selectedBottomDestination = "Search"
                        render()
                    }.also { mainHandler.postDelayed(it, SEARCH_DEBOUNCE_MS) }
                }
                override fun afterTextChanged(s: Editable?) = Unit
            })
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                    pendingSearch?.let(mainHandler::removeCallbacks)
                    query = text?.toString().orEmpty()
                    if (query.isNotBlank()) selectedBottomDestination = "Search"
                    render()
                    true
                } else {
                    false
                }
            }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(52)
        ).apply { topMargin = dp(15) })
    }

    private fun buildTopTabs(): View = HorizontalScrollView(context).apply {
        isHorizontalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        setBackgroundColor(Color.WHITE)
        addView(topTabs, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
    }

    private fun render(animate: Boolean = true) {
        renderNavigation()
        content.animate().cancel()
        content.removeAllViews()
        content.setPadding(dp(16), dp(16), dp(16), dp(34))

        if (query.isNotBlank()) {
            renderSearchResults()
        } else {
            when (selectedTopTab) {
                "Top Charts" -> renderTopCharts()
                "Kids" -> renderAppList("Kids & family", StoreCatalog.kids())
                "Categories" -> renderCategories()
                else -> renderPrimaryDestination()
            }
        }

        if (animate) {
            content.alpha = 0.76f
            content.translationY = dp(4).toFloat()
            content.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(140L)
                .start()
        } else {
            content.alpha = 1f
            content.translationY = 0f
        }
    }

    private fun renderNavigation() {
        topTabs.removeAllViews()
        topTabs.setPadding(dp(14), dp(4), dp(14), dp(10))
        StoreCatalog.topTabs.forEach { tab ->
            val selected = tab == selectedTopTab
            topTabs.addView(chip(tab, selected) {
                selectedTopTab = tab
                selectedCategory = null
                render()
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(44)
            ).apply { marginEnd = dp(8) })
        }

        bottomNavigation.removeAllViews()
        bottomNavigation.setPadding(dp(6), dp(5), dp(6), dp(7))
        bottomNavigation.setBackgroundColor(Color.WHITE)
        bottomNavigation.elevation = dp(10).toFloat()
        StoreCatalog.bottomDestinations.forEach { destination ->
            val selected = destination == selectedBottomDestination
            bottomNavigation.addView(TextView(context).apply {
                text = destination
                textSize = 12f
                includeFontPadding = false
                gravity = Gravity.CENTER
                setTypeface(typeface, if (selected) Typeface.BOLD else Typeface.NORMAL)
                setTextColor(if (selected) BLUE else Color.rgb(100, 116, 139))
                background = clickableRounded(
                    if (selected) Color.rgb(239, 246, 255) else Color.TRANSPARENT,
                    18f
                )
                contentDescription = "$destination tab${if (selected) ", selected" else ""}"
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    selectedBottomDestination = destination
                    selectedTopTab = "For You"
                    selectedCategory = null
                    if (destination != "Search") query = ""
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
                val featured = StoreCatalog.featured()
                content.addView(sectionTitle("Featured for you"))
                featured.forEach { content.addView(appCard(it)) }
                content.addView(sectionTitle("All Aarulya apps"))
                val featuredIds = featured.mapTo(mutableSetOf()) { it.id }
                StoreCatalog.forBottomDestination("Apps")
                    .filterNot { it.id in featuredIds }
                    .forEach { content.addView(appCard(it)) }
            }
        }
    }

    private fun renderSearchResults() {
        renderAppList("Search results", StoreCatalog.search(query))
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
            content.addView(label("#${index + 1}", 16f, Color.rgb(30, 64, 175), Typeface.BOLD).apply {
                setPadding(dp(4), dp(6), 0, dp(6))
            })
            content.addView(appCard(app))
        }
    }

    private fun renderCategories() {
        content.addView(sectionTitle("Categories"))
        content.addView(HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                StoreCatalog.categories.forEach { category ->
                    addView(chip(category, category == selectedCategory, darkSelection = true) {
                        selectedCategory = category
                        render()
                    }, LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        dp(44)
                    ).apply { marginEnd = dp(8) })
                }
            })
        })

        selectedCategory?.let { renderAppList(it, StoreCatalog.search("", it)) }
            ?: content.addView(infoCard(
                "Choose a category",
                "Every app remains unavailable until its ownership, privacy, security, signing and release evidence passes."
            ))
    }

    private fun renderAccountState() {
        content.addView(sectionTitle("You"))
        content.addView(infoCard(
            "Verified account",
            "Downloads, devices, update history and privacy controls stay bound to the signed-in account. Guest browsing remains disabled for the first release."
        ))
    }

    private fun renderSearchPrompt() {
        content.addView(sectionTitle("Search"))
        content.addView(infoCard(
            "Find by name or need",
            "Use the search field above. Search can match an Aarulya app, category, package or the task described in its summary."
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

    private fun sectionTitle(value: String): TextView = label(value, 20f, INK, Typeface.BOLD).apply {
        setPadding(dp(4), dp(10), 0, dp(11))
    }

    private fun infoCard(title: String, body: String): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(18), dp(18), dp(18))
        background = rounded(Color.WHITE, 20f, Color.rgb(226, 232, 240))
        elevation = dp(1).toFloat()
        addView(label(title, 17f, INK, Typeface.BOLD))
        addView(label(body, 14f, Color.rgb(71, 85, 105), Typeface.NORMAL).apply {
            setPadding(0, dp(8), 0, 0)
            setLineSpacing(0f, 1.08f)
        })
    }

    private fun appCard(app: StoreApp): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(17), dp(16), dp(17), dp(16))
        background = clickableRounded(Color.WHITE, 20f, Color.rgb(226, 232, 240))
        elevation = dp(2).toFloat()
        isClickable = true
        isFocusable = true
        contentDescription = "Open ${app.name}. ${app.statusLabel}. ${app.trustLabel}."
        setOnClickListener { onAppSelected(app) }

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(appIcon(app), LinearLayout.LayoutParams(dp(56), dp(56)))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), 0, dp(8), 0)
                addView(label(app.name, 18f, INK, Typeface.BOLD))
                addView(label("${app.category} • ${app.ageLabel}", 13f, Color.rgb(100, 116, 139), Typeface.NORMAL).apply {
                    setPadding(0, dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(label(app.statusLabel, 12f, Color.rgb(146, 64, 14), Typeface.BOLD).apply {
                setPadding(dp(10), dp(7), dp(10), dp(7))
                background = rounded(Color.rgb(255, 247, 237), 14f)
            })
        })
        addView(label(app.summary, 14f, Color.rgb(71, 85, 105), Typeface.NORMAL).apply {
            setPadding(0, dp(12), 0, dp(10))
            setLineSpacing(0f, 1.08f)
        })
        addView(label("Evidence: ${app.trustLabel}   •   Size: ${app.sizeLabel}", 12f, Color.rgb(30, 64, 175), Typeface.NORMAL))
    }.also {
        it.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(12) }
    }

    private fun appIcon(app: StoreApp): View {
        if (app.packageId == "com.aarulya.store") {
            return ImageView(context).apply {
                setImageResource(R.drawable.ic_aarulya_mark)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "${app.name} icon"
            }
        }
        return FrameLayout(context).apply {
            background = rounded(NAVY, 17f, GOLD)
            addView(label(app.name.take(1), 22f, Color.WHITE, Typeface.BOLD).apply {
                gravity = Gravity.CENTER
                contentDescription = "${app.name} icon"
            }, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
        }
    }

    private fun chip(
        value: String,
        selected: Boolean,
        darkSelection: Boolean = false,
        onClick: () -> Unit
    ): TextView = label(
        value,
        14f,
        if (selected) Color.WHITE else Color.rgb(31, 41, 55),
        if (selected) Typeface.BOLD else Typeface.NORMAL
    ).apply {
        gravity = Gravity.CENTER
        minWidth = dp(72)
        setPadding(dp(16), 0, dp(16), 0)
        background = clickableRounded(
            when {
                selected && darkSelection -> NAVY
                selected -> BLUE
                else -> Color.rgb(239, 246, 255)
            },
            22f
        )
        contentDescription = "$value${if (selected) ", selected" else ""}"
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
    }

    private fun label(value: String, size: Float, color: Int, style: Int): TextView = TextView(context).apply {
        text = value
        textSize = size
        includeFontPadding = false
        setTextColor(color)
        setTypeface(typeface, style)
    }

    private fun clickableRounded(fill: Int, radiusDp: Float, stroke: Int? = null): RippleDrawable {
        val contentDrawable = rounded(fill, radiusDp, stroke)
        val mask = rounded(Color.WHITE, radiusDp)
        return RippleDrawable(
            ColorStateList.valueOf(Color.argb(34, 30, 107, 255)),
            contentDrawable,
            mask
        )
    }

    private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(fill)
        cornerRadius = dp(radiusDp.toInt()).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    companion object {
        private const val SEARCH_DEBOUNCE_MS = 180L
        private val SURFACE = Color.rgb(248, 250, 252)
        private val INK = Color.rgb(11, 15, 26)
        private val MUTED = Color.rgb(75, 85, 99)
        private val NAVY = Color.rgb(15, 30, 46)
        private val BLUE = Color.rgb(30, 107, 255)
        private val GOLD = Color.rgb(245, 192, 106)
    }
}
