package com.velologiclabs.gpxexporter

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "GpxSaver")
class GpxSaverPlugin : Plugin() {

    @PluginMethod
    fun save(call: PluginCall) {
        val filename = call.getString("filename") ?: return call.reject("filename required")
        val content = call.getString("content") ?: return call.reject("content required")
        if (content.isBlank()) return call.reject("content empty")

        // Park the content in a cache file so it survives even if the PluginCall
        // data gets stripped during the Activity round-trip.
        try {
            val cache = File(context.cacheDir, "pending-gpx-${System.currentTimeMillis()}.gpx")
            cache.writeText(content, Charsets.UTF_8)
            Log.d("GpxSaver", "parked ${cache.length()} bytes at ${cache.absolutePath}")
            call.data.put("cachePath", cache.absolutePath)
        } catch (e: Exception) {
            return call.reject("Could not stage GPX: ${e.message}")
        }

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/gpx+xml"
            putExtra(Intent.EXTRA_TITLE, filename)
        }
        startActivityForResult(call, intent, "onPickResult")
    }

    @ActivityCallback
    private fun onPickResult(call: PluginCall, result: ActivityResult) {
        val cachePath = call.getString("cachePath")
        val cacheFile = cachePath?.let { File(it) }
        Log.d("GpxSaver", "onPickResult code=${result.resultCode} cachePath=$cachePath exists=${cacheFile?.exists()}")

        if (result.resultCode != Activity.RESULT_OK) {
            cacheFile?.delete()
            call.reject("save cancelled")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            cacheFile?.delete()
            call.reject("picker returned no uri")
            return
        }
        if (cacheFile == null || !cacheFile.exists()) {
            call.reject("staged file missing")
            return
        }

        try {
            val bytes = cacheFile.readBytes()
            context.contentResolver.openOutputStream(uri)?.use { os ->
                os.write(bytes)
                os.flush()
            } ?: throw RuntimeException("openOutputStream returned null")
            Log.d("GpxSaver", "wrote ${bytes.size} bytes to $uri")
            val ret = JSObject()
            ret.put("uri", uri.toString())
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e("GpxSaver", "write failed", e)
            call.reject(e.message ?: "write failed")
        } finally {
            cacheFile.delete()
        }
    }
}
