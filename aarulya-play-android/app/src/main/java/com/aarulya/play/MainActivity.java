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
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

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
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";
    private static final String HOME_URL = "https://" + APP_ASSET_HOST + "/assets/index.html";
    private static final int INTERSTITIAL_EVERY_COMPLETIONS = 3;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
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

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

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
        settings.setAllowFileAccess(false);
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
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                super.onPageFinished(v, url);
                injectLifecycleObserver();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();

                if ("https".equalsIgnoreCase(scheme) && APP_ASSET_HOST.equalsIgnoreCase(host)) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // Unknown or unsupported links stay outside the embedded game surface.
                }
                return true;
            }
        });
    }

    private void injectLifecycleObserver() {
        String js = "(() => {" +
                "if (window.__aarulyaNativeObserved) return;" +
                "window.__aarulyaNativeObserved = true;" +
                "let arenaOpen = false;" +
                "const completed = new Set(['WIN','LOSS','DRAW']);" +
                "const scan = () => {" +
                " const arena = document.querySelector('#arena');" +
                " const open = !!arena?.open;" +
                " if (open !== arenaOpen) { arenaOpen = open; AarulyaNative.onGameVisibility(open); }" +
                " const timer = (document.querySelector('#timer')?.textContent || '').trim().toUpperCase();" +
                " const result = document.querySelector('#gameStage .battle-card');" +
                " if (open && completed.has(timer) && result && !result.dataset.nativeComplete) {" +
                "   result.dataset.nativeComplete = '1';" +
                "   AarulyaNative.onGameComplete();" +
                "   const footer = document.querySelector('#arenaFooter');" +
                "   if (footer && !footer.querySelector('[data-native-reward]')) {" +
                "     const b = document.createElement('button');" +
                "     b.type = 'button';" +
                "     b.className = 'action-button';" +
                "     b.dataset.nativeReward = '1';" +
                "     b.textContent = 'Optional ad • +50 virtual coins';" +
                "     b.addEventListener('click', () => AarulyaNative.showRewardedAd());" +
                "     footer.appendChild(b);" +
                "   }" +
                " }" +
                "};" +
                "new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});" +
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
                "const key='aarulya-play-profile-v1';" +
                "const p=JSON.parse(localStorage.getItem(key)||'{}');" +
                "p.virtualCoins=(Number(p.virtualCoins)||2500)+" + amount + ";" +
                "localStorage.setItem(key,JSON.stringify(p));" +
                "location.reload();" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("document.querySelector('#arena')?.open ? 'open' : 'closed'", value -> {
            if ("\"open\"".equals(value)) {
                webView.evaluateJavascript("document.querySelector('#arena')?.close()", null);
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
