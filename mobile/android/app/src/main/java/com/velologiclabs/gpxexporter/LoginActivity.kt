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
            val conn = URL(ACCOUNT_URL).openConnection() as HttpsURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Cookie", cookies)
            conn.setRequestProperty("Accept", "application/hal+json,application/json")
            conn.setRequestProperty("User-Agent", "ExportGpxForKomoot/0.1")
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000

            val code = conn.responseCode
            Log.d("KomootAuth", "/v006/account/ -> HTTP $code")
            if (code != 200) {
                conn.disconnect()
                throw RuntimeException("HTTP $code")
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            val json = JSONObject(body)
            val userId = json.getString("username")
            val token = json.getString("password")
            val email = json.optString("email", "")
            Log.d("KomootAuth", "got userId=$userId, email present=${email.isNotEmpty()}")
            runOnUiThread {
                val data = Intent()
                    .putExtra(EXTRA_USER_ID, userId)
                    .putExtra(EXTRA_TOKEN, token)
                    .putExtra(EXTRA_EMAIL, email)
                setResult(Activity.RESULT_OK, data)
                finish()
            }
        } catch (e: Exception) {
            Log.e("KomootAuth", "fetchAccount failed", e)
            runOnUiThread {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
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
