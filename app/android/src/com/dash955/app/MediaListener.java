package com.dash955.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * Reads the track playing in any music app (title, artist, cover) through the
 * media sessions Android exposes to notification listeners, and relays play,
 * pause, next and previous. Needs "accès aux notifications" granted once.
 */
public class MediaListener extends NotificationListenerService {
    static volatile MediaListener instance;

    private MediaSessionManager msm;
    private ComponentName cn;
    private MediaController ctl;
    private String lastArtKey = "";
    private final Handler main = new Handler(Looper.getMainLooper());

    private final MediaController.Callback cb = new MediaController.Callback() {
        @Override
        public void onMetadataChanged(MediaMetadata m) {
            push(false);
        }

        @Override
        public void onPlaybackStateChanged(PlaybackState s) {
            push(false);
        }

        @Override
        public void onSessionDestroyed() {
            refresh();
        }
    };

    private final MediaSessionManager.OnActiveSessionsChangedListener sl =
            new MediaSessionManager.OnActiveSessionsChangedListener() {
                @Override
                public void onActiveSessionsChanged(List<MediaController> l) {
                    pick(l);
                }
            };

    static boolean enabled(Context c) {
        String s = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(c.getPackageName());
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        instance = this;
        cn = new ComponentName(this, MediaListener.class);
        msm = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
        try {
            msm.addOnActiveSessionsChangedListener(sl, cn, main);
            pick(msm.getActiveSessions(cn));
        } catch (SecurityException ignored) {
        }
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        try {
            if (msm != null) msm.removeOnActiveSessionsChangedListener(sl);
            if (ctl != null) ctl.unregisterCallback(cb);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    void refresh() {
        try {
            if (msm != null) pick(msm.getActiveSessions(cn));
        } catch (SecurityException ignored) {
        }
    }

    private void pick(List<MediaController> list) {
        MediaController best = null;
        if (list != null) {
            for (MediaController c : list) {
                PlaybackState s = c.getPlaybackState();
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) {
                    best = c;
                    break;
                }
            }
            if (best == null && !list.isEmpty()) best = list.get(0);
        }
        if (ctl != null && (best == null || !best.getSessionToken().equals(ctl.getSessionToken()))) {
            try {
                ctl.unregisterCallback(cb);
            } catch (Exception ignored) {
            }
            ctl = null;
        }
        if (best != null && ctl == null) {
            ctl = best;
            ctl.registerCallback(cb, main);
            lastArtKey = "";
        }
        push(true);
    }

    void push(boolean forceArt) {
        Hub hub = Hub.peek();
        if (hub == null) return;
        JSONObject o = new JSONObject();
        try {
            MediaController c = ctl;
            if (c == null) {
                o.put("none", true);
                hub.emit("media", o);
                return;
            }
            MediaMetadata m = c.getMetadata();
            PlaybackState s = c.getPlaybackState();
            String title = "", artist = "", album = "";
            long dur = 0;
            Bitmap art = null;
            if (m != null) {
                title = first(m.getString(MediaMetadata.METADATA_KEY_TITLE), m.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE));
                artist = first(m.getString(MediaMetadata.METADATA_KEY_ARTIST), m.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST),
                        m.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE));
                album = first(m.getString(MediaMetadata.METADATA_KEY_ALBUM));
                dur = m.getLong(MediaMetadata.METADATA_KEY_DURATION);
                art = m.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
                if (art == null) art = m.getBitmap(MediaMetadata.METADATA_KEY_ART);
                if (art == null) art = m.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
            }
            o.put("title", title);
            o.put("artist", artist);
            o.put("album", album);
            o.put("dur", dur);
            o.put("playing", s != null && s.getState() == PlaybackState.STATE_PLAYING);
            o.put("pos", s != null ? s.getPosition() : 0);
            o.put("speed", s != null ? s.getPlaybackSpeed() : 0);
            o.put("at", s != null ? s.getLastPositionUpdateTime() : 0);
            o.put("app", appLabel(c.getPackageName()));
            String key = title + "|" + artist + "|" + album;
            if (forceArt || !key.equals(lastArtKey)) {
                lastArtKey = key;
                o.put("art", art == null ? "" : encode(art));
            }
        } catch (Exception ignored) {
        }
        hub.emit("media", o);
    }

    static void command(String cmd) {
        MediaListener l = instance;
        if (l == null || l.ctl == null) return;
        MediaController.TransportControls t = l.ctl.getTransportControls();
        if ("play".equals(cmd)) t.play();
        else if ("pause".equals(cmd)) t.pause();
        else if ("next".equals(cmd)) t.skipToNext();
        else if ("prev".equals(cmd)) t.skipToPrevious();
        else if ("toggle".equals(cmd)) {
            PlaybackState s = l.ctl.getPlaybackState();
            if (s != null && s.getState() == PlaybackState.STATE_PLAYING) t.pause();
            else t.play();
        }
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String first(String... v) {
        for (String s : v) if (s != null && s.length() > 0) return s;
        return "";
    }

    private static String encode(Bitmap b) {
        int max = 320;
        int w = b.getWidth(), h = b.getHeight();
        if (w > max || h > max) {
            float k = Math.min(max / (float) w, max / (float) h);
            b = Bitmap.createScaledBitmap(b, Math.max(1, (int) (w * k)), Math.max(1, (int) (h * k)), true);
        }
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 82, bo);
        return "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
    }
}
