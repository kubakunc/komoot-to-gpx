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

@CapacitorPlugin(name = "KomootAuth")
class KomootAuthPlugin : Plugin() {

    @PluginMethod
    fun login(call: PluginCall) {
        val intent = Intent(context, LoginActivity::class.java)
        startActivityForResult(call, intent, "onLoginResult")
    }

    @ActivityCallback
    private fun onLoginResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Login cancelled")
            return
        }
        val cookies = result.data?.getStringExtra(LoginActivity.EXTRA_COOKIES)
        if (cookies.isNullOrBlank()) {
            call.reject("No cookies captured")
            return
        }
        val ret = JSObject()
        ret.put("cookies", cookies)
        call.resolve(ret)
    }
}
