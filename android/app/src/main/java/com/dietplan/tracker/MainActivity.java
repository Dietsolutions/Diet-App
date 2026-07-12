package com.dietplan.tracker;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ forces "edge-to-edge": the status bar draws OVER the WebView, and on
        // Android 16 windowOptOutEdgeToEdgeEnforcement is ignored — so the app header ends
        // up under the clock/camera. WebView *padding* doesn't fix it (fixed-position
        // screens ignore it) and CSS env(safe-area-inset-top) is 0 on Android WebView.
        // The robust fix: apply the top system-bar inset as a top MARGIN on the WebView,
        // which moves the whole web surface (including fixed overlays) down below the
        // status bar. Pure native layout — immune to page reloads, service-worker caching,
        // and CSS quirks. The strip above the WebView shows the (dark) window background.
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0F1117"));

        final View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            ViewGroup.LayoutParams lp = v.getLayoutParams();
            if (lp instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) lp;
                if (mlp.topMargin != bars.top) {
                    mlp.topMargin = bars.top;   // push the WebView below the status bar
                    v.setLayoutParams(mlp);
                }
            }
            return insets;
        });
        // Insets were dispatched before this listener existed — nudge another pass.
        webView.post(() -> ViewCompat.requestApplyInsets(webView));
    }
}
