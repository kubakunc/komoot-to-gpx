package com.velologiclabs.gpxexporter;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern TOUR_PATTERN =
        Pattern.compile("komoot\\.(?:com|de)/(?:[^/?#\\s]+/)?tour/(\\d+)", Pattern.CASE_INSENSITIVE);

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KomootAuthPlugin.class);
        registerPlugin(KomootApiPlugin.class);
        registerPlugin(StravaAuthPlugin.class);
        registerPlugin(StravaApiPlugin.class);
        registerPlugin(GpxSaverPlugin.class);
        super.onCreate(savedInstanceState);
        WindowInsetsControllerCompat insets =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insets.setAppearanceLightStatusBars(true);
        insets.setAppearanceLightNavigationBars(true);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;
        Matcher m = TOUR_PATTERN.matcher(text);
        if (!m.find()) {
            Log.d("ShareIntent", "received SEND text without matching tour URL");
            return;
        }
        final String tourId = m.group(1);
        if (bridge == null || bridge.getWebView() == null) {
            Log.w("ShareIntent", "bridge/webview not ready for tour " + tourId);
            return;
        }
        bridge.getWebView().post(() ->
            bridge.getWebView().evaluateJavascript(
                "window.location.hash='share-tour=" + tourId + "'", null
            )
        );
    }
}
