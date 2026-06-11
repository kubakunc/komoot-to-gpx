package com.velologiclabs.gpxexporter

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * WebView login for Strava ("twin" of LoginActivity). After the user signs in,
 * Strava redirects to /dashboard; we then read the current athlete id from
 * /settings/profile. The session cookie stays in the WebView CookieManager and
 * is replayed by StravaApiPlugin — no portable token is extracted.
 */
class StravaLoginActivity : Activity() {

    companion object {
        const val EXTRA_USER_ID = "userId"
        const val EXTRA_DISPLAY_NAME = "displayName"
        const val EXTRA_TOKEN = "token"
        private const val LOGIN_URL = "https://www.strava.com/login"
        private const val COOKIE_DOMAIN = "https://www.strava.com"
        // Shared with StravaApiPlugin so the cookie is replayed under the same
        // User-Agent it was issued to (Strava can tie a session to the UA).
        const val USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/124.0.0.0 Mobile Safari/537.36 ExportGpxForKomoot/0.1"
        // The rails markup (profile form, athlete id) only renders under a desktop
        // UA; the mobile UA gets a Next.js shell. Same trick as StravaApiPlugin.
        private const val DESKTOP_UA =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    @Volatile private var resolved = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_strava_login)
        webView = findViewById(R.id.stravaWebView)
        progress = findViewById(R.id.stravaProgress)

        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        // Clear only Strava's cookies — must not wipe a connected Komoot session.
        CookieUtil.clearFor(COOKIE_DOMAIN, ".strava.com")

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.userAgentString = USER_AGENT

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                progress.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                checkForLogin(url)
            }
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                checkForLogin(url)
                return false
            }
        }

        webView.loadUrl(LOGIN_URL)
    }

    /**
     * Logged in once Strava sets the `strava_remember_id` cookie (only present
     * after authentication, and it holds the athlete id), or once we navigate
     * away from the auth pages.
     */
    private fun checkForLogin(url: String) {
        if (resolved) return
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: ""
        val rememberId = Regex("strava_remember_id=([^;]+)").find(cookies)?.groupValues?.get(1)
        val onAuthPage = listOf(
            "/login", "/legal", "/onboarding", "/auth",
            "accounts.google", "facebook.com", "appleid.apple.com"
        ).any { url.contains(it) }
        val leftAuthPages = url.startsWith("https://www.strava.com") && !onAuthPage
        if (rememberId.isNullOrBlank() && !leftAuthPages) return
        CookieManager.getInstance().flush()
        resolved = true
        progress.visibility = View.VISIBLE
        Thread { fetchIdentityAndFinish(rememberId) }.start()
    }

    private fun fetchIdentityAndFinish(rememberId: String?) {
        try {
            val athleteId = rememberId?.let { Regex("\\d+").find(it)?.value }
                ?: fetchAthleteId()
                ?: throw RuntimeException("athlete id not found")
            val name = fetchDisplayName(athleteId)
            Log.d("StravaAuth", "athleteId=$athleteId name_present=${name.isNotEmpty()}")
            runOnUiThread {
                val data = Intent()
                    .putExtra(EXTRA_USER_ID, athleteId)
                    .putExtra(EXTRA_DISPLAY_NAME, name)
                    .putExtra(EXTRA_TOKEN, "")
                setResult(Activity.RESULT_OK, data)
                finish()
            }
        } catch (e: Exception) {
            Log.e("StravaAuth", "identity probe failed", e)
            runOnUiThread {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun cookieHeader(): String = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: ""

    private fun httpGetBody(url: String, userAgent: String = USER_AGENT): String {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Cookie", cookieHeader())
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Accept", "text/html,application/json")
        conn.connectTimeout = 12_000
        conn.readTimeout = 15_000
        return try {
            val code = conn.responseCode
            if (code !in 200..299) return ""
            conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun fetchAthleteId(): String? {
        val html = httpGetBody("https://www.strava.com/settings/profile", DESKTOP_UA)
        return Regex("athleteId\\s*=\\s*(\\d+)").find(html)?.groupValues?.get(1)
            ?: Regex("/athletes/(\\d+)").find(html)?.groupValues?.get(1)
    }

    private fun fetchDisplayName(athleteId: String): String {
        // The public profile page <title> ("First Last | Strava") is the reliable
        // name source — but only under a desktop UA; the mobile UA gets a Next.js
        // shell whose title is just "Strava".
        return try {
            val html = httpGetBody("https://www.strava.com/athletes/$athleteId", DESKTOP_UA)
            val title = Regex("<title>([^<]+)</title>", RegexOption.IGNORE_CASE).find(html)?.groupValues?.get(1) ?: ""
            val name = title.replace(Regex("\\s*[|·]\\s*Strava.*$", RegexOption.IGNORE_CASE), "").trim()
            if (name.equals("Strava", ignoreCase = true)) "" else name
        } catch (e: Exception) {
            ""
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else {
            setResult(Activity.RESULT_CANCELED)
            super.onBackPressed()
        }
    }
}
