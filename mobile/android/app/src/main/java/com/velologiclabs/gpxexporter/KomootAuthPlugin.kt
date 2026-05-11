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
            call.reject("Login cancelled or failed")
            return
        }
        val data = result.data
        val userId = data?.getStringExtra(LoginActivity.EXTRA_USER_ID)
        val token = data?.getStringExtra(LoginActivity.EXTRA_TOKEN)
        val email = data?.getStringExtra(LoginActivity.EXTRA_EMAIL) ?: ""
        if (userId.isNullOrBlank() || token.isNullOrBlank()) {
            call.reject("Login result missing userId or token")
            return
        }
        val ret = JSObject()
        ret.put("userId", userId)
        ret.put("token", token)
        ret.put("email", email)
        call.resolve(ret)
    }
}
