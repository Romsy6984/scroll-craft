package com.dash955.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * ELM327 OBD-II client. Talks to the adapter over classic Bluetooth (SPP),
 * Bluetooth Low Energy or Wi-Fi, detects it automatically, then polls the
 * standard mode 01 PIDs and pushes decoded values to the UI.
 */
final class Obd {
    static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    static final Pattern OBD_NAME = Pattern.compile(
            "(?i).*(obd|elm|v-?link|vgate|icar|konnwei|viecar|carista|veepeak|kiwi|kw9|vlinker|scan|torque|link|car|rev|king|headz).*");
    /** RevKing (RevKingz) adapters: matched first when several devices answer. */
    static final Pattern REVKING = Pattern.compile("(?i).*(rev|king|headz).*");
    /** BLE services exposed by ELM327-compatible adapters. */
    static final String[] OBD_SERVICES = {"fff0", "ffe0", "18f0", "e7810a71-73ae-499d-8c15-faa9aef0c3f2"};
    static final String WIFI_DEFAULT = "192.168.0.10:35000";
    /** service, notify, write: known BLE adapters first, generic fallback after. */
    static final String[][] BLE_PREF = {
            {"fff0", "fff1", "fff2"},
            {"ffe0", "ffe1", "ffe1"},
            {"18f0", "2af0", "2af1"},
            {"e7810a71-73ae-499d-8c15-faa9aef0c3f2", "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
                    "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f"},
    };

    private final Hub hub;
    private volatile boolean want;
    private volatile String target;
    private volatile Thread worker;
    private volatile InputStream in;
    private volatile OutputStream out;
    private volatile Runnable closer;
    private volatile String linkName = "";
    private volatile boolean reqDtc, reqClear;
    private final Set<Integer> supported = new HashSet<Integer>();
    private boolean can = true;
    private String protoName = "";
    private int timeouts;

    Obd(Hub hub) {
        this.hub = hub;
    }

    /* ------------------------------------------------------------------ API */

    String saved() {
        return hub.prefs().getString("obd", "");
    }

    void forget() {
        hub.prefs().edit().remove("obd").apply();
        disconnect();
    }

    void connect(String spec) {
        target = spec;
        want = true;
        restart();
    }

    /** Automatic connection: the saved adapter, or a new detection if none is saved. */
    boolean auto() {
        return hub.prefs().getBoolean("obdAuto", true);
    }

    void setAuto(boolean on) {
        hub.prefs().edit().putBoolean("obdAuto", on).apply();
        if (on && !want) resume();
    }

    void resume() {
        if (want) return;
        String s = saved();
        if (s.length() > 0) connect(s);
        else if (auto()) connect("auto");
    }

    private volatile boolean sleeping;

    /** Bluetooth just came on or the screen woke up: retry now instead of waiting. */
    void kick() {
        if (!want) {
            if (auto()) resume();
            return;
        }
        if (sleeping && !connected()) restart();
    }

    void disconnect() {
        want = false;
        target = null;
        Thread w = worker;
        worker = null;
        if (w != null) w.interrupt();
        closeLink();
        status("off", "", "");
    }

    void readDtc() {
        reqDtc = true;
    }

    void clearDtc() {
        reqClear = true;
    }

    boolean connected() {
        return in != null;
    }

    /** Paired classic devices, flagged when the name looks like an OBD adapter. */
    String devices() {
        JSONArray a = new JSONArray();
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        try {
            if (ad != null && ad.isEnabled()) {
                for (BluetoothDevice d : ad.getBondedDevices()) {
                    String n = d.getName() == null ? d.getAddress() : d.getName();
                    a.put(Hub.obj("name", n, "addr", d.getAddress(), "kind", "classic", "bonded", true,
                            "obd", OBD_NAME.matcher(n).matches()));
                }
            }
        } catch (SecurityException ignored) {
        }
        return Hub.obj("bt", ad != null && ad.isEnabled(), "has", ad != null, "list", a, "saved", saved()).toString();
    }

    /** Classic discovery then BLE scan; every find is pushed as "obdFound". */
    void scan() {
        new Thread(new Runnable() {
            public void run() {
                final Set<String> seen = new HashSet<String>();
                status("scan", "Recherche des boîtiers…", "");
                try {
                    Ble.scan(7000, new Ble.Found() {
                        public void found(String name, String address, int rssi, String services) {
                            if ((name != null || obdService(services)) && seen.add(address))
                                pushFound(name, address, "ble", rssi, services);
                        }
                    });
                    discoverClassic(9000, new Ble.Found() {
                        public void found(String name, String address, int rssi, String services) {
                            if (seen.add(address)) pushFound(name, address, "classic", rssi, "");
                        }
                    });
                } catch (InterruptedException ignored) {
                }
                hub.emit("obdScanDone", "{}");
                if (!connected()) status(want ? "connecting" : "off", "", "");
            }
        }, "obd-scan").start();
    }

    void pair(String address) {
        try {
            BluetoothDevice d = BluetoothAdapter.getDefaultAdapter().getRemoteDevice(address);
            d.createBond();
        } catch (Exception e) {
            status("error", "", "Appairage impossible : " + e.getMessage());
        }
    }

    /* -------------------------------------------------------------- worker */

    private synchronized void restart() {
        Thread old = worker;
        if (old != null) old.interrupt();
        closeLink();
        Thread t = new Thread(new Runnable() {
            public void run() {
                loop();
            }
        }, "obd");
        worker = t;
        t.start();
    }

    private void loop() {
        Thread me = Thread.currentThread();
        int fails = 0;
        while (want && worker == me) {
            try {
                String spec = target;
                if (spec == null) break;
                if ("auto".equals(spec)) {
                    spec = detect(me);
                    if (spec == null) {
                        status("notfound", "", auto() ? "Aucun boîtier n'a répondu, nouvel essai dans 30 s" : "Aucun boîtier n'a répondu");
                        if (!auto()) {
                            want = false;
                            break;
                        }
                        sleeping = true;
                        try {
                            Thread.sleep(30000);
                        } finally {
                            sleeping = false;
                        }
                        continue;
                    }
                    target = spec;
                } else {
                    open(spec);
                }
                hub.prefs().edit().putString("obd", spec).apply();
                fails = 0;
                poll(me);
            } catch (InterruptedException e) {
                break;
            } catch (Exception e) {
                closeLink();
                if (!want || worker != me) break;
                fails++;
                log("erreur : " + msg(e));
                status("lost", linkName, msg(e));
                sleeping = true;
                try {
                    Thread.sleep(Math.min(20000, 3000L * fails));
                } catch (InterruptedException ie) {
                    break;
                } finally {
                    sleeping = false;
                }
            }
        }
        closeLink();
    }

    private String detect(Thread me) throws InterruptedException {
        status("detect", "", "Recherche d'un boîtier OBD…");
        final List<String> cands = new ArrayList<String>();
        final List<String> bleByName = new ArrayList<String>();
        final List<String> bleRev = new ArrayList<String>();
        final List<String> bleBySvc = new ArrayList<String>();
        final Set<String> seenAdv = new HashSet<String>();
        String last = saved();
        if (last.length() > 0) cands.add(last);
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad != null && ad.isEnabled()) {
            status("detect", "", "Recherche Bluetooth basse consommation (RevKing, iCar, Vgate…)");
            Ble.scan(7000, new Ble.Found() {
                public void found(String name, String address, int rssi, String services) {
                    if (!seenAdv.add(address)) return;
                    String s = "ble|" + address;
                    boolean led = name != null && Led.LED_NAME.matcher(name).matches();
                    log("vu  " + (name == null ? "(sans nom)" : name) + "  " + address + (services.length() > 0 ? "  [" + services + "]" : ""));
                    if (name != null && REVKING.matcher(name).matches()) { if (!bleRev.contains(s)) bleRev.add(s); }
                    else if (name != null && OBD_NAME.matcher(name).matches() && !led) { if (!bleByName.contains(s)) bleByName.add(s); }
                    else if (obdService(services) && !led) { if (!bleBySvc.contains(s)) bleBySvc.add(s); }
                }
            });
            cands.addAll(bleRev);
            cands.addAll(bleByName);
            try {
                for (BluetoothDevice d : ad.getBondedDevices()) {
                    String n = d.getName() == null ? "" : d.getName();
                    if (d.getType() != BluetoothDevice.DEVICE_TYPE_LE && OBD_NAME.matcher(n).matches())
                        cands.add("classic|" + d.getAddress());
                }
            } catch (SecurityException ignored) {
            }
            cands.addAll(bleBySvc);
        } else {
            status("detect", "", "Bluetooth désactivé : essai en Wi-Fi");
        }
        cands.add("wifi|" + WIFI_DEFAULT);
        List<String> uniq = new ArrayList<String>();
        for (String c : cands) if (!uniq.contains(c)) uniq.add(c);
        log("candidats : " + uniq.size());
        for (String c : uniq) {
            if (!want || worker != me) return null;
            try {
                open(c);
                return c;
            } catch (InterruptedException e) {
                throw e;
            } catch (Exception e) {
                closeLink();
                log("échec " + c + " : " + msg(e));
                status("detect", "", "Pas de réponse de " + linkName + " (" + msg(e) + ")");
            }
        }
        return null;
    }

    static boolean obdService(String services) {
        if (services == null || services.length() == 0) return false;
        for (String x : OBD_SERVICES) if (services.contains(x)) return true;
        return false;
    }

    /** One line of the connection journal, shown in the Moteur tab. */
    void log(String line) {
        hub.emit("obdLog", Hub.obj("l", line, "t", System.currentTimeMillis()));
    }

    private void open(String spec) throws Exception {
        String[] p = spec.split("\\|", 2);
        String kind = p[0], addr = p.length > 1 ? p[1] : "";
        linkName = addr;
        status("connecting", addr, "Connexion…");
        if ("classic".equals(kind)) openClassic(addr);
        else if ("ble".equals(kind)) openBle(addr);
        else openWifi(addr.length() > 0 ? addr : WIFI_DEFAULT);
        String id = init();
        status("connected", linkName, id + (protoName.length() > 0 ? " · " + protoName : ""));
        hub.emit("obdSupported", supportedJson());
    }

    private void openClassic(String addr) throws Exception {
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null || !ad.isEnabled()) throw new IOException("Bluetooth désactivé");
        ad.cancelDiscovery();
        BluetoothDevice d = ad.getRemoteDevice(addr);
        linkName = d.getName() != null ? d.getName() : addr;
        IOException last = new IOException("connexion impossible");
        for (int attempt = 0; attempt < 3; attempt++) {
            BluetoothSocket s = null;
            try {
                if (attempt == 0) s = d.createRfcommSocketToServiceRecord(SPP);
                else if (attempt == 1) s = d.createInsecureRfcommSocketToServiceRecord(SPP);
                else s = (BluetoothSocket) d.getClass().getMethod("createRfcommSocket", int.class).invoke(d, 1);
                final BluetoothSocket sock = s;
                closer = new Runnable() {
                    public void run() {
                        try {
                            sock.close();
                        } catch (Exception ignored) {
                        }
                    }
                };
                sock.connect();
                in = sock.getInputStream();
                out = sock.getOutputStream();
                return;
            } catch (IOException e) {
                last = e;
                if (s != null) try {
                    s.close();
                } catch (Exception ignored) {
                }
                if (Thread.interrupted()) throw new InterruptedException();
            }
        }
        throw last;
    }

    private void openBle(String addr) throws Exception {
        final Ble.Link l = new Ble.Link(true);
        closer = new Runnable() {
            public void run() {
                l.close();
            }
        };
        l.open(hub.ctx, addr, BLE_PREF, 15000);
        linkName = l.name;
        in = l.rx;
        out = l.stream();
    }

    private void openWifi(String hostPort) throws Exception {
        String host = hostPort, port = "35000";
        int i = hostPort.lastIndexOf(':');
        if (i > 0) {
            host = hostPort.substring(0, i);
            port = hostPort.substring(i + 1);
        }
        linkName = "Wi-Fi " + host;
        Socket s = null;
        ConnectivityManager cm = (ConnectivityManager) hub.ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        try {
            if (cm != null) {
                for (Network n : cm.getAllNetworks()) {
                    NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                    if (nc != null && nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        s = n.getSocketFactory().createSocket();
                        break;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        if (s == null) s = new Socket();
        final Socket sock = s;
        closer = new Runnable() {
            public void run() {
                try {
                    sock.close();
                } catch (Exception ignored) {
                }
            }
        };
        sock.connect(new InetSocketAddress(host, Integer.parseInt(port)), 3500);
        sock.setTcpNoDelay(true);
        in = sock.getInputStream();
        out = sock.getOutputStream();
    }

    private void closeLink() {
        Runnable c = closer;
        closer = null;
        in = null;
        out = null;
        if (c != null) c.run();
    }

    /* --------------------------------------------------------------- ELM327 */

    private String init() throws Exception {
        logging = true;
        try {
            return doInit();
        } finally {
            logging = false;
        }
    }

    private String doInit() throws Exception {
        log("connexion à " + linkName);
        cmd("ATZ", 4000);
        Thread.sleep(400);
        String v = cmd("ATI", 2500);
        if (v == null || !looksElm(v)) v = cmd("ATI", 2500);
        if (v == null || !looksElm(v)) throw new IOException("ce n'est pas un boîtier ELM327");
        cmd("ATE0", 1500);
        cmd("ATL0", 1500);
        cmd("ATS0", 1500);
        cmd("ATH0", 1500);
        cmd("ATAT1", 1500);
        cmd("ATSP0", 1500);
        supported.clear();
        status("connecting", linkName, "Dialogue avec la voiture…");
        String r = cmd("0100", 12000);
        if (data(r, 0x41, 0x00) == null) r = cmd("0100", 12000);
        int[] d = data(r, 0x41, 0x00);
        if (d == null) {
            String u = r == null ? "" : r;
            throw new IOException(u.contains("UNABLE") || u.contains("NO DATA")
                    ? "la voiture ne répond pas : mets le contact" : "la voiture ne répond pas");
        }
        addSupported(d, 0x00);
        String dp = cmd("ATDPN", 1500);
        if (dp != null) {
            dp = dp.replace("A", "").trim();
            if (dp.length() > 0) {
                char c = dp.charAt(dp.length() - 1);
                can = c >= '6';
                protoName = c >= '6' && c <= '9' ? "CAN" : (c >= 'A' ? "CAN" : "OBD");
            }
        }
        for (int base = 0x20; base <= 0x40; base += 0x20) {
            if (!supported.contains(base)) break;
            int[] e = data(cmd(String.format(Locale.US, "01%02X", base), 2500), 0x41, base);
            if (e == null) break;
            addSupported(e, base);
        }
        return v.trim();
    }

    private static boolean looksElm(String v) {
        String u = v.toUpperCase(Locale.US);
        return u.contains("ELM") || u.contains("STN") || u.contains("OBD") || u.contains("V1.") || u.contains("V2.");
    }

    private void addSupported(int[] d, int base) {
        for (int i = 0; i < 32 && i / 8 < d.length; i++) {
            if ((d[i / 8] & (0x80 >> (i % 8))) != 0) supported.add(base + i + 1);
        }
    }

    private String supportedJson() {
        JSONArray a = new JSONArray();
        for (Integer i : supported) a.put(i);
        return Hub.obj("pids", a, "can", can).toString();
    }

    private boolean logging;

    /** Sends a command, returns the cleaned reply, or null on timeout. */
    private String cmd(String c, long timeoutMs) throws IOException, InterruptedException {
        String r = rawCmd(c, timeoutMs);
        if (logging) log("> " + c + "   " + (r == null ? "(pas de réponse)" : r.replace('\n', ' ')));
        return r;
    }

    private String rawCmd(String c, long timeoutMs) throws IOException, InterruptedException {
        InputStream i = in;
        OutputStream o = out;
        if (i == null || o == null) throw new IOException("liaison fermée");
        byte[] buf = new byte[512];
        while (i.available() > 0) {
            if (i.read(buf, 0, Math.min(buf.length, i.available())) <= 0) break;
        }
        o.write((c + "\r").getBytes("US-ASCII"));
        o.flush();
        StringBuilder sb = new StringBuilder();
        long end = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < end) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
            int n = i.available();
            if (n > 0) {
                int k = i.read(buf, 0, Math.min(n, buf.length));
                for (int j = 0; j < k; j++) {
                    char ch = (char) (buf[j] & 0xff);
                    if (ch == '>') {
                        timeouts = 0;
                        return clean(sb.toString(), c);
                    }
                    sb.append(ch);
                }
            } else {
                Thread.sleep(6);
            }
        }
        timeouts++;
        return null;
    }

    private static String clean(String s, String sent) {
        StringBuilder out = new StringBuilder();
        for (String line : s.split("[\\r\\n]+")) {
            String l = line.trim().toUpperCase(Locale.US);
            if (l.length() == 0 || l.equals(sent.toUpperCase(Locale.US)) || l.startsWith("SEARCHING")
                    || l.startsWith("BUS INIT")) continue;
            if (out.length() > 0) out.append('\n');
            out.append(l);
        }
        return out.toString();
    }

    /** Data bytes following "mode pid" in the first matching reply line. */
    private static int[] data(String r, int mode, int pid) {
        if (r == null) return null;
        String key = String.format(Locale.US, "%02X%02X", mode, pid);
        for (String line : r.split("\n")) {
            String h = line.replaceAll("[^0-9A-F]", "");
            int at = h.indexOf(key);
            if (at < 0) continue;
            String rest = h.substring(at + 4);
            int[] d = new int[rest.length() / 2];
            for (int k = 0; k < d.length; k++) d[k] = Integer.parseInt(rest.substring(k * 2, k * 2 + 2), 16);
            return d;
        }
        return null;
    }

    /* ----------------------------------------------------------------- poll */

    private void poll(Thread me) throws Exception {
        int[] fast = {0x0C, 0x0D, 0x04, 0x0B, 0x10, 0x11, 0x5E};
        int[] slow = {0x05, 0x0F, 0x33, 0x46, 0x5C, 0x2F, 0x01, 0x42, 0x23, 0x2C};
        int cycle = 0, silent = 0;
        boolean asleep = false;
        timeouts = 0;
        while (want && worker == me) {
            if (reqDtc) {
                reqDtc = false;
                doReadDtc();
            }
            if (reqClear) {
                reqClear = false;
                doClearDtc();
            }
            JSONObject o = new JSONObject();
            int got = 0;
            for (int pid : fast) if (supported.contains(pid)) got += query(pid, o);
            if (cycle % 8 == 0) {
                for (int pid : slow) if (supported.contains(pid)) got += query(pid, o);
                String rv = cmd("ATRV", 1500);
                if (rv != null) {
                    try {
                        o.put("volt", Double.parseDouble(rv.replaceAll("[^0-9.]", "")));
                    } catch (Exception ignored) {
                    }
                }
            }
            if (timeouts > 6) throw new IOException("le boîtier ne répond plus");
            silent = got == 0 ? silent + 1 : 0;
            if (silent > 6 && !asleep) {
                asleep = true;
                status("sleep", linkName, "Contact coupé : la voiture ne répond plus");
            } else if (got > 0 && asleep) {
                asleep = false;
                status("connected", linkName, protoName);
            }
            o.put("t", System.currentTimeMillis());
            hub.emit("obd", o);
            cycle++;
            if (asleep) Thread.sleep(2000);
        }
    }

    private int query(int pid, JSONObject o) throws Exception {
        int[] d = data(cmd(String.format(Locale.US, "01%02X", pid), 1200), 0x41, pid);
        if (d == null || d.length == 0) return 0;
        int a = d[0], b = d.length > 1 ? d[1] : 0;
        switch (pid) {
            case 0x0C: o.put("rpm", ((a * 256) + b) / 4.0); break;
            case 0x0D: o.put("spd", a); break;
            case 0x04: o.put("load", a * 100.0 / 255); break;
            case 0x05: o.put("ect", a - 40); break;
            case 0x0B: o.put("map", a); break;
            case 0x0F: o.put("iat", a - 40); break;
            case 0x10: o.put("maf", ((a * 256) + b) / 100.0); break;
            case 0x11: o.put("tps", a * 100.0 / 255); break;
            case 0x33: o.put("baro", a); break;
            case 0x46: o.put("amb", a - 40); break;
            case 0x5C: o.put("oil", a - 40); break;
            case 0x2F: o.put("fuel", a * 100.0 / 255); break;
            case 0x42: o.put("cmv", ((a * 256) + b) / 1000.0); break;
            case 0x23: o.put("rail", ((a * 256) + b) * 10); break;
            case 0x5E: o.put("fuelRate", ((a * 256) + b) / 20.0); break;
            case 0x2C: o.put("egr", a * 100.0 / 255); break;
            case 0x01:
                o.put("mil", (a & 0x80) != 0);
                o.put("dtcCount", a & 0x7F);
                break;
            default: return 0;
        }
        return 1;
    }

    private void doReadDtc() throws Exception {
        String r = cmd("03", 5000);
        List<String> codes = new ArrayList<String>();
        if (r != null) {
            StringBuilder hex = new StringBuilder();
            boolean multi = false;
            for (String line : r.split("\n")) {
                String l = line.replaceAll("\\s", "");
                if (l.matches("^[0-9A-F]{3}$")) {
                    multi = true;
                    continue;
                }
                if (l.matches("^[0-9A-F]:.*")) {
                    multi = true;
                    l = l.substring(2);
                }
                l = l.replaceAll("[^0-9A-F]", "");
                if (!multi && !can && l.startsWith("43")) l = l.substring(2);
                hex.append(l);
            }
            String h = hex.toString();
            if (can || multi) {
                int at = h.indexOf("43");
                if (at >= 0) h = h.substring(at + 2 + 2);
            }
            for (int k = 0; k + 4 <= h.length(); k += 4) {
                String pair = h.substring(k, k + 4);
                if (pair.equals("0000")) continue;
                int a = Integer.parseInt(pair.substring(0, 2), 16);
                char letter = "PCBU".charAt((a >> 6) & 3);
                codes.add(letter + Integer.toString((a >> 4) & 3) + pair.substring(1));
            }
        }
        Map<String, Boolean> uniq = new LinkedHashMap<String, Boolean>();
        for (String c : codes) uniq.put(c, true);
        JSONArray a = new JSONArray();
        for (String c : uniq.keySet()) a.put(c);
        hub.emit("dtc", Hub.obj("codes", a, "ok", r != null));
    }

    private void doClearDtc() throws Exception {
        String r = cmd("04", 6000);
        hub.emit("dtcCleared", Hub.obj("ok", r != null && r.contains("44")));
        doReadDtc();
    }

    /* -------------------------------------------------------------- helpers */

    private void discoverClassic(long ms, final Ble.Found cb) throws InterruptedException {
        final BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null || !ad.isEnabled()) return;
        BroadcastReceiver rcv = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                BluetoothDevice d = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (d == null) return;
                int type = d.getType();
                if (type == BluetoothDevice.DEVICE_TYPE_LE) return;
                short rssi = i.getShortExtra(BluetoothDevice.EXTRA_RSSI, (short) 0);
                cb.found(d.getName(), d.getAddress(), rssi, "");
            }
        };
        hub.ctx.registerReceiver(rcv, new IntentFilter(BluetoothDevice.ACTION_FOUND));
        try {
            ad.startDiscovery();
            Thread.sleep(ms);
        } catch (SecurityException ignored) {
        } finally {
            try {
                ad.cancelDiscovery();
            } catch (Exception ignored) {
            }
            hub.ctx.unregisterReceiver(rcv);
        }
    }

    private void pushFound(String name, String address, String kind, int rssi, String services) {
        boolean bonded = false;
        try {
            BluetoothDevice d = BluetoothAdapter.getDefaultAdapter().getRemoteDevice(address);
            bonded = d.getBondState() == BluetoothDevice.BOND_BONDED;
        } catch (Exception ignored) {
        }
        String n = name == null ? "Appareil sans nom" : name;
        boolean obd = OBD_NAME.matcher(n).matches() || obdService(services);
        hub.emit("obdFound", Hub.obj("name", n, "addr", address, "kind", kind, "rssi", rssi,
                "bonded", bonded, "obd", obd, "rev", REVKING.matcher(n).matches(), "svc", services));
    }

    private void status(String state, String label, String info) {
        hub.emit("obdStatus", Hub.obj("state", state, "label", label == null ? "" : label,
                "info", info == null ? "" : info, "target", target == null ? "" : target));
    }

    private static String msg(Exception e) {
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }
}
