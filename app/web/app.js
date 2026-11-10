/* ==========================================================================
   Dash 955 · application pour Alfa Romeo MiTo 2009
   Interface commune à l'APK Android (pont natif window.DashNative) et à la
   version web (GPS du navigateur seulement).
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------ outils -- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const nf = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pad = (n) => String(n).padStart(2, '0');
  const now = () => Date.now();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = (t) => { const d = t ? new Date(t) : new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dur = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + pad(m) : m + ' min'; };
  const dayLabel = (t) => {
    const d = new Date(t), today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === y.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  function haversine(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const hexRgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };

  /* ------------------------------------------------------- pont natif -- */
  const N = window.DashNative || null;
  const NATIVE = !!N;
  const call = (fn, ...a) => { try { return N && typeof N[fn] === 'function' ? N[fn](...a) : undefined; } catch (e) { console.warn(fn, e); return undefined; } };
  let INFO = {};
  try { INFO = NATIVE ? JSON.parse(call('info') || '{}') : {}; } catch (e) { INFO = {}; }

  /* ------------------------------------------------------------ icônes -- */
  const IC = {
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    engine: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l-3.4-4.4"/><path d="M12 8v1.2M7 10l.8.8M17 10l-.8.8"/><path d="M8.5 19.5h7"/>',
    trips: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4.5V8h3.5"/><path d="M12 8v4l2.6 2"/>',
    route: '<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    led: '<path d="M4.5 16h15"/><path d="M8 16a4 4 0 0 1 8 0"/><path d="M12 5.5v2.5M6.4 8l1.7 1.7M17.6 8l-1.7 1.7M3.5 12.5h2M18.5 12.5h2"/>',
    service: '<circle cx="8" cy="15.5" r="4"/><path d="M10.9 12.6 19.5 4M15.8 7.7l2.6 2.6M13.6 9.9l2 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sport: '<path d="M13 3 5 13.5h6L10 21l9-11h-6z"/>',
    conso: '<path d="M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z"/>',
    g: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="14.6" cy="9.8" r="1.4" fill="currentColor"/>',
    signals: '<path d="M10.5 5.5 4 12l6.5 6.5V15H20V9h-9.5z"/>',
    battery: '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2.2"/><path d="M7.5 7.5V5.5h2v2M14.5 7.5V5.5h2v2M7 13.2h3M15.5 11.7v3M14 13.2h3"/>',
    cold: '<path d="M4 10h2.5l1.5-2h6l1.5 2H18v2.5h2V10h1v6h-1v-2.5h-2V17h-3l-1.5 1.5h-5L7 17H4z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
    mount: '<path d="M3 19 9.5 8l3.5 6 2-3 6 8z"/>',
    city: '<path d="M4 20V9l5-3v14M9 20V4h7v16M16 20v-9l4 2v7M3 20h18"/>',
    fuel: '<path d="M5 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h11M7.5 9h4"/><path d="M14 10h1.8a1.7 1.7 0 0 1 1.7 1.7v4.5a1.5 1.5 0 0 0 3 0V9.5L18 7"/>',
    music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    prev: '<path d="M18 6v12L9 12zM6 6v12"/>', next: '<path d="M6 6v12l9-6zM18 6v12"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>', pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    bt: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>', wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    carplay: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2.2"/><path d="M9 20h6M12 16v4"/>',
    car: '<path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><path d="M6 17v2M18 17v2"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    locate: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/>',
    star: '<path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8 6.6 19.7l1.2-5.9L3.4 9.7l6-.7z"/>',
    work: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
    vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
    msg: '<path d="M4 5.5h16v10H9l-5 4z"/>',
    back: '<path d="M9 5.5h11v13H9l-5.5-6.5z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>',
  };
  const icon = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || '') + '</svg>';

  /* ---------------------------------------------------------- données -- */
  const ENGINES = {
    '14-78':      { name: '1.4 · 78 ch',              cc: 1368, diesel: false, turbo: false, tq: 115, belt: true },
    '14tb-120':   { name: '1.4 TB · 120 ch',          cc: 1368, diesel: false, turbo: true,  tq: 206, belt: true },
    '14tb-155':   { name: '1.4 TB · 155 ch',          cc: 1368, diesel: false, turbo: true,  tq: 230, belt: true },
    '14ma-105':   { name: '1.4 MultiAir · 105 ch',    cc: 1368, diesel: false, turbo: false, tq: 130, belt: true },
    '14ma-135':   { name: '1.4 MultiAir TB · 135 ch', cc: 1368, diesel: false, turbo: true,  tq: 206, belt: true },
    '13jtdm-90':  { name: '1.3 JTDM · 90 ch',         cc: 1248, diesel: true,  turbo: true,  tq: 200, belt: false },
    '16jtdm-120': { name: '1.6 JTDM · 120 ch',        cc: 1598, diesel: true,  turbo: true,  tq: 320, belt: true },
  };
  const FUELS = { 'SP95-E10': 'e10_prix', 'SP95': 'sp95_prix', 'SP98': 'sp98_prix', 'Gazole': 'gazole_prix' };
  const THEMES = [
    { id: 'nuit',      name: 'Nuit',       layout: 'digital', bg: '#0b0c0e', fg: '#f1efea', soft: '#8f8c86', card: '#17191c', card2: '#202226', acc: '#ece8e1', ink: '#0b0c0e' },
    { id: 'rosso',     name: 'Rosso',      layout: 'digital', bg: '#130909', fg: '#f6eeec', soft: '#a58e8a', card: '#211211', card2: '#2c1817', acc: '#ff3b2f', ink: '#ffffff' },
    { id: 'analog',    name: 'Analogique', layout: 'analog',  bg: '#0a0a0b', fg: '#f4f4f2', soft: '#8b8b88', card: '#161617', card2: '#1f1f21', acc: '#f4f4f2', ink: '#0a0a0b' },
    { id: 'corsa',     name: 'Corsa',      layout: 'analog',  bg: '#0d0d10', fg: '#f2f0ee', soft: '#8f8c92', card: '#18181d', card2: '#212128', acc: '#ff5a2a', ink: '#ffffff' },
    { id: 'carbone',   name: 'Carbone',    layout: 'cards',   bg: '#101113', fg: '#eceae6', soft: '#8d8b87', card: '#1d1e21', card2: '#26282c', acc: '#c9c6c0', ink: '#101113' },
    { id: 'minimal',   name: 'Minimal',    layout: 'min',     bg: '#08080a', fg: '#f3f3f1', soft: '#7d7d7a', card: '#141416', card2: '#1c1c1f', acc: '#f3f3f1', ink: '#08080a' },
    { id: 'glace',     name: 'Glace',      layout: 'min',     bg: '#081018', fg: '#eaf5ff', soft: '#8199ad', card: '#0f1b26', card2: '#162534', acc: '#9ad7ff', ink: '#081018' },
    { id: 'ambre',     name: 'Ambre LCD',  layout: 'digital', bg: '#0d0a05', fg: '#ffb347', soft: '#a17836', card: '#18120a', card2: '#21190e', acc: '#ffb347', ink: '#0d0a05' },
    { id: 'jour',      name: 'Jour',       layout: 'cards',   bg: '#ebe9e4', fg: '#151515', soft: '#5d5b56', card: '#ffffff', card2: '#f1efea', acc: '#cf271e', ink: '#ffffff', light: true },
    { id: 'ardoise',   name: 'Ardoise',    layout: 'cards',   bg: '#141a21', fg: '#e9eef3', soft: '#8897a6', card: '#1e2731', card2: '#27323e', acc: '#8fb3d9', ink: '#141a21' },
    { id: 'tunnel',    name: 'Tunnel',     layout: 'min',     bg: '#060607', fg: '#a8a59f', soft: '#62605b', card: '#0f0f11', card2: '#161618', acc: '#c9463d', ink: '#ffffff' },
    { id: 'circuit',   name: 'Circuit',    layout: 'analog',  bg: '#0e0f0a', fg: '#f3f3ea', soft: '#909181', card: '#1a1b14', card2: '#23241b', acc: '#e8d23a', ink: '#0e0f0a' },
    { id: 'brume',     name: 'Brume',      layout: 'digital', bg: '#d8dadc', fg: '#16181b', soft: '#565a60', card: '#eef0f2', card2: '#e3e6e9', acc: '#2d6fd6', ink: '#ffffff', light: true },
    { id: 'ronaldo',   name: 'Ronaldo',    layout: 'cr7',     bg: '#0a0a0a', fg: '#ffffff', soft: '#9a9a9a', card: '#141414', card2: '#1d1d1d', acc: '#e4002b', ink: '#ffffff' },
  ];
  const ZFE = [
    ['Grand Paris', 48.8566, 2.3522, 13], ['Lyon', 45.764, 4.8357, 7], ['Grenoble', 45.1885, 5.7245, 7],
    ['Strasbourg', 48.5734, 7.7521, 7], ['Montpellier', 43.6108, 3.8767, 7], ['Toulouse', 43.6047, 1.4442, 7],
    ['Aix-Marseille', 43.2965, 5.3698, 7], ['Nice', 43.7102, 7.262, 6], ['Rouen', 49.4432, 1.0999, 6],
    ['Reims', 49.2583, 4.0317, 5], ['Saint-Étienne', 45.4397, 4.3872, 5],
  ];
  const LED_COLORS = ['#ff3b2f', '#ff8a3d', '#ffd23f', '#3ccf6e', '#38bdf8', '#3b5bff', '#b14dff', '#ffffff'];

  function presetService(engId) {
    const e = ENGINES[engId] || ENGINES['14tb-155'];
    return [
      { id: 'vidange', name: 'Vidange + filtre à huile', km: 15000, months: 12 },
      e.belt ? { id: 'courroie', name: 'Courroie de distribution', km: 90000, months: 72 } : null,
      { id: 'ct', name: 'Contrôle technique', km: 0, months: 24 },
      { id: 'freins', name: 'Liquide de frein', km: 0, months: 24 },
      { id: 'assurance', name: 'Assurance', km: 0, months: 12 },
    ].filter(Boolean).map((x) => Object.assign(x, { lastKm: null, lastDate: null }));
  }

  /* ------------------------------------------------------------ store -- */
  const DEF = {
    v: 1, engine: '16jtdm-120', fuelType: 'Gazole', fuelPrice: 1.75, critair: '3', theme: 'nuit', onboarded: false,
    carplay: { pkg: '', label: '' }, odo: { base: null, atKm: 0 }, kmTotal: 0, trips: [], cur: null,
    service: presetService('16jtdm-120'),
    led: { mode: 'color', color: '#ff3b2f', bright: 80, on: true }, sportLed: true, demo: false, seen: {}, fuelCal: 100,
  };
  let S = load();
  function load() {
    let raw = '';
    try { raw = (NATIVE && call('load')) || localStorage.getItem('dash955') || ''; } catch (e) { raw = ''; }
    let o = {};
    try { o = raw ? JSON.parse(raw) : {}; } catch (e) { o = {}; }
    const s = Object.assign(JSON.parse(JSON.stringify(DEF)), o);
    s.led = Object.assign({}, DEF.led, o.led || {});
    s.odo = Object.assign({}, DEF.odo, o.odo || {});
    s.carplay = Object.assign({}, DEF.carplay, o.carplay || {});
    return s;
  }
  let saveTimer = 0;
  function save(now_) {
    clearTimeout(saveTimer);
    const run = () => {
      const json = JSON.stringify(S);
      try { localStorage.setItem('dash955', json); } catch (e) {}
      if (NATIVE) call('save', json);
    };
    if (now_) run(); else saveTimer = setTimeout(run, 400);
  }
  const engine = () => ENGINES[S.engine] || ENGINES['14tb-155'];
  const theme = () => THEMES.find((t) => t.id === S.theme) || THEMES[0];

  /* ------------------------------------------------------- état direct -- */
  const L = {
    gps: { t: 0 }, gpsErr: '', o: {}, oT: 0, obd: { state: NATIVE ? 'off' : 'web', label: '', info: '' }, pids: [],
    media: { none: true }, led: { state: 'off', info: '' }, weather: null, limit: null, stations: null, stationsT: 0, stationsErr: '',
    speed: 0, speedSrc: '', accel: 0, latG: 0, fuelRate: null, dtc: null, demo: false, found: [], ledFound: [],
  };
  let lastSpeed = null, lastBrg = null;
  /* displayed values, eased every frame so numbers and needles glide */
  const SM = { speed: 0, rpm: 0, accel: 0, latG: 0, boost: 0, tq: 0, ect: 40, rail: 0 };
  L.log = [];

  function onSpeedSample(v, t) {
    if (lastSpeed && t > lastSpeed.t) {
      const dt = (t - lastSpeed.t) / 1000;
      if (dt > 0.05 && dt < 5) {
        const a = (v - lastSpeed.v) / 3.6 / dt;
        L.accel = L.accel * 0.6 + clamp(a, -12, 12) * 0.4;
      }
    }
    lastSpeed = { v, t };
  }

  /* --------------------------------------------------- événements natifs -- */
  const H = {
    gps(d) {
      if (d.error) { L.gpsErr = d.error; return; }
      if (d.provider) return;
      L.gpsErr = '';
      const prev = L.gps;
      L.gps = { lat: d.lat, lon: d.lon, spd: d.spd, brg: d.brg, acc: d.acc, alt: d.alt, t: d.stale ? 0 : now(), fix: d.t };
      if (!obdFresh() && d.spd >= 0 && !d.stale) onSpeedSample(d.spd * 3.6, now());
      if (d.brg >= 0 && d.spd > 3 && prev && prev.brg >= 0 && prev.t) {
        let db = d.brg - prev.brg; if (db > 180) db -= 360; if (db < -180) db += 360;
        const dt = (now() - prev.t) / 1000;
        if (dt > 0.3 && dt < 4) L.latG = L.latG * 0.5 + clamp(d.spd * (db * Math.PI / 180) / dt / 9.81, -1.5, 1.5) * 0.5;
      } else if (d.spd >= 0 && d.spd < 2) L.latG *= 0.5;
      netTick();
    },
    obd(d) {
      Object.assign(L.o, d);
      L.oT = now();
      if (d.spd != null) onSpeedSample(d.spd, now());
    },
    obdStatus(d) {
      L.obd = d;
      if (d.state === 'connected') { toast('Boîtier OBD connecté'); keepAlive(); }
      if (d.state === 'notfound' && L.userDetect) { toast('Aucun boîtier trouvé'); L.userDetect = false; }
      if (d.state === 'off' || d.state === 'lost') keepAlive();
      refreshIf(['engine', 'home']);
      renderStatus();
    },
    obdSupported(d) { L.pids = d.pids || []; refreshIf(['engine']); },
    obdLog(d) {
      L.log.push(hhmm(d.t) + '  ' + d.l);
      if (L.log.length > 120) L.log.splice(0, L.log.length - 120);
      const el = $('[data-log]');
      if (el) { el.textContent = L.log.slice(-40).join('\n'); el.scrollTop = el.scrollHeight; }
    },
    obdFound(d) { if (!L.found.some((x) => x.addr === d.addr)) L.found.push(d); if (sheetKind === 'devices') renderDevices(); else if (sheetKind === 'revking') renderRevking(); },
    obdScanDone() { L.scanning = false; if (sheetKind === 'devices') renderDevices(); else if (sheetKind === 'revking') renderRevking(); },
    dtc(d) { L.dtc = d.codes || []; refreshIf(['engine']); },
    dtcCleared(d) { toast(d.ok ? 'Codes effacés' : "Effacement refusé (moteur tournant ?)"); },
    media(d) {
      const art = d.art !== undefined ? d.art : L.media.art;
      L.media = Object.assign({}, d, { art, rx: now() });
      updateMusic();
    },
    ledStatus(d) { L.led = d; if (d.state === 'connected') { toast('LED connectées'); ledApply(true); } refreshIf(['led']); renderStatus(); },
    ledFound(d) { if (!L.ledFound.some((x) => x.addr === d.addr)) L.ledFound.push(d); if (sheetKind === 'leds') renderLedList(); },
    ledScanDone() { L.ledScanning = false; if (sheetKind === 'leds') renderLedList(); },
    perm(d) { if (!d.location) toast('Localisation refusée : pas de vitesse GPS'); },
    resume() {
      if (!NATIVE) return;
      try { INFO = JSON.parse(call('info') || '{}'); } catch (e) {}
      APPS = null;
      call('mediaRefresh');
      call('obdResume');
      renderCar();
      if (panelKind && $('#sheet').hidden) render();
      if (map) setTimeout(() => map.invalidateSize(), 200);
    },
    appIcon(d) {
      ICON_CACHE[d.pkg] = d.icon;
      $$(`[data-appic="${d.pkg}"]`).forEach((el) => { el.style.backgroundImage = `url('${d.icon}')`; el.textContent = ''; });
    },
    back() {
      if (!$('#sheet').hidden) return closeSheet();
      if (panelKind) return closePanel();
      if (dest) { dest = null; if (destMk && map) map.removeLayer(destMk); renderDest(); return; }
    },
  };
  window.Dash = { onNative(ev, data) { try { H[ev] && H[ev](data || {}); } catch (e) { console.error(ev, e); } }, state: () => ({ S, L }) };

  /* ----------------------------------------------------- calculs moteur -- */
  const obdOn = () => L.obd.state === 'connected' || L.demo;
  const obdFresh = () => obdOn() && now() - L.oT < 3000;

  function fuelRate() {
    const r = fuelRateRaw();
    return r == null ? null : r * ((S.fuelCal || 100) / 100);
  }
  function fuelRateRaw() {
    const o = L.o, e = engine();
    if (!obdFresh()) return null;
    if (o.fuelRate != null) return o.fuelRate;
    let maf = o.maf;
    if (maf == null && o.map != null && o.rpm != null) {
      const T = (o.iat != null ? o.iat : 20) + 273.15;
      const ve = e.turbo ? 0.85 : 0.8;
      maf = (o.map * 1000 * (e.cc / 1e6) * ve * (o.rpm / 120)) / (287.05 * T) * 1000;
    }
    if (maf == null) return null;
    if (e.diesel) {
      const afr = 14.5 / clamp(((o.load || 20) / 100) * 0.95, 0.22, 0.95);
      return (maf * 3600) / (afr * 832);
    }
    let r = (maf * 3600) / (14.7 * 745);
    if ((o.load || 0) < 14 && (o.rpm || 0) > 1300 && L.accel < -0.3) r *= 0.1;
    return r;
  }
  const torque = () => {
    const o = L.o, e = engine();
    if (o.load == null || o.rpm == null) return null;
    const curve = e.turbo ? clamp((o.rpm - 900) / 1300, 0, 1) * 0.9 + 0.1 : clamp((o.rpm - 700) / 3300, 0, 1) * 0.85 + 0.15;
    return e.tq * (o.load / 100) * curve;
  };
  const boost = () => (L.o.map != null && engine().turbo ? (L.o.map - (L.o.baro || 101)) / 100 : null);
  const outsideTemp = () => (obdFresh() && L.o.amb != null ? L.o.amb : L.weather ? L.weather.temp : null);
  const odoNow = () => (S.odo.base == null ? null : S.odo.base + (S.kmTotal + (S.cur ? S.cur.dist : 0) - S.odo.atKm));
  const price = () => {
    const st = L.stations && L.stations[0];
    return S.priceFromStation && st ? st.price : S.fuelPrice;
  };

  /* --------------------------------------------------------- trajets -- */
  let startAcc = 0, idleAcc = 0, lastPt = 0, lastPersist = 0;
  function tripTick(dt) {
    const v = L.speed;
    if (!S.cur) {
      startAcc = v > 8 ? startAcc + dt : 0;
      if (startAcc > 4) startTrip();
      return;
    }
    const c = S.cur;
    c.dur += dt;
    c.dist += (v * dt) / 3600;
    c.max = Math.max(c.max, v);
    if (L.fuelRate != null) { c.fuel += (L.fuelRate * dt) / 3600; c.hasFuel = true; }
    c.maxLat = Math.max(c.maxLat, Math.abs(L.latG));
    c.maxBrk = Math.max(c.maxBrk, -L.accel / 9.81);
    c.upd = now();
    const g = L.gps;
    if (g.t && now() - g.t < 4000 && now() - lastPt > 4000) {
      const p = [+g.lat.toFixed(5), +g.lon.toFixed(5), Math.round(v)];
      const lp = c.pts[c.pts.length - 1];
      if (!lp || haversine(lp, p) > 15) { c.pts.push(p); lastPt = now(); }
    }
    idleAcc = v < 2 ? idleAcc + dt : 0;
    if (idleAcc > 240) endTrip();
    else if (now() - lastPersist > 15000) { lastPersist = now(); save(); }
  }
  function startTrip() {
    S.cur = { start: now(), dur: 0, dist: 0, max: 0, fuel: 0, hasFuel: false, maxLat: 0, maxBrk: 0, pts: [], upd: now(), engine: S.engine };
    idleAcc = 0; save(); keepAlive();
  }
  function endTrip() {
    const c = S.cur;
    S.cur = null;
    if (c && c.dist >= 0.2) {
      if (c.pts.length > 400) { const k = Math.ceil(c.pts.length / 400); c.pts = c.pts.filter((_, i) => i % k === 0 || i === c.pts.length - 1); }
      c.end = now();
      c.price = price();
      S.trips.unshift(c);
      if (S.trips.length > 300) S.trips.length = 300;
      S.kmTotal += c.dist;
      toast('Trajet enregistré : ' + nf(c.dist, 1) + ' km');
    }
    save(true); keepAlive(); refreshIf(['trips', 'home']);
  }
  if (S.cur && now() - (S.cur.upd || 0) > 10 * 60000) endTrip();
  function keepAlive() { if (NATIVE) call('keepAlive', !!(S.cur || L.obd.state === 'connected')); }

  /* ------------------------------------------------------------ réseau -- */
  let netState = { wT: 0, lT: 0, lPos: null, busyL: false };
  function fetchJson(url, opt, ms = 9000) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), ms);
    return fetch(url, Object.assign({ signal: ctl ? ctl.signal : undefined }, opt || {}))
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(() => clearTimeout(to));
  }
  function netTick() {
    const g = L.gps;
    if (!g.lat) return;
    if (navigator.onLine === false) return;
    if (now() - netState.wT > 15 * 60000) {
      netState.wT = now();
      fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat.toFixed(3)}&longitude=${g.lon.toFixed(3)}&current=temperature_2m`)
        .then((j) => { if (j.current) L.weather = { temp: Math.round(j.current.temperature_2m), t: now() }; })
        .catch(() => { netState.wT = now() - 13 * 60000; });
    }
    const moved = !netState.lPos || haversine(netState.lPos, [g.lat, g.lon]) > 120;
    if (!netState.busyL && moved && now() - netState.lT > 15000) fetchLimit(g.lat, g.lon);
  }
  function parseLimit(v) {
    if (!v) return null;
    const m = { 'FR:URBAN': 50, 'FR:RURAL': 80, 'FR:MOTORWAY': 130, 'FR:ZONE30': 30, 'FR:WALK': 6, 'FR:TRUNK': 110 }[String(v).toUpperCase()];
    if (m) return m;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }
  function fetchLimit(lat, lon) {
    netState.busyL = true; netState.lT = now(); netState.lPos = [lat, lon];
    const q = `[out:json][timeout:8];way(around:25,${lat.toFixed(5)},${lon.toFixed(5)})[highway][highway!~"footway|cycleway|path|steps|pedestrian|track"];out tags;`;
    fetchJson('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 10000)
      .then((j) => {
        const ways = (j.elements || []).filter((w) => w.tags);
        let lim = null;
        for (const w of ways) { lim = parseLimit(w.tags.maxspeed) || parseLimit(w.tags['maxspeed:forward']); if (lim) break; }
        L.limit = lim ? { v: lim, t: now(), road: ways[0] && (ways[0].tags.ref || ways[0].tags.name) } : { v: null, t: now() };
      })
      .catch(() => {})
      .finally(() => { netState.busyL = false; });
  }
  function fetchStations(force) {
    const g = L.gps;
    if (!g.lat) { L.stationsErr = 'Position GPS inconnue'; refreshIf(['route']); return; }
    if (!force && L.stations && now() - L.stationsT < 20 * 60000) return;
    L.stationsErr = 'Recherche…'; refreshIf(['route']);
    const field = FUELS[S.fuelType] || 'e10_prix';
    const where = `within_distance(geom, geom'POINT(${g.lon.toFixed(5)} ${g.lat.toFixed(5)})', 10km)`;
    const url = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=60&where=' + encodeURIComponent(where);
    fetchJson(url, null, 12000).then((j) => {
      const list = (j.results || []).map((r) => {
        const geo = r.geom || {};
        const lat = geo.lat != null ? geo.lat : r.latitude / 100000, lon = geo.lon != null ? geo.lon : r.longitude / 100000;
        const p = r[field];
        return { name: [r.adresse, r.ville].filter(Boolean).join(', ') || 'Station', price: typeof p === 'number' ? p : parseFloat(p), dist: haversine([g.lat, g.lon], [lat, lon]) / 1000, maj: r[field.replace('_prix', '_maj')], lat, lon };
      }).filter((s) => s.price > 0.5).sort((a, b) => a.price - b.price || a.dist - b.dist).slice(0, 10);
      L.stations = list; L.stationsT = now(); L.stationsErr = list.length ? '' : 'Aucune station avec du ' + S.fuelType + ' à moins de 10 km';
      refreshIf(['route', 'home']);
    }).catch(() => { L.stationsErr = 'Pas de connexion internet, ou service des prix indisponible'; refreshIf(['route']); });
  }

  /* ------------------------------------------------------------ alertes -- */
  function alerts() {
    const out = [];
    const t = outsideTemp();
    if (t != null && t <= 3) out.push({ hot: true, ic: 'snow', text: 'Risque de verglas : ' + t + ' °C dehors' });
    if (obdFresh() && L.o.ect != null && L.o.ect < 70) out.push({ hot: true, ic: 'cold', text: 'Moteur froid (' + Math.round(L.o.ect) + ' °C) : pas de hauts régimes' });
    if (L.o.mil && obdFresh()) out.push({ hot: true, ic: 'warn', text: 'Voyant moteur allumé : lis les codes dans Moteur' });
    const z = nearestZfe();
    if (z && z.d < z.r + 3) out.push({ hot: z.d < z.r, ic: 'city', text: 'ZFE ' + z.name + (z.d < z.r ? ' : tu es dans la zone' : ' à ' + nf(z.d - z.r, 0) + ' km') + ' · vignette Crit\'Air ' + S.critair });
    const m = new Date().getMonth();
    if (m >= 10 || m <= 2) out.push({ hot: false, ic: 'mount', text: 'Loi Montagne : pneus hiver ou chaînes à bord dans les communes signalées (1er nov. au 31 mars)' });
    const due = serviceDue().filter((x) => x.level > 0);
    if (due.length) out.push({ hot: due[0].level > 1, ic: 'service', text: due[0].name + ' : ' + due[0].label });
    return out;
  }
  function nearestZfe() {
    const g = L.gps; if (!g.lat) return null;
    let best = null;
    for (const z of ZFE) { const d = haversine([g.lat, g.lon], [z[1], z[2]]) / 1000; if (!best || d - z[3] < best.d - best.r) best = { name: z[0], d, r: z[3] }; }
    return best;
  }

  /* ---------------------------------------------------------- entretien -- */
  function serviceDue() {
    const odo = odoNow();
    return S.service.map((x) => {
      let kmLeft = null, daysLeft = null;
      if (x.km && x.lastKm != null && odo != null) kmLeft = x.lastKm + x.km - odo;
      if (x.months && x.lastDate) { const d = new Date(x.lastDate); d.setMonth(d.getMonth() + x.months); daysLeft = Math.round((d - new Date()) / 86400000); }
      let level = 0, label = 'À renseigner';
      const parts = [];
      if (kmLeft != null) parts.push(kmLeft < 0 ? 'dépassée de ' + nf(-kmLeft) + ' km' : 'dans ' + nf(kmLeft) + ' km');
      if (daysLeft != null) parts.push(daysLeft < 0 ? 'en retard de ' + nf(-daysLeft) + ' j' : daysLeft < 60 ? 'dans ' + daysLeft + ' j' : 'avant le ' + new Date(Date.now() + daysLeft * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }));
      if (parts.length) label = parts.join(' · ');
      if ((kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0)) level = 2;
      else if ((kmLeft != null && kmLeft < 1000) || (daysLeft != null && daysLeft < 30)) level = 1;
      let frac = 0;
      if (kmLeft != null && x.km) frac = 1 - kmLeft / x.km; else if (daysLeft != null && x.months) frac = 1 - daysLeft / (x.months * 30.4);
      return Object.assign({}, x, { kmLeft, daysLeft, level, label, frac: clamp(frac, 0, 1) });
    }).sort((a, b) => b.level - a.level);
  }

  /* --------------------------------------------------------------- LED -- */
  let ledLast = '', ledT = 0;
  function ledTarget() {
    const l = S.led;
    if (!l.on) return null;
    const base = hexRgb(l.color);
    let k = l.bright / 100, c = base;
    if (S.sportLed && obdFresh() && l.mode === 'sport') {
      const x = clamp(L.accel / 9.81 / 0.3, 0, 1);
      c = x > 0.75 ? [255, 40, 30] : base; k = 0.08 + x * 0.92;
    } else if (l.mode === 'sport') {
      const x = clamp(L.accel / 9.81 / 0.3, 0, 1); k = 0.08 + x * 0.92;
    } else if (l.mode === 'night') { c = [255, 140, 40]; k = 0.15; }
    else if (l.mode === 'music') {
      if (L.media.playing) { const t = now() / 1000; const beat = Math.pow(Math.max(0, Math.cos(t * Math.PI * 2 * 2)), 6); const hue = (t * 40) % 360; c = hsl(hue); k = (0.25 + beat * 0.75) * (l.bright / 100); }
      else k = 0.2 * (l.bright / 100);
    }
    return c.map((v) => Math.round(v * k));
  }
  function hsl(h) { const f = (n) => { const k = (n + h / 30) % 12; return 255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)].map(Math.round); }
  function ledApply(force) {
    const c = ledTarget();
    const key = c ? c.join(',') : 'off';
    const sw = $('.ledstrip');
    if (sw) { sw.style.setProperty('--ledc', c ? `rgb(${c.join(',')})` : '#333'); sw.style.setProperty('--ledi', c ? '1' : '.25'); }
    if (!NATIVE || L.led.state !== 'connected') return;
    if (!force && (key === ledLast || now() - ledT < 80)) return;
    ledLast = key; ledT = now();
    if (!c) call('ledPower', false); else call('ledColor', c[0], c[1], c[2]);
  }

  /* -------------------------------------------------------------- UI -- */
  const VEH = ['engine', 'trips', 'route', 'led', 'service', 'settings'];
  const LABELS = { engine: 'Moteur', trips: 'Trajets', route: 'Route', led: 'LED', service: 'Entretien', settings: 'Réglages', music: 'Musique', phone: 'Téléphone', apps: 'Applications' };
  const ICONS = { engine: 'engine', trips: 'trips', route: 'route', led: 'led', service: 'service', settings: 'settings' };
  let view = 'home', selTrip = 0, panelKind = '', panelSeq = 0;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const haptic = (ms = 7) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  function applyTheme() {
    const t = theme(), r = document.documentElement.style;
    r.setProperty('--bg', t.bg); r.setProperty('--fg', t.fg); r.setProperty('--soft', t.soft); r.setProperty('--card', t.card);
    r.setProperty('--card2', t.card2); r.setProperty('--acc', t.acc); r.setProperty('--acc-ink', t.ink);
    r.setProperty('--line', t.light ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.08)');
    document.documentElement.style.colorScheme = t.light ? 'light' : 'dark';
    document.documentElement.dataset.layout = t.layout;
    const m = $('meta[name=theme-color]'); if (m) m.content = t.bg;
    if (typeof setTiles === 'function' && map) setTiles();
  }

  /* ---- barre du bas : voiture · mini-lecteur · navigation, musique, téléphone, CarPlay, applis ---- */
  function renderBar() {
    const b = $('#bar');
    const cp = S.carplay.label || 'CarPlay';
    b.innerHTML = `<button class="bar__btn bar__car" data-panel="engine">${icon('car')}<span>Voiture</span></button>
      <div class="mini" data-music>
        <button class="mini__open" data-panel="music" aria-label="Ouvrir la musique"><span class="cover" data-cover>${icon('music')}</span>
        <span class="col fill" style="gap:1px;min-width:0"><span class="t ell" data-k="mTitle"></span><span class="s ell" data-k="mArtist"></span></span></button>
        ${NATIVE || L.demo ? `<button class="icon-btn" data-media="prev" aria-label="Précédent">${icon('prev')}</button><button class="icon-btn" data-media="toggle" data-play aria-label="Lecture ou pause">${icon('play')}</button><button class="icon-btn" data-media="next" aria-label="Suivant">${icon('next')}</button>` : ''}
      </div>
      <div class="bar__apps">
        <button class="bar__btn" data-act="navSearch">${icon('search')}<span>Navigation</span></button>
        <button class="bar__btn" data-panel="music">${icon('music')}<span>Musique</span></button>
        <button class="bar__btn" data-panel="phone">${icon('phone')}<span>Téléphone</span></button>
        <button class="bar__btn" data-act="carplay">${icon('carplay')}<span class="ell" data-k="cpLabel">${esc(cp)}</span></button>
        <button class="bar__btn" data-panel="apps">${icon('apps')}<span>Applis</span></button>
      </div>
      ${NATIVE ? `<div class="bar__vol"><button class="icon-btn" data-vol="-1" aria-label="Baisser le volume">−</button>${icon('vol')}<button class="icon-btn" data-vol="1" aria-label="Monter le volume">+</button></div>` : ''}`;
    markBar();
    updateMusic();
  }
  function markBar() {
    $$('#bar [data-panel]').forEach((x) => {
      const on = x.dataset.panel === panelKind || (x.classList.contains('bar__car') && VEH.includes(panelKind));
      if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
    });
  }

  let statusKey = '';
  function renderStatus() {
    const o = L.obd.state;
    const key = [o, L.demo, L.led.state, L.gpsErr, !!(L.gps.t && now() - L.gps.t < 5000), outsideTemp()].join('|');
    const clock = $('#status [data-k="clock"]');
    if (key === statusKey && clock) { clock.textContent = hhmm(); return; }
    statusKey = key;
    const obdCls = o === 'connected' ? 'on' : ['connecting', 'detect', 'scan', 'sleep', 'notfound'].includes(o) ? 'wait' : o === 'lost' ? 'bad' : '';
    const t = outsideTemp();
    $('#status').innerHTML = `<div class="grp"><b data-k="clock">${hhmm()}</b><span>${t != null ? t + ' °C' : ''}</span></div>
      <div class="grp">${L.demo ? '<span class="demo-badge">DÉMO</span>' : ''}
      <span class="ind ${L.gps.t && now() - L.gps.t < 5000 ? 'on' : L.gpsErr ? 'bad' : ''}"><i></i>GPS</span>
      ${NATIVE || L.demo ? `<button class="ind ${L.demo ? 'on' : obdCls}" data-panel="engine"><i></i>OBD</button>` : ''}
      ${NATIVE ? `<button class="ind ${L.led.state === 'connected' ? 'on' : ''}" data-panel="led"><i></i>LED</button>` : ''}</div>`;
  }

  /* ---- panneaux (cartes qui montent au-dessus de la carte) ---- */
  function openPanel(kind, dir) {
    if (!kind || kind === 'home') return closePanel();
    if (kind === panelKind && !dir) return closePanel();
    const p = $('#panel'), veh = VEH.includes(kind);
    const from = VEH.indexOf(view);
    panelKind = kind; view = kind; panelSeq++;
    p.classList.toggle('has-nav', veh);
    $('#panel-title').textContent = veh ? 'Voiture' : LABELS[kind] || '';
    $('#panel-nav').innerHTML = veh ? VEH.map((v) => `<button type="button" data-panel="${v}" ${v === kind ? 'aria-current="page"' : ''}>${icon(ICONS[v])}<span>${LABELS[v]}</span></button>`).join('') : '';
    const wasOpen = !p.hidden && p.classList.contains('open');
    if (p.hidden) { p.hidden = false; void p.offsetWidth; }
    p.classList.add('open');
    render(wasOpen && veh && from > -1 ? (VEH.indexOf(kind) > from ? 1 : -1) : 0);
    $('#view').scrollTop = 0;
    markBar();
    if (kind === 'route') fetchStations(false);
    if (kind === 'engine' && NATIVE && L.obd.state === 'connected' && L.dtc == null) call('obdReadDtc');
    if (kind === 'apps') loadIcons();
    if (kind === 'music' && NATIVE) { call('mediaRefresh'); readVolume(); }
  }
  function closePanel() {
    const p = $('#panel'), seq = ++panelSeq;
    p.classList.remove('open');
    panelKind = ''; view = 'home';
    markBar();
    setTimeout(() => { if (seq === panelSeq) { p.hidden = true; $('#view').innerHTML = ''; bind(); } }, REDUCE ? 0 : 260);
  }
  function go(v, dir) { if (v === 'home') closePanel(); else openPanel(v, dir || 1); }
  function refreshIf(list) {
    if (list.includes('home')) renderCar();
    if (panelKind && list.includes(view) && $('#sheet').hidden) render();
  }
  function render(dir) {
    const fn = R[view], el = $('#view');
    el.innerHTML = '<div class="page">' + (fn ? fn() : '') + '</div>';
    if (dir && !REDUCE) el.firstElementChild.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
    bind();
    tick(true);
    updateMusic();
  }

  /* gauge */
  function polar(r, a) { const t = (a * Math.PI) / 180; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; }
  function arc(r, a0, a1) { const s = polar(r, a0), e = polar(r, a1); return `M${s[0].toFixed(2)} ${s[1].toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}`; }
  function gauge(key, mid) {
    let ticks = '';
    for (let i = 0; i <= 12; i++) { const a = 135 + i * 22.5, p = polar(38, a), q = polar(i % 2 ? 40 : 41.5, a); ticks += `<line class="tick" x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${q[0].toFixed(2)}" y2="${q[1].toFixed(2)}"/>`; }
    return `<div class="gauge" data-g="${key}"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="trk" d="${arc(46, 135, 405)}"/><path class="val" pathLength="1" stroke-dasharray="0 1" d="${arc(46, 135, 405)}"/>${ticks}<line class="ndl" x1="50" y1="50" x2="50" y2="50"/></svg><div class="mid">${mid}</div></div>`;
  }

  /* bindings: text (data-k), bars (data-bar), gauges (data-g), toggles (data-on) */
  const F = {
    clock: () => hhmm(),
    speed: () => String(Math.round(SM.speed)),
    limit: () => (L.limit && L.limit.v ? String(L.limit.v) : '–'),
    temp: () => { const t = outsideTemp(); return t == null ? '–' : t + '°'; },
    trip: () => (S.cur ? nf(S.cur.dist, 1) + ' km' : S.trips[0] ? nf(S.trips[0].dist, 1) + ' km' : '0,0 km'),
    tripDur: () => (S.cur ? dur(S.cur.dur) : S.trips[0] ? dur(S.trips[0].dur) : '–'),
    tripLabel: () => (S.cur ? 'Trajet en cours' : S.trips[0] ? 'Dernier trajet' : 'Trajet'),
    rpm: () => (L.o.rpm == null || !obdFresh() ? '–' : nf(Math.round(SM.rpm / 10) * 10)),
    tq: () => { const t = torque(); return t == null || !obdFresh() ? '–' : String(Math.round(t)); },
    ect: () => (L.o.ect == null || !obdFresh() ? '–' : String(Math.round(L.o.ect))),
    gacc: () => nf(Math.max(0, SM.accel / 9.81), 2),
    rail: () => (L.o.rail == null || !obdFresh() ? '–' : nf(SM.rail / 100)),
    egr: () => (L.o.egr == null || !obdFresh() ? '–' : nf(L.o.egr)),
    fuelSrc: () => (L.o.fuelRate != null && obdFresh() ? 'Débit de carburant donné par le calculateur.' : engine().diesel ? 'Estimée pour un diesel (débit d\'air et charge).' : 'Calculée sur le débit d\'air du moteur.'),
    inst: () => { if (L.fuelRate == null) return '–'; return L.speed > 5 ? nf(Math.min((L.fuelRate / L.speed) * 100, 39.9), 1) : nf(L.fuelRate, 1); },
    instU: () => (L.speed > 5 || L.fuelRate == null ? 'L/100 km' : "L/h à l'arrêt"),
    avg: () => { const c = S.cur; return c && c.hasFuel && c.dist > 0.1 ? nf((c.fuel / c.dist) * 100, 1) : '–'; },
    cost: () => { const c = S.cur; return c && c.hasFuel ? nf(c.fuel * price(), 2) + ' €' : '–'; },
    fuelL: () => (S.cur && S.cur.hasFuel ? nf(S.cur.fuel, 2) + ' L' : '–'),
    lat: () => nf(Math.abs(SM.latG), 2) + ' g',
    brk: () => nf(Math.max(0, -SM.accel / 9.81), 2) + ' g',
    mlat: () => nf(S.cur ? S.cur.maxLat : 0, 2), mbrk: () => nf(S.cur ? Math.max(0, S.cur.maxBrk) : 0, 2),
    volt: () => { const v = L.o.volt != null ? L.o.volt : L.o.cmv; return v == null ? '–' : nf(v, 1); },
    voltS: () => { const v = L.o.volt != null ? L.o.volt : L.o.cmv; if (v == null) return 'Tension lue par le boîtier'; if (v >= 13.2) return 'Charge correcte · alternateur actif'; if (v >= 12.4) return 'Batterie correcte, moteur arrêté'; return 'Tension faible : batterie à vérifier'; },
    mil: () => (L.o.mil == null ? '–' : L.o.mil ? 'Allumé' : 'Éteint'),
    dtcCount: () => (L.o.dtcCount == null ? '–' : String(L.o.dtcCount)),
    boost: () => { const b = boost(); return b == null || !obdFresh() ? '–' : nf(Math.max(0, SM.boost), 2); },
    coldMsg: () => { const e = L.o.ect; if (e == null || !obdFresh()) return 'Température d\'eau lue par le boîtier'; return e < 70 ? 'Moteur froid : ménage-le, pas de hauts régimes avant 70 °C' : 'Moteur chaud : tout le moteur est dispo'; },
    oil: () => (L.o.oil == null ? '' : 'Huile ' + Math.round(L.o.oil) + ' °C'),
    gear: () => '',
    odo: () => { const o = odoNow(); return o == null ? 'Non renseigné' : nf(o) + ' km'; },
    mTitle: () => L.media.title || (NATIVE && !INFO.media && !L.media.access ? 'Musique' : 'Aucune lecture'),
    mArtist: () => L.media.artist || (NATIVE && !mediaOk() ? 'Autorise l\'accès pour voir le titre' : L.media.app || ''),
    limitRoad: () => (L.limit && L.limit.road ? L.limit.road : 'Limitation de la route'),
    mApp: () => L.media.app || 'Musique',
    mPos: () => { const m = L.media; if (!m.dur) return ''; const pos = Math.min(m.dur, m.playing ? m.pos + (now() - (m.at || m.rx)) * (m.speed || 1) : m.pos); return mmss(pos); },
    mDur: () => (L.media.dur ? mmss(L.media.dur) : ''),
    cpLabel: () => S.carplay.label || 'CarPlay',
  };
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  const B = {
    inst: () => (L.fuelRate == null ? 0 : L.speed > 5 ? (L.fuelRate / L.speed) * 100 / 25 : 0.05),
    volt: () => { const v = L.o.volt != null ? L.o.volt : L.o.cmv; return v == null ? 0 : (v - 11.5) / 3.2; },
    ect: () => (L.o.ect == null ? 0 : (L.o.ect - 30) / 80),
    boost: () => (boost() == null ? 0 : SM.boost / 1.6),
    rail: () => (L.o.rail == null ? 0 : SM.rail / 160000),
    music: () => { const m = L.media; if (!m.dur) return 0; const pos = m.playing ? m.pos + (now() - (m.at || m.rx)) * (m.speed || 1) : m.pos; return pos / m.dur; },
  };
  const G = {
    spd: () => SM.speed / 200,
    rpm: () => SM.rpm / (engine().diesel ? 5000 : 7000),
    tq: () => SM.tq / (engine().tq * 1.05),
    ect: () => (SM.ect - 40) / 90,
  };
  const C = {
    over: () => L.limit && L.limit.v && L.speed > L.limit.v + 1,
    cold: () => L.o.ect != null && L.o.ect < 70 && obdFresh(),
    brake: () => SM.accel < -1.8,
  };
  let bound = [];
  function bind() {
    bound = [];
    $$('[data-k]').forEach((el) => bound.push({ el, f: F[el.dataset.k], t: 'k' }));
    $$('[data-bar]').forEach((el) => bound.push({ el, f: B[el.dataset.bar], t: 'b' }));
    $$('[data-g]').forEach((el) => bound.push({ el, f: G[el.dataset.g], t: 'g', a: $('.val', el), n: $('.ndl', el) }));
    $$('[data-on]').forEach((el) => { const [k, c] = el.dataset.on.split(':'); bound.push({ el, f: C[k], t: 'c', c: c || 'on' }); });
    $$('[data-segs]').forEach((el) => bound.push({ el, t: 's', kids: $$('i', el) }));
    $$('[data-ball]').forEach((el) => bound.push({ el, t: 'ball', dot: $('i', el) }));
  }
  function tick(force) {
    for (const b of bound) {
      if (b.t === 'k' && b.f) { const v = b.f(); if (force || b.el.__v !== v) { b.el.__v = v; b.el.textContent = v; } }
      else if (b.t === 'b' && b.f) b.el.style.transform = 'scaleX(' + clamp(b.f() || 0, 0, 1).toFixed(3) + ')';
      else if (b.t === 'g' && b.f) {
        const f = clamp(b.f() || 0, 0, 1);
        b.a.setAttribute('stroke-dasharray', f.toFixed(4) + ' 1');
        const ang = 135 + f * 270, p = polar(30, ang), q = polar(42, ang);
        b.n.setAttribute('x1', p[0].toFixed(2)); b.n.setAttribute('y1', p[1].toFixed(2)); b.n.setAttribute('x2', q[0].toFixed(2)); b.n.setAttribute('y2', q[1].toFixed(2));
      } else if (b.t === 'c' && b.f) b.el.classList.toggle(b.c, !!b.f());
      else if (b.t === 's') { const on = Math.round(clamp(SM.accel / 9.81 / 0.3, 0, 1) * b.kids.length); if (b.on !== on) { b.on = on; b.kids.forEach((k, i) => k.classList.toggle('on', i < on)); } }
      else if (b.t === 'ball') { const w = b.el.clientWidth; b.dot.style.transform = `translate3d(${(-clamp(SM.latG / 0.6, -1, 1) * 0.44 * w).toFixed(1)}px, ${(clamp(SM.accel / 9.81 / 0.6, -1, 1) * 0.44 * w).toFixed(1)}px, 0)`; }
    }
  }

  /* ------------------------------------------------------------- vues -- */
  const mediaOk = () => !NATIVE || INFO.media || L.media.access || (L.media && !L.media.none);
  function updateMusic() {
    const m = L.media;
    $$('[data-cover]').forEach((c) => {
      c.style.backgroundImage = m.art ? `url('${m.art}')` : '';
      c.innerHTML = m.art ? '' : icon('music');
    });
    $$('[data-play]').forEach((p) => { p.innerHTML = icon(m.playing ? 'pause' : 'play'); });
  }
  function signHtml(cls) { return `<span class="sign ${L.limit && L.limit.v ? '' : 'none'} ${cls || ''}" data-k="limit">–</span>`; }
  function alertLine() {
    const a = alerts();
    if (!a.length) return `<div class="alert-line" data-alert>${icon('check')}<span>Tout va bien. Bonne route.</span></div>`;
    const x = a[Math.floor(now() / 6000) % a.length];
    return `<div class="alert-line ${x.hot ? 'hot' : ''}" data-alert>${icon(x.ic)}<span class="ell">${esc(x.text)}</span></div>`;
  }
  function nextService() { const d = serviceDue(); const x = d.find((y) => y.label !== 'À renseigner') || d[0]; return x ? [x.name, x.label] : ['Entretien', '–']; }

  /* la MiTo de profil : silhouette originale, feux stop et éclairage vivants */
  function carSvg() {
    return `<svg class="mito" viewBox="0 0 360 150" aria-hidden="true">
      <defs><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="var(--ledc, var(--acc))" stop-opacity=".55"/><stop offset="1" stop-color="var(--ledc, var(--acc))" stop-opacity="0"/></radialGradient>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--card2)"/><stop offset="1" stop-color="var(--card)"/></linearGradient></defs>
      <ellipse class="mito__glow" cx="180" cy="132" rx="150" ry="14" fill="url(#glow)"/>
      <path class="mito__body" d="M18 104 C18 92 28 84 48 80 L112 70 C130 58 150 44 170 38 C200 32 245 32 268 36 C290 40 310 48 322 56 L334 66 C340 74 342 92 340 110 L312 114 A30 30 0 0 0 250 114 L116 114 A30 30 0 0 0 54 114 L26 114 C20 113 18 110 18 104 Z" fill="url(#body)"/>
      <path class="mito__glass" d="M124 70 C140 58 156 47 172 43 L232 41 L232 70 Z M238 41 L266 42 C284 46 300 54 310 62 L238 70 Z"/>
      <path class="mito__line" d="M120 72 L118 112 M236 70 L236 112 M48 92 L112 86"/>
      <path class="mito__head" d="M22 92 C26 86 34 83 46 82 L44 92 Z"/>
      <circle class="mito__tail" cx="329" cy="72" r="6.5"/>
      <g class="mito__wheel"><circle cx="85" cy="116" r="24"/><circle cx="85" cy="116" r="13"/></g>
      <g class="mito__wheel"><circle cx="281" cy="116" r="24"/><circle cx="281" cy="116" r="13"/></g>
    </svg>`;
  }
  function renderCar() {
    const t = theme(), el = $('#carpane');
    if (!el) return;
    const live = obdOn();
    const speed = t.layout === 'analog'
      ? gauge('spd', `<span class="big" data-k="speed" data-on="over:over">0</span><span class="u">km/h</span>`)
      : `<div class="spd"><span class="big" data-k="speed" data-on="over:over">0</span><span class="u">km/h</span></div>`;
    const stats = live
      ? `<div class="stat"><span class="k">Eau</span><span class="n"><span data-k="ect" data-on="cold:cold"></span><small>°C</small></span></div>
         <div class="stat"><span class="k">${engine().turbo ? 'Turbo' : 'Régime'}</span><span class="n">${engine().turbo ? '<span data-k="boost"></span><small>bar</small>' : '<span data-k="rpm"></span>'}</span></div>
         <div class="stat"><span class="k">Conso</span><span class="n"><span data-k="inst"></span><small data-k="instU"></small></span></div>
         <div class="stat"><span class="k">Batterie</span><span class="n"><span data-k="volt"></span><small>V</small></span></div>`
      : `<div class="stat"><span class="k" data-k="tripLabel"></span><span class="n"><span data-k="trip"></span></span></div>
         <div class="stat"><span class="k">Durée</span><span class="n"><span data-k="tripDur"></span></span></div>
         <div class="stat"><span class="k">Dehors</span><span class="n"><span data-k="temp"></span></span></div>
         <button class="stat stat--btn" data-panel="engine"><span class="k">Boîtier OBD</span><span class="t">${NATIVE ? 'Connecter' : 'Appli Android'}</span></button>`;
    el.innerHTML = `<div class="car-head"><span class="chip ${live ? 'on' : ''}">${icon('bt')}<span>${live ? (L.demo ? 'Démo' : esc(L.obd.label || 'OBD')) : 'OBD hors ligne'}</span></span>
        <span class="chip">${icon('engine')}<span>MiTo ${esc(engine().name)}</span></span></div>
      <div class="car-speed">${t.layout === 'cr7' ? '<span class="cr7tag">CR<b>7</b></span>' : ''}${speed}${signHtml()}</div>
      <div class="car-art" data-on="brake:brake">${carSvg()}${t.layout === 'cr7' ? '<span class="cr7stripe"></span>' : ''}</div>
      <div class="car-stats">${stats}</div>
      ${alertLine()}`;
    bind(); tick(true);
  }

  /* ---------------------------------------------------------------- carte -- */
  let map = null, meMk = null, follow = true, tiles = null, destMk = null, trace = null, lastFollow = 0, programmatic = false, userZoom = null;
  function initMap() {
    const LF = window.L, el = $('#map');
    if (!el) return;
    if (!LF) { el.innerHTML = '<p class="map-off">Carte indisponible</p>'; return; }
    const c = S.lastPos || [45.4642, 9.19];
    map = LF.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, inertia: true, fadeAnimation: !REDUCE, zoomAnimation: !REDUCE }).setView(c, 15);
    map.attributionControl.setPrefix('');
    setTiles();
    meMk = LF.marker(c, { icon: LF.divIcon({ className: 'me', html: '<i></i>', iconSize: [40, 40], iconAnchor: [20, 20] }), interactive: false, keyboard: false }).addTo(map);
    trace = LF.polyline([], { color: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#fff', weight: 4, opacity: 0.7, interactive: false }).addTo(map);
    map.on('dragstart', () => { follow = false; $('#recenter').hidden = false; });
    map.on('zoomend', () => { if (!programmatic) userZoom = { z: map.getZoom(), t: now() }; });
    window.addEventListener('resize', () => setTimeout(() => map && map.invalidateSize(), 120));
  }
  function setTiles() {
    if (!map) return;
    const t = theme(), style = t.light ? 'rastertiles/voyager' : 'dark_all';
    if (tiles) map.removeLayer(tiles);
    tiles = window.L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, { subdomains: 'abcd', maxZoom: 20, attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
    if (trace) trace.setStyle({ color: t.acc });
  }
  let lastTrace = 0, lastPosSave = 0;
  function mapTick() {
    if (!map) return;
    const g = L.gps;
    if (!g.lat) return;
    const ll = [g.lat, g.lon];
    meMk.setLatLng(ll);
    const me = meMk.getElement();
    if (me) { me.classList.toggle('moving', SM.speed > 3); const a = me.firstChild; if (a && g.brg >= 0) a.style.transform = `rotate(${g.brg}deg)`; }
    if (follow && now() - lastFollow > 1000) {
      lastFollow = now();
      const z = userZoom && now() - userZoom.t < 30000 ? userZoom.z : SM.speed < 35 ? 16.5 : SM.speed < 75 ? 15.5 : 14.5;
      programmatic = true;
      map.setView(ll, z, { animate: !REDUCE, duration: 0.9, easeLinearity: 0.4 });
      setTimeout(() => { programmatic = false; }, 1000);
    }
    if (S.cur && now() - lastTrace > 4000) { lastTrace = now(); trace.setLatLngs(S.cur.pts.map((p) => [p[0], p[1]])); }
    else if (!S.cur && trace.getLatLngs().length) trace.setLatLngs([]);
    if (now() - lastPosSave > 60000) { lastPosSave = now(); S.lastPos = [+g.lat.toFixed(4), +g.lon.toFixed(4)]; save(); }
  }
  function recenter() { follow = true; userZoom = null; lastFollow = 0; $('#recenter').hidden = true; mapTick(); }

  /* destinations : recherche, Maison / Travail, récents, carburant */
  let dest = null, searchTimer = 0, searchRes = [];
  function placeLabel(p) { return p.name || 'Destination'; }
  function setDest(p) {
    dest = p;
    if (map) {
      if (destMk) map.removeLayer(destMk);
      destMk = window.L.marker([p.lat, p.lon], { icon: window.L.divIcon({ className: 'dest-pin', html: '<i></i>', iconSize: [30, 40], iconAnchor: [15, 38] }) }).addTo(map);
      follow = false; $('#recenter').hidden = false;
      const g = L.gps;
      if (g.lat) map.fitBounds([[g.lat, g.lon], [p.lat, p.lon]], { padding: [70, 70], maxZoom: 16, animate: !REDUCE });
      else map.setView([p.lat, p.lon], 15, { animate: !REDUCE });
    }
    renderDest();
  }
  function renderDest() {
    const d = $('#dest');
    if (!dest) { d.hidden = true; d.innerHTML = ''; return; }
    const g = L.gps, km = g.lat ? haversine([g.lat, g.lon], [dest.lat, dest.lon]) / 1000 : null;
    d.innerHTML = `<div class="row between" style="align-items:flex-start"><div class="col fill" style="gap:2px"><span class="t ell">${esc(placeLabel(dest))}</span><span class="s ell">${esc(dest.sub || '')}${km != null ? ' · ' + nf(km, km < 10 ? 1 : 0) + ' km à vol d\'oiseau' : ''}</span></div><button class="icon-btn" data-act="clearDest" aria-label="Effacer">✕</button></div>
      <div class="btns"><button class="btn primary" data-act="goWaze">${icon('route')}Y aller avec Waze</button><button class="btn" data-act="goMaps">Google Maps</button>
      <button class="btn small" data-act="setHome">${icon('home')}Maison</button><button class="btn small" data-act="setWork">${icon('work')}Travail</button></div>`;
    d.hidden = false;
  }
  function renderQuick() {
    const q = $('#quick'); if (!q) return;
    const P = S.places || {};
    const chips = [];
    chips.push(P.home ? `<button class="qchip" data-place="home">${icon('home')}Maison</button>` : `<button class="qchip ghost" data-act="defineHome">${icon('home')}Définir Maison</button>`);
    if (P.work) chips.push(`<button class="qchip" data-place="work">${icon('work')}Travail</button>`);
    chips.push(`<button class="qchip" data-act="cheapFuel">${icon('fuel')}Carburant</button>`);
    (S.recents || []).slice(0, 2).forEach((r, i) => chips.push(`<button class="qchip" data-recent="${i}">${icon('trips')}<span class="ell">${esc(r.name)}</span></button>`));
    q.innerHTML = chips.join('');
  }
  function navigate(app) {
    if (!dest) return;
    const r = (S.recents || []).filter((x) => !(Math.abs(x.lat - dest.lat) < 1e-4 && Math.abs(x.lon - dest.lon) < 1e-4));
    r.unshift({ name: placeLabel(dest), sub: dest.sub || '', lat: dest.lat, lon: dest.lon });
    S.recents = r.slice(0, 8); save(); renderQuick();
    if (NATIVE) {
      const used = call('nav', dest.lat, dest.lon, placeLabel(dest), app);
      if (!used) toast('Installe Waze ou Google Maps sur l\'écran');
      else if (app === 'waze' && used !== 'waze') toast('Waze introuvable : ouverture avec Google Maps');
    } else {
      window.open(app === 'maps' ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}` : `https://waze.com/ul?ll=${dest.lat},${dest.lon}&navigate=yes`, '_blank');
    }
  }
  function searchSheet(mode) {
    openSheet(mode === 'home' ? 'Adresse de la maison' : mode === 'work' ? 'Adresse du travail' : 'Où va-t-on ?', `<form class="searchbox" data-search="${mode || ''}"><span class="ic">${icon('search')}</span><input class="input" id="q" type="search" autocomplete="off" placeholder="Adresse, ville, lieu…" enterkeyhint="search"></form>
      <div class="list" id="results">${recentHtml()}</div>`, 'search');
    setTimeout(() => { const i = $('#q'); if (i) i.focus(); }, 80);
  }
  function recentHtml() {
    const r = S.recents || [];
    return r.length ? '<p class="k" style="margin:4px 0">Récents</p>' + r.map((x, i) => `<button class="li" data-recent="${i}"><span class="ic">${icon('trips')}</span><span class="col fill" style="gap:2px"><span class="t ell">${esc(x.name)}</span><span class="s ell">${esc(x.sub)}</span></span></button>`).join('') : '<p class="hint">Tape une adresse ou un lieu. La recherche passe par OpenStreetMap (internet nécessaire).</p>';
  }
  function runSearch(q, mode) {
    const box = $('#results'); if (!box) return;
    if (q.trim().length < 3) { box.innerHTML = recentHtml(); return; }
    box.innerHTML = '<p class="hint">Recherche…</p>';
    const g = L.gps;
    const url = 'https://photon.komoot.io/api/?limit=8&lang=fr&q=' + encodeURIComponent(q) + (g.lat ? `&lat=${g.lat.toFixed(4)}&lon=${g.lon.toFixed(4)}` : '');
    fetchJson(url, null, 9000).then((j) => {
      searchRes = (j.features || []).map((f) => {
        const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
        const street = [p.housenumber, p.street].filter(Boolean).join(' ');
        return { name: p.name || street || p.city || 'Lieu', sub: [p.name ? street : '', p.postcode, p.city || p.county].filter(Boolean).join(' · '), lat: c[1], lon: c[0] };
      }).filter((x) => x.lat != null);
      if (!$('#results')) return;
      $('#results').innerHTML = searchRes.length ? searchRes.map((x, i) => {
        const km = g.lat ? haversine([g.lat, g.lon], [x.lat, x.lon]) / 1000 : null;
        return `<button class="li" data-result="${i}" data-mode="${mode || ''}"><span class="ic">${icon('route')}</span><span class="col fill" style="gap:2px"><span class="t ell">${esc(x.name)}</span><span class="s ell">${esc(x.sub)}</span></span>${km != null ? `<span class="s">${nf(km, km < 10 ? 1 : 0)} km</span>` : ''}</button>`;
      }).join('') : '<p class="hint">Aucun résultat.</p>';
    }).catch(() => { if ($('#results')) $('#results').innerHTML = '<p class="hint">Pas de connexion internet : la recherche d\'adresse est indisponible.</p>'; });
  }

  /* volume, icônes d'applis, téléphone */
  let VOL = null, dialNum = '';
  function readVolume(dir) { if (!NATIVE) return; try { VOL = JSON.parse(call('volume', dir || 0) || '{}'); } catch (e) {} const v = $('[data-volbar]'); if (v && VOL && VOL.max) v.style.transform = `scaleX(${(VOL.v / VOL.max).toFixed(3)})`; }
  const ICON_CACHE = {};
  let APPS = null;
  function appsList() {
    if (APPS) return APPS;
    try { APPS = JSON.parse(call('apps') || '[]'); } catch (e) { APPS = []; }
    return APPS;
  }
  function findApps(re) { try { return JSON.parse(call('findApps', re) || '[]'); } catch (e) { return []; } }
  function loadIcons() {
    const need = appsList().map((a) => a.pkg).filter((p) => !ICON_CACHE[p]);
    [S.carplay.pkg, S.phoneApp && S.phoneApp.pkg, S.smsApp && S.smsApp.pkg].forEach((p) => { if (p && !ICON_CACHE[p] && !need.includes(p)) need.push(p); });
    if (need.length && NATIVE) call('appIcons', need.join(','));
  }
  function appTile(a, attr) {
    const ic = ICON_CACHE[a.pkg];
    return `<button class="app" ${attr}="${esc(a.pkg)}" data-label="${esc(a.label)}"><span class="app__ic" data-appic="${esc(a.pkg)}" ${ic ? `style="background-image:url('${ic}')"` : ''}>${ic ? '' : esc((a.label || '?').slice(0, 1).toUpperCase())}</span><span class="app__t">${esc(a.label)}</span></button>`;
  }

  const R = {
    music() {
      const m = L.media;
      const sp = NATIVE ? findApps('spotify') : [];
      const spPkg = sp.length ? sp[0].pkg : 'com.spotify.music';
      const sources = NATIVE ? findApps('spotify|deezer|youtube music|qobuz|tidal|amazon music|soundcloud|radio|podcast|music|musique').filter((a) => a.launch && a.pkg !== spPkg) : [];
      const quick = (S.spotQuick || []).map((q, i) => `<span class="qchip"><button data-spq="${i}">${icon('play')}${esc(q)}</button><button class="x" data-spdel="${i}" aria-label="Retirer">✕</button></span>`).join('');
      return `<div class="music-pane">
        <div class="mp-art" data-cover>${m.art ? '' : icon('music')}</div>
        <div class="mp-info col">
          <span class="k" data-k="mApp"></span>
          <h2 class="mp-title" data-k="mTitle"></h2>
          <p class="s mp-artist" data-k="mArtist"></p>
          <button class="mp-prog" data-seek aria-label="Avancer dans le titre"><span class="bar-t"><i data-bar="music"></i></span><span class="row between s"><span data-k="mPos"></span><span data-k="mDur"></span></span></button>
          <div class="mp-ctrls">${NATIVE || L.demo ? `<button class="icon-btn" data-media="prev" aria-label="Précédent">${icon('prev')}</button><button class="icon-btn play" data-media="toggle" data-play aria-label="Lecture ou pause">${icon('play')}</button><button class="icon-btn" data-media="next" aria-label="Suivant">${icon('next')}</button>` : '<p class="hint">Les commandes de lecture passent par l\'appli Android.</p>'}</div>
          ${NATIVE ? `<div class="mp-vol"><button class="icon-btn" data-vol="-1" aria-label="Baisser le volume">−</button><span class="bar-t fill"><i data-volbar></i></span><button class="icon-btn" data-vol="1" aria-label="Monter le volume">+</button></div>` : ''}
          ${NATIVE && !mediaOk() ? '<button class="btn small" data-act="mediaAccess">Autoriser l\'affichage du titre et de la pochette</button>' : ''}
        </div></div>
      <div class="grid two" style="margin-top:14px">
        <div class="card col"><h3>Spotify</h3>
          <form class="searchbox" data-spotify><span class="ic">${icon('search')}</span><input class="input" id="sp-q" type="search" placeholder="Artiste, titre, album, playlist…" enterkeyhint="go"><button class="btn primary" type="submit">Lancer</button></form>
          <div class="chips">${quick}${m.title ? `<button class="qchip ghost" data-act="spAdd">${icon('star')}Garder « ${esc(m.artist || m.title)} »</button>` : ''}</div>
          <div class="btns">${NATIVE ? `<button class="btn" data-open="${esc(spPkg)}">Ouvrir Spotify</button><button class="btn" data-split="${esc(spPkg)}">${icon('split')}À côté</button>` : '<span class="s">Spotify se lance depuis l\'appli Android.</span>'}</div>
          ${NATIVE && !sp.length ? '<p class="hint">Spotify n\'est pas installé sur cet écran : installe-le depuis le Play Store, puis connecte-toi une fois.</p>' : '<p class="hint">Tape ce que tu veux écouter : Spotify le lance directement, puis Dash 955 revient à l\'écran.</p>'}</div>
        <div class="card col"><h3>Autres sources</h3><div class="appgrid small">${sources.map((a) => appTile(a, 'data-open')).join('') || '<p class="hint">Aucune autre appli musique trouvée.</p>'}</div></div>
      </div>`;
    },

    phone() {
      const favs = S.favs || [];
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      const ph = S.phoneApp, sm = S.smsApp;
      return `<div class="phone">
        <div class="card dial"><div class="dial__num" data-dialnum>${esc(dialNum) || '<span class="s">Compose un numéro</span>'}</div>
          <div class="pad">${keys.map((k) => `<button class="key" data-key="${k}">${k}</button>`).join('')}</div>
          <div class="row" style="gap:10px"><button class="btn fill" data-act="dialDel">${icon('back')}</button><button class="btn primary fill call" data-act="dialCall">${icon('phone')}Appeler</button></div></div>
        <div class="col" style="gap:14px">
          <div class="card col"><div class="row between"><h3 style="margin:0">Favoris</h3><button class="btn small" data-act="favAdd">Ajouter</button></div>
            <div class="list">${favs.map((f, i) => `<div class="li"><span class="ic">${icon('phone')}</span><span class="col fill" style="gap:2px"><span class="t ell">${esc(f.name)}</span><span class="s">${esc(f.num)}</span></span><button class="btn small primary" data-favcall="${i}">Appeler</button><button class="icon-btn" data-favdel="${i}" aria-label="Retirer">✕</button></div>`).join('') || '<p class="hint">Ajoute les numéros que tu appelles le plus.</p>'}</div></div>
          <div class="card col"><h3>Téléphone de l'écran</h3>
            <div class="btns">${NATIVE ? `<button class="btn" data-act="phoneApp">${icon('phone')}${ph ? esc(ph.label) : 'Appels Bluetooth'}</button><button class="btn" data-act="smsApp">${icon('msg')}${sm ? esc(sm.label) : 'Messages'}</button>` : '<span class="s">Disponible dans l\'appli Android.</span>'}</div>
            <p class="hint">Les appels passent par le Bluetooth de l'écran, relié à ton iPhone. Appelle depuis ici ou ouvre l'appli téléphone de l'écran. Les messages restent dans cette appli : Android ne les partage pas avec les autres applis.</p></div>
        </div></div>`;
    },

    apps() {
      const list = appsList();
      return `<div class="row" style="gap:12px;flex-wrap:wrap"><form class="searchbox fill" data-appfilter onsubmit="return false"><span class="ic">${icon('search')}</span><input class="input" id="app-q" type="search" placeholder="Rechercher une appli" autocomplete="off"></form>
        <label class="row"><span class="s">Ouvrir à côté</span><span class="switch"><input type="checkbox" data-set="split" ${S.split ? 'checked' : ''}><span></span></span></label></div>
        <div class="appgrid" id="appgrid">${list.map((a) => appTile(a, 'data-launch')).join('') || '<p class="hint">Les applis de l\'écran apparaissent ici dans l\'appli Android.</p>'}</div>`;
    },

    engine() {
      const st = L.obd, e = engine();
      const STATES = { off: 'Boîtier non connecté', web: 'Disponible dans l\'appli Android', connecting: 'Connexion…', detect: 'Recherche du boîtier…', scan: 'Recherche des appareils…',
        connected: 'Connecté', lost: 'Connexion perdue, nouvel essai…', notfound: 'Aucun boîtier trouvé', sleep: 'Contact coupé', error: 'Erreur' };
      const live = obdOn();
      let conn;
      if (!NATIVE && !L.demo) {
        conn = `<div class="card col"><span class="conn"><span class="state">Boîtier OBD</span><span class="pill warn">Appli Android</span></span>
          <p class="hint">Un navigateur web (iPhone compris) ne peut pas parler à un boîtier OBD. Installe l'appli Android (fichier APK) sur ton boîtier CarPlay Android, ton autoradio Android ou un téléphone Android : elle détecte le boîtier toute seule. Ici, tu gardes la vitesse GPS, les trajets, la route et l'entretien.</p></div>`;
      } else {
        const btns = st.state === 'connected' || L.demo
          ? `<button class="btn" data-act="obdDisconnect">Déconnecter</button><button class="btn" data-act="obdDevices">Autre appareil</button>`
          : `<button class="btn primary" data-act="revking">Connecter mon RevKing</button><button class="btn" data-act="obdAuto">Détection automatique</button><button class="btn" data-act="obdDevices">Choisir un appareil</button><button class="btn" data-act="obdWifi">Boîtier Wi-Fi</button>`;
        conn = `<div class="card col"><div class="conn"><span class="ic ${live ? 'hot' : ''}">${icon('bt')}</span><div class="col fill" style="gap:2px">
          <span class="state">${L.demo ? 'Démo : trajet simulé' : esc(STATES[st.state] || st.state)}${st.label && !L.demo ? ' · ' + esc(st.label) : ''}</span>
          <span class="s">${esc(L.demo ? 'Les valeurs ci-dessous sont simulées.' : st.info || (st.state === 'off' ? 'Branche le boîtier dans la prise OBD (sous le volant, à gauche, derrière la trappe), mets le contact, puis lance la détection.' : ''))}</span></div></div>
          <div class="btns">${btns}</div>${L.pids.length ? `<p class="hint">Ta MiTo transmet ${L.pids.length} données standard au boîtier.</p>` : ''}</div>`;
      }
      const na = (txt) => `<p class="na">${txt}</p>`;
      const mod = (ic, title, body, foot) => `<div class="card mod"><div class="head"><span class="ic">${icon(ic)}</span><h3>${title}</h3></div>${body}${foot || ''}</div>`;
      const segs = '<div class="segs" data-segs>' + Array.from({ length: 16 }, (_, i) => `<i class="${i > 12 ? 'hi' : ''}"></i>`).join('') + '</div>';
      const dtcList = L.dtc == null ? '' : L.dtc.length ? `<div class="codes">${L.dtc.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : '<span class="pill ok">Aucun code défaut</span>';
      return `<h1 class="page-title">Moteur</h1>${conn}<div class="mods">
        ${mod('sport', 'Mode sport : LED sur la vraie accélération', `${segs}<div class="row between"><div><span class="n" data-k="gacc"></span> <span class="u">g</span></div>
          <label class="row"><span class="s">LED sport</span><span class="switch"><input type="checkbox" data-set="sportLed" ${S.led.mode === 'sport' ? 'checked' : ''}><span></span></span></label></div>`,
          na('Les LED suivent l\'accélération réelle (vitesse lue par le boîtier). Active « Sport » dans LED.'))}
        ${mod('conso', 'Conso réelle + coût de chaque trajet', `<div><span class="n" data-k="inst"></span> <span class="u" data-k="instU"></span></div><div class="bar-t"><i data-bar="inst"></i></div>
          <div class="row between"><div class="col" style="gap:2px"><span class="k">Moyenne</span><span class="t"><span data-k="avg"></span> L/100</span></div>
          <div class="col" style="gap:2px"><span class="k">Carburant</span><span class="t" data-k="fuelL"></span></div><div class="col" style="gap:2px;text-align:right"><span class="k">Coût</span><span class="t acc" data-k="cost"></span></div></div>`,
          na('<span data-k="fuelSrc"></span> Prix : ' + nf(price(), 3) + ' €/L (' + S.fuelType + '). Compare avec tes pleins et ajuste « Correction conso » dans Réglages.'))}
        ${mod('engine', 'Régime · couple · eau', `<div class="tri">${gauge('rpm', '<span class="n" data-k="rpm"></span><span class="u">tr/min</span>')}${gauge('tq', '<span class="n" data-k="tq"></span><span class="u">N·m est.</span>')}${gauge('ect', '<span class="n" data-k="ect"></span><span class="u">°C eau</span>')}</div>`)}
        ${mod('g', 'Virages en g · freinages', `<div class="row" style="gap:18px"><div class="gball" data-ball><i></i></div><div class="col"><div><span class="k">Virage</span><div class="n" data-k="lat"></div></div><div><span class="k">Freinage</span><div class="n" data-k="brk"></div></div>
          <span class="s">Maxi du trajet : <b data-k="mlat"></b> g / <b data-k="mbrk"></b> g</span></div></div>`)}
        ${mod('signals', 'Clignotants · frein à main', `<div class="row" style="gap:16px;opacity:.5"><span class="ic">${icon('signals')}</span><span class="t">Non disponible</span></div>`,
          na('Sur la MiTo, ces deux infos passent par le réseau carrosserie (B-CAN, broches 1 et 9 de la prise), qu\'un boîtier ELM327 standard ne lit pas. Elles ne sont pas encore gérées par cette version.'))}
        ${mod('battery', 'Batterie · voyants', `<div class="row between"><div><span class="n" data-k="volt"></span> <span class="u">V</span></div><div class="col" style="gap:2px;text-align:right"><span class="k">Voyant moteur</span><span class="t" data-k="mil"></span></div></div>
          <div class="bar-t"><i data-bar="volt"></i></div><span class="s" data-k="voltS"></span>${dtcList}
          <div class="btns"><button class="btn small" data-act="readDtc" ${live ? '' : 'disabled'}>Lire les codes</button><button class="btn small danger" data-act="clearDtc" ${live && L.dtc && L.dtc.length ? '' : 'disabled'}>Effacer</button></div>`)}
        ${mod('cold', 'Moteur froid en °C · turbo', `<div class="row between"><div><span class="n" data-k="ect" data-on="cold:cold"></span> <span class="u">°C</span></div><span class="s" data-k="oil"></span></div><div class="bar-t"><i data-bar="ect"></i></div><span class="s" data-k="coldMsg"></span>
          ${e.turbo ? `<div class="row between" style="margin-top:4px"><span class="k">Turbo</span><span class="t"><span data-k="boost"></span> bar</span></div><div class="bar-t"><i data-bar="boost"></i></div>` : `<p class="na">Moteur ${esc(e.name)} atmosphérique : pas de turbo à surveiller.</p>`}
          ${e.diesel ? `<div class="row between" style="margin-top:4px"><span class="k">Pression rail</span><span class="t"><span data-k="rail"></span> bar</span></div><div class="bar-t"><i data-bar="rail"></i></div><div class="row between"><span class="k">Vanne EGR</span><span class="t"><span data-k="egr"></span> %</span></div>` : ''}`)}
        ${mod('carplay', 'Portes · feux · marche arrière', `<div class="row" style="gap:16px;opacity:.5"><span class="ic">${icon('carplay')}</span><span class="t">Non disponible</span></div>`,
          na('Ces infos arrivent dans l\'autoradio par son décodeur CAN (canbox) ou ses fils, et la plupart des autoradios ne les partagent pas avec les applis. Elles ne sont pas gérées par cette version.'))}
      </div>${NATIVE ? `<div class="card col" style="margin-top:14px"><div class="row between"><h3 style="margin:0">Journal de connexion</h3><button class="btn small" data-act="logShare">Partager</button></div>
        <pre class="log" data-log>${esc(L.log.slice(-40).join('\n') || 'Le journal se remplit pendant la connexion au boîtier. En cas de souci, fais une capture d\'écran de ce cadre.')}</pre></div>` : ''}`;
    },

    trips() {
      const list = S.trips;
      const cur = S.cur ? `<button class="li" data-trip="-1"><span class="ic hot">${icon('route')}</span><span class="col fill" style="gap:2px"><span class="t">En cours</span><span class="s">Depuis ${hhmm(S.cur.start)}</span></span><span class="col" style="gap:2px;text-align:right"><span class="t" data-k="trip"></span><span class="s" data-k="tripDur"></span></span></button>` : '';
      const month = new Date().getMonth(), year = new Date().getFullYear();
      const monthTrips = list.filter((t) => { const d = new Date(t.start); return d.getMonth() === month && d.getFullYear() === year; });
      const mKm = monthTrips.reduce((a, t) => a + t.dist, 0), mDur = monthTrips.reduce((a, t) => a + t.dur, 0);
      const rows = list.map((t, i) => `<button class="li" data-trip="${i}" ${i === selTrip && !S.cur ? 'aria-current="true"' : ''}><span class="ic">${icon('route')}</span><span class="col fill" style="gap:2px"><span class="t">${dayLabel(t.start)} · ${hhmm(t.start)}</span><span class="s">${nf(t.max)} km/h maxi${t.hasFuel ? ' · ' + nf(t.fuel * (t.price || S.fuelPrice), 2) + ' €' : ''}</span></span><span class="col" style="gap:2px;text-align:right"><span class="t">${nf(t.dist, 1)} km</span><span class="s">${dur(t.dur)}</span></span></button>`).join('');
      const t = selTrip === -1 ? S.cur : list[selTrip];
      return `<h1 class="page-title">Mes trajets</h1><div class="trips-wrap"><div class="card"><div class="row between" style="margin-bottom:6px"><span class="k">Ce mois</span><span class="t">${nf(mKm, 0)} km · ${dur(mDur)}</span></div>
        <div class="list">${cur}${rows || (S.cur ? '' : '<p class="hint" style="padding:12px 0">Aucun trajet pour l\'instant. Ils s\'enregistrent tout seuls dès que tu roules.</p>')}</div></div>
        <div class="col" style="gap:14px">${t ? recapHtml(t) : '<div class="card"><p class="hint">Le récap 3D de ton trajet apparaîtra ici.</p></div>'}</div></div>`;
    },

    route() {
      const a = alerts().filter((x) => x.ic !== 'service' && x.ic !== 'warn' && x.ic !== 'cold');
      const t = outsideTemp();
      if (!a.some((x) => x.ic === 'snow')) a.unshift({ hot: false, ic: 'snow', text: t == null ? 'Verglas : température en attente (internet ou boîtier)' : 'Pas de verglas : ' + t + ' °C dehors (alerte dès 3 °C)' });
      if (!a.some((x) => x.ic === 'city')) { const z = nearestZfe(); a.push({ hot: false, ic: 'city', text: z ? 'ZFE la plus proche : ' + z.name + ' à ' + nf(Math.max(0, z.d - z.r), 0) + ' km' : 'ZFE : position GPS en attente' }); }
      if (!a.some((x) => x.ic === 'mount')) a.push({ hot: false, ic: 'mount', text: 'Loi Montagne : en vigueur du 1er novembre au 31 mars' });
      const st = L.stations;
      const stations = st && st.length ? st.map((s, i) => `<div class="li"><span class="ic ${i === 0 ? 'hot' : ''}">${icon('fuel')}</span><span class="col fill" style="gap:2px"><span class="t ell">${esc(s.name)}</span><span class="s">${nf(s.dist, 1)} km${i === 0 ? ' · le moins cher' : ''}</span></span><span class="n ${i === 0 ? 'acc' : ''}" style="font-size:24px">${nf(s.price, 3)} €</span></div>`).join('') : `<p class="hint" style="padding:10px 0">${esc(L.stationsErr || 'Touche « Actualiser » pour voir les prix autour de toi.')}</p>`;
      return `<h1 class="page-title">Route</h1><div class="route"><div class="col" style="gap:14px"><div class="card limit-big">${signHtml()}<div style="text-align:center"><div class="big" data-k="speed" data-on="over:over">0</div><div class="u">km/h</div></div></div>
        <div class="card"><h3>Alertes</h3><div class="list">${a.map((x) => `<div class="li"><span class="ic ${x.hot ? 'hot' : ''}">${icon(x.ic)}</span><span class="s fill" style="color:var(--fg)">${esc(x.text)}</span></div>`).join('')}</div></div></div>
        <div class="card"><div class="row between"><h3 style="margin:0">Prix du carburant · ${esc(S.fuelType)}</h3><button class="btn small" data-act="stations">Actualiser</button></div>
        <div class="list">${stations}</div>${st && st.length ? `<p class="hint">Source : prix-carburants (données publiques), mis à jour ${hhmm(L.stationsT)}. <button class="btn small" data-act="usePrice">Utiliser ${nf(st[0].price, 3)} € pour le coût des trajets</button></p>` : ''}</div></div>`;
    },

    led() {
      const l = S.led, st = L.led.state;
      const conn = !NATIVE ? `<p class="hint">Le pilotage des LED Bluetooth passe par l'appli Android (APK).</p>`
        : st === 'connected' ? `<div class="btns"><span class="pill ok">Connectées ${esc(L.led.info)}</span><button class="btn small" data-act="ledOff">Déconnecter</button></div>`
        : `<div class="btns"><button class="btn primary" data-act="ledScan">Trouver mes LED</button>${INFO.ledSaved ? '<button class="btn" data-act="ledResume">Reconnecter</button>' : ''}<span class="s">${st === 'connecting' ? 'Connexion…' : st === 'error' ? esc(L.led.info) : 'Rubans compatibles : ELK-BLEDOM, Triones, Happy Lighting, LEDnet.'}</span></div>`;
      const modes = [['color', 'Couleur'], ['night', 'Nuit'], ['music', 'Musique'], ['sport', 'Sport']];
      return `<h1 class="page-title">LED</h1><div class="grid" style="grid-template-columns:minmax(0,1fr)"><div class="card col"><div class="row between"><h3 style="margin:0">Ruban LED Bluetooth</h3>
        <label class="row"><span class="s">Allumées</span><span class="switch"><input type="checkbox" data-set="ledOn" ${l.on ? 'checked' : ''}><span></span></span></label></div>${conn}<div class="ledstrip"></div></div>
        <div class="card col"><h3>Mode</h3><div class="modes">${modes.map((m) => `<button type="button" data-ledmode="${m[0]}" aria-pressed="${l.mode === m[0]}">${m[1]}</button>`).join('')}</div>
        <p class="hint">${{ color: 'Une couleur fixe.', night: 'Lumière chaude tamisée pour rouler de nuit.', music: 'Les couleurs défilent et pulsent pendant la lecture de musique.', sport: 'L\'intensité suit l\'accélération réelle (boîtier OBD ou GPS).' }[l.mode]}</p></div>
        <div class="card col"><h3>Couleur</h3><div class="swatches">${LED_COLORS.map((c) => `<button type="button" style="--c:${c}" data-ledcolor="${c}" aria-pressed="${l.color === c}" aria-label="Couleur ${c}"></button>`).join('')}<input type="color" value="${l.color}" data-ledpick aria-label="Couleur libre" style="width:46px;height:46px;border:0;background:none;padding:0"></div>
        <div class="field"><label>Intensité · <span>${l.bright}</span> %</label><input type="range" min="5" max="100" value="${l.bright}" data-ledbright></div></div></div>`;
    },

    service() {
      const d = serviceDue();
      return `<h1 class="page-title">Entretien</h1><div class="grid" style="grid-template-columns:minmax(0,1fr)">
        <div class="card row between"><div class="col" style="gap:2px"><span class="k">Compteur · MiTo ${esc(engine().name)}</span><span class="n" data-k="odo"></span></div><button class="btn" data-act="setOdo">Corriger</button></div>
        <div class="card"><div class="list">${d.map((x) => `<div class="li" style="flex-wrap:wrap"><span class="ic ${x.level === 2 ? 'badbg' : x.level ? 'hot' : ''}">${icon('service')}</span>
          <span class="col fill" style="gap:4px;min-width:180px"><span class="t">${esc(x.name)}</span><span class="s ${x.level === 2 ? 'bad' : ''}">${esc(x.label)}</span><span class="bar-t"><i style="transform:scaleX(${x.frac.toFixed(3)});${x.level === 2 ? 'background:var(--bad)' : ''}"></i></span></span>
          <span class="btns"><button class="btn small" data-svcdone="${x.id}">Fait</button><button class="btn small" data-svcedit="${x.id}">Régler</button></span></div>`).join('')}</div>
        <p class="hint">Intervalles pré-réglés pour ta motorisation. Cale-les sur ton carnet d'entretien avec « Régler ».</p></div></div>`;
    },

    settings() {
      const e = S.engine;
      const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
      return `<h1 class="page-title">Réglages</h1><div class="grid" style="grid-template-columns:minmax(0,1fr)">
        <div class="card col"><h3>Ma MiTo</h3><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
          <div class="field"><label for="f-engine">Motorisation</label><select class="input" id="f-engine" data-set="engine">${Object.keys(ENGINES).map((k) => opt(k, e, ENGINES[k].name)).join('')}</select></div>
          <div class="field"><label for="f-fuel">Carburant</label><select class="input" id="f-fuel" data-set="fuelType">${Object.keys(FUELS).map((k) => opt(k, S.fuelType, k)).join('')}</select></div>
          <div class="field"><label for="f-price">Prix du litre (€)</label><input class="input" id="f-price" type="number" step="0.001" min="0.5" max="4" value="${S.fuelPrice}" data-set="fuelPrice"></div>
          <div class="field"><label for="f-cal">Correction conso (%)</label><input class="input" id="f-cal" type="number" step="1" min="50" max="150" value="${S.fuelCal || 100}" data-set="fuelCal"></div>
          <div class="field"><label for="f-crit">Vignette Crit'Air</label><select class="input" id="f-crit" data-set="critair">${['0', '1', '2', '3', '4', '5', 'aucune'].map((k) => opt(k, S.critair, k === 'aucune' ? 'Aucune' : k === '0' ? '0 (électrique)' : k)).join('')}</select></div></div></div>
        <div class="card col"><h3>Thème d'accueil · ${THEMES.length} thèmes</h3><div class="themes">${THEMES.map((t) => `<button type="button" data-theme="${t.id}" aria-pressed="${t.id === S.theme}" style="--tb:${t.bg};--tf:${t.fg};--ta:${t.acc}"><span>${t.name}</span><i></i></button>`).join('')}</div></div>
        <div class="card col"><h3>CarPlay en un glissement</h3><p class="hint">Le bouton CarPlay de la barre du bas, ou un glissement vers la gauche sur la voiture, ouvre l'appli de projection de l'écran. ZLink est choisi tout seul s'il est installé.</p>
          <div class="btns">${NATIVE ? `<button class="btn primary" data-act="pickCarplay">${S.carplay.pkg ? 'Appli : ' + esc(S.carplay.label) : 'Choisir l\'appli'}</button>${S.carplay.pkg ? '<button class="btn" data-act="carplay">Tester</button>' : ''}<button class="btn" data-act="findZlink">Rechercher ZLink</button>` : '<span class="s">Disponible dans l\'appli Android.</span>'}</div>
          ${NATIVE ? `<label class="row between"><span class="col" style="gap:2px"><span class="t">Ouvrir les applis à côté</span><span class="s">Écran partagé avec Dash 955 quand l'écran le permet (ZLink, Waze, Spotify…).</span></span><span class="switch"><input type="checkbox" data-set="split" ${S.split ? 'checked' : ''}><span></span></span></label>` : ''}</div>
        ${NATIVE ? startupCard() : ''}
        ${NATIVE ? `<div class="card col"><h3>Musique</h3><p class="hint">Pour afficher le titre et la pochette de n'importe quelle appli musique, autorise « Dash 955 · titre et pochette » dans l'accès aux notifications.</p><div class="btns"><span class="pill ${mediaOk() ? 'ok' : 'warn'}">${mediaOk() ? 'Autorisé' : 'Pas encore autorisé'}</span><button class="btn small" data-act="mediaAccess">Ouvrir le réglage</button></div></div>` : ''}
        <div class="card col"><h3>Essai</h3><label class="row between"><span class="col" style="gap:2px"><span class="t">Mode démo</span><span class="s">Trajet simulé avec données moteur, pour essayer l'appli à l'arrêt.</span></span><span class="switch"><input type="checkbox" data-set="demo" ${S.demo ? 'checked' : ''}><span></span></span></label></div>
        <div class="card col"><h3>Mes données</h3><p class="hint">${S.trips.length} trajets · ${nf(S.kmTotal, 0)} km enregistrés. Tout reste sur l'appareil.</p><div class="btns"><button class="btn" data-act="export">Exporter</button><button class="btn" data-act="import">Importer</button><button class="btn danger" data-act="reset">Tout effacer</button></div></div>
        <div class="card col"><h3>À propos</h3><p class="hint">Dash 955 ${esc(INFO.version || 'web')} · pour Alfa Romeo MiTo (2008 à 2018), réglée pour 2009.${INFO.model ? ' · ' + esc(INFO.model) : ''}${INFO.sdk ? ' · Android API ' + INFO.sdk : ''} · moteur web ${esc((navigator.userAgent.match(/Chrome\/(\d+)/) || [0, '?'])[1])}<br>Application indépendante, non affiliée à Alfa Romeo ni à Stellantis. Ne la règle pas en roulant.</p></div></div>`;
    },
  };

  /* -------------------------------------------------------- récap 3D -- */
  function recapHtml(t) {
    const pts = t.pts || [];
    let svg = '<p class="hint" style="position:absolute;inset:auto 16px 16px">Pas de tracé GPS pour ce trajet.</p>';
    if (pts.length > 1) {
      const lat0 = pts[0][0], k = Math.cos((lat0 * Math.PI) / 180);
      const xy = pts.map((p) => [(p[1] - pts[0][1]) * k * 111320, -(p[0] - lat0) * 110540, p[2]]);
      const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const span = Math.max(maxX - minX, maxY - minY, 50), sc = 180 / span;
      const ox = 100 - ((minX + maxX) / 2) * sc, oy = 100 - ((minY + maxY) / 2) * sc;
      const P = xy.map((p) => [(p[0] * sc + ox).toFixed(1), (p[1] * sc + oy).toFixed(1), p[2]]);
      let grid = '';
      for (let i = 0; i <= 200; i += 20) grid += `<line x1="${i}" y1="0" x2="${i}" y2="200"/><line x1="0" y1="${i}" x2="200" y2="${i}"/>`;
      const col = (v) => (v < 50 ? '#3ccf6e' : v < 90 ? 'var(--acc)' : '#ff3b2f');
      let segs = '', d = '';
      for (let i = 1; i < P.length; i++) {
        segs += `<path class="seg" stroke="${col(P[i][2])}" d="M${P[i - 1][0]} ${P[i - 1][1]}L${P[i][0]} ${P[i][1]}"/>`;
      }
      d = 'M' + P.map((p) => p[0] + ' ' + p[1]).join('L');
      svg = `<svg viewBox="0 0 200 200" aria-hidden="true"><g class="grid">${grid}</g><path class="shadow" d="${d}"/>${segs}<circle cx="${P[0][0]}" cy="${P[0][1]}" r="4.5" fill="#3ccf6e"/><circle cx="${P[P.length - 1][0]}" cy="${P[P.length - 1][1]}" r="4.5" fill="#ff3b2f"/></svg>`;
    }
    const avg = t.dur > 0 ? (t.dist / t.dur) * 3600 : 0;
    const cost = t.hasFuel ? t.fuel * (t.price || price()) : null;
    return `<div class="card col" style="gap:12px"><div class="row between"><span class="k">Récap 3D · ${t === S.cur ? 'en cours' : dayLabel(t.start) + ' ' + hhmm(t.start)}</span>${t !== S.cur ? `<button class="btn small danger" data-deltrip>Supprimer</button>` : ''}</div>
      <div class="plane">${svg}</div><div class="legend"><span><i style="background:#3ccf6e"></i>moins de 50</span><span><i style="background:var(--acc)"></i>50 à 90</span><span><i style="background:#ff3b2f"></i>plus de 90 km/h</span></div>
      <div class="stats"><div><span class="k">Distance</span><div class="n">${nf(t.dist, 1)}</div><span class="s">km</span></div><div><span class="k">Durée</span><div class="n">${dur(t.dur)}</div></div>
      <div><span class="k">Moyenne</span><div class="n">${nf(avg)}</div><span class="s">km/h</span></div><div><span class="k">Maxi</span><div class="n">${nf(t.max)}</div><span class="s">km/h</span></div>
      ${t.hasFuel ? `<div><span class="k">Conso</span><div class="n">${nf((t.fuel / Math.max(0.1, t.dist)) * 100, 1)}</div><span class="s">L/100 km</span></div><div><span class="k">Coût</span><div class="n acc">${nf(cost, 2)} €</div><span class="s">${nf(t.fuel, 2)} L</span></div>` : ''}
      <div><span class="k">Virage maxi</span><div class="n">${nf(t.maxLat, 2)}</div><span class="s">g</span></div><div><span class="k">Freinage maxi</span><div class="n">${nf(Math.max(0, t.maxBrk), 2)}</div><span class="s">g</span></div></div></div>`;
  }

  /* -------------------------------------------------------- feuilles -- */
  let sheetKind = '', sheetSeq = 0;
  function openSheet(title, html, kind) {
    sheetKind = kind || '';
    sheetSeq++;
    const sh = $('#sheet');
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet-body').scrollTop = 0;
    $('.sheet__card', sh).style.transform = '';
    if (sh.hidden) { sh.hidden = false; void sh.offsetWidth; }
    sh.classList.add('open');
  }
  function closeSheet() {
    const sh = $('#sheet'), seq = ++sheetSeq;
    if (sheetKind === 'welcome') { S.onboarded = true; save(); }
    sh.classList.remove('open');
    $('.sheet__card', sh).style.transform = '';
    sheetKind = '';
    setTimeout(() => { if (seq === sheetSeq) sh.hidden = true; }, REDUCE ? 0 : 220);
    render();
  }
  (function dragSheet() {
    const card = $('.sheet__card');
    let y0 = null, dy = 0;
    card.addEventListener('touchstart', (e) => {
      const inHead = e.target.closest('.sheet__head');
      const body = $('#sheet-body');
      if (!inHead && body.scrollTop > 0) return;
      y0 = e.touches[0].clientY; dy = 0; card.style.transition = 'none';
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      card.style.transform = `translate3d(0, ${dy}px, 0)`;
    }, { passive: true });
    card.addEventListener('touchend', () => {
      if (y0 == null) return;
      card.style.transition = '';
      y0 = null;
      if (dy > 110) closeSheet(); else card.style.transform = '';
    }, { passive: true });
  })();
  function renderDevices() {
    let paired = [];
    try { paired = (JSON.parse(call('obdDevices') || '{}').list) || []; } catch (e) { paired = []; }
    const row = (d, act) => devRow(d, act);
    const found = L.found.filter((d) => !paired.some((p) => p.addr === d.addr));
    found.sort(devSort);
    $('#sheet-body').innerHTML = `<p class="hint">Les boîtiers Bluetooth classiques s'appairent d'abord (code 1234 ou 0000). Les boîtiers « BLE » se connectent directement.</p>
      <div class="card"><h3>Appairés</h3><div class="list">${paired.length ? paired.sort((a, b) => (b.obd ? 1 : 0) - (a.obd ? 1 : 0)).map((d) => row(d, 'connect')).join('') : '<p class="hint">Aucun appareil appairé.</p>'}</div></div>
      <div class="card"><div class="row between"><h3 style="margin:0">À proximité</h3><button class="btn small" data-act="obdScan" ${L.scanning ? 'disabled' : ''}>${L.scanning ? 'Recherche…' : 'Rechercher'}</button></div>
      <div class="list">${found.map((d) => row(d, d.kind === 'classic' && !d.bonded ? 'pair' : 'connect')).join('') || '<p class="hint">Touche « Rechercher », boîtier branché et contact mis.</p>'}</div></div>
      <div class="btns"><button class="btn" data-act="btSettings">Réglages Bluetooth</button><button class="btn danger" data-act="obdForget">Oublier le boîtier</button></div>`;
  }
  const devSort = (a, b) => (b.rev ? 2 : 0) + (b.obd ? 1 : 0) - ((a.rev ? 2 : 0) + (a.obd ? 1 : 0)) || (b.rssi || -200) - (a.rssi || -200);
  function devRow(d, act) {
    const what = d.rev ? 'probablement ton RevKing' : d.obd ? 'ressemble à un boîtier OBD' : '';
    return `<button class="li" data-${act}="${esc(d.kind)}|${esc(d.addr)}"><span class="ic ${d.rev || d.obd ? 'hot' : ''}">${icon('bt')}</span><span class="col fill" style="gap:2px"><span class="t">${esc(d.name)}</span><span class="s">${d.kind === 'ble' ? 'Bluetooth basse conso.' : 'Bluetooth'}${what ? ' · ' + what : ''}${d.kind === 'classic' && d.bonded === false ? ' · à appairer' : ''}${d.rssi ? ' · signal ' + (d.rssi > -65 ? 'fort' : d.rssi > -85 ? 'moyen' : 'faible') : ''}</span></span><span class="pill ${d.rev || d.obd ? 'on' : ''}">Connecter</span></button>`;
  }
  function renderRevking() {
    const ble = L.found.filter((d) => d.kind === 'ble').sort(devSort);
    $('#sheet-body').innerHTML = `<ol class="steps">
        <li><b>Branche le RevKing</b> dans la prise OBD : sous la planche de bord, à gauche du volant, derrière la petite trappe.</li>
        <li><b>Mets le contact</b> (ou démarre le moteur).</li>
        <li><b>Ferme l'appli RevHeadz</b> sur ton téléphone, ou coupe son Bluetooth : le RevKing n'accepte qu'une connexion à la fois.</li>
        <li><b>Touche « Rechercher »</b>, puis ton boîtier dans la liste.</li></ol>
      <div class="btns"><button class="btn primary" data-act="revScan" ${L.scanning ? 'disabled' : ''}>${L.scanning ? 'Recherche… (15 s)' : 'Rechercher'}</button><button class="btn" data-act="revAuto">Détection automatique</button></div>
      <div class="list">${ble.map((d) => devRow(d, 'connect')).join('') || `<p class="hint">${L.scanning ? 'Recherche des boîtiers Bluetooth…' : 'Aucun boîtier trouvé pour l\'instant.'}</p>`}</div>
      <p class="hint">Le RevKing apparaît souvent sous un nom comme « REVKING », « OBDII » ou « OBDBLE ». S'il n'a pas de nom, essaie ceux marqués « ressemble à un boîtier OBD ».</p>`;
  }
  function renderLedList() {
    const list = L.ledFound.slice().sort((a, b) => (b.led ? 1 : 0) - (a.led ? 1 : 0));
    $('#sheet-body').innerHTML = `<p class="hint">Allume le ruban (et ferme l'appli fournie avec, elle bloque la connexion).</p>
      <div class="list">${list.map((d) => `<button class="li" data-ledconnect="${esc(d.addr)}"><span class="ic ${d.led ? 'hot' : ''}">${icon('led')}</span><span class="col fill" style="gap:2px"><span class="t">${esc(d.name)}</span><span class="s">${d.led ? 'Ruban LED compatible' : 'Appareil Bluetooth'}</span></span></button>`).join('') || `<p class="hint">${L.ledScanning ? 'Recherche…' : 'Aucun ruban trouvé.'}</p>`}</div>
      <button class="btn" data-act="ledScan" ${L.ledScanning ? 'disabled' : ''}>${L.ledScanning ? 'Recherche…' : 'Relancer la recherche'}</button>`;
  }
  function launchApp(pkg) { return S.split ? (call('launchSplit', pkg) || call('launch', pkg)) : call('launch', pkg); }
  function dial(num) { if (!NATIVE) { location.href = 'tel:' + num; return; } if (!call('dial', num)) { toast('Pas d\'appli d\'appel : ouverture du téléphone Bluetooth'); A.phoneApp(); } }
  function updDial() { const el = $('[data-dialnum]'); if (el) el.innerHTML = esc(dialNum) || '<span class="s">Compose un numéro</span>'; }
  let pickKind = '';
  function pickApp(kind, title, query) {
    pickKind = kind;
    openSheet(title, `<form class="searchbox" onsubmit="return false"><span class="ic">${icon('search')}</span><input class="input" id="pick-q" type="search" value="${esc(query || '')}" placeholder="Nom de l'appli" autocomplete="off"></form>
      <div class="list" id="pick-list"></div>
      <details class="hint"><summary>Saisir le nom du paquet</summary><div class="row" style="gap:8px;margin-top:8px"><input class="input" id="pick-pkg" placeholder="com.zjinnova.zlink"><button class="btn" data-act="pickPkg">Utiliser</button></div></details>`, 'pick');
    renderPick();
  }
  function renderPick() {
    const box = $('#pick-list'); if (!box) return;
    const q = ($('#pick-q') || {}).value || '';
    let list = [];
    if (q.trim()) list = findApps(q.trim().replace(/[.*+?^${}()[\]\\]/g, (c) => (c === '|' ? c : '\\' + c)));
    const all = appsList().filter((a) => !list.some((x) => x.pkg === a.pkg));
    const rows = (arr, dim) => arr.map((a) => `<button class="li" data-pickapp="${esc(a.pkg)}" data-label="${esc(a.label)}" ${dim ? 'style="opacity:.75"' : ''}><span class="ic">${icon('apps')}</span><span class="col fill" style="gap:2px"><span class="t">${esc(a.label)}</span><span class="s">${esc(a.pkg)}${a.launch === false ? ' · sans icône de lancement' : ''}</span></span></button>`).join('');
    box.innerHTML = (q.trim() ? (list.length ? '<p class="k" style="margin:6px 0">Trouvées</p>' + rows(list) : `<p class="hint">Aucune appli ne contient « ${esc(q)} ».</p>`) : '') + '<p class="k" style="margin:10px 0 4px">Toutes les applis</p>' + rows(all, true);
  }
  function startupCard() {
    let st = {};
    try { st = JSON.parse(call('startup') || '{}'); } catch (e) {}
    return `<div class="card col"><h3>Démarrage et connexion</h3>
      <label class="row between"><span class="col" style="gap:2px"><span class="t">Ouvrir Dash 955 au démarrage</span><span class="s">Quand l'écran de la voiture s'allume.</span></span><span class="switch"><input type="checkbox" data-set="autostart" ${st.autostart !== false ? 'checked' : ''}><span></span></span></label>
      ${st.needOverlay && !st.overlay ? `<div class="row between" style="gap:10px;flex-wrap:wrap"><span class="s fill">Android demande une autorisation pour ouvrir l'appli tout seul : « Afficher par-dessus les autres applis ».</span><button class="btn small primary" data-act="overlay">Autoriser</button></div>` : ''}
      <div class="row between" style="gap:10px;flex-wrap:wrap"><span class="s fill">Le plus fiable : faire de Dash 955 l'écran d'accueil. Il s'affiche alors à chaque allumage, et le bouton Accueil y revient.</span><button class="btn small" data-act="homeApp">Écran d'accueil</button></div>
      <label class="row between"><span class="col" style="gap:2px"><span class="t">Connexion automatique au boîtier OBD</span><span class="s">Au démarrage, au réveil de l'écran et quand le Bluetooth revient. Nouvel essai toutes les 30 s.</span></span><span class="switch"><input type="checkbox" data-set="obdAutoPref" ${st.obdAuto !== false ? 'checked' : ''}><span></span></span></label></div>`;
  }
  function appsSheet(pickFor) {
    let apps = [];
    try { apps = JSON.parse(call('apps') || '[]'); } catch (e) { apps = []; }
    const hint = /carplay|link|auto|kit|play|mirror|car|zlink|android auto/i;
    apps.sort((a, b) => (hint.test(b.label) ? 1 : 0) - (hint.test(a.label) ? 1 : 0));
    openSheet(pickFor ? 'Appli CarPlay' : 'Applications', `${pickFor ? '<p class="hint">Choisis l\'appli qui affiche CarPlay sur ton boîtier ou autoradio.</p>' : ''}<div class="list">${apps.map((a) => `<button class="li" data-${pickFor ? 'pickapp' : 'launch'}="${esc(a.pkg)}" data-label="${esc(a.label)}"><span class="ic">${icon(hint.test(a.label) ? 'carplay' : 'apps')}</span><span class="col fill"><span class="t">${esc(a.label)}</span><span class="s">${esc(a.pkg)}</span></span></button>`).join('') || '<p class="hint">Aucune appli trouvée.</p>'}</div>`, 'apps');
  }

  /* -------------------------------------------------------- actions -- */
  const A = {
    obdAuto() { L.found = []; L.log = []; L.userDetect = true; call('obdAuto'); toast('Recherche du boîtier…'); },
    revking() {
      if (!NATIVE) return toast('La connexion au boîtier se fait dans l\'appli Android');
      if (!INFO.btOn) call('enableBluetooth');
      openSheet('Mon RevKing', '', 'revking'); renderRevking();
      if (!L.found.length) A.revScan();
    },
    revScan() { L.scanning = true; L.found = []; call('obdScan'); renderRevking(); },
    revAuto() { L.log = []; L.userDetect = true; call('obdAuto'); closeSheet(); go('engine'); toast('Recherche du RevKing…'); },
    logShare() { const txt = 'Dash 955 · journal OBD\n' + (INFO.model || '') + '\n' + L.log.join('\n'); if (NATIVE) call('share', txt, 'Dash 955 · journal OBD'); },
    welcomeDemo() { S.demo = true; save(); startDemo(); closeSheet(); go('home'); },
    obdDevices() { openSheet('Boîtier OBD', '', 'devices'); renderDevices(); },
    obdScan() { L.scanning = true; L.found = []; call('obdScan'); renderDevices(); },
    obdWifi() { openSheet('Boîtier Wi-Fi', `<p class="hint">1. Connecte l'appareil au Wi-Fi du boîtier (souvent « WiFi_OBDII »). 2. Reviens ici et connecte. Adresse par défaut : 192.168.0.10, port 35000.</p>
      <div class="field"><label for="f-wifi">Adresse:port</label><input class="input" id="f-wifi" value="192.168.0.10:35000"></div><div class="btns"><button class="btn" data-act="wifiSettings">Réglages Wi-Fi</button><button class="btn primary" data-act="wifiGo">Connecter</button></div>`, 'wifi'); },
    wifiSettings() { call('settings', 'wifi'); },
    wifiGo() { call('obdConnect', 'wifi|' + ($('#f-wifi').value.trim() || '192.168.0.10:35000')); closeSheet(); },
    obdDisconnect() { if (L.demo) { S.demo = false; save(); stopDemo(); render(); return; } call('obdDisconnect'); },
    obdForget() { call('obdForget'); closeSheet(); toast('Boîtier oublié'); },
    btSettings() { call('settings', 'bluetooth'); },
    readDtc() { if (L.demo) { L.dtc = []; render(); return; } call('obdReadDtc'); toast('Lecture des codes…'); },
    clearDtc() {
      openSheet('Effacer les codes ?', `<p class="hint">Les codes défaut et le voyant moteur seront effacés. Fais-le moteur coupé, contact mis, et seulement si le problème est réglé : le voyant reviendra sinon.</p><div class="btns"><button class="btn danger" data-act="clearGo">Effacer</button><button class="btn" data-close>Annuler</button></div>`);
    },
    clearGo() { call('obdClearDtc'); closeSheet(); },
    stations() { fetchStations(true); },
    usePrice() { if (L.stations && L.stations[0]) { S.fuelPrice = +L.stations[0].price.toFixed(3); save(); toast('Prix enregistré : ' + nf(S.fuelPrice, 3) + ' €'); render(); } },
    ledScan() { L.ledScanning = true; L.ledFound = []; call('ledScan'); openSheet('Mes LED', '', 'leds'); renderLedList(); },
    ledResume() { if (INFO.ledSaved) call('ledConnect', INFO.ledSaved); },
    ledOff() { call('ledDisconnect'); },
    mediaAccess() { call('settings', 'media'); },
    carplay() {
      if (!NATIVE) return toast('CarPlay en un glissement : dans l\'appli Android');
      if (!S.carplay.pkg) autoCarplay();
      if (!S.carplay.pkg) return A.pickCarplay();
      if (!launchApp(S.carplay.pkg)) { toast(S.carplay.label + ' introuvable, choisis-le à nouveau'); A.pickCarplay(); }
    },
    pickCarplay() { pickApp('carplay', 'Appli CarPlay', 'zlink'); },
    findZlink() {
      S.carplay = { pkg: '', label: '' };
      const z = autoCarplay();
      if (z) { toast(z.label + ' sera ouvert par le bouton CarPlay'); render(); } else { toast('ZLink n\'est pas installé sous ce nom : cherche-le dans la liste'); A.pickCarplay(); }
    },
    apps() { openPanel('apps'); },
    navSearch() { closePanel(); searchSheet(''); },
    defineHome() { searchSheet('home'); },
    recenter() { recenter(); },
    clearDest() { dest = null; if (destMk && map) map.removeLayer(destMk); renderDest(); },
    goWaze() { navigate('waze'); },
    goMaps() { navigate('maps'); },
    setHome() { if (dest) { S.places = Object.assign({}, S.places, { home: dest }); save(); renderQuick(); toast('Maison enregistrée'); } },
    setWork() { if (dest) { S.places = Object.assign({}, S.places, { work: dest }); save(); renderQuick(); toast('Travail enregistré'); } },
    cheapFuel() {
      const st = L.stations && L.stations[0];
      if (!st || st.lat == null) { fetchStations(true); toast('Recherche des stations…'); setTimeout(() => { const s2 = L.stations && L.stations[0]; if (s2 && s2.lat != null) setDest({ name: s2.name, sub: nf(s2.price, 3) + ' € · ' + S.fuelType, lat: s2.lat, lon: s2.lon }); }, 4000); return; }
      setDest({ name: st.name, sub: nf(st.price, 3) + ' € · ' + S.fuelType, lat: st.lat, lon: st.lon });
    },
    dialDel() { dialNum = dialNum.slice(0, -1); updDial(); },
    dialCall() { if (!dialNum) return toast('Compose un numéro'); dial(dialNum); },
    favAdd() {
      openSheet('Nouveau favori', `<div class="field"><label for="fv-n">Nom</label><input class="input" id="fv-n" autocomplete="off"></div><div class="field"><label for="fv-p">Numéro</label><input class="input" id="fv-p" type="tel" inputmode="tel" value="${esc(dialNum)}"></div><button class="btn primary" data-act="favGo">Enregistrer</button>`);
      setTimeout(() => $('#fv-n') && $('#fv-n').focus(), 60);
    },
    favGo() { const n = $('#fv-n').value.trim(), num = $('#fv-p').value.trim(); if (num) { S.favs = (S.favs || []).concat([{ name: n || num, num }]); save(); } closeSheet(); },
    phoneApp() { if (S.phoneApp && S.phoneApp.pkg && launchApp(S.phoneApp.pkg)) return; pickApp('phone', 'Appli téléphone de l\'écran', 'bluetooth|bt|phone|téléphone|dial|appel|call|hands'); },
    smsApp() { if (S.smsApp && S.smsApp.pkg && launchApp(S.smsApp.pkg)) return; pickApp('sms', 'Appli messages de l\'écran', 'sms|messag|bluetooth|bt'); },
    spAdd() { const m = L.media, q = (m.artist || m.title || '').trim(); if (!q) return; S.spotQuick = [q].concat((S.spotQuick || []).filter((x) => x !== q)).slice(0, 8); save(); render(); },
    overlay() { call('settings', 'overlay'); },
    homeApp() { call('settings', 'home'); },
    pickPkg() { const v = ($('#pick-pkg').value || '').trim(); if (!v) return; pickChosen(v, v); },
    setOdo() {
      const o = odoNow();
      openSheet('Kilométrage', `<div class="field"><label for="f-odo">Kilomètres au compteur de ta MiTo</label><input class="input" id="f-odo" type="number" inputmode="numeric" min="0" value="${o == null ? '' : Math.round(o)}"></div><button class="btn primary" data-act="odoGo">Enregistrer</button>`);
      setTimeout(() => $('#f-odo') && $('#f-odo').focus(), 50);
    },
    odoGo() { const v = parseFloat($('#f-odo').value); if (!isNaN(v)) { S.odo = { base: v, atKm: S.kmTotal + (S.cur ? S.cur.dist : 0) }; save(); } closeSheet(); },
    export() {
      const json = JSON.stringify(S);
      if (NATIVE) call('share', json, 'Dash 955 · sauvegarde');
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'dash955-sauvegarde.json'; a.click(); }
    },
    import() { openSheet('Importer une sauvegarde', `<p class="hint">Colle ici le contenu d'une sauvegarde Dash 955.</p><textarea class="input" id="f-import"></textarea>${NATIVE ? '' : '<input type="file" accept="application/json" id="f-file">'}<button class="btn primary" data-act="importGo">Importer</button>`);
      const f = $('#f-file'); if (f) f.onchange = () => { const r = new FileReader(); r.onload = () => { $('#f-import').value = r.result; }; r.readAsText(f.files[0]); };
    },
    importGo() { try { const o = JSON.parse($('#f-import').value); if (!o || typeof o !== 'object' || !Array.isArray(o.trips)) throw new Error(); S = Object.assign(load(), o); save(true); applyTheme(); toast('Sauvegarde importée'); closeSheet(); } catch (e) { toast('Ce texte n\'est pas une sauvegarde Dash 955'); } },
    reset() { openSheet('Tout effacer ?', `<p class="hint">Trajets, entretien et réglages seront supprimés de cet appareil.</p><div class="btns"><button class="btn danger" data-act="resetGo">Tout effacer</button><button class="btn" data-close>Annuler</button></div>`); },
    resetGo() { S = JSON.parse(JSON.stringify(DEF)); save(true); applyTheme(); closeSheet(); toast('Données effacées'); },
  };

  function setSetting(key, el) {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'engine') {
      const old = engine();
      S.engine = v; const e = engine();
      S.fuelType = e.diesel ? 'Gazole' : S.fuelType === 'Gazole' ? 'SP95-E10' : S.fuelType;
      if (old.belt !== e.belt) { const fresh = presetService(v); S.service = fresh.map((f) => S.service.find((x) => x.id === f.id) || f); }
    } else if (key === 'fuelPrice') { const n = parseFloat(v); if (n > 0.3) S.fuelPrice = n; }
    else if (key === 'fuelCal') { const n = parseFloat(v); if (n >= 50 && n <= 150) S.fuelCal = n; }
    else if (key === 'demo') { S.demo = v; v ? startDemo() : stopDemo(); }
    else if (key === 'ledOn') { S.led.on = v; ledApply(true); }
    else if (key === 'sportLed') { S.led.mode = v ? 'sport' : 'color'; ledApply(true); }
    else if (key === 'fuelType') { S.fuelType = v; L.stations = null; }
    else if (key === 'split') { S.split = v; }
    else if (key === 'autostart') { call('setAutoStart', !!v); return; }
    else if (key === 'obdAutoPref') { call('setObdAuto', !!v); return; }
    else S[key] = v;
    save();
    if (['engine', 'fuelType', 'demo'].includes(key)) { if (panelKind) render(); renderCar(); }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-close]');
    if (!t) return;
    if (t.tagName === 'BUTTON' && !t.disabled) haptic();
    const d = t.dataset;
    if (d.close !== undefined) return closeSheet();
    if (d.go) return go(d.go);
    if (d.act && A[d.act]) return A[d.act]();
    if (d.media) { call('media', d.media); return; }
    if (d.theme) {
      const apply = () => { S.theme = d.theme; save(); applyTheme(); render(); };
      if (document.startViewTransition && !REDUCE) document.startViewTransition(apply); else apply();
      return;
    }
    if (d.trip !== undefined) { selTrip = +d.trip; render(); return; }
    if (d.deltrip !== undefined) { const t2 = S.trips[selTrip]; if (t2) { S.trips.splice(selTrip, 1); S.kmTotal = Math.max(0, S.kmTotal - t2.dist); selTrip = 0; save(); render(); } return; }
    if (d.connect) { call('obdConnect', d.connect); closeSheet(); go('engine'); return; }
    if (d.pair) { call('obdPair', d.pair.split('|')[1]); toast('Valide l\'appairage (code 1234 ou 0000), puis connecte'); return; }
    if (d.ledconnect) { call('ledConnect', d.ledconnect); INFO.ledSaved = d.ledconnect; closeSheet(); return; }
    if (d.ledmode) { S.led.mode = d.ledmode; save(); render(); ledApply(true); return; }
    if (d.ledcolor) { S.led.color = d.ledcolor; if (S.led.mode === 'night' || S.led.mode === 'music') S.led.mode = 'color'; save(); render(); ledApply(true); return; }
    if (d.pickapp) { pickChosen(d.pickapp, d.label); return; }
    if (d.launch) { if (!launchApp(d.launch)) toast('Impossible d\'ouvrir cette appli'); if (!$('#sheet').hidden) closeSheet(); return; }
    if (d.panel) { openPanel(d.panel, VEH.includes(d.panel) && VEH.includes(panelKind) ? (VEH.indexOf(d.panel) > VEH.indexOf(panelKind) ? 1 : -1) : 0); return; }
    if (d.open) { if (!call('launch', d.open)) toast('Appli introuvable'); return; }
    if (d.split) { if (!call('launchSplit', d.split)) call('launch', d.split); return; }
    if (d.vol) { readVolume(+d.vol); return; }
    if (d.key) { if (dialNum.length < 20) dialNum += d.key; updDial(); return; }
    if (d.favcall) { const f = (S.favs || [])[+d.favcall]; if (f) dial(f.num); return; }
    if (d.favdel) { S.favs.splice(+d.favdel, 1); save(); render(); return; }
    if (d.place) { const pl = (S.places || {})[d.place]; if (pl) setDest(pl); return; }
    if (d.recent !== undefined && d.recent !== '') { const r = (S.recents || [])[+d.recent]; if (r) { if (sheetKind === 'search') closeSheet(); setDest(r); } return; }
    if (d.result !== undefined) { const r = searchRes[+d.result]; if (!r) return; closeSheet(); if (d.mode === 'home' || d.mode === 'work') { S.places = Object.assign({}, S.places, { [d.mode]: r }); save(); renderQuick(); toast(d.mode === 'home' ? 'Maison enregistrée' : 'Travail enregistré'); } else setDest(r); return; }
    if (d.spq !== undefined) { const q = (S.spotQuick || [])[+d.spq]; if (q) spotify(q); return; }
    if (d.spdel !== undefined) { S.spotQuick.splice(+d.spdel, 1); save(); render(); return; }
    if (t.matches('[data-seek]')) {
      const m = L.media, r = t.getBoundingClientRect();
      if (m.dur && NATIVE) { const f = clamp((e.clientX - r.left) / r.width, 0, 1); call('seek', Math.round(f * m.dur)); L.media = Object.assign({}, m, { pos: f * m.dur, at: now() }); }
      return;
    }
    if (d.svcdone) { const x = S.service.find((y) => y.id === d.svcdone); if (x) { x.lastDate = new Date().toISOString().slice(0, 10); const o = odoNow(); if (o != null) x.lastKm = Math.round(o); save(); render(); toast(x.name + ' : noté'); } return; }
    if (d.svcedit) return editService(d.svcedit);
  });
  function pickChosen(pkg, label) {
    if (pickKind === 'phone') S.phoneApp = { pkg, label };
    else if (pickKind === 'sms') S.smsApp = { pkg, label };
    else { S.carplay = { pkg, label }; renderBar(); }
    save(); closeSheet();
    toast(pickKind === 'carplay' || !pickKind ? label + ' : bouton CarPlay de la barre du bas' : label + ' enregistré');
  }
  function spotify(q) {
    if (!NATIVE) return toast('Spotify se lance depuis l\'appli Android');
    const sp = findApps('spotify');
    if (!call('playSearch', q, sp.length ? sp[0].pkg : '')) toast('Spotify n\'est pas installé sur cet écran');
  }
  document.addEventListener('submit', (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.matches('[data-spotify]')) { const q = ($('#sp-q').value || '').trim(); if (q) { spotify(q); S.spotQuick = [q].concat((S.spotQuick || []).filter((x) => x !== q)).slice(0, 8); save(); } }
    else if (f.matches('[data-search]')) { clearTimeout(searchTimer); runSearch($('#q').value, f.dataset.search); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.set) setSetting(el.dataset.set, el);
    if (el.matches('[data-ledpick]')) { S.led.color = el.value; save(); render(); ledApply(true); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { const v = e.target.value, mode = e.target.closest('form').dataset.search; clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(v, mode), 350); return; }
    if (e.target.id === 'pick-q') { renderPick(); return; }
    if (e.target.id === 'app-q') { const q = e.target.value.trim().toLowerCase(); $$('#appgrid .app').forEach((a) => { a.hidden = q && !a.dataset.label.toLowerCase().includes(q); }); return; }
    if (e.target.matches('[data-ledbright]')) { S.led.bright = +e.target.value; e.target.previousElementSibling.querySelector('span').textContent = S.led.bright; save(); ledApply(); if (NATIVE) call('ledBrightness', S.led.bright); }
  });

  function welcome() {
    const e = S.engine;
    openSheet('Bienvenue dans Dash 955', `<p class="hint">Ton écran de bord pour Alfa Romeo MiTo. Trois réglages et c'est parti.</p>
      <div class="field"><label for="w-engine">1. Ta motorisation</label><select class="input" id="w-engine" data-set="engine">${Object.keys(ENGINES).map((k) => `<option value="${k}" ${k === e ? 'selected' : ''}>${ENGINES[k].name}</option>`).join('')}</select></div>
      ${NATIVE ? `<div class="field"><label>2. Ton boîtier OBD</label><button class="btn" data-act="revking">Connecter mon RevKing</button></div>
      <div class="field"><label>3. CarPlay en un glissement</label><button class="btn" data-act="pickCarplay">Choisir l'appli CarPlay</button></div>` : '<p class="hint">Sur iPhone, la vitesse GPS, les trajets, la route et l\'entretien marchent ici. Le boîtier OBD se connecte avec l\'appli Android.</p>'}
      <div class="btns"><button class="btn primary" data-close>C'est parti</button><button class="btn" data-act="welcomeDemo">Essayer en démo</button></div>`, 'welcome');
    S.onboarded = true; save();
  }
  function editService(id) {
    const x = S.service.find((y) => y.id === id); if (!x) return;
    openSheet(x.name, `<div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="field"><label for="s-km">Tous les (km)</label><input class="input" id="s-km" type="number" min="0" value="${x.km || ''}" placeholder="aucun"></div>
      <div class="field"><label for="s-mo">Tous les (mois)</label><input class="input" id="s-mo" type="number" min="0" value="${x.months || ''}" placeholder="aucun"></div>
      <div class="field"><label for="s-lkm">Dernière fois à (km)</label><input class="input" id="s-lkm" type="number" min="0" value="${x.lastKm == null ? '' : x.lastKm}"></div>
      <div class="field"><label for="s-ld">Dernière fois le</label><input class="input" id="s-ld" type="date" value="${x.lastDate || ''}"></div></div>
      <button class="btn primary" id="s-go">Enregistrer</button>`);
    $('#s-go').onclick = () => {
      const num = (v) => (v === '' ? null : Math.max(0, parseFloat(v)));
      x.km = num($('#s-km').value) || 0; x.months = num($('#s-mo').value) || 0; x.lastKm = num($('#s-lkm').value); x.lastDate = $('#s-ld').value || null;
      save(); closeSheet();
    };
  }

  /* glissements :
     - panneau de la voiture : gauche / droite = onglet suivant / précédent
     - en-tête d'un panneau : vers le bas = fermer
     - zone de la voiture : gauche = CarPlay, droite = applis
     - barre du bas : vers le haut = applis */
  let sw = null;
  document.addEventListener('touchstart', (e) => {
    if (!$('#sheet').hidden || e.touches.length > 1) return;
    const t = e.target;
    if (t.closest('input, select, textarea, .swatches, #map, .leaflet-container, .plane, [data-seek]')) return;
    const zone = t.closest('.panel__head') ? 'head' : t.closest('#panel') ? 'panel' : t.closest('#carpane') ? 'car' : t.closest('#bar') ? 'bar' : '';
    if (!zone) return;
    const p = e.touches[0]; sw = { x: p.clientX, y: p.clientY, t: now(), zone };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!sw || sw.zone !== 'head') return;
    const dy = Math.max(0, e.touches[0].clientY - sw.y), c = $('.panel__card');
    c.style.transition = 'none'; c.style.transform = `translate3d(0, ${dy}px, 0)`;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!sw) return;
    const p = e.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y, fast = now() - sw.t < 650, zone = sw.zone;
    sw = null;
    if (zone === 'head') {
      const c = $('.panel__card'); c.style.transition = ''; c.style.transform = '';
      if (dy > 90) closePanel();
      return;
    }
    if (!fast) return;
    if (zone === 'bar' && dy < -50 && Math.abs(dx) < 60) { openPanel('apps'); return; }
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (zone === 'car') { if (dx < 0) A.carplay(); else if (NATIVE) openPanel('apps'); return; }
    if (zone === 'panel' && VEH.includes(view)) {
      const i = VEH.indexOf(view);
      if (dx < 0 && i < VEH.length - 1) openPanel(VEH[i + 1], 1);
      else if (dx > 0 && i > 0) openPanel(VEH[i - 1], -1);
    }
  }, { passive: true });

  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  /* ------------------------------------------------------------ démo -- */
  let demoTimer = 0, demoT = 7, demoKm = 0;
  const KF = [[0, 0], [2.5, 0], [9, 46], [13, 52], [16, 34], [20, 31], [26, 68], [31, 84], [36, 80], [42, 80], [46, 58], [50, 33], [53, 40], [57, 12], [58.6, 0], [60, 0]];
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function demoSpeed(t) { for (let i = 0; i < KF.length - 1; i++) { const a = KF[i], b = KF[i + 1]; if (t >= a[0] && t <= b[0]) return a[1] + (b[1] - a[1]) * sm((t - a[0]) / (b[0] - a[0])); } return 0; }
  function startDemo() {
    if (demoTimer) return;
    L.demo = true; demoT = 7;
    let lat = 45.4642, lon = 9.19, brg = 40, cool = 44;
    H.media({ title: 'Strada Notturna', artist: 'Piste de démo', app: 'Démo', playing: true, pos: 72000, dur: 228000, speed: 1, at: now(), art: '' });
    demoTimer = setInterval(() => {
      demoT = (demoT + 0.25) % 60;
      const v = demoSpeed(demoT);
      if (demoT > 15 && demoT < 21) brg -= 3.2; else if (demoT > 47 && demoT < 52.5) brg += 6; else brg += Math.sin(demoT) * 0.3;
      const d = (v / 3.6) * 0.25; demoKm += d / 1000;
      lat += (d * Math.cos((brg * Math.PI) / 180)) / 110540; lon += (d * Math.sin((brg * Math.PI) / 180)) / (111320 * Math.cos((lat * Math.PI) / 180));
      H.gps({ lat, lon, spd: v / 3.6, brg: ((brg % 360) + 360) % 360, acc: 5, alt: 120, t: now() });
      const gear = v < 2 ? 0 : v < 18 ? 1 : v < 32 ? 2 : v < 50 ? 3 : v < 68 ? 4 : 5;
      const kmh1000 = [0, 7.4, 13.2, 19.4, 25.8, 31.8][gear] || 7.4;
      const rpm = gear ? Math.max(1100, (v / kmh1000) * 1000) : 840;
      const load = clamp(18 + L.accel * 22 + v / 3, 3, 98);
      cool = Math.min(90, cool + 0.12);
      H.obd({ spd: Math.round(v), rpm, load, map: Math.round(35 + load * 1.2), iat: 22, baro: 100, ect: Math.round(cool), volt: 14.1 + Math.sin(demoT) * 0.05, mil: false, dtcCount: 0, tps: load });
      if (!L.limit || now() - L.limit.t > 4000) L.limit = { v: demoT > 24 && demoT < 44 ? 80 : 50, t: now(), road: 'Exemple' };
      if (!L.weather) L.weather = { temp: 9, t: now() };
    }, 250);
    renderStatus(); renderBar(); renderCar();
  }
  function stopDemo() { clearInterval(demoTimer); demoTimer = 0; L.demo = false; L.o = {}; L.oT = 0; L.media = { none: true }; L.limit = null; renderStatus(); renderBar(); renderCar(); }

  /* ------------------------------------------------------------ boucle -- */
  let last = performance.now(), acc1 = 0, accA = 0, accM = 0;
  function loop(t) {
    const dt = Math.min(0.5, (t - last) / 1000); last = t;
    const g = L.gps;
    if (obdFresh() && L.o.spd != null) { L.speed = L.o.spd; L.speedSrc = 'obd'; }
    else if (g.t && now() - g.t < 4000 && g.spd >= 0) { L.speed = g.spd * 3.6; L.speedSrc = 'gps'; }
    else { L.speed = L.speed > 0.5 ? L.speed * 0.9 : 0; L.speedSrc = ''; }
    if (!obdFresh() && !(g.t && now() - g.t < 4000)) L.accel *= 0.9;
    L.fuelRate = fuelRate();
    const k = 1 - Math.exp(-dt * 7), k2 = 1 - Math.exp(-dt * 4);
    SM.speed += (L.speed - SM.speed) * k;
    SM.rpm += ((obdFresh() && L.o.rpm != null ? L.o.rpm : 0) - SM.rpm) * k;
    SM.accel += (L.accel - SM.accel) * k;
    SM.latG += (L.latG - SM.latG) * k;
    SM.tq += ((obdFresh() ? torque() || 0 : 0) - SM.tq) * k;
    SM.boost += ((obdFresh() ? Math.max(0, boost() || 0) : 0) - SM.boost) * k;
    SM.ect += ((L.o.ect != null ? L.o.ect : 40) - SM.ect) * k2;
    SM.rail += ((obdFresh() && L.o.rail != null ? L.o.rail : 0) - SM.rail) * k;
    tripTick(dt);
    tick(false);
    ledApply(false);
    acc1 += dt; accA += dt;
    if (acc1 > 1) { acc1 = 0; renderStatus(); }
    if (accA > 6) { accA = 0; const al = $('#carpane [data-alert]'); if (al) { const tmp = document.createElement('div'); tmp.innerHTML = alertLine(); al.replaceWith(tmp.firstElementChild); } if (dest) renderDest(); }
    accM += dt; if (accM > 0.5) { accM = 0; mapTick(); }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ démarrage -- */
  function webGps() {
    if (NATIVE || !navigator.geolocation) return;
    navigator.geolocation.watchPosition((p) => {
      const c = p.coords;
      H.gps({ lat: c.latitude, lon: c.longitude, spd: c.speed == null ? -1 : c.speed, brg: c.heading == null || isNaN(c.heading) ? -1 : c.heading, acc: c.accuracy, alt: c.altitude || 0, t: p.timestamp });
    }, (err) => { L.gpsErr = err.code === 1 ? 'perm' : 'nogps'; renderStatus(); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  /* ZLink (ou une autre appli CarPlay) choisi tout seul s'il est installé */
  function autoCarplay() {
    if (!NATIVE || S.carplay.pkg) return null;
    const list = findApps('zlink|zjinnova|carplay|car ?link|autokit|carbit|phonelink|easyconnect').filter((a) => a.launch);
    const z = list.find((a) => /zlink|zjinnova/i.test(a.label + ' ' + a.pkg)) || list.find((a) => /carplay/i.test(a.label)) || null;
    if (z) { S.carplay = { pkg: z.pkg, label: z.label }; save(); renderBar(); }
    return z;
  }
  applyTheme();
  renderStatus();
  renderBar();
  renderCar();
  renderQuick();
  initMap();
  if (S.demo || /[?&]demo=1/.test(location.search)) { S.demo = true; startDemo(); }
  if (!S.onboarded && !/[?&]demo=1/.test(location.search)) welcome();
  if (NATIVE) {
    autoCarplay();
    call('obdResume');
    if (INFO.ledSaved) call('ledConnect', INFO.ledSaved);
    call('mediaRefresh');
  } else {
    webGps();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeunload', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  requestAnimationFrame(loop);
})();

