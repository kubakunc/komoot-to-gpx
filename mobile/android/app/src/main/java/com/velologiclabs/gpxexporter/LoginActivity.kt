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
        // Heuristic: when Komoot redirects after sign-in, the URL no longer contains "/signin".
        private val POST_LOGIN_FRAGMENTS = listOf("/discover", "/user/", "/inspiration", "/plan")
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
        if (url.contains("/signin") || url.contains("/login")) return
        if (POST_LOGIN_FRAGMENTS.none { url.contains(it) }) return
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: return
        if (!cookies.contains("koa_") && !cookies.contains("komoot-session")) return
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
