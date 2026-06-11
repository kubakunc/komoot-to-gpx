package com.velologiclabs.gpxexporter

import android.util.Log
import android.webkit.CookieManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.URL
import java.net.URLDecoder
import javax.net.ssl.HttpsURLConnection

@CapacitorPlugin(name = "KomootApi")
class KomootApiPlugin : Plugin() {

    companion object {
        private const val BASE = "https://api.komoot.de"
        private const val PAGE = "https://www.komoot.com/"
        private const val COOKIE_DOMAIN = "https://www.komoot.com"
        private const val UA = "ExportGpxForKomoot/0.1"
        private val refreshLock = Any()
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path required")
        val token = call.getString("token") ?: return call.reject("token required")
        Thread {
            try {
                var (status, body) = httpGet("$BASE$path", token)
                var newToken: String? = null
                if (status == 401) {
                    val refreshed = refreshToken(token)
                    if (refreshed != null) {
                        newToken = refreshed
                        val retry = httpGet("$BASE$path", refreshed)
                        status = retry.first; body = retry.second
                    }
                }
                val ret = JSObject()
                ret.put("status", status)
                ret.put("body", body)
                if (newToken != null) ret.put("newToken", newToken)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("KomootApi", "GET $path failed", e)
                call.reject(e.message ?: "request failed")
            }
        }.start()
    }

    /**
     * Twin-technique refresh: a page GET to www.komoot.com with the current
     * cookie jar makes Komoot's SSR rotate the koa_at cookie via Set-Cookie.
     * Copy those cookies into the WebView CookieManager and read the new JWT.
     * Single-flight so concurrent 401s share one refresh. Returns the new JWT,
     * or null if no fresh koa_at appeared (caller surfaces the original 401).
     */
    private fun refreshToken(staleToken: String): String? = synchronized(refreshLock) {
        // Another thread may have refreshed while we waited on the lock.
        currentJwt()?.let { if (it != staleToken) return it }
        return try {
            val conn = URL(PAGE).openConnection() as HttpsURLConnection
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("Cookie", CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: "")
            conn.setRequestProperty("User-Agent", UA)
            conn.connectTimeout = 12_000
            conn.readTimeout = 15_000
            conn.responseCode
            val cm = CookieManager.getInstance()
            // Copy every Set-Cookie back into the jar (header casing varies).
            conn.headerFields["Set-Cookie"]?.forEach { cm.setCookie(COOKIE_DOMAIN, it) }
            conn.headerFields["set-cookie"]?.forEach { cm.setCookie(COOKIE_DOMAIN, it) }
            cm.flush()
            conn.disconnect()
            val jwt = currentJwt()
            Log.d("KomootApi", "refresh: new koa_at present=${jwt != null} changed=${jwt != null && jwt != staleToken}")
            if (jwt != null && jwt != staleToken) jwt else null
        } catch (e: Exception) {
            Log.w("KomootApi", "refresh failed: ${e.message}")
            null
        }
    }

    /** Extract the JWT (2nd field of koa_at = userId|JWT|expiry, URL-decoded). */
    private fun currentJwt(): String? {
        val cookies = CookieManager.getInstance().getCookie(COOKIE_DOMAIN) ?: return null
        val koaAt = cookies.split(";").map { it.trim() }
            .firstOrNull { it.startsWith("koa_at=") }
            ?.substringAfter("koa_at=")
            ?.let { runCatching { URLDecoder.decode(it, "UTF-8") }.getOrNull() }
            ?: return null
        val parts = koaAt.split("|")
        return if (parts.size >= 2 && parts[1].isNotBlank()) parts[1] else null
    }

    private fun httpGet(url: String, token: String): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Accept", "application/hal+json,application/json")
        conn.setRequestProperty("User-Agent", UA)
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        return try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Log.d("KomootApi", "GET $url -> $code (${body.length} bytes)")
            Pair(code, body)
        } finally {
            conn.disconnect()
        }
    }
}
