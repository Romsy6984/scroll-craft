package com.dash955.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import org.json.JSONObject;

/**
 * Application-wide hub. Owns the OBD, GPS and LED managers so they survive the
 * activity being recreated, and forwards every native event to the web UI as
 * Dash.onNative(event, payload).
 */
public final class Hub {
    private static Hub instance;

    public static synchronized Hub get(Context c) {
        if (instance == null) instance = new Hub(c.getApplicationContext());
        return instance;
    }

    public static Hub peek() {
        return instance;
    }

    final Context ctx;
    final Handler ui = new Handler(Looper.getMainLooper());
    final Obd obd;
    final Gps gps;
    final Led led;
    private volatile WebView web;
    volatile Activity activity;

    private Hub(Context c) {
        ctx = c;
        obd = new Obd(this);
        gps = new Gps(this);
        led = new Led(this);
    }

    void attach(Activity a, WebView w) {
        activity = a;
        web = w;
    }

    void detach(WebView w) {
        if (web == w) {
            web = null;
            activity = null;
        }
    }

    void emit(final String event, final String json) {
        ui.post(new Runnable() {
            public void run() {
                WebView w = web;
                if (w == null) return;
                w.evaluateJavascript("window.Dash&&Dash.onNative(" + JSONObject.quote(event) + ","
                        + (json == null ? "null" : json) + ")", null);
            }
        });
    }

    void emit(String event, JSONObject o) {
        emit(event, o.toString());
    }

    SharedPreferences prefs() {
        return ctx.getSharedPreferences("dash955", Context.MODE_PRIVATE);
    }

    static JSONObject obj(Object... kv) {
        JSONObject o = new JSONObject();
        try {
            for (int i = 0; i + 1 < kv.length; i += 2) o.put(String.valueOf(kv[i]), kv[i + 1]);
        } catch (Exception ignored) {
        }
        return o;
    }
}
