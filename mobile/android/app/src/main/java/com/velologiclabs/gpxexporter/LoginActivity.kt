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
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class LoginActivity : Activity() {

    companion object {
        const val EXTRA_USER_ID = "userId"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_EMAIL = "email"
        private const val LOGIN_URL = "https://www.komoot.com/signin"
        private const val COOKIE_DOMAIN = "https://www.komoot.com"
        private const val ACCOUNT_URL = "https://api.komoot.de/v006/account/"
        // Komoot sets these cookies once the user is authenticated.
        // koa_at = OAuth access token, koa_re = refresh token.
        private val POST_LOGIN_COOKIE_KEYS = listOf("koa_at", "koa_re", "fresh_signin")
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    @Volatile private var resolved = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        webView = findViewById(R.id.komootWebView)
        progress = findViewById(R.id.komootProgress)

        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(webView, true)
        cm.removeAllCookies(null)
        cm.flush()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.userAgentString =
            webView.settings.userAgentString + " ExportGpxForKomoot/0.1"

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

    private fun checkForLogin(url: String) {
        if (resolved) return
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: return
        val cookieNames = cookies.split(";").mapNotNull {
            it.substringBefore("=").trim().takeIf { n -> n.isNotEmpty() }
        }
        Log.d("KomootAuth", "url=$url cookieNames=${cookieNames.joinToString(",")}")
        if (url.contains("/signin") || url.contains("/signup")) return
        if (POST_LOGIN_COOKIE_KEYS.none { cookieNames.contains(it) }) {
            Log.d("KomootAuth", "no post-login cookie yet")
            return
        }
        resolved = true
        Log.d("KomootAuth", "login complete; calling /v006/account/ in background")
        progress.visibility = View.VISIBLE
        Thread { fetchAccountAndFinish(cookies) }.start()
    }

    private fun fetchAccountAndFinish(cookies: String) {
        try {
            // koa_at cookie has the form: <userId>|<JWT>|<expiry>, URL-encoded.
            val koaAt = cookies.split(";")
                .map { it.trim() }
                .firstOrNull { it.startsWith("koa_at=") }
                ?.substringAfter("koa_at=")
                ?.let { java.net.URLDecoder.decode(it, "UTF-8") }
                ?: throw RuntimeException("koa_at cookie missing")

            val parts = koaAt.split("|")
            if (parts.size < 2 || parts[0].isBlank() || parts[1].isBlank()) {
                throw RuntimeException("koa_at malformed (got ${parts.size} parts)")
            }
            val userId = parts[0]
            val jwt = parts[1]

            // Try to enrich with display name + email from /v007/users/{id}.
            // If it fails we still return userId+jwt; UI will show a placeholder.
            val (display, email) = fetchProfile(userId, jwt)

            Log.d("KomootAuth", "userId=$userId jwt.length=${jwt.length} display=$display email_present=${email.isNotEmpty()}")
            runOnUiThread {
                val data = Intent()
                    .putExtra(EXTRA_USER_ID, userId)
                    .putExtra(EXTRA_TOKEN, jwt)
                    .putExtra(EXTRA_EMAIL, email.ifBlank { display })
                setResult(Activity.RESULT_OK, data)
                finish()
            }
        } catch (e: Exception) {
            Log.e("KomootAuth", "extract failed", e)
            runOnUiThread {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun fetchProfile(userId: String, jwt: String): Pair<String, String> {
        return try {
            val conn = URL("https://api.komoot.de/v007/users/$userId").openConnection() as HttpsURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $jwt")
            conn.setRequestProperty("Accept", "application/hal+json,application/json")
            conn.setRequestProperty("User-Agent", "ExportGpxForKomoot/0.1")
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000

            val code = conn.responseCode
            Log.d("KomootAuth", "/v007/users/$userId -> HTTP $code")
            if (code != 200) {
                conn.disconnect()
                return Pair(userId, "")
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            val json = JSONObject(body)
            val display = json.optString("displayname", userId)
            val email = json.optString("email", "")
            Pair(display, email)
        } catch (e: Exception) {
            Log.w("KomootAuth", "profile fetch failed: ${e.message}")
            Pair(userId, "")
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
