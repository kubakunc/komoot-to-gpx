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

@CapacitorPlugin(name = "GpxSaver")
class GpxSaverPlugin : Plugin() {

    @PluginMethod
    fun save(call: PluginCall) {
        val filename = call.getString("filename") ?: return call.reject("filename required")
        if (call.getString("content").isNullOrBlank()) {
            return call.reject("content required")
        }
        // Persist the call so we still have the content when the picker returns.
        call.setKeepAlive(true)
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/gpx+xml"
            putExtra(Intent.EXTRA_TITLE, filename)
        }
        startActivityForResult(call, intent, "onPickResult")
    }

    @ActivityCallback
    private fun onPickResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("save cancelled")
            return
        }
        val uri = result.data?.data ?: return call.reject("picker returned no uri")
        val content = call.getString("content") ?: return call.reject("content lost")

        Thread {
            try {
                context.contentResolver.openOutputStream(uri)?.use { os ->
                    os.write(content.toByteArray(Charsets.UTF_8))
                    os.flush()
                } ?: throw RuntimeException("openOutputStream returned null")
                Log.d("GpxSaver", "saved ${content.length} chars to $uri")
                val ret = JSObject()
                ret.put("uri", uri.toString())
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e("GpxSaver", "save failed", e)
                call.reject(e.message ?: "write failed")
            }
        }.start()
    }
}
