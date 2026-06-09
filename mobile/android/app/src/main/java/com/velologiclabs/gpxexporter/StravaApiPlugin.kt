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
        // The CSRF <meta> only renders on the rails (desktop) page; the mobile UA
        // gets a Next.js shell without it. Scrape it under a desktop UA.
        private const val DESKTOP_UA =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        @Volatile private var cachedCsrf: String? = null
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

    @PluginMethod
    fun post(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path required")
        val body = call.getString("body") ?: "{}"
        Thread {
            try {
                var (status, resp) = httpPost("$BASE$path", body, ensureCsrf(false))
                if (status == 403) {
                    // CSRF token may be stale — refresh once and retry.
                    val retry = httpPost("$BASE$path", body, ensureCsrf(true))
                    status = retry.first; resp = retry.second
                }
                val ret = JSObject()
                ret.put("status", status)
                ret.put("body", resp)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("StravaApi", "POST $path failed", e)
                call.reject(e.message ?: "request failed")
            }
        }.start()
    }

    /** Scrape the CSRF token from a rails page (the Next.js routes page has none). */
    private fun ensureCsrf(forceRefresh: Boolean): String {
        if (!forceRefresh) cachedCsrf?.let { if (it.isNotEmpty()) return it }
        for (path in listOf("/dashboard", "/settings/profile", "/")) {
            val html = fetchCsrfPage("$BASE$path")
            val token = extractCsrf(html)
            if (token.isNotEmpty()) {
                Log.d("StravaApi", "csrf scraped from $path len=${token.length}")
                cachedCsrf = token
                return token
            }
            val idx = html.indexOf("csrf")
            Log.d("StravaApi", "csrf miss $path htmlLen=${html.length} hasCsrf=${idx >= 0} ctx=${
                if (idx >= 0) html.substring(idx, minOf(idx + 90, html.length)).replace("\n", " ") else "-"
            }")
        }
        // Don't poison the cache with an empty token — leave it so the next call re-scrapes.
        return ""
    }

    private fun extractCsrf(html: String): String =
        Regex("""csrf-token["']?\s+content=["']([^"']+)""").find(html)?.groupValues?.get(1)
            ?: Regex("""content=["']([^"']+)["']\s+name=["']csrf-token""").find(html)?.groupValues?.get(1)
            ?: ""

    /** GET a page under a desktop UA so Strava renders the rails markup with the CSRF meta. */
    private fun fetchCsrfPage(url: String): String {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.instanceFollowRedirects = true
        conn.requestMethod = "GET"
        conn.setRequestProperty("Cookie", cookieHeader())
        conn.setRequestProperty("User-Agent", DESKTOP_UA)
        conn.setRequestProperty("Accept", "text/html")
        conn.connectTimeout = 12_000
        conn.readTimeout = 20_000
        return try {
            if (conn.responseCode !in 200..299) "" else conn.inputStream.bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.w("StravaApi", "csrf page fetch failed: ${e.message}")
            ""
        } finally {
            conn.disconnect()
        }
    }

    private fun httpPost(url: String, body: String, csrf: String): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.instanceFollowRedirects = false
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Cookie", cookieHeader())
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("X-Requested-With", "XMLHttpRequest")
        conn.setRequestProperty("X-CSRF-Token", csrf)
        conn.setRequestProperty("Origin", BASE)
        conn.setRequestProperty("Referer", "$BASE/athlete/routes")
        conn.setRequestProperty("User-Agent", StravaLoginActivity.USER_AGENT)
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        return try {
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code in 300..399) {
                val loc = conn.getHeaderField("Location") ?: ""
                if (loc.contains("/login") || loc.contains("/onboarding")) return Pair(401, "")
            }
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val resp = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Log.d("StravaApi", "POST $url -> $code (${resp.length} bytes)")
            Pair(code, resp)
        } finally {
            conn.disconnect()
        }
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
