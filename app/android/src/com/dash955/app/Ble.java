package com.dash955.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.os.Build;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Bluetooth Low Energy helpers: a blocking scan, and a GATT link with streams. */
final class Ble {
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    interface Found {
        /** services: advertised 16-bit or 128-bit service ids, comma separated (may be empty). */
        void found(String name, String address, int rssi, String services);
    }

    static String shortId(UUID u) {
        String s = u.toString().toLowerCase();
        if (s.endsWith("-0000-1000-8000-00805f9b34fb") && s.startsWith("0000")) return s.substring(4, 8);
        return s;
    }

    /** Scans for `ms` milliseconds. Blocks the calling (background) thread. */
    static void scan(long ms, final Found cb) throws InterruptedException {
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null || !ad.isEnabled()) return;
        final BluetoothLeScanner sc = ad.getBluetoothLeScanner();
        if (sc == null) return;
        ScanCallback scb = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult r) {
                BluetoothDevice d = r.getDevice();
                String name = r.getScanRecord() != null ? r.getScanRecord().getDeviceName() : null;
                if (name == null) name = d.getName();
                StringBuilder sv = new StringBuilder();
                if (r.getScanRecord() != null && r.getScanRecord().getServiceUuids() != null) {
                    for (android.os.ParcelUuid u : r.getScanRecord().getServiceUuids()) {
                        if (sv.length() > 0) sv.append(',');
                        sv.append(shortId(u.getUuid()));
                    }
                }
                cb.found(name, d.getAddress(), r.getRssi(), sv.toString());
            }
        };
        try {
            sc.startScan(scb);
            Thread.sleep(ms);
        } catch (SecurityException e) {
            // location permission missing: nothing found
        } finally {
            try {
                sc.stopScan(scb);
            } catch (Exception ignored) {
            }
        }
    }

    /** Byte buffer fed by GATT notifications, read like a socket stream. */
    static final class Rx extends InputStream {
        private final byte[] buf = new byte[16384];
        private int r, w, n;
        private boolean closed;

        synchronized void push(byte[] b) {
            if (b == null) return;
            for (byte x : b) {
                if (n == buf.length) break;
                buf[w] = x;
                w = (w + 1) % buf.length;
                n++;
            }
        }

        synchronized void shut() {
            closed = true;
        }

        @Override
        public synchronized int available() throws IOException {
            if (closed && n == 0) throw new IOException("BLE fermé");
            return n;
        }

        @Override
        public synchronized int read() {
            if (n == 0) return -1;
            int v = buf[r] & 0xff;
            r = (r + 1) % buf.length;
            n--;
            return v;
        }

        @Override
        public synchronized int read(byte[] b, int off, int len) {
            if (n == 0) return closed ? -1 : 0;
            int k = Math.min(len, n);
            for (int i = 0; i < k; i++) {
                b[off + i] = buf[r];
                r = (r + 1) % buf.length;
            }
            n -= k;
            return k;
        }
    }

    /**
     * A GATT connection with one notify characteristic (input) and one write
     * characteristic (output). `prefer` lists service/notify/write short ids to
     * try first; otherwise the first service exposing both is used.
     */
    static final class Link {
        final Rx rx = new Rx();
        BluetoothGatt gatt;
        BluetoothGattCharacteristic wr, nt;
        String name;
        private volatile String err;
        private volatile CountDownLatch wlatch;
        private final CountDownLatch ready = new CountDownLatch(1);
        private final boolean needNotify;

        Link(boolean needNotify) {
            this.needNotify = needNotify;
        }

        void open(Context c, String address, final String[][] prefer, long timeoutMs) throws Exception {
            BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
            if (ad == null || !ad.isEnabled()) throw new IOException("Bluetooth désactivé");
            BluetoothDevice d = ad.getRemoteDevice(address);
            name = d.getName() != null ? d.getName() : address;
            BluetoothGattCallback cb = new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt g, int status, int state) {
                    if (state == BluetoothProfile.STATE_CONNECTED) {
                        g.discoverServices();
                    } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                        err = "Bluetooth déconnecté";
                        rx.shut();
                        ready.countDown();
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt g, int status) {
                    pick(g, prefer);
                    if (wr == null || (needNotify && nt == null)) {
                        err = "Service inconnu sur cet appareil";
                        ready.countDown();
                        return;
                    }
                    if (nt == null) {
                        ready.countDown();
                        return;
                    }
                    g.setCharacteristicNotification(nt, true);
                    BluetoothGattDescriptor ds = nt.getDescriptor(CCCD);
                    if (ds == null) {
                        ready.countDown();
                        return;
                    }
                    boolean ind = (nt.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0;
                    ds.setValue(ind ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                            : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    if (!g.writeDescriptor(ds)) ready.countDown();
                }

                @Override
                public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
                    ready.countDown();
                }

                @Override
                public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
                    rx.push(ch.getValue());
                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
                    CountDownLatch l = wlatch;
                    if (l != null) l.countDown();
                }
            };
            if (Build.VERSION.SDK_INT >= 23) gatt = d.connectGatt(c, false, cb, BluetoothDevice.TRANSPORT_LE);
            else gatt = d.connectGatt(c, false, cb);
            if (!ready.await(timeoutMs, TimeUnit.MILLISECONDS)) {
                close();
                throw new IOException("Bluetooth : pas de réponse");
            }
            if (err != null) {
                close();
                throw new IOException(err);
            }
        }

        private void pick(BluetoothGatt g, String[][] prefer) {
            if (prefer != null) {
                for (String[] p : prefer) {
                    for (BluetoothGattService s : g.getServices()) {
                        if (!shortId(s.getUuid()).equals(p[0])) continue;
                        BluetoothGattCharacteristic n = null, w = null;
                        for (BluetoothGattCharacteristic ch : s.getCharacteristics()) {
                            String id = shortId(ch.getUuid());
                            if (p[1] != null && id.equals(p[1])) n = ch;
                            if (id.equals(p[2])) w = ch;
                        }
                        if (w != null && (n != null || p[1] == null)) {
                            nt = n;
                            wr = w;
                            return;
                        }
                    }
                }
            }
            for (BluetoothGattService s : g.getServices()) {
                String sid = shortId(s.getUuid());
                if (sid.equals("1800") || sid.equals("1801") || sid.equals("180a") || sid.equals("180f")) continue;
                BluetoothGattCharacteristic n = null, w = null;
                for (BluetoothGattCharacteristic ch : s.getCharacteristics()) {
                    int pr = ch.getProperties();
                    if (n == null && (pr & (BluetoothGattCharacteristic.PROPERTY_NOTIFY
                            | BluetoothGattCharacteristic.PROPERTY_INDICATE)) != 0) n = ch;
                    if (w == null && (pr & (BluetoothGattCharacteristic.PROPERTY_WRITE
                            | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0) w = ch;
                }
                if (w != null && (n != null || !needNotify)) {
                    nt = n;
                    wr = w;
                    return;
                }
            }
        }

        /** Writes in 20-byte chunks, waiting for each write callback. */
        synchronized boolean write(byte[] b, boolean wait) throws InterruptedException {
            if (gatt == null || wr == null) return false;
            boolean noResp = (wr.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0;
            boolean ok = true;
            for (int off = 0; off < b.length; off += 20) {
                int len = Math.min(20, b.length - off);
                byte[] chunk = new byte[len];
                System.arraycopy(b, off, chunk, 0, len);
                CountDownLatch l = new CountDownLatch(1);
                wlatch = l;
                wr.setValue(chunk);
                wr.setWriteType(noResp ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                        : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                boolean sent = gatt.writeCharacteristic(wr);
                if (!sent) {
                    Thread.sleep(30);
                    sent = gatt.writeCharacteristic(wr);
                }
                ok &= sent;
                if (sent && wait) l.await(800, TimeUnit.MILLISECONDS);
            }
            return ok;
        }

        OutputStream stream() {
            return new OutputStream() {
                @Override
                public void write(int b) throws IOException {
                    write(new byte[]{(byte) b}, 0, 1);
                }

                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    byte[] c = new byte[len];
                    System.arraycopy(b, off, c, 0, len);
                    try {
                        if (!Link.this.write(c, true)) throw new IOException("Écriture Bluetooth refusée");
                    } catch (InterruptedException e) {
                        throw new IOException("interrompu");
                    }
                }
            };
        }

        void close() {
            rx.shut();
            BluetoothGatt g = gatt;
            gatt = null;
            if (g != null) {
                try {
                    g.disconnect();
                } catch (Exception ignored) {
                }
                try {
                    g.close();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
