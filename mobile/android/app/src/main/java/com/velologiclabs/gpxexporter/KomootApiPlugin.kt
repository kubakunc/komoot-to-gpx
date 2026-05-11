package com.velologiclabs.gpxexporter

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.URL
import javax.net.ssl.HttpsURLConnection

@CapacitorPlugin(name = "KomootApi")
class KomootApiPlugin : Plugin() {

    @PluginMethod
    fun get(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path required")
        val token = call.getString("token") ?: return call.reject("token required")
        Thread {
            try {
                val (status, body) = httpGet("https://api.komoot.de$path", token)
                val ret = JSObject()
                ret.put("status", status)
                ret.put("body", body)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("KomootApi", "GET $path failed", e)
                call.reject(e.message ?: "request failed")
            }
        }.start()
    }

    private fun httpGet(url: String, token: String): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpsURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Accept", "application/hal+json,application/json")
        conn.setRequestProperty("User-Agent", "ExportGpxForKomoot/0.1")
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
