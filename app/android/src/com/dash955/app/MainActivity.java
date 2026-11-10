package com.dash955.app;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.app.SearchManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.media.AudioManager;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.util.regex.Pattern;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/** The whole UI is a WebView (assets/web); this activity wires it to the car. */
public class MainActivity extends Activity {
    private WebView web;
    private Hub hub;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        hub = Hub.get(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0C0E);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return external(url);
            }
        });
        web.addJavascriptInterface(new Bridge(), "DashNative");
        setContentView(web);
        hub.attach(this, web);
        web.loadUrl("file:///android_asset/web/index.html");
        askPermissions();
        hub.obd.resume();
    }

    private boolean external(String url) {
        if (url.startsWith("file:")) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
        }
        return true;
    }

    private void askPermissions() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, 1);
        } else {
            hub.gps.start();
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        hub.emit("perm", Hub.obj("location", ok));
        if (ok) hub.gps.start();
    }

    @Override
    protected void onStart() {
        super.onStart();
        hub.obd.unpause();
        hub.obd.resume();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (hub.prefs().getBoolean("releaseObd", true)) hub.obd.pause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        immersive();
        hub.emit("resume", "{}");
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) immersive();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        immersive();
    }

    private void immersive() {
        boolean land = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        View d = getWindow().getDecorView();
        if (land) {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onBackPressed() {
        hub.emit("back", "{}");
    }

    @Override
    protected void onDestroy() {
        hub.detach(web);
        web.destroy();
        super.onDestroy();
    }

    /* ----------------------------------------------------------- JS bridge */

    final class Bridge {
        @JavascriptInterface
        public String info() {
            String v = "1.0";
            try {
                v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception ignored) {
            }
            BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
            return Hub.obj("native", true, "version", v, "sdk", Build.VERSION.SDK_INT,
                    "model", Build.MANUFACTURER + " " + Build.MODEL,
                    "bt", ad != null, "btOn", ad != null && ad.isEnabled(),
                    "ble", getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE),
                    "media", MediaListener.enabled(MainActivity.this),
                    "obdSaved", hub.obd.saved(), "ledSaved", hub.led.saved()).toString();
        }

        /* storage: one JSON file in the app's private folder */
        @JavascriptInterface
        public String load() {
            try {
                File f = new File(getFilesDir(), "dash955.json");
                if (!f.exists()) return "";
                FileInputStream in = new FileInputStream(f);
                byte[] b = new byte[(int) f.length()];
                int off = 0;
                while (off < b.length) {
                    int n = in.read(b, off, b.length - off);
                    if (n < 0) break;
                    off += n;
                }
                in.close();
                return new String(b, 0, off, "UTF-8");
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void save(String json) {
            try {
                File tmp = new File(getFilesDir(), "dash955.tmp");
                FileOutputStream out = new FileOutputStream(tmp);
                out.write(json.getBytes("UTF-8"));
                out.close();
                tmp.renameTo(new File(getFilesDir(), "dash955.json"));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void gps() {
            runOnUiThread(new Runnable() {
                public void run() {
                    askPermissions();
                }
            });
        }

        /* OBD */
        @JavascriptInterface
        public String obdDevices() {
            return hub.obd.devices();
        }

        @JavascriptInterface
        public void obdScan() {
            hub.obd.scan();
        }

        @JavascriptInterface
        public void obdAuto() {
            hub.obd.connect("auto");
        }

        @JavascriptInterface
        public void obdConnect(String spec) {
            hub.obd.connect(spec);
        }

        @JavascriptInterface
        public void obdResume() {
            hub.obd.resume();
        }

        @JavascriptInterface
        public void obdPair(String addr) {
            hub.obd.pair(addr);
        }

        @JavascriptInterface
        public void obdDisconnect() {
            hub.obd.disconnect();
        }

        @JavascriptInterface
        public void obdForget() {
            hub.obd.forget();
        }

        @JavascriptInterface
        public void obdReadDtc() {
            hub.obd.readDtc();
        }

        @JavascriptInterface
        public void obdClearDtc() {
            hub.obd.clearDtc();
        }

        /* LED */
        @JavascriptInterface
        public void ledScan() {
            hub.led.scan();
        }

        @JavascriptInterface
        public void ledConnect(String addr) {
            hub.led.connect(addr);
        }

        @JavascriptInterface
        public void ledDisconnect() {
            hub.led.disconnect();
        }

        @JavascriptInterface
        public void ledForget() {
            hub.led.forget();
        }

        @JavascriptInterface
        public void ledColor(int r, int g, int b) {
            hub.led.color(r, g, b);
        }

        @JavascriptInterface
        public void ledPower(boolean on) {
            hub.led.power(on);
        }

        @JavascriptInterface
        public void ledBrightness(int pct) {
            hub.led.brightness(pct);
        }

        /* music */
        @JavascriptInterface
        public boolean mediaAccess() {
            return MediaListener.enabled(MainActivity.this);
        }

        @JavascriptInterface
        public void mediaRefresh() {
            MediaListener l = MediaListener.instance;
            if (l != null) l.refresh();
            else hub.emit("media", Hub.obj("none", true, "access", MediaListener.enabled(MainActivity.this)));
        }

        @JavascriptInterface
        public void media(String cmd) {
            MediaListener.command(cmd);
        }

        /* apps (CarPlay in one swipe) */
        @JavascriptInterface
        public String apps() {
            PackageManager pm = getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN);
            i.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> list = pm.queryIntentActivities(i, 0);
            List<JSONObject> out = new ArrayList<JSONObject>();
            for (ResolveInfo r : list) {
                String pkg = r.activityInfo.packageName;
                if (pkg.equals(getPackageName())) continue;
                out.add(Hub.obj("label", r.loadLabel(pm).toString(), "pkg", pkg));
            }
            Collections.sort(out, new Comparator<JSONObject>() {
                public int compare(JSONObject a, JSONObject b) {
                    return a.optString("label").compareToIgnoreCase(b.optString("label"));
                }
            });
            JSONArray a = new JSONArray();
            for (JSONObject o : out) a.put(o);
            return a.toString();
        }

        /** Every installed app whose name or package matches, launcher or not (ZLink…). */
        @JavascriptInterface
        public String findApps(String regex) {
            JSONArray a = new JSONArray();
            try {
                Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
                PackageManager pm = getPackageManager();
                for (ApplicationInfo ai : pm.getInstalledApplications(0)) {
                    String label = String.valueOf(pm.getApplicationLabel(ai));
                    if (!p.matcher(label).find() && !p.matcher(ai.packageName).find()) continue;
                    if (ai.packageName.equals(getPackageName())) continue;
                    a.put(Hub.obj("label", label, "pkg", ai.packageName, "launch", intentFor(ai.packageName) != null));
                }
            } catch (Exception ignored) {
            }
            return a.toString();
        }

        /** App icons, sent in small batches as "appIcon" events. */
        @JavascriptInterface
        public void appIcons(final String pkgsCsv) {
            new Thread(new Runnable() {
                public void run() {
                    PackageManager pm = getPackageManager();
                    for (String pkg : pkgsCsv.split(",")) {
                        if (pkg.length() == 0) continue;
                        try {
                            Drawable d = pm.getApplicationIcon(pkg);
                            int s = 96;
                            Bitmap b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
                            Canvas cv = new Canvas(b);
                            d.setBounds(0, 0, s, s);
                            d.draw(cv);
                            ByteArrayOutputStream bo = new ByteArrayOutputStream();
                            b.compress(Bitmap.CompressFormat.PNG, 100, bo);
                            hub.emit("appIcon", Hub.obj("pkg", pkg, "icon",
                                    "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)));
                        } catch (Exception ignored) {
                        }
                    }
                }
            }, "icons").start();
        }

        private Intent intentFor(String pkg) {
            PackageManager pm = getPackageManager();
            Intent i = pm.getLaunchIntentForPackage(pkg);
            if (i == null) i = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (i == null) {
                Intent q = new Intent(Intent.ACTION_MAIN);
                q.setPackage(pkg);
                List<ResolveInfo> l = pm.queryIntentActivities(q, 0);
                if (l != null && !l.isEmpty()) {
                    i = new Intent(Intent.ACTION_MAIN);
                    i.setClassName(pkg, l.get(0).activityInfo.name);
                }
            }
            return i;
        }

        @JavascriptInterface
        public boolean launch(String pkg) {
            try {
                Intent i = intentFor(pkg);
                if (i == null) return false;
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Opens the app next to Dash 955 when the unit supports split screen. */
        @JavascriptInterface
        public boolean launchSplit(String pkg) {
            try {
                Intent i = intentFor(pkg);
                if (i == null) return false;
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 0x00001000 /* LAUNCH_ADJACENT */ | 0x08000000 /* MULTIPLE_TASK */);
                startActivity(i);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean openUri(String uri, String pkg) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
                if (pkg != null && pkg.length() > 0) i.setPackage(pkg);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Navigation: Waze first, then Google Maps, then any map app. Returns what opened. */
        @JavascriptInterface
        public String nav(double lat, double lon, String label, String app) {
            String ll = lat + "," + lon;
            if (!"maps".equals(app) && openUri("waze://?ll=" + ll + "&navigate=yes", "com.waze")) return "waze";
            if (openUri("google.navigation:q=" + ll, "com.google.android.apps.maps")) return "maps";
            if (openUri("geo:" + ll + "?q=" + ll + "(" + Uri.encode(label == null ? "" : label) + ")", null)) return "geo";
            return "";
        }

        @JavascriptInterface
        public boolean dial(String number) {
            try {
                Intent i = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** "Play X": hands a search to Spotify (or another music app), then comes back. */
        @JavascriptInterface
        public boolean playSearch(String query, String pkg) {
            try {
                Intent i = new Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH);
                i.putExtra(SearchManager.QUERY, query);
                i.putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*");
                if (pkg != null && pkg.length() > 0) i.setPackage(pkg);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                hub.ui.postDelayed(new Runnable() {
                    public void run() {
                        bringToFront();
                    }
                }, 2500);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void bringToFront() {
            try {
                Intent i = new Intent(MainActivity.this, MainActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String volume(int dir) {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return "{}";
            if (dir != 0) am.adjustStreamVolume(AudioManager.STREAM_MUSIC,
                    dir > 0 ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
            return Hub.obj("v", am.getStreamVolume(AudioManager.STREAM_MUSIC),
                    "max", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)).toString();
        }

        @JavascriptInterface
        public void seek(long ms) {
            MediaListener.seek(ms);
        }

        @JavascriptInterface
        public String startup() {
            return Hub.obj("autostart", hub.prefs().getBoolean("autostart", false),
                    "releaseObd", hub.prefs().getBoolean("releaseObd", true),
                    "overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(MainActivity.this),
                    "needOverlay", Build.VERSION.SDK_INT >= 29,
                    "obdAuto", hub.obd.auto()).toString();
        }

        @JavascriptInterface
        public void setAutoStart(boolean on) {
            hub.prefs().edit().putBoolean("autostart", on).apply();
        }

        @JavascriptInterface
        public void setReleaseObd(boolean on) {
            hub.prefs().edit().putBoolean("releaseObd", on).apply();
        }

        @JavascriptInterface
        public void setObdAuto(boolean on) {
            hub.obd.setAuto(on);
        }

        @JavascriptInterface
        public void settings(String which) {
            Intent i;
            if ("bluetooth".equals(which)) i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            else if ("location".equals(which)) i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            else if ("wifi".equals(which)) i = new Intent(Settings.ACTION_WIFI_SETTINGS);
            else if ("home".equals(which)) i = new Intent(Settings.ACTION_HOME_SETTINGS);
            else if ("media".equals(which)) i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            else if ("overlay".equals(which)) {
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                i.setData(Uri.parse("package:" + getPackageName()));
            }
            else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(i);
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) {
                }
            }
        }

        @JavascriptInterface
        public void enableBluetooth() {
            try {
                startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void keepAlive(boolean on) {
            TrackService.set(MainActivity.this, on);
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void share(String text, String title) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/json");
            i.putExtra(Intent.EXTRA_TEXT, text);
            i.putExtra(Intent.EXTRA_SUBJECT, title);
            try {
                startActivity(Intent.createChooser(i, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                public void run() {
                    moveTaskToBack(true);
                }
            });
        }

        @JavascriptInterface
        public void stopAll() {
            hub.obd.disconnect();
            hub.led.disconnect();
            TrackService.set(MainActivity.this, false);
        }

        Context ctx() {
            return MainActivity.this;
        }
    }
}
