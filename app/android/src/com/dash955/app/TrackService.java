package com.dash955.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps the app alive (and GPS/OBD flowing) while a trip is recorded with the
 * screen off, as a foreground service with a quiet notification.
 */
public class TrackService extends Service {
    private static final String CHANNEL = "trajets";

    static void set(Context c, boolean on) {
        Intent i = new Intent(c, TrackService.class);
        try {
            if (!on) {
                c.stopService(i);
            } else if (Build.VERSION.SDK_INT >= 26) {
                c.getClass().getMethod("startForegroundService", Intent.class).invoke(c, i);
            } else {
                c.startService(i);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            startForeground(955, build());
        } catch (Exception ignored) {
            stopSelf();
        }
        return START_STICKY;
    }

    @SuppressWarnings("deprecation")
    private Notification build() throws Exception {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            Class<?> chCls = Class.forName("android.app.NotificationChannel");
            Object ch = chCls.getConstructor(String.class, CharSequence.class, int.class)
                    .newInstance(CHANNEL, "Trajets", 2);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.getClass().getMethod("createNotificationChannel", chCls).invoke(nm, ch);
            b = (Notification.Builder) Notification.Builder.class.getConstructor(Context.class, String.class)
                    .newInstance(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
            b.setPriority(Notification.PRIORITY_LOW);
        }
        b.setContentTitle("Dash 955")
                .setContentText("Trajet en cours d'enregistrement")
                .setSmallIcon(R.drawable.ic_stat)
                .setContentIntent(pi)
                .setOngoing(true);
        return b.build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
