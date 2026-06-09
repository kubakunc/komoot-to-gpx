package com.velologiclabs.gpxexporter

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StravaAuth")
class StravaAuthPlugin : Plugin() {

    @PluginMethod
    fun login(call: PluginCall) {
        val intent = Intent(context, StravaLoginActivity::class.java)
        startActivityForResult(call, intent, "onLoginResult")
    }

    @ActivityCallback
    private fun onLoginResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Login cancelled or failed")
            return
        }
        val data = result.data
        val userId = data?.getStringExtra(StravaLoginActivity.EXTRA_USER_ID)
        val displayName = data?.getStringExtra(StravaLoginActivity.EXTRA_DISPLAY_NAME) ?: ""
        val token = data?.getStringExtra(StravaLoginActivity.EXTRA_TOKEN) ?: ""
        // No portable token for Strava — the session cookie stays in CookieManager.
        if (userId.isNullOrBlank()) {
            call.reject("Login result missing athlete id")
            return
        }
        val ret = JSObject()
        ret.put("userId", userId)
        ret.put("displayName", displayName)
        ret.put("token", token)
        call.resolve(ret)
    }
}
