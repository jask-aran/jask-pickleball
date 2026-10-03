package com.jask.pickleball;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setDecorFitsSystemWindows(false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#121214"));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setSupportZoom(false);
        web.getSettings().setBuiltInZoomControls(false);
        web.getSettings().setDisplayZoomControls(false);
        web.getSettings().setUseWideViewPort(false);
        web.getSettings().setLoadWithOverviewMode(false);
        web.setOnTouchListener((v, event) -> event.getPointerCount() > 1);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pushInsets();
            }
        });
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            pushInsets();
            return insets;
        });
        setContentView(web);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackInvoked);
        }
        web.loadUrl("file:///android_asset/index.html");
    }

    private void pushInsets() {
        WindowInsets insets = web.getRootWindowInsets();
        if (insets == null) return;
        android.graphics.Insets bars = insets.getInsets(
                WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
        float d = getResources().getDisplayMetrics().density;
        web.evaluateJavascript(
                "document.documentElement.style.setProperty('--safe-top','" + Math.round(bars.top / d) + "px');"
                        + "document.documentElement.style.setProperty('--safe-bottom','" + Math.round(bars.bottom / d) + "px');"
                        + "document.documentElement.style.setProperty('--safe-left','" + Math.round(bars.left / d) + "px');"
                        + "document.documentElement.style.setProperty('--safe-right','" + Math.round(bars.right / d) + "px');",
                null);
    }

    @Override
    public void onBackPressed() {
        onBackInvoked();
    }

    private void onBackInvoked() {
        web.evaluateJavascript("window.onBack ? window.onBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void close() {
            runOnUiThread(MainActivity.this::finish);
        }
    }
}
