package com.dash955.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

/**
 * Starts Dash 955 when the car unit boots, and starts looking for the OBD
 * adapter straight away. On Android 10 and later, Android only lets an app
 * open itself at boot if "afficher par-dessus les autres applis" is allowed.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Hub hub = Hub.get(c);
        SharedPreferences p = hub.prefs();
        if (!p.getBoolean("autostart", false)) return;
        hub.obd.resume();
        if (Build.VERSION.SDK_INT >= 29 && !Settings.canDrawOverlays(c)) return;
        try {
            Intent a = new Intent(c, MainActivity.class);
            a.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            c.startActivity(a);
        } catch (Exception ignored) {
        }
    }
}
