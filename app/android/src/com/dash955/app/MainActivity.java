package com.dash955.app;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
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

        @JavascriptInterface
        public boolean launch(String pkg) {
            try {
                Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
                if (i == null) return false;
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void settings(String which) {
            Intent i;
            if ("bluetooth".equals(which)) i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            else if ("location".equals(which)) i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            else if ("wifi".equals(which)) i = new Intent(Settings.ACTION_WIFI_SETTINGS);
            else if ("home".equals(which)) i = new Intent(Settings.ACTION_HOME_SETTINGS);
            else if ("media".equals(which)) i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
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
