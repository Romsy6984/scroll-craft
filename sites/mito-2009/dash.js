/* ==========================================================================
   Dash 955 · page logic

   The scroll engine (scrollcraft.js) is untouched. This file runs everything
   bespoke on the page:
     - a simulated drive, clearly labelled "Démo" on every screen
     - the head-unit renderer (one markup builder + one updater per module)
     - the two module acts, driven by the engine's --sc-p
     - the 13-theme picker, the DNA selector (D / N / A regrades the page)
     - the first-run form and the download link
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var CFG = window.DASH955 || {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var nf = function (n, d) {
    d = d || 0;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var hhmm = function () { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  /* ------------------------------------------------------------- icons -- */
  var ICONS = {
    themes:  '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="3.25"/>',
    carplay: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2.2"/><path d="M9 20h6M12 16v4"/>',
    music:   '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    speed:   '<path d="M4.5 16.5a7.5 7.5 0 1 1 15 0"/><path d="M12 16.5l3.6-4.2"/>',
    limit:   '<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    recap:   '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
    trips:   '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4.5V8h3.5"/><path d="M12 8v4l2.6 2"/>',
    led:     '<path d="M4.5 16h15"/><path d="M8 16a4 4 0 0 1 8 0"/><path d="M12 5.5v2.5M6.4 8l1.7 1.7M17.6 8l-1.7 1.7M3.5 12.5h2M18.5 12.5h2"/>',
    alerts:  '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.6 4.6 12 6l2.4-1.4M9.6 19.4 12 18l2.4 1.4M4.6 10.4l2.6.2-.9 2.4M19.4 13.6l-2.6-.2.9-2.4"/>',
    fuel:    '<path d="M5 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h11M7.5 9h4"/><path d="M14 10h1.8a1.7 1.7 0 0 1 1.7 1.7v4.5a1.5 1.5 0 0 0 3 0V9.5L18 7"/>',
    service: '<circle cx="8" cy="15.5" r="4"/><path d="M10.9 12.6 19.5 4M15.8 7.7l2.6 2.6M13.6 9.9l2 2"/>',
    body:    '<path d="M4 13 9 6h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h16M15 16h2"/>',
    sport:   '<path d="M13 3 5 13.5h6L10 21l9-11h-6z"/>',
    conso:   '<path d="M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    gauges:  '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l-3.4-4.4"/><path d="M12 8v1.2M7 10l.8.8M17 10l-.8.8"/><path d="M8.5 19.5h7"/>',
    g:       '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="14.6" cy="9.8" r="1.4" fill="currentColor"/>',
    signals: '<path d="M10.5 5.5 4 12l6.5 6.5V15H20V9h-9.5z"/>',
    battery: '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2.2"/><path d="M7.5 7.5V5.5h2v2M14.5 7.5V5.5h2v2M7 13.2h3M15.5 11.7v3M14 13.2h3"/>',
    cold:    '<path d="M4 10h2.5l1.5-2h6l1.5 2H18v2.5h2V10h1v6h-1v-2.5h-2V17h-3l-1.5 1.5h-5L7 17H4z"/>',
    route:   '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
    mount:   '<path d="M3 19 9.5 8l3.5 6 2-3 6 8z"/><path d="M8 10.5l1.5 1 1.3-1"/>',
    city:    '<path d="M4 20V9l5-3v14M9 20V4h7v16M16 20v-9l4 2v7M3 20h18"/>',
    prev:    '<path d="M18 6v12L9 12zM6 6v12"/>',
    pause:   '<path d="M9 5.5v13M15 5.5v13"/>',
    next:    '<path d="M6 6v12l9-6zM18 6v12"/>'
  };
  var icon = function (n, cls) { return '<svg viewBox="0 0 24 24" class="' + (cls || 'icn') + '" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; };

  /* ----------------------------------------------------------- the car -- */
  var ENGINES = {
    '14-78':      { name: '1.4 · 78 ch',              diesel: false, turbo: false, tq: 115, belt: true },
    '14tb-120':   { name: '1.4 TB · 120 ch',          diesel: false, turbo: true,  tq: 206, belt: true },
    '14tb-155':   { name: '1.4 TB · 155 ch',          diesel: false, turbo: true,  tq: 230, belt: true },
    '14ma-105':   { name: '1.4 MultiAir · 105 ch',    diesel: false, turbo: false, tq: 130, belt: true },
    '14ma-135':   { name: '1.4 MultiAir TB · 135 ch', diesel: false, turbo: true,  tq: 206, belt: true },
    '13jtdm-90':  { name: '1.3 JTDM · 90 ch',         diesel: true,  turbo: true,  tq: 200, belt: false },
    '16jtdm-120': { name: '1.6 JTDM · 120 ch',        diesel: true,  turbo: true,  tq: 320, belt: true }
  };
  var engine = ENGINES['14tb-155'];
  var fuelName = function () { return engine.diesel ? 'Gazole' : 'SP95-E10'; };
  /* Sample prices, labelled as such on screen. */
  var PRICES = { petrol: [1.749, 1.768, 1.789, 1.812], diesel: [1.659, 1.672, 1.698, 1.715] };
  var STATIONS = ['Station du Centre', 'Relais de la Rocade', 'Station de la Gare', 'Hyper Nord'];
  var DIST = ['0,8 km', '1,6 km', '2,1 km', '3,4 km'];
  var price = function () { return (engine.diesel ? PRICES.diesel : PRICES.petrol)[0]; };

  var THEMES = [
    { name: 'Nuit',       layout: 'digital', bg: '#0b0c0e', fg: '#f1efea', soft: '#8f8c86', card: '#17191c', acc: '#ece8e1' },
    { name: 'Rosso',      layout: 'digital', bg: '#130909', fg: '#f6eeec', soft: '#a58e8a', card: '#211211', acc: '#ff3b2f' },
    { name: 'Analogique', layout: 'analog',  bg: '#0a0a0b', fg: '#f4f4f2', soft: '#8b8b88', card: '#161617', acc: '#f4f4f2' },
    { name: 'Corsa',      layout: 'analog',  bg: '#0d0d10', fg: '#f2f0ee', soft: '#8f8c92', card: '#18181d', acc: '#ff5a2a' },
    { name: 'Carbone',    layout: 'cards',   bg: '#101113', fg: '#eceae6', soft: '#8d8b87', card: '#1d1e21', acc: '#c9c6c0' },
    { name: 'Minimal',    layout: 'min',     bg: '#08080a', fg: '#f3f3f1', soft: '#7d7d7a', card: '#141416', acc: '#f3f3f1' },
    { name: 'Glace',      layout: 'min',     bg: '#081018', fg: '#eaf5ff', soft: '#8199ad', card: '#0f1b26', acc: '#9ad7ff' },
    { name: 'Ambre LCD',  layout: 'digital', bg: '#0d0a05', fg: '#ffb347', soft: '#a17836', card: '#18120a', acc: '#ffb347' },
    { name: 'Jour',       layout: 'cards',   bg: '#ebe9e4', fg: '#151515', soft: '#5d5b56', card: '#ffffff', acc: '#cf271e', light: true },
    { name: 'Ardoise',    layout: 'cards',   bg: '#141a21', fg: '#e9eef3', soft: '#8897a6', card: '#1e2731', acc: '#8fb3d9' },
    { name: 'Tunnel',     layout: 'min',     bg: '#060607', fg: '#a8a59f', soft: '#62605b', card: '#0f0f11', acc: '#c9463d' },
    { name: 'Circuit',    layout: 'analog',  bg: '#0e0f0a', fg: '#f3f3ea', soft: '#909181', card: '#1a1b14', acc: '#e8d23a' },
    { name: 'Brume',      layout: 'digital', bg: '#d8dadc', fg: '#16181b', soft: '#565a60', card: '#eef0f2', acc: '#2d6fd6', light: true },
    { name: 'Ronaldo',    layout: 'cr7',     bg: '#0a0a0a', fg: '#ffffff', soft: '#9a9a9a', card: '#141414', acc: '#e4002b' }
  ];
  var themeIdx = 0;
  var dna = 'n';

  /* --------------------------------------------------------- simulation --
     One looped demo drive, 60 s: a red light, town, a bend, a faster road at
     80, a roundabout, back to a stop. Everything on every screen is computed
     from this state; nothing is a static picture. */
  var LOOP = 60;
  var SPEED_KF = [[0, 0], [2.5, 0], [9, 46], [13, 52], [16, 34], [20, 31], [26, 68], [31, 84], [36, 80],
                  [42, 80], [46, 58], [50, 33], [53, 40], [57, 12], [58.6, 0], [60, 0]];
  var CURVES = [{ a: 15, b: 21, r: 42, d: -1 }, { a: 47, b: 52.5, r: 17, d: 1 }];
  var BLINK = [{ a: 13.2, b: 16, d: -1 }, { a: 45.2, b: 48.4, d: 1 }];
  var LIMITS = [[0, 50], [24, 80], [44, 50]];
  var KMH1000 = [7.4, 13.2, 19.4, 25.8, 31.8, 37.6];

  var S = { t: 7, clock: 0, v: 0, a: 0, gear: 0, rpm: 850, load: 0.15, tq: 0, boost: 0, cool: 40,
            latg: 0, lng: 0, lph: 0.6, l100: 0, km: 0, L: 0, maxLat: 0, maxBrk: 0, blink: 0, hb: true,
            volt: 12.6, out: 11, beat: 0, limit: 50 };

  function speedAt(t) {
    for (var i = 0; i < SPEED_KF.length - 1; i++) {
      var A = SPEED_KF[i], B = SPEED_KF[i + 1];
      if (t >= A[0] && t <= B[0]) {
        var u = (t - A[0]) / (B[0] - A[0]);
        return { v: lerp(A[1], B[1], smooth(u)), dv: (B[1] - A[1]) * 6 * u * (1 - u) / (B[0] - A[0]) };
      }
    }
    return { v: 0, dv: 0 };
  }

  function step(dt) {
    S.clock += dt;
    S.t = (S.t + dt) % LOOP;
    var sp = speedAt(S.t);
    S.v = sp.v; S.a = sp.dv / 3.6;
    var dyn = dna === 'd';
    if (S.v < 2) { S.gear = 0; S.rpm = 840 + Math.sin(S.clock * 9) * 12; }
    else {
      var floor = engine.diesel ? (dyn ? 1900 : 1350) : (dyn ? 2600 : 1650);
      var g = 0;
      for (var i = 5; i >= 0; i--) { if (i === 0 || S.v / KMH1000[i] * 1000 >= floor) { g = i; break; } }
      S.gear = g + 1;
      S.rpm = Math.max(1000, S.v / KMH1000[g] * 1000);
    }
    var load = S.a < -0.25 ? 0.03 : clamp(0.16 + S.a * 0.3 + S.v / 280 + (dyn ? 0.05 : 0), 0.05, 1);
    S.load += (load - S.load) * Math.min(1, dt * 6);
    var curve = engine.turbo ? smooth((S.rpm - 900) / 1300) * 0.9 + 0.1 : smooth((S.rpm - 700) / 3300) * 0.85 + 0.15;
    S.tq = engine.tq * S.load * curve;
    S.boost = engine.turbo ? clamp((S.load - 0.28) * 1.7, -0.55, engine.diesel ? 1.25 : 1.15) : 0;
    S.lph = S.v < 2 ? (engine.diesel ? 0.45 : 0.62) : 0.35 + S.load * S.rpm / 1000 * (engine.diesel ? 2.0 : 2.75);
    S.l100 = S.v > 4 ? S.lph / S.v * 100 : 0;
    S.km += S.v * dt / 3600;
    S.L += S.lph * dt / 3600;

    var k = 0, dir = 0;
    CURVES.forEach(function (c) {
      if (S.t > c.a && S.t < c.b) { k = Math.sin(Math.PI * (S.t - c.a) / (c.b - c.a)) / c.r; dir = c.d; }
    });
    var vms = S.v / 3.6;
    S.latg = dir * vms * vms * k / 9.81;
    S.lng = S.a / 9.81;
    S.maxLat = Math.max(S.maxLat, Math.abs(S.latg));
    S.maxBrk = Math.max(S.maxBrk, -S.lng);

    S.blink = 0;
    BLINK.forEach(function (b) { if (S.t > b.a && S.t < b.b) S.blink = (Math.floor(S.clock * 3) % 2 === 0) ? b.d : 0; });
    S.hb = S.v < 0.3;
    S.cool = 90 - 50 * Math.exp(-S.clock / 28);
    S.volt = 14.12 + Math.sin(S.clock * 0.8) * 0.06 + S.load * 0.05;
    S.out = dna === 'a' ? 2 : 11;
    S.beat = Math.pow(Math.max(0, Math.cos(S.clock * Math.PI * 2 * 2.03)), 10);
    S.limit = 50;
    LIMITS.forEach(function (l) { if (S.t >= l[0]) S.limit = l[1]; });
  }

  /* ------------------------------------------------------- view helpers -- */
  var COVER = 'radial-gradient(circle at 68% 72%, #ffcf7a 0 13%, transparent 13.5%),' +
              'linear-gradient(160deg, #1c0d16 0%, #6b1022 46%, #e3261c 78%, #ff8a3d 100%)';

  function polar(r, a) { var t = a * Math.PI / 180; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; }
  function arc(r, a0, a1) {
    var s = polar(r, a0), e = polar(r, a1);
    return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
  }
  function gauge(key, mid) {
    var ticks = '';
    for (var i = 0; i <= 12; i++) {
      var a = 135 + i * 22.5, p = polar(38, a), q = polar(i % 2 ? 40 : 41.5, a);
      ticks += '<line class="tick" x1="' + p[0].toFixed(2) + '" y1="' + p[1].toFixed(2) + '" x2="' + q[0].toFixed(2) + '" y2="' + q[1].toFixed(2) + '"/>';
    }
    return '<div class="gauge"><svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="trk" d="' + arc(46, 135, 405) + '"/>' +
      '<path class="val" pathLength="1" stroke-dasharray="0 1" data-b="' + key + '-arc" d="' + arc(46, 135, 405) + '"/>' +
      ticks + '<line class="ndl" data-b="' + key + '-ndl" x1="50" y1="50" x2="50" y2="50"/></svg>' +
      '<div class="mid">' + mid + '</div></div>';
  }
  function setGauge(sc, key, f) {
    f = clamp(f, 0, 1);
    var a = sc.b[key + '-arc'], n = sc.b[key + '-ndl'];
    if (a) a.setAttribute('stroke-dasharray', f.toFixed(4) + ' 1');
    if (n) {
      var ang = 135 + f * 270, p = polar(30, ang), q = polar(42, ang);
      n.setAttribute('x1', p[0].toFixed(2)); n.setAttribute('y1', p[1].toFixed(2));
      n.setAttribute('x2', q[0].toFixed(2)); n.setAttribute('y2', q[1].toFixed(2));
    }
  }
  function txt(sc, k, v) { var el = sc.b[k]; if (el && el.__v !== v) { el.__v = v; el.textContent = v; } }
  function cls(sc, k, c, on) { var el = sc.b[k]; if (el) el.classList.toggle(c, !!on); }
  function bar(sc, k, f) { var el = sc.b[k]; if (el) el.style.transform = 'scaleX(' + clamp(f, 0, 1).toFixed(3) + ')'; }
  var kmh = function () { return String(Math.round(S.v)); };
  var tripMin = function () { return Math.max(1, Math.round(S.clock / 60)) + ' min'; };

  function musicCard(big) {
    return '<div class="c row" style="flex:' + (big ? 1.3 : 1) + '"><div class="cover" style="width:' + (big ? 12 : 9) + 'cqw;background:' + COVER + '"></div>' +
      '<div class="col fill" style="gap:0.5cqw"><span class="k">En lecture</span><span class="t">Strada Notturna</span>' +
      '<span class="s">Piste de démo</span><div class="bar-t" style="margin-top:0.6cqw"><i data-b="prog"></i></div></div></div>';
  }
  var signHtml = function (style) { return '<span class="sign" data-b="limit"' + (style ? ' style="' + style + '"' : '') + '>50</span>'; };

  function homeHtml(th) {
    if (th.layout === 'analog') {
      return '<div class="home-analog" style="height:100%">' +
        '<div class="col">' + musicCard(false) +
          '<div class="c col" style="gap:0.6cqw"><span class="k">Trajet</span><span class="n" data-b="trip">0,0 km</span><span class="s" data-b="dur">1 min</span></div></div>' +
        gauge('spd', '<span class="big" style="font-size:10.5cqw" data-b="v">0</span><span class="u">km/h</span>') +
        '<div class="col" style="align-items:center;gap:2cqw">' + signHtml('width:12cqw;font-size:4.4cqw;border-width:1.4cqw') +
          '<span class="s">Limitation</span><span class="n" data-b="out">11°</span><span class="s">dehors</span></div></div>';
    }
    if (th.layout === 'cr7') {
      return '<div style="height:100%;display:grid;grid-template-rows:1fr auto;gap:1.6cqw">' +
        '<div class="c" style="display:grid;place-items:center;position:relative;overflow:hidden">' +
        '<span style="position:absolute;right:6%;bottom:-14%;font-weight:800;font-size:46cqw;line-height:.8;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,0.09)">7</span>' +
        '<span style="position:absolute;left:2.2cqw;top:1.8cqw;font-weight:800;letter-spacing:.12em;font-size:1.9cqw">CR<span style="color:#e4002b">7</span></span>' +
        '<div style="position:relative"><span class="big" style="font-size:19cqw" data-b="v">0</span> <span class="u">km/h</span></div>' +
        '<span style="position:absolute;left:0;right:0;bottom:0;height:0.7cqw;background:linear-gradient(90deg,#00843d 0 40%,#e4002b 40% 100%)"></span></div>' +
        '<div class="row" style="gap:2cqw">' + signHtml('width:8cqw;font-size:3cqw;border-width:1cqw') + musicCard(false) +
        '<div class="col" style="gap:0.4cqw;text-align:right"><span class="n" data-b="out">11°</span><span class="s">dehors</span></div></div></div>';
    }
    if (th.layout === 'min') {
      return '<div class="home-min" style="height:100%"><div>' +
        '<div class="big" data-b="v">0</div><div class="row" style="justify-content:center;margin-top:3cqw;gap:3cqw">' +
        signHtml('width:7cqw;font-size:2.7cqw;border-width:0.9cqw') + '<span class="u">km/h</span><span class="u" data-b="out">11°</span></div></div></div>';
    }
    if (th.layout === 'cards') {
      return '<div class="home-cards" style="height:100%">' +
        '<div class="c wide col" style="justify-content:space-between"><span class="k">Vitesse GPS</span><div><span class="big" style="font-size:12cqw" data-b="v">0</span> <span class="u">km/h</span></div></div>' +
        '<div class="c col" style="justify-content:space-between;align-items:flex-start"><span class="k">Limitation</span>' + signHtml() + '</div>' +
        '<div class="c wide row" style="padding:2cqw"><div class="cover" style="width:13cqw;background:' + COVER + '"></div><div class="col fill" style="gap:0.5cqw"><span class="k">En lecture</span><span class="t">Strada Notturna</span><span class="s">Piste de démo</span><div class="bar-t"><i data-b="prog"></i></div></div></div>' +
        '<div class="c col" style="justify-content:space-between"><span class="k">' + fuelName() + '</span><span class="n">' + nf(price(), 3) + ' €</span><span class="s">à 0,8 km</span></div></div>';
    }
    return '<div class="home-digital" style="height:100%">' +
      '<div class="c speedbox"><div class="row" style="justify-content:space-between;align-items:flex-start"><span class="k">Vitesse GPS</span>' + signHtml() + '</div>' +
      '<div><span class="big" data-b="v">0</span> <span class="u">km/h</span></div>' +
      '<div class="row s" style="gap:1.4cqw"><span data-b="trip">0,0 km</span><span>·</span><span data-b="dur">1 min</span></div></div>' +
      '<div class="col">' + musicCard(true) +
        '<div class="c fill row" style="justify-content:space-between"><div class="col" style="gap:0.6cqw"><span class="k">Dehors</span><span class="n" data-b="out">11°</span></div>' +
        '<div class="col" style="gap:0.6cqw;text-align:right"><span class="k">Vidange</span><span class="t">dans 2 300 km</span></div></div></div></div>';
  }
  function homeUpd(sc) {
    txt(sc, 'v', kmh());
    txt(sc, 'limit', String(S.limit));
    cls(sc, 'v', 'over', S.v > S.limit + 0.5);
    txt(sc, 'trip', nf(S.km, 1) + ' km');
    txt(sc, 'dur', tripMin());
    txt(sc, 'out', S.out + '°');
    bar(sc, 'prog', ((S.clock + 72) % 228) / 228);
    setGauge(sc, 'spd', S.v / 180);
  }

  /* -------------------------------------------------------------- views -- */
  var VIEWS = {
    home: { html: function (sc) { return homeHtml(sc.theme); }, upd: homeUpd },

    themes: {
      html: function (sc) {
        return homeHtml(sc.theme) + '<span class="chip on" style="position:absolute;left:50%;top:-5.6cqw;translate:-50% 0;padding:0.7cqw 1.8cqw;font-size:1.7cqw">' +
          'Thème ' + (sc.cycle + 1) + ' sur ' + THEMES.length + ' · ' + sc.theme.name + '</span>';
      },
      upd: function (sc) {
        homeUpd(sc);
        if (sc.vt > 2.1) { sc.cycle = (sc.cycle + 1) % THEMES.length; applyTheme(sc, THEMES[sc.cycle]); setView(sc, 'themes', true); }
      }
    },

    carplay: {
      html: function (sc) {
        var tiles = ['#4a7bd8', '#3fb36b', '#e0574a', '#e8a63a', '#7f8ea3', '#38a9a0', '#c8c5bf', '#d9677f'];
        return '<div class="swipe" data-b="sw"><div>' + homeHtml(sc.theme) + '</div>' +
          '<div class="col" style="justify-content:center;height:100%"><div class="proj">' +
          tiles.map(function (c) { return '<span style="--tile:' + c + '"></span>'; }).join('') +
          '</div><p class="s" style="text-align:center;margin:0">CarPlay, via l\'appli de projection de l\'autoradio</p></div></div>' +
          '<span class="finger" data-b="fg"></span>';
      },
      upd: function (sc) {
        homeUpd(sc);
        var p = (sc.vt % 5.4) / 5.4, s;
        if (p < 0.2) s = 0; else if (p < 0.36) s = smooth((p - 0.2) / 0.16);
        else if (p < 0.82) s = 1; else if (p < 0.94) s = 1 - smooth((p - 0.82) / 0.12); else s = 0;
        var sw = sc.b.sw, fg = sc.b.fg;
        if (sw) sw.style.transform = 'translate3d(' + (-50 * s).toFixed(2) + '%,0,0)';
        if (fg) {
          var fp = clamp((p - 0.15) / 0.24, 0, 1);
          fg.style.opacity = (p > 0.14 && p < 0.4) ? String(1 - Math.abs(fp - 0.5) * 1.2) : '0';
          fg.style.left = (78 - 58 * smooth(fp)).toFixed(1) + '%';
        }
      }
    },

    music: {
      html: function () {
        return '<div class="row" style="height:100%;gap:4.5cqw;padding:0 2cqw">' +
          '<div class="cover" style="width:33cqw;background:' + COVER + ';box-shadow:0 2cqw 5cqw -1cqw rgba(0,0,0,0.6)"></div>' +
          '<div class="col fill" style="gap:1.2cqw"><span class="k">En lecture · appli musique</span>' +
          '<span style="font-size:4.8cqw;font-weight:650;letter-spacing:-0.035em;line-height:1.05">Strada Notturna</span>' +
          '<span class="s" style="font-size:2.3cqw">Piste de démo</span>' +
          '<div class="bar-t" style="margin-top:2.2cqw"><i data-b="prog"></i></div>' +
          '<div class="row s" style="justify-content:space-between"><span data-b="el">1:12</span><span>3:48</span></div>' +
          '<div class="row" style="gap:6cqw;margin-top:1.2cqw">' + icon('prev') + icon('pause') + icon('next') + '</div></div></div>';
      },
      upd: function (sc) {
        var e = (S.clock + 72) % 228;
        bar(sc, 'prog', e / 228);
        txt(sc, 'el', Math.floor(e / 60) + ':' + pad(Math.floor(e % 60)));
      }
    },

    speed: {
      html: function () {
        return '<div style="height:100%;display:grid;place-items:center;text-align:center"><div>' +
          '<div class="big" style="font-size:27cqw" data-b="v">0</div>' +
          '<div class="u" style="font-size:2.6cqw;margin-top:2cqw">km/h · GPS de l\'autoradio</div></div></div>';
      },
      upd: function (sc) { txt(sc, 'v', kmh()); }
    },

    limit: {
      html: function () {
        return '<div class="row" style="height:100%;justify-content:center;gap:7cqw">' +
          '<div style="text-align:right"><div class="big" style="font-size:23cqw" data-b="v">0</div><div class="u" style="margin-top:1.4cqw">km/h</div></div>' +
          signHtml('width:23cqw;border-width:2.7cqw;font-size:9cqw') + '</div>';
      },
      upd: function (sc) {
        txt(sc, 'v', kmh()); txt(sc, 'limit', String(S.limit));
        cls(sc, 'v', 'over', S.v > S.limit + 0.5);
      }
    },

    recap: {
      html: function (sc) {
        var grid = '';
        for (var i = 0; i <= 200; i += 20) grid += '<line x1="' + i + '" y1="0" x2="' + i + '" y2="200"/><line x1="0" y1="' + i + '" x2="200" y2="' + i + '"/>';
        var d1 = 'M24 176 C44 168 52 146 74 140 S108 150 118 128',
            d2 = 'M118 128 C128 106 160 104 170 82 S168 40 140 34',
            d3 = 'M140 34 C118 28 96 46 80 38 S58 20 40 24';
        var acc = getComputedStyle(sc.glass).getPropertyValue('--hu-acc').trim() || '#ece8e1';
        return '<div class="recap"><div class="plane"><svg viewBox="0 0 200 200" aria-hidden="true"><g class="grid">' + grid + '</g>' +
          '<path class="rt-sh" d="' + d1 + ' ' + d2.slice(d2.indexOf('C')) + ' ' + d3.slice(d3.indexOf('C')) + '"/>' +
          '<path class="rt" pathLength="1" data-b="r1" stroke="#3ccf6e" d="' + d1 + '"/>' +
          '<path class="rt" pathLength="1" data-b="r2" stroke="' + acc + '" d="' + d2 + '"/>' +
          '<path class="rt" pathLength="1" data-b="r3" stroke="#ff3b2f" d="' + d3 + '"/>' +
          '<circle cx="24" cy="176" r="4" fill="#3ccf6e"/><circle cx="40" cy="24" r="4" fill="#ff3b2f"/></svg></div>' +
          '<div class="col" style="justify-content:center;gap:1.6cqw"><span class="k">Trajet terminé</span><span class="t" style="font-size:3cqw">Maison → Bureau</span>' +
          '<div class="list"><div class="li"><span class="s fill">Distance</span><span class="t">12,4 km</span></div>' +
          '<div class="li"><span class="s fill">Durée</span><span class="t">18 min</span></div>' +
          '<div class="li"><span class="s fill">Moyenne</span><span class="t">41 km/h</span></div>' +
          '<div class="li"><span class="s fill">Maxi</span><span class="t">84 km/h</span></div></div>' +
          '<span class="s">Exemple de trajet</span></div></div>';
      },
      upd: function (sc) {
        var p = (sc.vt % 6.5) / 2.6;
        ['r1', 'r2', 'r3'].forEach(function (k, i) {
          var el = sc.b[k]; if (!el) return;
          var f = clamp(p * 3 - i, 0, 1);
          el.setAttribute('stroke-dasharray', f.toFixed(3) + ' 1');
        });
      }
    },

    trips: {
      html: function () {
        var rows = [['Maison → Plage', 'Samedi · 10:05', '38,2 km', '41 min'],
                    ['Bureau → Maison', 'Hier · 18:40', '13,1 km', '24 min'],
                    ['Maison → Bureau', 'Hier · 08:09', '12,4 km', '19 min']];
        return '<div class="col" style="height:100%;gap:0.6cqw"><div class="row" style="justify-content:space-between">' +
          '<span class="k">Mes trajets</span><span class="s">Ce mois : <b class="acc">412 km</b> · 9 h 40</span></div><div class="list">' +
          '<div class="li"><div class="alert-ic hot">' + icon('route') + '</div><div class="col fill" style="gap:0.3cqw"><span class="t">En cours</span><span class="s">Depuis ' + hhmm() + '</span></div>' +
          '<div style="text-align:right"><div class="t" data-b="trip">0,0 km</div><div class="s" data-b="dur">1 min</div></div></div>' +
          rows.map(function (r) {
            return '<div class="li"><div class="alert-ic">' + icon('route') + '</div><div class="col fill" style="gap:0.3cqw"><span class="t">' + r[0] + '</span><span class="s">' + r[1] + '</span></div>' +
              '<div style="text-align:right"><div class="t">' + r[2] + '</div><div class="s">' + r[3] + '</div></div></div>';
          }).join('') + '</div></div>';
      },
      upd: function (sc) { txt(sc, 'trip', nf(S.km, 1) + ' km'); txt(sc, 'dur', tripMin()); }
    },

    led: {
      html: function () {
        var sw = ['#ff3b2f', '#ff8a3d', '#ffd23f', '#3ccf6e', '#38bdf8', '#6d7cff', '#ece8e1'];
        return '<div class="col" style="height:100%;justify-content:center;gap:3.6cqw;padding:0 3cqw">' +
          '<div class="row" style="justify-content:space-between"><span class="k">Ruban LED · Bluetooth</span><span class="t" data-b="mode">Couleur</span></div>' +
          '<div class="strip" data-b="strip"></div>' +
          '<div class="row" style="justify-content:space-between"><div class="chips"><span class="chip" data-b="c0">Couleur</span><span class="chip" data-b="c1">Nuit</span><span class="chip" data-b="c2">Musique</span></div>' +
          '<div class="sw">' + sw.map(function (c, i) { return '<span style="--c:' + c + '" data-b="w' + i + '"></span>'; }).join('') + '</div></div></div>';
      },
      upd: function (sc) {
        var st = ledViewState(sc);
        txt(sc, 'mode', ['Couleur', 'Nuit', 'Musique'][st.mode]);
        for (var i = 0; i < 3; i++) cls(sc, 'c' + i, 'on', st.mode === i);
        for (var j = 0; j < 7; j++) cls(sc, 'w' + j, 'on', st.mode === 0 && st.sw === j);
        var s = sc.b.strip;
        if (s) { s.style.setProperty('--strip', st.c); s.style.opacity = st.i.toFixed(2); }
      }
    },

    alerts: {
      html: function () {
        var m = new Date().getMonth();
        var montagne = m >= 10 || m <= 2;
        return '<div class="col" style="height:100%;justify-content:center"><div class="list">' +
          '<div class="li"><div class="alert-ic" data-b="ice-ic">' + icon('alerts') + '</div><div class="col fill" style="gap:0.4cqw"><span class="t" data-b="ice-t">Pas de verglas</span><span class="s" data-b="ice-s"></span></div><span class="badge" data-b="ice-b" style="visibility:hidden">Alerte</span></div>' +
          '<div class="li"><div class="alert-ic' + (montagne ? ' hot' : '') + '">' + icon('mount') + '</div><div class="col fill" style="gap:0.4cqw"><span class="t">Loi Montagne</span><span class="s">Pneus hiver, ou chaînes à bord, dans les communes concernées du 1er novembre au 31 mars</span></div>' +
          '<span class="badge"' + (montagne ? '' : ' style="background:var(--hu-line);color:var(--hu-fg)"') + '>' + (montagne ? 'En vigueur' : 'Dès le 1er nov.') + '</span></div>' +
          '<div class="li"><div class="alert-ic">' + icon('city') + '</div><div class="col fill" style="gap:0.4cqw"><span class="t">ZFE à 2,4 km</span><span class="s">Accès selon ta vignette Crit\'Air · exemple</span></div><span class="badge" style="background:var(--hu-line);color:var(--hu-fg)">Info</span></div>' +
          '</div></div>';
      },
      upd: function (sc) {
        var ice = S.out <= 3;
        txt(sc, 'ice-t', ice ? 'Risque de verglas' : 'Pas de verglas');
        txt(sc, 'ice-s', ice ? S.out + ' °C dehors · prudence sur les ponts et à l\'ombre' : S.out + ' °C dehors · alerte dès 3 °C (essaie le mode A)');
        cls(sc, 'ice-ic', 'hot', ice);
        var b = sc.b['ice-b']; if (b) b.style.visibility = ice ? 'visible' : 'hidden';
      }
    },

    fuel: {
      html: function () {
        var pr = engine.diesel ? PRICES.diesel : PRICES.petrol;
        return '<div class="col" style="height:100%;gap:0.6cqw"><div class="row" style="justify-content:space-between">' +
          '<span class="k">Autour de toi · ' + fuelName() + '</span><span class="s">prix d\'exemple</span></div><div class="list">' +
          STATIONS.map(function (n, i) {
            return '<div class="li"><div class="alert-ic' + (i === 0 ? ' hot' : '') + '">' + icon('fuel') + '</div><div class="col fill" style="gap:0.3cqw"><span class="t">' + n + '</span><span class="s">' + DIST[i] + (i === 0 ? ' · le moins cher' : '') + '</span></div>' +
              '<span class="n' + (i === 0 ? ' acc' : '') + '" style="font-size:3.6cqw">' + nf(pr[i], 3) + ' €</span></div>';
          }).join('') + '</div></div>';
      }
    },

    service: {
      html: function () {
        var rows = [
          ['Vidange', 'dans 2 300 km', 0.84],
          engine.belt ? ['Courroie de distribution', 'dans 18 600 km', 0.7] : ['Chaîne de distribution', 'pas de remplacement prévu', 0],
          ['Contrôle technique', 'avant le 14 mars 2027', 0.42],
          ['Pneus hiver', 'loi Montagne : à monter', 1]
        ];
        return '<div class="col" style="height:100%;justify-content:center;gap:2.2cqw">' +
          '<div class="row" style="justify-content:space-between"><span class="k">Entretien · MiTo ' + engine.name + '</span><span class="s">compteur 148 230 km</span></div>' +
          rows.map(function (r) {
            return '<div class="col" style="gap:0.9cqw"><div class="row" style="justify-content:space-between"><span class="t">' + r[0] + '</span><span class="s">' + r[1] + '</span></div>' +
              '<div class="bar-t"><i style="transform:scaleX(' + r[2] + ')' + (r[2] >= 1 ? ';background:#ff4a3d' : '') + '"></i></div></div>';
          }).join('') + '<span class="s">Intervalles à ajuster selon ton carnet d\'entretien</span></div>';
      }
    },

    body: {
      html: function (sc) {
        var id = 'beam-' + sc.id;
        return '<div class="bodyv"><div class="car"><svg viewBox="-10 -60 140 280" aria-hidden="true">' +
          '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.75"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>' +
          '<radialGradient id="' + id + 'r"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
          '<polygon class="beam" data-b="b1" style="fill:url(#' + id + ')" points="34,24 14,-56 52,-56 46,24"/>' +
          '<polygon class="beam" data-b="b2" style="fill:url(#' + id + ')" points="74,24 68,-56 106,-56 86,24"/>' +
          '<circle class="rev" data-b="rv" style="fill:url(#' + id + 'r)" cx="60" cy="214" r="22"/>' +
          '<path class="door" data-b="dl" style="transform-box:view-box;transform-origin:28px 80px" d="M27.5 80 Q25 110 27.5 140 L31.5 140 Q29.5 110 31.5 80 Z"/>' +
          '<path class="door" data-b="dr" style="transform-box:view-box;transform-origin:92px 80px" d="M92.5 80 Q95 110 92.5 140 L88.5 140 Q90.5 110 88.5 80 Z"/>' +
          '<path class="shell" d="M60 18 C78 18 88 24 90 40 L92 70 C93 110 93 150 91 178 C90 194 82 202 60 202 C38 202 30 194 29 178 C27 150 27 110 28 70 L30 40 C32 24 42 18 60 18 Z"/>' +
          '<path class="glass" d="M36 66 C44 60 76 60 84 66 L80 88 C70 85 50 85 40 88 Z"/>' +
          '<path class="glass" d="M40 152 C50 155 70 155 80 152 L83 168 C72 172 48 172 37 168 Z"/>' +
          '<path class="door" data-b="hy" style="transform-box:view-box;transform-origin:60px 186px" d="M33 184 C44 192 76 192 87 184 L88 194 C80 203 40 203 32 194 Z"/>' +
          '<ellipse class="lamp" cx="41" cy="25" rx="7" ry="3"/><ellipse class="lamp" cx="79" cy="25" rx="7" ry="3"/>' +
          '<circle cx="38" cy="195" r="4" fill="#ff3b2f"/><circle cx="82" cy="195" r="4" fill="#ff3b2f"/>' +
          '</svg></div><div class="col" style="gap:0"><span class="k" style="margin-bottom:1cqw">MiTo · 3 portes</span><div class="list">' +
          '<div class="li"><span class="s fill">Portes</span><span class="t" data-b="d-t">Fermées</span></div>' +
          '<div class="li"><span class="s fill">Hayon</span><span class="t" data-b="h-t">Fermé</span></div>' +
          '<div class="li"><span class="s fill">Feux</span><span class="t">Croisement</span></div>' +
          '<div class="li"><span class="s fill">Marche arrière</span><span class="t" data-b="r-t">Non</span></div></div></div></div>';
      },
      upd: function (sc) {
        var ph = Math.floor((sc.vt % 12) / 3);
        var b1 = sc.b.b1, b2 = sc.b.b2;
        if (b1) b1.style.opacity = '1';
        if (b2) b2.style.opacity = '1';
        var rv = sc.b.rv; if (rv) rv.style.opacity = ph === 1 ? '1' : '0';
        var dl = sc.b.dl; if (dl) { dl.style.transform = ph === 2 ? 'rotate(52deg)' : 'none'; dl.classList.toggle('open', ph === 2); }
        var hy = sc.b.hy; if (hy) { hy.style.transform = ph === 3 ? 'translateY(13px)' : 'none'; hy.classList.toggle('open', ph === 3); }
        txt(sc, 'd-t', ph === 2 ? 'Conducteur ouverte' : 'Fermées');
        txt(sc, 'h-t', ph === 3 ? 'Ouvert' : 'Fermé');
        txt(sc, 'r-t', ph === 1 ? 'Enclenchée' : 'Non');
        cls(sc, 'd-t', 'acc', ph === 2); cls(sc, 'h-t', 'acc', ph === 3); cls(sc, 'r-t', 'acc', ph === 1);
      }
    },

    /* ---- with the OBD box ---- */
    sport: {
      html: function () {
        var segs = ''; for (var i = 0; i < 16; i++) segs += '<i data-b="s' + i + '"' + (i > 12 ? ' class="hi"' : '') + '></i>';
        return '<div class="col" style="height:100%;justify-content:center;gap:3.2cqw;padding:0 1cqw">' +
          '<div class="row" style="justify-content:space-between"><span class="k">Mode sport · LED</span><span class="s"><b data-b="gear">N</b> · <span data-b="rpm">850</span> tr/min</span></div>' +
          '<div class="segs">' + segs + '</div>' +
          '<div class="row" style="justify-content:space-between;align-items:flex-end"><div><span class="big" style="font-size:12cqw" data-b="ga">0,00</span> <span class="u">g en accélération</span></div>' +
          '<div style="text-align:right"><span class="n" data-b="v">0</span> <span class="u">km/h</span></div></div></div>';
      },
      upd: function (sc) {
        var x = clamp(S.lng / 0.3, 0, 1), on = Math.round(x * 16);
        for (var i = 0; i < 16; i++) cls(sc, 's' + i, 'on', i < on);
        txt(sc, 'ga', nf(Math.max(0, S.lng), 2));
        txt(sc, 'gear', S.gear ? S.gear + 'e' : 'N');
        txt(sc, 'rpm', nf(Math.round(S.rpm / 10) * 10));
        txt(sc, 'v', kmh());
      }
    },

    conso: {
      html: function () {
        return '<div class="home-cards" style="height:100%">' +
          '<div class="c wide col" style="justify-content:space-between"><span class="k">Conso instantanée</span>' +
          '<div><span class="big" style="font-size:12.5cqw" data-b="inst">0,0</span> <span class="u" data-b="instu">L/100 km</span></div><div class="bar-t"><i data-b="ib"></i></div></div>' +
          '<div class="c col" style="justify-content:space-between"><span class="k">Moyenne</span><span class="n" data-b="avg">0,0</span><span class="s">L/100 km</span></div>' +
          '<div class="c col" style="justify-content:space-between"><span class="k">Coût du trajet</span><span class="n acc" data-b="cost">0,00 €</span><span class="s">' + fuelName() + ' · ' + nf(price(), 3) + ' €</span></div>' +
          '<div class="c col" style="justify-content:space-between"><span class="k">Distance</span><span class="n" data-b="km">0,0</span><span class="s">km</span></div>' +
          '<div class="c col" style="justify-content:space-between"><span class="k">Carburant</span><span class="n" data-b="L">0,00</span><span class="s">litres</span></div></div>';
      },
      upd: function (sc) {
        var stopped = S.v <= 4;
        txt(sc, 'inst', nf(stopped ? S.lph : Math.min(S.l100, 39.9), 1));
        txt(sc, 'instu', stopped ? 'L/h à l\'arrêt' : 'L/100 km');
        bar(sc, 'ib', stopped ? 0.05 : S.l100 / 25);
        txt(sc, 'avg', S.km > 0.05 ? nf(S.L / S.km * 100, 1) : '-');
        txt(sc, 'cost', nf(S.L * price(), 2) + ' €');
        txt(sc, 'km', nf(S.km, 1));
        txt(sc, 'L', nf(S.L, 2));
      }
    },

    gauges: {
      html: function () {
        return '<div class="tri">' +
          '<div class="col" style="align-items:center;gap:1cqw">' + gauge('rpm', '<span class="n" data-b="rpm">850</span><span class="u">tr/min</span>') + '<span class="k">Régime</span></div>' +
          '<div class="col" style="align-items:center;gap:1cqw">' + gauge('tq', '<span class="n" data-b="tq">0</span><span class="u">N·m estimé</span>') + '<span class="k">Couple</span></div>' +
          '<div class="col" style="align-items:center;gap:1cqw">' + gauge('cool', '<span class="n" data-b="cool">40</span><span class="u">°C</span>') + '<span class="k">Eau</span></div></div>';
      },
      upd: function (sc) {
        txt(sc, 'rpm', nf(Math.round(S.rpm / 10) * 10)); setGauge(sc, 'rpm', S.rpm / (engine.diesel ? 5000 : 7000));
        txt(sc, 'tq', String(Math.round(S.tq))); setGauge(sc, 'tq', S.tq / (engine.tq * 1.05));
        txt(sc, 'cool', String(Math.round(S.cool))); setGauge(sc, 'cool', (S.cool - 40) / 90);
      }
    },

    g: {
      html: function () {
        return '<div class="row" style="height:100%;gap:5.5cqw;justify-content:center">' +
          '<div class="gball" style="width:35cqw"><i data-b="dot"></i></div>' +
          '<div class="col" style="gap:2.4cqw"><div><span class="k">Virage</span><div class="n" data-b="lat">0,00 g</div></div>' +
          '<div><span class="k">Freinage</span><div class="n" data-b="brk">0,00 g</div></div>' +
          '<div class="s">Maxi du trajet<br>virage <b data-b="mlat">0,00</b> g · freinage <b data-b="mbrk">0,00</b> g</div></div></div>';
      },
      upd: function (sc) {
        var d = sc.b.dot;
        if (d) {
          d.style.left = (50 - clamp(S.latg / 0.6, -1, 1) * 44).toFixed(2) + '%';
          d.style.top = (50 + clamp(S.lng / 0.6, -1, 1) * 44).toFixed(2) + '%';
        }
        txt(sc, 'lat', nf(Math.abs(S.latg), 2) + ' g');
        txt(sc, 'brk', nf(Math.max(0, -S.lng), 2) + ' g');
        txt(sc, 'mlat', nf(S.maxLat, 2)); txt(sc, 'mbrk', nf(S.maxBrk, 2));
      }
    },

    signals: {
      html: function () {
        return '<div class="row" style="height:100%;justify-content:space-around">' +
          '<svg class="arrow" data-b="L" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 5 3 12l7 7v-4.5h11v-5H10z"/></svg>' +
          '<div class="col" style="align-items:center;gap:2cqw"><div class="park" data-b="P">P</div><span class="t" data-b="Pt">Frein à main serré</span><span class="s" data-b="Ps"></span></div>' +
          '<svg class="arrow" data-b="R" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 5l7 7-7 7v-4.5H3v-5h11z"/></svg></div>';
      },
      upd: function (sc) {
        cls(sc, 'L', 'on', S.blink < 0); cls(sc, 'R', 'on', S.blink > 0);
        cls(sc, 'P', 'on', S.hb);
        txt(sc, 'Pt', S.hb ? 'Frein à main serré' : 'Frein à main desserré');
        txt(sc, 'Ps', S.hb ? 'à l\'arrêt' : kmh() + ' km/h');
      }
    },

    battery: {
      html: function () {
        return '<div class="row" style="height:100%;gap:4cqw">' +
          '<div class="col fill" style="gap:1.6cqw"><span class="k">Batterie</span><div><span class="big" style="font-size:15cqw" data-b="volt">14,1</span> <span class="u">V</span></div>' +
          '<span class="s">Charge correcte · alternateur actif</span><div class="bar-t"><i data-b="vb"></i></div></div>' +
          '<div class="c fill col" style="gap:0.6cqw"><span class="k">Voyants</span><div class="list">' +
          '<div class="li"><span class="t fill">Codes défaut moteur</span><span class="badge">0</span></div>' +
          '<div class="li"><span class="t fill">Voyant moteur</span><span class="s">éteint</span></div>' +
          '<div class="li"><span class="t fill">Au démarrage</span><span class="s">12,6 V</span></div></div></div></div>';
      },
      upd: function (sc) { txt(sc, 'volt', nf(S.volt, 1)); bar(sc, 'vb', (S.volt - 11.5) / 3.2); }
    },

    cold: {
      html: function () {
        return '<div class="row" style="height:100%;gap:4cqw">' +
          '<div class="col fill" style="gap:1.4cqw"><span class="k">Température d\'eau</span><div><span class="big" style="font-size:15cqw" data-b="cool">40</span> <span class="u">°C</span></div>' +
          '<span class="t" data-b="msg">Moteur froid</span><span class="s" data-b="msg2"></span><div class="bar-t"><i data-b="cb"></i></div></div>' +
          '<div class="c fill col" style="gap:1.4cqw"><span class="k">Turbo · ' + engine.name + '</span>' +
          (engine.turbo
            ? '<div><span class="n" data-b="boost">0,0</span> <span class="u">bar</span></div><div class="bar-t"><i data-b="bb"></i></div><span class="s">Pression de suralimentation</span>'
            : '<span class="t">Moteur atmosphérique</span><span class="s">Pas de turbo à surveiller sur cette motorisation.</span>') +
          '</div></div>';
      },
      upd: function (sc) {
        var c = 38 + 52 * (1 - Math.exp(-sc.vt / 16));
        if (reduce) c = 46;
        var cold = c < 70;
        txt(sc, 'cool', String(Math.round(c)));
        cls(sc, 'cool', 'cold', cold);
        txt(sc, 'msg', cold ? 'Moteur froid' : 'Moteur chaud');
        txt(sc, 'msg2', cold ? 'Ménage-le : pas de hauts régimes avant 70 °C' : 'Tu peux exploiter tout le moteur');
        bar(sc, 'cb', (c - 30) / 70);
        txt(sc, 'boost', nf(Math.max(0, S.boost), 1));
        bar(sc, 'bb', S.boost / 1.3);
      }
    }
  };

  /* ------------------------------------------------------------ screens -- */
  function applyTheme(sc, th) {
    sc.theme = th;
    var g = sc.glass.style;
    g.setProperty('--hu-bg', th.bg); g.setProperty('--hu-fg', th.fg); g.setProperty('--hu-soft', th.soft);
    g.setProperty('--hu-card', th.card); g.setProperty('--hu-acc', th.acc);
    g.setProperty('--hu-line', th.light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.08)');
    if (th.light) sc.glass.setAttribute('data-light', ''); else sc.glass.removeAttribute('data-light');
  }

  function statusHtml(sc) {
    return '<span class="st"><b data-s="clock">' + hhmm() + '</b><span data-s="out">' + S.out + ' °C</span></span>' +
      '<span class="st"><span class="on"><i class="dot"></i>GPS</span><span class="' + (sc.obd ? 'on' : '') + '"><i class="dot"></i>OBD</span><span class="demo">DÉMO</span></span>';
  }

  var LABELS = {};
  function setView(sc, view, keepTime) {
    var first = sc.current !== view;
    sc.current = view;
    if (!keepTime) sc.vt = 0;
    if (view === 'themes' && first) { sc.cycle = themeIdx; applyTheme(sc, THEMES[sc.cycle]); }
    if (view !== 'themes' && sc.theme !== THEMES[themeIdx]) applyTheme(sc, THEMES[themeIdx]);
    if (keepTime && view === 'themes') sc.vt = 0;
    sc.view.innerHTML = '<div class="v"' + (keepTime ? ' style="animation:none"' : '') + '>' + VIEWS[view].html(sc) + '</div>';
    sc.b = {};
    $$('[data-b]', sc.view).forEach(function (el) { sc.b[el.getAttribute('data-b')] = el; });
    sc.el.setAttribute('aria-label', 'Démo de l\'écran Dash 955 : ' + (LABELS[view] || 'accueil'));
    if (VIEWS[view].upd) VIEWS[view].upd(sc, 0);
  }

  var screens = $$('[data-screen]').map(function (el) {
    el.setAttribute('role', 'img');
    el.innerHTML = '<div class="hu__frame"><div class="hu__glass" aria-hidden="true"><div class="hu__status"></div><div class="hu__view"></div></div></div>' +
      '<div class="hu__led" aria-hidden="true"><i></i></div>';
    var sc = {
      el: el, id: el.getAttribute('data-screen'), obd: el.hasAttribute('data-obd'),
      glass: $('.hu__glass', el), status: $('.hu__status', el), view: $('.hu__view', el), led: $('.hu__led i', el),
      current: null, vt: 0, b: {}, visible: true, cycle: 0, theme: THEMES[0]
    };
    applyTheme(sc, THEMES[themeIdx]);
    sc.status.innerHTML = statusHtml(sc);
    return sc;
  });

  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { screens.forEach(function (sc) { if (sc.el === e.target) sc.visible = e.isIntersecting; }); });
    }, { rootMargin: '120px 0px' });
    screens.forEach(function (sc) { vio.observe(sc.el); });
  }

  /* ---------------------------------------------------------------- LED --
     Every head unit has a strip under it, and it behaves like the real one
     would for whatever the screen is showing. */
  function ledViewState(sc) {
    var mode = Math.floor((sc.vt % 9) / 3);
    var sw = ['#ff3b2f', '#ff8a3d', '#ffd23f', '#3ccf6e', '#38bdf8', '#6d7cff', '#ece8e1'];
    if (mode === 0) { var k = Math.floor((sc.vt % 3) / 0.6) % 7; return { mode: 0, sw: k, c: sw[k], i: 0.95 }; }
    if (mode === 1) return { mode: 1, sw: -1, c: '#ffb347', i: 0.28 };
    var hue = (S.clock * 40) % 360;
    return { mode: 2, sw: -1, c: 'hsl(' + hue.toFixed(0) + ' 90% 60%)', i: 0.25 + S.beat * 0.75 };
  }
  function dnaColor(sc) { return dna === 'd' ? '#ff3b2f' : dna === 'a' ? '#9ad7ff' : sc.theme.acc; }
  function led(sc) {
    var c = dnaColor(sc), i = 0.5 + Math.sin(S.clock * 1.3) * 0.08, w = 1, v = sc.current;
    if (v === 'led') { var st = ledViewState(sc); c = st.c; i = st.i; }
    else if (v === 'music') { i = 0.22 + S.beat * 0.78; }
    else if (v === 'sport' || (dna === 'd' && sc.obd)) {
      var x = clamp(S.lng / 0.3, 0, 1);
      c = x > 0.8 ? '#ff3b2f' : c; i = 0.25 + x * 0.75; w = 0.06 + x * 0.94;
    }
    if (reduce) { i = 0.6; w = 1; }
    var s = sc.led.style;
    s.setProperty('--led-c', c); s.setProperty('--led-i', i.toFixed(3)); s.setProperty('--led-w', w.toFixed(3));
  }

  /* -------------------------------------------------------- module acts -- */
  var acts = $$('[data-mods]').map(function (sec) {
    var feats = $$('.feat', sec);
    var A = {
      sec: sec, feats: feats, idx: -1, lockUntil: 0, focusY: null,
      screen: screens.filter(function (s) { return sec.contains(s.el); })[0],
      cap: $('[data-caption]', sec), stage: $('[data-sc-stage]', sec)
    };
    feats.forEach(function (b, i) {
      var ic = document.createElement('span');
      ic.className = 'feat__ic'; ic.setAttribute('aria-hidden', 'true');
      ic.innerHTML = icon(b.getAttribute('data-icon'), '');
      b.insertBefore(ic, b.firstChild);
      LABELS[b.getAttribute('data-view')] = $('.feat__t', b).textContent;
      b.addEventListener('click', function () { goTo(A, i); });
      b.addEventListener('focus', function () { A.focusY = scrollY; setIdx(A, i); });
    });
    return A;
  });
  LABELS.home = 'accueil';

  function setIdx(A, i) {
    if (i === A.idx) return;
    A.idx = i;
    A.feats.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    var b = A.feats[i];
    var label = $('.feat__t', b).textContent.replace(/\*$/, '');
    A.cap.innerHTML = '<b>' + label + '.</b> ' + $('[data-detail]', b).textContent;
    setView(A.screen, b.getAttribute('data-view'));
    A.stage.setAttribute('data-sc-verify-state', A.sec.getAttribute('data-mods') + ':' + i);
  }
  function goTo(A, i) {
    var top = A.sec.getBoundingClientRect().top + scrollY;
    var travel = A.sec.offsetHeight - innerHeight;
    var y = Math.round(top + travel * (i + 0.5) / A.feats.length);
    A.lockUntil = performance.now() + 1100;
    A.focusY = null;
    setIdx(A, i);
    scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function updateAct(A, now) {
    if (now < A.lockUntil) return;
    if (A.focusY !== null) { if (Math.abs(scrollY - A.focusY) < 48) return; A.focusY = null; }
    var p = parseFloat(A.sec.style.getPropertyValue('--sc-p'));
    if (isNaN(p)) p = 0;
    setIdx(A, clamp(Math.floor(p * A.feats.length), 0, A.feats.length - 1));
  }

  /* ------------------------------------------------------------- themes -- */
  var dots = $('[data-theme-dots]'), themeName = $('[data-theme-name]');
  var heroScreen = screens.filter(function (s) { return s.id === 'hero'; })[0];
  THEMES.forEach(function (th, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--a', th.bg); b.style.setProperty('--b', th.acc);
    b.setAttribute('aria-label', 'Thème ' + th.name);
    b.setAttribute('aria-pressed', i === themeIdx ? 'true' : 'false');
    b.addEventListener('click', function () { setTheme(i); });
    dots.appendChild(b);
  });
  function setTheme(i) {
    themeIdx = i;
    $$('button', dots).forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    themeName.textContent = THEMES[i].name;
    screens.forEach(function (sc) {
      if (sc.current === 'themes') return;
      applyTheme(sc, THEMES[i]);
      if (sc.current === 'home' || sc.current === 'carplay') setView(sc, sc.current, true);
    });
  }

  /* ---------------------------------------------------------------- DNA --
     The page's signature: one control, three states, and every surface on the
     page follows it at once. Accent, screens, LED strips, the simulated drive
     (D shifts later, A drops the outside temperature to 2 °C). */
  var dnaBtns = $$('[data-dna-set]');
  function setDna(d, focus) {
    dna = d;
    root.setAttribute('data-dna', d);
    dnaBtns.forEach(function (b) {
      var on = b.getAttribute('data-dna-set') === d;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    S.out = d === 'a' ? 2 : 11;
    screens.forEach(function (sc) {
      if (sc.current) setView(sc, sc.current, true);
      var o = $('[data-s="out"]', sc.status); if (o) o.textContent = S.out + ' °C';
    });
  }
  dnaBtns.forEach(function (b, i) {
    b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
    b.addEventListener('click', function () { setDna(b.getAttribute('data-dna-set')); });
    b.addEventListener('keydown', function (e) {
      var k = e.key, n = dnaBtns.length, j = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
      if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
      if (j > -1) { e.preventDefault(); setDna(dnaBtns[j].getAttribute('data-dna-set'), true); }
    });
  });

  /* ----------------------------------------------------- first-run form -- */
  var engSel = $('[data-engine]'), out = $('[data-setup-out]');
  function renderSetup() {
    engine = ENGINES[engSel.value] || engine;
    var box = ($('[data-obd-choice]:checked') || {}).value === '1';
    var items = [];
    items.push('Carburant : ' + (engine.diesel ? 'gazole' : 'SP95-E10 ou SP98') + ', pour les prix des stations et le coût des trajets.');
    items.push(engine.belt ? 'Rappel de courroie de distribution activé, à caler sur ton carnet.' : 'Chaîne de distribution : pas de rappel de courroie.');
    if (box) {
      items.push(engine.turbo ? 'Pression de turbo affichée en bar.' : 'Moteur atmosphérique : pas de jauge de turbo.');
      items.push('Clignotants et frein à main : pas encore gérés (réseau carrosserie B-CAN).');
    } else {
      items.push('Les 7 options moteur s\'ajoutent dès que tu branches un boîtier OBD.');
    }
    out.innerHTML = '<p class="sum">' + (box ? 19 : 12) + ' options pour ta MiTo ' + engine.name + '</p><ul>' +
      items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    screens.forEach(function (sc) {
      if (['home', 'service', 'fuel', 'cold', 'conso'].indexOf(sc.current) > -1) setView(sc, sc.current, true);
    });
  }
  if (engSel) {
    engSel.addEventListener('change', renderSetup);
    $$('[data-obd-choice]').forEach(function (r) { r.addEventListener('change', renderSetup); });
    renderSetup();
  }

  /* ----------------------------------------------------------- download -- */
  var file = CFG.fichier || 'telechargement/dash955.apk';
  var dl = $$('[data-download]');
  var meta = $('[data-file-meta]');
  dl.forEach(function (a) { a.setAttribute('href', file); });
  if (meta) meta.textContent = 'Gratuit · fichier APK · version ' + (CFG.version || '1.0') + ' · ' + (CFG.android || 'Android 8 ou plus récent');
  if (location.protocol.indexOf('http') === 0 && /^[^:]+$/.test(file.split('?')[0].split('#')[0].replace(/^\.?\//, ''))) {
    fetch(file, { method: 'HEAD' }).then(function (r) {
      if (r.ok) return;
      dl.forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (meta) meta.textContent = 'Le fichier arrive très bientôt sur cette page.';
          var card = $('#telecharger'); if (card && !card.contains(a)) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        });
      });
      console.info('[Dash 955] Fichier introuvable : ' + file + '. Dépose ton APK à cet emplacement ou change "fichier" dans index.html.');
    }).catch(function () {});
  }

  /* --------------------------------------------------- bar: clock, tabs -- */
  var clockEl = $('[data-clock]');
  var tabs = $$('.bar__tabs a');
  var tabTargets = tabs.map(function (a) { return $(a.getAttribute('href')); });
  function clocks() {
    var t = hhmm();
    if (clockEl) clockEl.textContent = t;
    screens.forEach(function (sc) { var c = $('[data-s="clock"]', sc.status); if (c && c.textContent !== t) c.textContent = t; });
  }
  var lastTab = -1;
  function tabsFrame() {
    var line = innerHeight * 0.4, cur = 0;
    tabTargets.forEach(function (el, i) { if (el && el.getBoundingClientRect().top <= line) cur = i; });
    if (cur !== lastTab) {
      lastTab = cur;
      tabs.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
  }

  /* --------------------------------------------------------------- loop -- */
  if (reduce) { S.t = 30.5; S.clock = 400; S.km = 7.8; S.L = 0.52; step(0.016); }
  if (heroScreen) setView(heroScreen, 'home');
  acts.forEach(function (A) { setIdx(A, 0); });
  clocks();

  var last = performance.now(), sec = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!reduce) step(dt);
    acts.forEach(function (A) { updateAct(A, now); });
    screens.forEach(function (sc) {
      if (!sc.visible || !sc.current) return;
      if (!reduce) sc.vt += dt;
      var V = VIEWS[sc.current];
      if (V.upd) V.upd(sc, dt);
      led(sc);
    });
    tabsFrame();
    sec += dt;
    if (sec > 1) { sec = 0; clocks(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
