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

    /**
     * Persist the GPX content to cacheDir so we don't have to ferry the whole
     * XML through the PluginCall bundle (Android Binder rejects payloads above
     * ~1 MB with TransactionTooLargeException, which kills the process between
     * the picker activity and our callback). Returns the staged file path.
     */
    @PluginMethod
    fun stage(call: PluginCall) {
        val content = call.getString("content") ?: return call.reject("content required")
        if (content.isBlank()) return call.reject("content empty")
        try {
            val cache = File(context.cacheDir, "pending-gpx-${System.currentTimeMillis()}.gpx")
            cache.writeText(content, Charsets.UTF_8)
            Log.d("GpxSaver", "staged ${cache.length()} bytes at ${cache.absolutePath}")
            val ret = JSObject()
            ret.put("stagePath", cache.absolutePath)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e("GpxSaver", "stage failed", e)
            call.reject(e.message ?: "stage failed")
        }
    }

    /**
     * Open the system Save-As picker; on success copy the staged file to the
     * URI the user picked. The PluginCall now only carries a short string
     * (filename + stagePath) so the Binder transaction stays well below 1 MB.
     */
    @PluginMethod
    fun save(call: PluginCall) {
        val filename = call.getString("filename") ?: return call.reject("filename required")
        val stagePath = call.getString("stagePath") ?: return call.reject("stagePath required")
        if (!File(stagePath).exists()) return call.reject("staged file missing")

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/gpx+xml"
            putExtra(Intent.EXTRA_TITLE, filename)
        }
        startActivityForResult(call, intent, "onPickResult")
    }

    @ActivityCallback
    private fun onPickResult(call: PluginCall, result: ActivityResult) {
        val stagePath = call.getString("stagePath")
        val staged = stagePath?.let { File(it) }
        Log.d("GpxSaver", "onPickResult code=${result.resultCode} staged=${staged?.exists()}")

        if (result.resultCode != Activity.RESULT_OK) {
            staged?.delete()
            call.reject("save cancelled")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            staged?.delete()
            call.reject("picker returned no uri")
            return
        }
        if (staged == null || !staged.exists()) {
            call.reject("staged file missing")
            return
        }

        try {
            val bytes = staged.readBytes()
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
            staged.delete()
        }
    }
}
