package com.dash955.app;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Bluetooth LED strip controller. Supports the two protocols used by most
 * cheap car LED strips: ELK-BLEDOM family (service FFF0, characteristic FFF3)
 * and Triones / Happy Lighting / LEDnet (FFD5/FFD9 or FFE5/FFE9).
 */
final class Led {
    static final Pattern LED_NAME = Pattern.compile(
            "(?i)^(elk|melk|bledom|ledble|triones|qhm|lednet|led|bt-led|happy|lotus|dmrrbb|sp1|ble-led|duoco).*");
    private static final String[][] PREF = {
            {"fff0", null, "fff3"},
            {"ffd5", null, "ffd9"},
            {"ffe5", null, "ffe9"},
    };

    private final Hub hub;
    private volatile Ble.Link link;
    private volatile int kind; // 1 = ELK, 2 = Triones
    private volatile int[] pending;
    private volatile int bright = 100;
    private volatile Thread writer;

    Led(Hub hub) {
        this.hub = hub;
    }

    String saved() {
        return hub.prefs().getString("led", "");
    }

    void scan() {
        new Thread(new Runnable() {
            public void run() {
                final Set<String> seen = new HashSet<String>();
                try {
                    Ble.scan(7000, new Ble.Found() {
                        public void found(String name, String address, int rssi) {
                            if (name == null || !seen.add(address)) return;
                            hub.emit("ledFound", Hub.obj("name", name, "addr", address, "rssi", rssi,
                                    "led", LED_NAME.matcher(name).matches()));
                        }
                    });
                } catch (InterruptedException ignored) {
                }
                hub.emit("ledScanDone", "{}");
            }
        }, "led-scan").start();
    }

    void connect(final String address) {
        disconnect();
        status("connecting", "");
        new Thread(new Runnable() {
            public void run() {
                Ble.Link l = new Ble.Link(false);
                try {
                    l.open(hub.ctx, address, PREF, 12000);
                    String s = Ble.shortId(l.wr.getService().getUuid());
                    kind = s.equals("fff0") ? 1 : 2;
                    link = l;
                    hub.prefs().edit().putString("led", address).apply();
                    status("connected", l.name);
                    power(true);
                } catch (Exception e) {
                    l.close();
                    status("error", e.getMessage() == null ? "connexion impossible" : e.getMessage());
                }
            }
        }, "led-connect").start();
    }

    void disconnect() {
        Ble.Link l = link;
        link = null;
        if (l != null) l.close();
        status("off", "");
    }

    void forget() {
        hub.prefs().edit().remove("led").apply();
        disconnect();
    }

    void power(boolean on) {
        if (kind == 1) send(on ? hex("7e0004f00001ff00ef") : hex("7e00040000 00ff00ef".replace(" ", "")));
        else send(on ? hex("cc2333") : hex("cc2433"));
    }

    void brightness(int pct) {
        bright = Math.max(0, Math.min(100, pct));
        if (kind == 1) send(new byte[]{0x7e, 0x00, 0x01, (byte) bright, 0x00, 0x00, 0x00, 0x00, (byte) 0xef});
    }

    /** Latest colour wins; a writer thread sends at most one frame every 60 ms. */
    void color(int r, int g, int b) {
        pending = new int[]{r, g, b};
        if (writer != null) return;
        Thread t = new Thread(new Runnable() {
            public void run() {
                try {
                    while (link != null) {
                        int[] c = pending;
                        pending = null;
                        if (c == null) {
                            Thread.sleep(40);
                            if (pending == null) break;
                            continue;
                        }
                        int r = c[0], g = c[1], b = c[2];
                        if (kind == 2 && bright < 100) {
                            r = r * bright / 100;
                            g = g * bright / 100;
                            b = b * bright / 100;
                        }
                        if (kind == 1)
                            send(new byte[]{0x7e, 0x00, 0x05, 0x03, (byte) r, (byte) g, (byte) b, 0x00, (byte) 0xef});
                        else send(new byte[]{0x56, (byte) r, (byte) g, (byte) b, 0x00, (byte) 0xf0, (byte) 0xaa});
                        Thread.sleep(60);
                    }
                } catch (InterruptedException ignored) {
                } finally {
                    writer = null;
                }
            }
        }, "led-writer");
        writer = t;
        t.start();
    }

    private void send(byte[] b) {
        Ble.Link l = link;
        if (l == null) return;
        try {
            l.write(b, false);
        } catch (InterruptedException ignored) {
        }
    }

    private static byte[] hex(String s) {
        s = s.toLowerCase(Locale.US);
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return b;
    }

    private void status(String state, String info) {
        hub.emit("ledStatus", Hub.obj("state", state, "info", info == null ? "" : info));
    }
}
