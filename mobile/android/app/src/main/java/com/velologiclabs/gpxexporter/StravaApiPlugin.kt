package com.velologiclabs.gpxexporter

import android.util.Log
import android.webkit.CookieManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * Cookie-replay GET against www.strava.com. The Strava session cookie lives in
 * the WebView CookieManager (set during StravaLoginActivity); we read it and
 * send it as the Cookie header on each request. A redirect to /login means the
 * session expired — we surface that as HTTP 401 so the UI can sign the user out.
 */
@CapacitorPlugin(name = "StravaApi")
class StravaApiPlugin : Plugin() {

    companion object {
        private const val BASE = "https://www.strava.com"
        private const val COOKIE_DOMAIN = "https://www.strava.com"
        private const val MAX_REDIRECTS = 2
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path required")
        Thread {
            try {
                val (status, body) = httpGet("$BASE$path", MAX_REDIRECTS)
                val ret = JSObject()
                ret.put("status", status)
                ret.put("body", body)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("StravaApi", "GET $path failed", e)
                call.reject(e.message ?: "request failed")
            }
        }.start()
    }

    private fun cookieHeader(): String = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: ""

    private fun httpGet(url: String, redirectsLeft: Int): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.instanceFollowRedirects = false
        conn.requestMethod = "GET"
        conn.setRequestProperty("Cookie", cookieHeader())
        conn.setRequestProperty("X-Requested-With", "XMLHttpRequest")
        conn.setRequestProperty("Accept", "application/json, text/html, application/octet-stream")
        conn.setRequestProperty("User-Agent", StravaLoginActivity.USER_AGENT)
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        return try {
            val code = conn.responseCode
            if (code in 300..399) {
                val loc = conn.getHeaderField("Location") ?: ""
                // A bounce to the login/onboarding page means the session is gone.
                if (loc.contains("/login") || loc.contains("/onboarding") || loc.isBlank()) {
                    return Pair(401, "")
                }
                if (redirectsLeft > 0) {
                    val next = if (loc.startsWith("http")) loc else "$BASE$loc"
                    conn.disconnect()
                    return httpGet(next, redirectsLeft - 1)
                }
                return Pair(code, "")
            }
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Log.d("StravaApi", "GET $url -> $code (${body.length} bytes)")
            Pair(code, body)
        } finally {
            conn.disconnect()
        }
    }
}
