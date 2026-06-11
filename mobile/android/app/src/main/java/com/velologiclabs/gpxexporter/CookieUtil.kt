package com.velologiclabs.gpxexporter

import android.webkit.CookieManager

/** Cookie helpers that operate on a single provider's domain, so signing in to
 *  one provider never wipes the other's session (CookieManager has no
 *  per-domain clear, so we expire each cookie name by name). */
object CookieUtil {
    /**
     * Expire every cookie currently set for [url]. [domain] is the registrable
     * domain (e.g. ".komoot.com"); we write both a host-scoped and a
     * domain-scoped expiry because a host-only overwrite leaves domain cookies.
     */
    fun clearFor(url: String, domain: String) {
        val cm = CookieManager.getInstance()
        val raw = cm.getCookie(url) ?: return
        val names = raw.split(";").mapNotNull { it.substringBefore("=").trim().takeIf(String::isNotEmpty) }
        val expiry = "Thu, 01 Jan 1970 00:00:00 GMT"
        for (name in names) {
            cm.setCookie(url, "$name=; Path=/; Expires=$expiry")
            cm.setCookie(url, "$name=; Domain=$domain; Path=/; Expires=$expiry")
        }
        cm.flush()
    }
}
