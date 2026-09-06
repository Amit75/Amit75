package com.aarulya.play;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

public final class MainActivity extends Activity {
    private static final String HOME_URL = "file:///android_asset/index.html";
    private static final int INTERSTITIAL_EVERY_COMPLETIONS = 3;

    private WebView webView;
    private AdView banner;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private ConsentInformation consentInformation;
    private boolean adsInitialized;
    private boolean gameVisible;
    private int completionCount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 9, 20));
        getWindow().setNavigationBarColor(Color.rgb(7, 9, 20));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 9, 20));

        webView = new WebView(this);
        configureWebView(webView);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        banner = new AdView(this);
        banner.setVisibility(View.GONE);
        banner.setAdSize(AdSize.BANNER);
        banner.setAdUnitId(BuildConfig.ADMOB_BANNER_ID);
        FrameLayout.LayoutParams bannerParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        root.addView(banner, bannerParams);

        setContentView(root);
        webView.loadUrl(HOME_URL);
        prepareConsentAndAds();
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);

        view.setBackgroundColor(Color.rgb(7, 9, 20));
        view.setWebChromeClient(new WebChromeClient());
        view.addJavascriptInterface(new NativeBridge(), "AarulyaNative");
        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                super.onPageFinished(v, url);
                injectLifecycleObserver();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equalsIgnoreCase(scheme)) {
                    return false;
                }
                if ("https".equalsIgnoreCase(scheme)
                        && uri.getHost() != null
                        && (uri.getHost().equals("aarulya.com") || uri.getHost().endsWith(".aarulya.com"))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // Fail closed: keep unknown URLs out of the embedded game surface.
                }
                return true;
            }
        });
    }

    private void injectLifecycleObserver() {
        String js = "(() => {" +
                "if (window.__aarulyaNativeObserved) return;" +
                "window.__aarulyaNativeObserved = true;" +
                "let modalOpen = false;" +
                "if (!document.querySelector('#nativePolicyLinks')) {" +
                " const f=document.createElement('footer');" +
                " f.id='nativePolicyLinks';" +
                " f.style.cssText='padding:20px;text-align:center;font:14px sans-serif;opacity:.8';" +
                " f.innerHTML='<a href=\"privacy.html\" style=\"color:#67e8f9;margin-right:16px\">Privacy</a><a href=\"terms.html\" style=\"color:#67e8f9\">Terms</a>';" +
                " document.querySelector('main')?.appendChild(f);" +
                "}" +
                "const scan = () => {" +
                " const open = !!document.querySelector('#gameModal.show');" +
                " if (open !== modalOpen) { modalOpen = open; AarulyaNative.onGameVisibility(open); }" +
                " const result = document.querySelector('#gameRoot .result');" +
                " if (result && !result.dataset.nativeComplete) {" +
                "   result.dataset.nativeComplete = '1';" +
                "   AarulyaNative.onGameComplete();" +
                "   if (!result.querySelector('[data-native-reward]')) {" +
                "     const b = document.createElement('button');" +
                "     b.className = 'btn secondary';" +
                "     b.dataset.nativeReward = '1';" +
                "     b.textContent = 'Watch ad • +50 virtual coins';" +
                "     b.addEventListener('click', () => AarulyaNative.showRewardedAd());" +
                "     result.appendChild(b);" +
                "   }" +
                " }" +
                "};" +
                "new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});" +
                "scan();" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private void prepareConsentAndAds() {
        RequestConfiguration config = new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .build();
        MobileAds.setRequestConfiguration(config);
        MobileAds.putPublisherFirstPartyIdEnabled(false);

        consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(
                this,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        this,
                        formError -> maybeInitializeAds()),
                requestConsentError -> maybeInitializeAds());
        maybeInitializeAds();
    }

    private void maybeInitializeAds() {
        if (adsInitialized) return;
        if (!BuildConfig.LIVE_ADS_ENABLED && !BuildConfig.DEBUG) return;
        if (consentInformation != null && !consentInformation.canRequestAds()) return;
        adsInitialized = true;
        MobileAds.initialize(this, initializationStatus -> {
            loadBanner();
            loadInterstitial();
            loadRewarded();
        });
    }

    private void loadBanner() {
        banner.setAdListener(new AdListener() {
            @Override
            public void onAdLoaded() {
                if (!gameVisible) banner.setVisibility(View.VISIBLE);
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                banner.setVisibility(View.GONE);
            }
        });
        banner.loadAd(new AdRequest.Builder().build());
    }

    private void loadInterstitial() {
        InterstitialAd.load(
                this,
                BuildConfig.ADMOB_INTERSTITIAL_ID,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(InterstitialAd ad) {
                        interstitial = ad;
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        interstitial = null;
                    }
                });
    }

    private void loadRewarded() {
        RewardedAd.load(
                this,
                BuildConfig.ADMOB_REWARDED_ID,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd ad) {
                        rewarded = ad;
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        rewarded = null;
                    }
                });
    }

    private void setGameplayVisible(boolean visible) {
        runOnUiThread(() -> {
            gameVisible = visible;
            if (visible) {
                banner.setVisibility(View.GONE);
            } else if (adsInitialized) {
                banner.setVisibility(View.VISIBLE);
            }
        });
    }

    private void onCompletedGame() {
        runOnUiThread(() -> {
            completionCount++;
            if (completionCount % INTERSTITIAL_EVERY_COMPLETIONS == 0 && interstitial != null) {
                InterstitialAd ad = interstitial;
                interstitial = null;
                ad.show(this);
                loadInterstitial();
            }
        });
    }

    private void showRewarded() {
        runOnUiThread(() -> {
            if (rewarded == null) {
                loadRewarded();
                return;
            }
            RewardedAd ad = rewarded;
            rewarded = null;
            ad.show(this, rewardItem -> grantVirtualCoins(50));
            loadRewarded();
        });
    }

    private void grantVirtualCoins(int amount) {
        String js = "(() => {" +
                "const s=JSON.parse(localStorage.getItem('aarulyaPlayV3')||'{}');" +
                "s.coins=(Number(s.coins)||2500)+" + amount + ";" +
                "localStorage.setItem('aarulyaPlayV3',JSON.stringify(s));" +
                "location.reload();" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("document.querySelector('#gameModal.show') ? 'open' : 'closed'", value -> {
            if ("\"open\"".equals(value)) {
                webView.evaluateJavascript("document.querySelector('#closeGame')?.click()", null);
            } else if (webView.canGoBack()) {
                webView.goBack();
            } else {
                MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (banner != null) banner.destroy();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private final class NativeBridge {
        @JavascriptInterface
        public void onGameVisibility(boolean visible) {
            setGameplayVisible(visible);
        }

        @JavascriptInterface
        public void onGameComplete() {
            onCompletedGame();
        }

        @JavascriptInterface
        public void showRewardedAd() {
            showRewarded();
        }
    }
}
