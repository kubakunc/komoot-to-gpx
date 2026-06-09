package com.velologiclabs.gpxexporter;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.net.URL;
import java.net.URLDecoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;

public class MainActivity extends BridgeActivity {
    private static final Pattern KOMOOT_TOUR =
        Pattern.compile("komoot\\.(?:com|de)/(?:[^/?#\\s]+/)?tour/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRAVA_DIRECT =
        Pattern.compile("strava\\.com/(activities|routes)/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRAVA_BRANCH =
        Pattern.compile("https?://strava\\.app\\.link/[A-Za-z0-9]+", Pattern.CASE_INSENSITIVE);

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
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;

        Matcher k = KOMOOT_TOUR.matcher(text);
        if (k.find()) { injectShare("komoot:" + k.group(1)); return; }

        Matcher sd = STRAVA_DIRECT.matcher(text);
        if (sd.find()) { injectShare("strava:" + stravaItem(sd.group(1), sd.group(2))); return; }

        Matcher sb = STRAVA_BRANCH.matcher(text);
        if (sb.find()) {
            final String link = sb.group();
            new Thread(() -> {
                String item = resolveStravaBranch(link);
                if (item != null) injectShare("strava:" + item);
                else Log.d("ShareIntent", "could not resolve strava branch link");
            }).start();
            return;
        }
        Log.d("ShareIntent", "received SEND text without a recognised URL");
    }

    private static String stravaItem(String kind, String id) {
        return ("activities".equalsIgnoreCase(kind) ? "activity-" : "route-") + id;
    }

    private void injectShare(String token) {
        if (bridge == null || bridge.getWebView() == null) {
            Log.w("ShareIntent", "bridge/webview not ready for " + token);
            return;
        }
        bridge.getWebView().post(() ->
            bridge.getWebView().evaluateJavascript(
                "window.location.hash='share=" + token + "'", null
            )
        );
    }

    /** Resolve a strava.app.link branch link to "activity-<id>" / "route-<id>" via its Location header. */
    private String resolveStravaBranch(String link) {
        HttpsURLConnection conn = null;
        try {
            conn = (HttpsURLConnection) new URL(link).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0.0.0 Mobile Safari/537.36");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(12000);
            conn.getResponseCode();
            String loc = conn.getHeaderField("Location");
            if (loc == null) return null;
            String decoded = URLDecoder.decode(loc, "UTF-8");
            Matcher m = STRAVA_DIRECT.matcher(decoded);
            return m.find() ? stravaItem(m.group(1), m.group(2)) : null;
        } catch (Exception e) {
            Log.w("ShareIntent", "branch resolve failed: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
