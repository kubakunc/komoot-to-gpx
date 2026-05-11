package com.velologiclabs.gpxexporter

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar

class LoginActivity : Activity() {

    companion object {
        const val EXTRA_COOKIES = "cookies"
        private const val LOGIN_URL = "https://www.komoot.com/signin"
        private const val COOKIE_DOMAIN = "https://www.komoot.com"
        // Komoot sets these cookies once the user is authenticated.
        // koa_at = OAuth access token, koa_re = refresh token. Their presence
        // means login is done regardless of which landing page Komoot picked.
        private val POST_LOGIN_COOKIE_KEYS = listOf("koa_at", "koa_re", "fresh_signin")
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar

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
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN)
        val cookieNames = cookies?.split(";")?.mapNotNull {
            it.substringBefore("=").trim().takeIf { n -> n.isNotEmpty() }
        } ?: emptyList()
        android.util.Log.d("KomootAuth", "url=$url cookieNames=${cookieNames.joinToString(",")}")
        // Still on a sign-in/sign-up page, no point looking for the token yet.
        if (url.contains("/signin") || url.contains("/signup")) return
        if (cookies == null) return
        if (POST_LOGIN_COOKIE_KEYS.none { key -> cookieNames.contains(key) }) {
            android.util.Log.d("KomootAuth", "no post-login cookie yet")
            return
        }
        android.util.Log.d("KomootAuth", "login complete, returning cookies")
        val data = Intent().putExtra(EXTRA_COOKIES, cookies)
        setResult(Activity.RESULT_OK, data)
        finish()
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
