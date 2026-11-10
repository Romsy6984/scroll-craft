package com.dash955.app;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;

import org.json.JSONObject;

/** GPS speed, position and heading, pushed to the UI once per second. */
final class Gps implements LocationListener {
    private final Hub hub;
    private boolean running;
    private long lastGpsFix;

    Gps(Hub hub) {
        this.hub = hub;
    }

    void start() {
        if (running) return;
        LocationManager lm = (LocationManager) hub.ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        try {
            boolean any = false;
            if (lm.getAllProviders().contains(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this, Looper.getMainLooper());
                any = true;
            }
            if (lm.getAllProviders().contains(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 0, this, Looper.getMainLooper());
                any = true;
            }
            running = any;
            Location last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (last != null) send(last, true);
            if (!any) hub.emit("gps", Hub.obj("error", "nogps"));
        } catch (SecurityException e) {
            hub.emit("gps", Hub.obj("error", "perm"));
        }
    }

    void stop() {
        LocationManager lm = (LocationManager) hub.ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm != null) lm.removeUpdates(this);
        running = false;
    }

    private void send(Location l, boolean stale) {
        JSONObject o = new JSONObject();
        try {
            o.put("lat", l.getLatitude());
            o.put("lon", l.getLongitude());
            o.put("acc", l.hasAccuracy() ? l.getAccuracy() : -1);
            o.put("alt", l.hasAltitude() ? l.getAltitude() : -9999);
            o.put("spd", l.hasSpeed() ? l.getSpeed() : -1);
            o.put("brg", l.hasBearing() ? l.getBearing() : -1);
            o.put("t", l.getTime());
            o.put("p", l.getProvider());
            o.put("stale", stale);
        } catch (Exception ignored) {
        }
        hub.emit("gps", o);
    }

    @Override
    public void onLocationChanged(Location l) {
        if (l == null) return;
        boolean isGps = LocationManager.GPS_PROVIDER.equals(l.getProvider());
        if (isGps) lastGpsFix = System.currentTimeMillis();
        else if (System.currentTimeMillis() - lastGpsFix < 10000) return;
        send(l, false);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    @Override
    public void onProviderEnabled(String provider) {
        hub.emit("gps", Hub.obj("provider", provider, "enabled", true));
    }

    @Override
    public void onProviderDisabled(String provider) {
        hub.emit("gps", Hub.obj("provider", provider, "enabled", false));
    }
}
