/* Thuis - wandpaneel
 * Let op: ES5 only (oude iPads: iOS 9/10 Safari). Dus: var, function(){}, XMLHttpRequest,
 * geen let/const, arrow functions, template strings, fetch of Promise.
 */
(function () {
  'use strict';

  // Een app op het beginscherm (iPad/iPhone/Mac-Dock) houdt index.html soms lang in zijn geheugen.
  // Past die oude index.html niet bij deze app.js, dan één keer vers laden (andere URL = geen cache).
  // Verhoog HUB_V en data-hubv in index.html samen, telkens als index.html verandert.
  var HUB_V = '6';
  if (document.body.getAttribute('data-hubv') !== HUB_V && !/[?&]r=/.test(location.search)) {
    location.replace(location.pathname + '?r=' + new Date().getTime());
    return;
  }

  var CFG = window.HUB_CONFIG;
  var CFG_ERROR = !CFG;   // config.js ontbreekt of bevat een typefout
  if (!CFG) CFG = { mode: 'demo', lights: [], entities: {}, acs: [], screens: [], dimAfterSec: 120 };

  /* =====================================================================
   * 1. Model: alles wat het scherm toont zit in dit ene object.
   * ===================================================================== */
  var state = {
    solar: 0, home: 0, hp: 0, ac: 0, grid: 0, cop: 4.1,         // kW (grid > 0 = afname, < 0 = teruglevering)
    todaySun: 0, todayUse: 0, todayNet: 0,     // kWh
    thermo: { temp: 20.6, set: 21.0, heating: true },   // Honeywell (keuken)
    flowTemp: 34,                               // Weheat aanvoertemperatuur
    acs: [],                                    // LG-aircos: { temp, set, mode: off|cool|heat|auto }
    screens: [],                                // Somfy: { pos: 0 = open .. 100 = dicht, target }
    mode: 'home',
    vent: 'auto',
    humidity: 58,
    lights: [],
    outTemp: 9.4, weatherText: 'Half bewolkt', rainText: 'Komende 2 uur droog',
    history: []                                 // 24 x { sun: kWh, use: kWh }
  };
  var i;
  for (i = 0; i < CFG.lights.length; i++) state.lights.push(i === 1 || i === 3);
  for (i = 0; i < 24; i++) state.history.push({ sun: 0, use: 0 });
  var ACS = CFG.acs || [], SCREENS = CFG.screens || [];
  var LIVE = CFG.mode === 'homeassistant';
  // welke onderdelen leveren echte data? In demo-modus alles; live pas als de entiteit bestaat.
  state.has = { solar: !LIVE, hp: !LIVE, ac: !LIVE, weheat: !LIVE, thermo: !LIVE, vent: !LIVE, screens: !LIVE, today: !LIVE, weather: !LIVE };
  state.lightsHas = []; state.lightsWall = []; state.lightsBri = []; state.lightsCt = []; state.lightsCtRange = []; state.lightsHasCt = [];
  for (i = 0; i < CFG.lights.length; i++) {
    state.lightsHas.push(!LIVE); state.lightsWall.push(false); state.lightsBri.push(80); state.lightsCt.push(2700);
    state.lightsCtRange.push([2700, 6500]); state.lightsHasCt.push(!LIVE);
  }
  if (LIVE) for (i = 0; i < CFG.lights.length; i++) state.lights[i] = false;
  for (i = 0; i < ACS.length; i++) state.acs.push({ temp: LIVE ? NaN : 19 + i * 0.4, set: LIVE ? NaN : 20, mode: (!LIVE && i === 1) ? 'heat' : 'off', modes: null, has: !LIVE });
  state.has.sched = !LIVE; state.schedOn = !LIVE; state.sched = null;
  if (LIVE) { state.outTemp = NaN; state.weatherText = ''; state.rainText = ''; state.thermo.heating = false; }
  for (i = 0; i < SCREENS.length; i++) state.screens.push({ pos: 0, target: 0 });

  /* =====================================================================
   * 2. Helpers
   * ===================================================================== */
  function $(id) { return document.getElementById(id); }
  function nl(v, d) { // getal in Nederlandse notatie
    if (v === null || v === undefined || isNaN(v)) return '&ndash;';
    return v.toFixed(d === undefined ? 1 : d).replace('.', ',');
  }
  function nlIf(ok, v, d) { return ok ? nl(v, d) : '&ndash;'; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  // Na een tik op het paneel houden we de nieuwe waarde even vast, tot Home Assistant
  // (via de cloud van het apparaat) hetzelfde meldt. Zo springt een knop niet terug.
  var pend = {};
  function setPend(key, val, ms) { pend[key] = { v: val, t: new Date().getTime() + (ms || 20000) }; }
  function usePend(key, haVal) {
    var p = pend[key];
    if (!p) return haVal;
    if (new Date().getTime() > p.t || p.v === haVal) { delete pend[key]; return haVal; }
    return p.v;
  }
  // + en - snel achter elkaar: pas na een korte pauze één opdracht versturen
  var debounceT = {};
  function debounce(key, fn, ms) { clearTimeout(debounceT[key]); debounceT[key] = setTimeout(fn, ms || 1200); }
  function on(elm, ev, fn) { if (elm) elm.addEventListener(ev, fn, false); }
  function closest(elm, attr) {
    while (elm && elm.getAttribute) {
      if (elm.getAttribute(attr) !== null) return elm;
      elm = elm.parentNode;
    }
    return null;
  }

  /* =====================================================================
   * 3. Isometrische 3D-scene (SVG), op maat van de woning
   *    Alle maten komen uit het SketchUp-model van de woning (meters):
   *      model-x = breedte (0,12 = linker bouwmuur, 5,25 = rechter bouwmuur)
   *      model-y = diepte  (0 = voorgevel, 9,5 = achtergevel, 11,9 = uitbouw)
   *      model-z = hoogte  (BG 0,00 / 1e 2,90 / zolder 5,78 / nok 9,74)
   *    Weergave: "exploded": elke verdieping zweeft los zodat je erin kijkt;
   *    het dak met de voorgevel (topgevel) zweeft boven de zolder.
   *    We kijken schuin van voren-rechts: links de voorgevel (topgevel),
   *    rechts het dakvlak met de zonnepanelen en de tuin met de warmtepomp.
   * ===================================================================== */
  var NS = 'http://www.w3.org/2000/svg';
  var svg = $('house');
  var S = 21, OX = 296, OY = 436;              // schaal en oorsprong op scherm

  // verdiepingen: echte vloerhoogte -> hoogte in de opengewerkte tekening
  // De woning zelf is een render van het SketchUp-model (house.png, gemaakt met three.js).
  // Daarboven tekenen we alleen de live onderdelen (lampen, vloerverwarming, stromen, labels).
  // Verdiepingen in de render: 1e +3,2 m en zolder +6,4 m opgetild, dak +9,6 m.
  var IMG = true;
  var LV = [{ real: 0.00, off: 0.0 }, { real: 2.90, off: 6.1 }, { real: 5.78, off: 12.18 }];
  var LIFT = 3.2;       // zoveel zweeft het dak boven de zolder
  var CUT = 6.40;       // boven deze hoogte hoort de gevel bij het dakdeel
  var EAVE = 7.31, RIDGE = 9.74, RIDGE_X = 2.685;
  var NEAR = 0.9, FAR = 2.0, PART = 1.0;       // hoogte waarop muren zijn "doorgezaagd"

  function ZZ(lv, z) { return LV[lv].off + (z - LV[lv].real); }
  function ZR(z) { return LV[2].off + (z - LV[2].real) + LIFT; }
  function roofZ(x) { return RIDGE - Math.abs(x - RIDGE_X) * 0.8663; }   // hoogte dakvlak (dakhelling ~41 graden)

  function P(X, Y, Z) { return [OX + (X - Y) * 0.866 * S, OY + (X + Y) * 0.5 * S - Z * S]; }
  // projectie van de render (wereld in meters, SketchUp-assen -> pixels; render is 2x, beeld 445x690)
  var PJ = { ax: 40.23884946100009, bx: 33.76440374172328, cx: 0, dx: 116.8864821340985,
    ay: 19.846218571833735, by: -23.651802282392776, cy: -42.49611538920617, dy: 1090.1514130921894 };
  function Pm(x, y, z) {
    if (!IMG) return P(x + 0.12, 12 - y, z);
    return [(PJ.ax * x + PJ.bx * y + PJ.cx * z + PJ.dx) / 2, (PJ.ay * x + PJ.by * y + PJ.cy * z + PJ.dy) / 2];
  }
  // in de render zitten de muren, vloeren en apparaten al; die tekenen we dan niet nog eens
  var KEEP_FACE = { panel: 1, 'floor-hit': 1 }, DROP_LINE = { pipe: 1, fascia: 1, gutter: 1, 'lgo-grill': 1 };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name), k;
    for (k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  function ptsM(list) {
    var out = [], k, p;
    for (k = 0; k < list.length; k++) { p = Pm(list[k][0], list[k][1], list[k][2]); out.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
    return out.join(' ');
  }
  function face(list, cls, parent) {
    if (IMG && !KEEP_FACE[cls]) return document.createElementNS(NS, 'polygon');
    return el('polygon', { points: ptsM(list), 'class': cls }, parent);
  }
  function line(list, cls, parent) {
    if (IMG && DROP_LINE[cls]) return document.createElementNS(NS, 'polyline');
    return el('polyline', { points: ptsM(list), 'class': cls }, parent);
  }
  // blok in modelcoordinaten; zichtbare vlakken: boven (-top), straatkant (-right), rechterzijde (-front)
  function box(x0, x1, y0, y1, z0, z1, cls, parent) {
    var g = el('g', {}, parent);
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], cls + '-front', g);
    face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], cls + '-right', g);
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cls + '-top', g);
    return g;
  }
  function circleFlat(cx, cy, z, r) {
    var list = [], a;
    for (a = 0; a < 24; a++) list.push([cx + r * Math.cos(a / 24 * 6.2832), cy + r * Math.sin(a / 24 * 6.2832), z]);
    return list;
  }
  // kamernamen worden na de wanden getekend (anders vallen ze erachter)
  var pendingText = [];
  function text(x, y, z, str, parent) { pendingText.push([x, y, z, str, parent]); }
  function flushText() {
    for (var k = 0; k < pendingText.length; k++) {
      var q = pendingText[k], p = Pm(q[0], q[1], q[2]);
      var t = el('text', { x: p[0].toFixed(1), y: p[1].toFixed(1), 'class': 'room-name', 'text-anchor': 'middle' }, q[4]);
      t.appendChild(document.createTextNode(q[3]));
    }
    pendingText = [];
  }
  // tekenvolgorde binnen een verdieping: verst weg eerst
  function drawSorted(items) {
    items.sort(function (a, b) { return a.k - b.k; });
    for (var k = 0; k < items.length; k++) items[k].f();
  }
  function item(x0, x1, y0, y1, fn) { return { k: (12 - (y0 + y1) / 2) + (x0 + x1) / 2, f: fn }; }
  function partition(list, z, h, g) {
    var out = [], k;
    for (k = 0; k < list.length; k++) (function (w) {
      out.push(item(w[0], w[1], w[2], w[3], function () { box(w[0], w[1], w[2], w[3], z, z + (w[4] || h), 'part', g); }));
    })(list[k]);
    return out;
  }
  function stairs(x0, x1, y0, y1, n, z, g) { // treden, oplopend naar achteren
    var out = [], d = (y1 - y0) / n, k;
    for (k = 0; k < n; k++) (function (i) {
      out.push(item(x0, x1, y0 + i * d, y0 + (i + 1) * d, function () { box(x0, x1, y0 + i * d, y0 + (i + 1) * d, z, z + (i + 1) * 0.19, 'stair', g); }));
    })(k);
    return out;
  }
  function hitArea(g, z0, z1, y1) {
    face([[0.12, 0.4, z0], [5.25, 0.4, z0], [5.25, y1, z0], [5.25, y1, z1], [0.12, y1, z1], [0.12, 0.4, z1]], 'floor-hit', g);
  }

  // zonsopkomst en -ondergang (benadering, Tilburg 51,56 N / 5,09 O), in minuten na middernacht lokale tijd
  function sunTimes(d) {
    var rad = Math.PI / 180, lat = 51.56, lon = 5.09;
    var start = new Date(d.getFullYear(), 0, 1), n = Math.floor((d - start) / 86400000) + 1;
    var g = 2 * Math.PI / 365 * (n - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
    var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
    var tz = -d.getTimezoneOffset();
    return { rise: 720 - 4 * (lon + ha) - eq + tz, set: 720 - 4 * (lon - ha) - eq + tz };
  }
  function isDark() {
    var d = new Date(), t = sunTimes(d), m = d.getHours() * 60 + d.getMinutes();
    return m < t.rise - 15 || m > t.set + 15;
  }
  var imgDark = null;
  function houseImg() {
    if (!refs.img) return;
    var dark = isDark();
    if (dark === imgDark) return;
    imgDark = dark;
    refs.img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (dark ? 'house-night.png' : 'house.png') + '?v=' + HUB_V);
  }

  var refs = { floors: [], glows: [], bulbs: [], panels: [], ufh: [], acFlows: [], fabric: [] };

  function buildScene() {
    if (IMG) {
      refs.img = el('image', { x: 0, y: 0, width: 445, height: 690, preserveAspectRatio: 'none' });
      houseImg();
      document.documentElement.className += ' img3d';
    }
    var defs = el('defs', {});
    var rg = el('radialGradient', { id: 'glowGrad' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#ffc94d', 'stop-opacity': '0.8' }, rg);
    el('stop', { offset: '100%', 'stop-color': '#ffc94d', 'stop-opacity': '0' }, rg);

    // ---- terrein: stoep, tuin, terras ----
    face([[-1.2, -2.6, -0.02], [6.6, -2.6, -0.02], [6.6, 15.4, -0.02], [-1.2, 15.4, -0.02]], 'grass');
    face([[-1.2, -2.6, -0.01], [6.6, -2.6, -0.01], [6.6, -0.05, -0.01], [-1.2, -0.05, -0.01]], 'paving');
    face([[0.12, 11.9, -0.01], [5.25, 11.9, -0.01], [5.25, 14.9, -0.01], [0.12, 14.9, -0.01]], 'paving');

    buildGround();
    buildFirst();
    buildAttic();
    buildRoof();
    buildFlows();

    // labels: verdiepingen in een kolom rechts naast het huis
    var COL = IMG ? 450 : 446;
    refs.anchor = {
      sun: IMG ? [86, 112] : Pm(RIDGE_X, 5.5, ZR(RIDGE) + 2.2),
      zolder: [COL, Pm(5.49, 9.5, ZZ(2, 6.6))[1]],
      floor1: [COL, Pm(5.49, 9.5, ZZ(1, 3.6))[1]],
      floor0: [COL, Pm(5.49, 0, 0)[1] - 18],
      hp: [COL, (Pm(5.49, 9.5, ZZ(1, 3.6))[1] + Pm(5.49, 0, 0)[1] - 18) / 2 + 8],
      grid: Pm(2.0, -2.8, -1.5)
    };
  }

  // ---------------- begane grond ----------------
  function buildGround() {
    var g = el('g', { 'class': 'floor', 'data-floor': '0' }), z = 0;
    refs.floors.push(g);
    box(0.12, 5.25, 0.4, 11.5, -0.3, 0, 'slab', g);
    // verre muren: linker bouwmuur (binnenkant), achtergevel uitbouw met tuinpui
    box(-0.12, 0.12, 0, 11.9, z, z + FAR, 'iwall', g);
    box(0.12, 0.5, 11.5, 11.9, z, z + FAR, 'extin', g);
    box(4.31, 5.25, 11.5, 11.9, z, z + FAR, 'extin', g);
    box(0.5, 4.31, 11.6, 11.75, z, z + FAR, 'glass', g);
    // vloerverwarming (woonkamer + uitbouw, keuken)
    refs.ufh.push(serpentine(2.75, 5.05, 0.6, 11.3, 0.33, ZZ(0, 0.01), g));
    refs.ufh.push(serpentine(0.9, 2.3, 5.75, 11.3, 0.33, ZZ(0, 0.01), g));
    text(3.9, 4.6, 0.02, 'Woonkamer', g);
    text(1.55, 7.2, 0.02, 'Keuken', g);
    text(2.0, 1.75, 0.02, 'Hal', g);
    var it = [];
    it = it.concat(partition([
      [2.42, 2.52, 0.4, 4.18], [1.39, 2.42, 2.82, 2.89], [1.32, 1.39, 2.82, 5.46], [1.39, 2.52, 4.11, 4.18],
      [0.12, 1.32, 5.46, 5.53], [1.56, 1.60, 0.4, 0.8], [1.60, 2.42, 0.78, 0.8]
    ], z, PART, g));
    it = it.concat(stairs(0.12, 1.32, 2.2, 5.4, 6, z, g));
    it.push(item(0.12, 0.72, 7.64, 8.24, function () { box(0.12, 0.72, 7.64, 8.24, z, z + 2.15, 'kitchen', g); }));
    it.push(item(0.12, 0.72, 8.24, 11.5, function () { box(0.12, 0.72, 8.24, 11.5, z, z + 0.91, 'counter', g); }));
    it.push(item(0.12, 0.62, 10.25, 10.95, function () { box(0.12, 0.62, 10.25, 10.95, z + 1.5, z + 1.64, 'app', g); }));
    drawSorted(it);
    // thermostaat (Honeywell) op de wand hal/woonkamer
    var th = Pm(2.53, 4.48, IMG ? 1.22 : 1.56);
    refs.thermo = el('circle', { cx: th[0], cy: th[1], r: 4, 'class': 'thermo' }, g);
    // nabije muren: voorgevel (met voordeuropening) en rechter bouwmuur
    box(0.12, 0.53, 0, 0.4, z, z + NEAR, 'brick', g);
    box(1.69, 5.25, 0, 0.4, z, z + NEAR, 'brick', g);
    box(0.53, 1.69, 0, 0.4, z, z + 0.02, 'paving-step', g);
    box(5.25, 5.49, 0, 11.9, z, z + NEAR, 'party', g);
    flushText();
    // plat dak van de uitbouw (grind) met de Weheat Blackbird en de LG-buitenunit erop
    box(0.12, 5.25, 9.5, 11.5, 2.83, 3.0, 'flatroof', g);
    // (langs de zijmuur, zoals op de foto: eerst de LG, dan de Weheat richting tuin)
    var lg = box(4.78, 5.15, 9.7, 10.55, 3.0, 3.62, 'lgo', g);
    for (var r = 0; r < 4; r++) line([[5.151, 9.78, 3.12 + r * 0.12], [5.151, 10.47, 3.12 + r * 0.12]], 'lgo-grill', lg);
    box(4.15, 5.15, 10.65, 11.45, 3.0, 3.92, 'hp', g);
    face(circleFlat(4.65, 11.05, 3.93, 0.38), 'hp-fan', g);
    hitArea(g, 0, 1.2, 11.5);
  }
  function serpentine(x0, x1, y0, y1, step, z, g) {
    var pts = [], x, row = 0;
    for (x = x0; x <= x1 + 0.001; x += step) {
      if (row % 2 === 0) { pts.push([x, y0, z]); pts.push([x, y1, z]); } else { pts.push([x, y1, z]); pts.push([x, y0, z]); }
      row++;
    }
    var l = line(pts, 'ufh', g);
    l.setAttribute('stroke-dasharray', '5 5');
    return l;
  }

  // ---------------- eerste verdieping ----------------
  function buildFirst() {
    var g = el('g', { 'class': 'floor', 'data-floor': '1' }), z = LV[1].off;
    refs.floors.push(g);
    box(0.12, 5.25, 0.4, 9.1, z - 0.27, z, 'slab', g);
    box(-0.12, 0.12, 0, 9.5, z, z + FAR, 'iwall', g);
    // achtergevel met ramen slaapkamer 3 en 1 (borstwering + penanten + glas)
    box(0.12, 5.25, 9.1, 9.5, z, z + 0.74, 'extin', g);
    box(0.12, 0.63, 9.1, 9.5, z + 0.74, z + FAR, 'extin', g);
    box(2.22, 3.15, 9.1, 9.5, z + 0.74, z + FAR, 'extin', g);
    box(4.74, 5.25, 9.1, 9.5, z + 0.74, z + FAR, 'extin', g);
    box(0.63, 2.22, 9.25, 9.35, z + 0.74, z + FAR, 'glass', g);
    box(3.15, 4.74, 9.25, 9.35, z + 0.74, z + FAR, 'glass', g);
    // Somfy-screens (zuidzijde): doek zakt zichtbaar voor het raam
    for (var sk = 0; sk < SCREENS.length; sk++) if (SCREENS[sk].win && SCREENS[sk].floor === 1) {
      refs.fabric[sk] = el('polygon', { 'class': 'fabric', points: '' }, g);
      refs.fabric[sk].win = SCREENS[sk].win; refs.fabric[sk].z = z;
    }
    face([[0.12, 0.4, z + 0.01], [2.42, 0.4, z + 0.01], [2.42, 3.03, z + 0.01], [0.12, 3.03, z + 0.01]], 'tile', g);
    text(1.27, 1.6, z + 0.02, 'Badkamer', g);
    text(3.87, 2.4, z + 0.02, 'Slaapkamer 2', g);
    text(3.87, 6.9, z + 0.02, 'Kamer Muriel', g);
    text(1.27, 7.5, z + 0.02, 'Slaapkamer 3', g);
    var it = [];
    it = it.concat(partition([
      [2.42, 2.49, 0.4, 9.1], [1.32, 2.42, 3.03, 3.10], [0.12, 2.42, 5.80, 5.87], [2.49, 5.25, 4.73, 4.80], [0.12, 1.32, 3.03, 3.10]
    ], z, PART, g));
    it = it.concat(stairs(0.12, 1.37, 2.45, 5.85, 6, z, g));
    it = it.concat(acUnits(1, z, g));
    var rads = [[3.58, 4.73, 0.39, 0.52], [3.28, 4.61, 8.95, 9.08], [0.76, 2.09, 8.95, 9.08], [2.28, 2.41, 1.70, 2.50]];
    for (var k = 0; k < rads.length; k++) (function (r) {
      it.push(item(r[0], r[1], r[2], r[3], function () { box(r[0], r[1], r[2], r[3], z + 0.08, z + 0.75, 'rad', g); }));
    })(rads[k]);
    drawSorted(it);
    // voorgevel met ramen slaapkamer 2 (klein + groot)
    box(0.12, 5.25, 0, 0.4, z, z + 0.69, 'brick', g);
    box(0.12, 0.83, 0, 0.4, z + 0.69, z + NEAR, 'brick', g);
    box(2.10, 3.45, 0, 0.4, z + 0.69, z + NEAR, 'brick', g);
    box(4.86, 5.25, 0, 0.4, z + 0.69, z + NEAR, 'brick', g);
    box(0.83, 2.10, 0.12, 0.2, z + 0.69, z + NEAR, 'glass', g);
    box(3.45, 4.86, 0.12, 0.2, z + 0.69, z + NEAR, 'glass', g);
    box(5.25, 5.49, 0, 9.5, z, z + NEAR, 'party', g);
    flushText();
    hitArea(g, z, z + 1.2, 9.1);
  }

  // ---------------- zolder (2e verdieping) ----------------
  function buildAttic() {
    var g = el('g', { 'class': 'floor', 'data-floor': '2' }), z = LV[2].off;
    refs.floors.push(g);
    box(0.12, 5.25, 0.4, 9.1, z - 0.25, z, 'slab', g);
    box(-0.12, 0.12, 0, 9.5, z, ZZ(2, EAVE), 'iwall', g);          // knieschot links
    box(0.12, 5.25, 9.1, 9.5, z, ZZ(2, CUT), 'extin', g);
    face([[2.57, 3.38, z + 0.01], [5.25, 3.38, z + 0.01], [5.25, 5.36, z + 0.01], [2.57, 5.36, z + 0.01]], 'tile', g);
    // LUUMR-lampen: gloed op de vloer
    var k;
    for (k = 0; k < CFG.lights.length; k++) {
      var at = CFG.lights[k].at || [2.7, 1.3];
      refs.glows.push(el('polygon', { points: ptsM(circleFlat(at[0], at[1], z + 0.02, 1.1)), fill: 'url(#glowGrad)', opacity: '0' }, g));
    }
    text(2.7, 1.35, z + 0.02, 'Kamer Margje', g);
    text(3.9, 4.75, z + 0.02, 'Badkamer', g);
    text(2.7, 7.5, z + 0.02, 'Kamer Julius', g);
    var it = [];
    it = it.concat(partition([
      [0.12, 5.25, 2.28, 2.38], [0.12, 5.25, 5.36, 5.46], [1.32, 1.42, 3.43, 5.36], [2.48, 2.57, 2.38, 5.36],
      [2.57, 5.25, 3.28, 3.38], [4.40, 5.25, 3.38, 3.58, 1.2]
    ], z, PART, g));
    // technische ruimte: wasmachine, droger, buffervat, boilervat, Orcon MV-unit
    var tech = [[2.65, 3.25, 2.40, 3.00, 0, 0.85], [3.30, 3.90, 2.40, 3.00, 0, 0.85], [4.00, 4.50, 2.58, 3.08, 0, 1.30],
      [4.58, 5.18, 2.53, 3.13, 0, 1.50], [4.70, 5.15, 2.39, 2.73, 1.70, 2.05]];
    for (k = 0; k < tech.length; k++) (function (t, i) {
      it.push(item(t[0], t[1], t[2], t[3], function () {
        var b = box(t[0], t[1], t[2], t[3], z + t[4], z + t[5], i === 4 ? 'mv' : 'app', g);
        if (i === 4) refs.mvUnit = b;
      }));
    })(tech[k], k);
    it.push(item(4.34, 4.35, 4.46, 5.35, function () { box(4.33, 4.36, 4.46, 5.35, z, z + 1.0, 'glass', g); }));
    it.push(item(4.65, 5.01, 3.59, 4.12, function () { box(4.65, 5.01, 3.59, 4.12, z + 0.25, z + 0.42, 'app', g); }));
    for (k = 0; k < CFG.lights.length; k++) (function (i) {
      var at = CFG.lights[i].at || [2.7, 1.3];
      it.push(item(at[0], at[0], at[1], at[1], function () {
        var t1 = Pm(at[0], at[1], z + 2.3), b1 = Pm(at[0], at[1], z + 1.75);
        el('line', { x1: t1[0], y1: t1[1], x2: b1[0], y2: b1[1], stroke: '#4a5670', 'stroke-width': 1 }, g);
        refs.bulbs[i] = el('circle', { cx: b1[0], cy: b1[1], r: 4.5, fill: '#3a4660' }, g);
      }));
    })(k);
    it = it.concat(acUnits(2, z, g));
    // ventilatiekanaal van MV-unit naar het dak (door de "explosie"-ruimte heen)
    it.push(item(3.4, 5.0, 2.5, 5.9, function () {
      refs.duct = line([[4.92, 2.56, z + 2.05], [4.92, 2.56, z + 2.5], [3.44, 2.56, z + 2.5], [3.44, 5.9, z + 2.5],
        [3.44, 5.9, ZR(roofZ(3.44))]], 'duct', g);
    }));
    drawSorted(it);
    box(0.12, 5.25, 0, 0.4, z, ZZ(2, CUT), 'brick', g);
    box(5.25, 5.49, 0, 9.5, z, z + NEAR, 'party', g);
    flushText();
    hitArea(g, z, z + 1.6, 9.1);
  }

  // LG-airco binnenunits: hoog aan de wand, met "luchtstroom" (blauw = koelen, oranje = verwarmen)
  function acUnits(floor, z, g) {
    var out = [], k;
    for (k = 0; k < ACS.length; k++) (function (i) {
      var a = ACS[i];
      if (a.floor !== floor) return;
      var x = a.at[0], w = a.at[1], s = a.side || 1, y0 = s > 0 ? w : w - 0.22, y1 = s > 0 ? w + 0.22 : w;
      var yf = s > 0 ? y1 : y0, zb = z + (IMG && floor === 2 ? 1.0 : 1.75);
      out.push(item(x - 0.45, x + 0.45, y0, y1, function () {
        box(x - 0.45, x + 0.45, y0, y1, zb, zb + 0.3, 'ac', g);
        refs.acFlows[i] = line([[x - 0.35, yf + s * 0.55, zb - 0.55], [x - 0.35, yf, zb], [x + 0.35, yf, zb], [x + 0.35, yf + s * 0.55, zb - 0.55]], 'acflow', g);
      }));
    })(k);
    return out;
  }

  // ---------------- dak + topgevels ----------------
  function buildRoof() {
    var g = el('g', { 'class': 'floor', 'data-floor': '3' });
    // achterste topgevel (binnenkant)
    face([[0.12, 9.1, ZR(CUT)], [5.25, 9.1, ZR(CUT)], [5.25, 9.1, ZR(EAVE)], [RIDGE_X, 9.1, ZR(RIDGE)], [0.12, 9.1, ZR(EAVE)]], 'gable-in', g);
    // rechter dakvlak (felszink) met zonnepanelen
    face([[RIDGE_X, 0.4, ZR(RIDGE)], [RIDGE_X, 9.1, ZR(RIDGE)], [5.49, 9.1, ZR(EAVE)], [5.49, 0.4, ZR(EAVE)]], 'roofz', g);
    var rows = [[4.35, 5.16], [3.51, 4.32]], cols = [[1.2, 2.9], [2.96, 4.66], [4.72, 6.42]], r, c;
    for (r = 0; r < rows.length; r++) for (c = 0; c < cols.length; c++) {
      var x0 = rows[r][0], x1 = rows[r][1], y0 = cols[c][0], y1 = cols[c][1];
      refs.panels.push(face([[x0, y0, ZR(roofZ(x0) + 0.07)], [x0, y1, ZR(roofZ(x0) + 0.07)], [x1, y1, ZR(roofZ(x1) + 0.07)], [x1, y0, ZR(roofZ(x1) + 0.07)]], 'panel', g));
    }
    // doorvoeren (MV en riool-ontluchting)
    line([[3.44, 5.9, ZR(roofZ(3.44))], [3.44, 5.9, ZR(roofZ(3.44) + 0.5)]], 'pipe', g);
    line([[3.83, 6.6, ZR(roofZ(3.83))], [3.83, 6.6, ZR(roofZ(3.83) + 0.45)]], 'pipe', g);
    // voorgevel (topgevel) in gevelsteen, met zolderraam en boeiboorden
    face([[RIDGE_X, 0, ZR(RIDGE)], [5.49, 0, ZR(EAVE)], [5.49, 0.4, ZR(EAVE)], [RIDGE_X, 0.4, ZR(RIDGE)]], 'brick-top', g);
    face([[-0.12, 0, ZR(CUT)], [5.49, 0, ZR(CUT)], [5.49, 0, ZR(EAVE)], [RIDGE_X, 0, ZR(RIDGE)], [-0.12, 0, ZR(EAVE)]], 'brick-right', g);
    face([[1.98, -0.01, ZR(6.43)], [3.39, -0.01, ZR(6.43)], [3.39, -0.01, ZR(7.77)], [1.98, -0.01, ZR(7.77)]], 'win-frame', g);
    face([[2.06, -0.02, ZR(6.51)], [3.31, -0.02, ZR(6.51)], [3.31, -0.02, ZR(7.69)], [2.06, -0.02, ZR(7.69)]], 'win-glass', g);
    line([[-0.12, -0.03, ZR(EAVE)], [RIDGE_X, -0.03, ZR(RIDGE + 0.06)], [5.49, -0.03, ZR(EAVE)]], 'fascia', g);
    line([[5.49, 0.4, ZR(EAVE)], [5.49, 9.1, ZR(EAVE)]], 'gutter', g);
    refs.floors.push(g);
  }

  // ---------------- energiestromen ----------------
  function buildFlows() {
    var HUB = [2.0, -0.25, 0.25];
    var sunPts = [[5.16, 3.8, ZR(roofZ(5.16) + 0.07)], [5.49, 3.8, ZR(EAVE)], [5.49, -0.12, ZR(EAVE)], [5.62, -0.12, ZR(EAVE)],
      [5.62, -0.12, 0.25], HUB];
    var gridPts = [HUB, [2.0, -2.8, 0.25]];
    var hpZ = IMG ? ZZ(1, 3.45) : 3.45;   // in de render staat de Weheat op het dak van de uitbouw (1e verdieping)
    var hpPts = [HUB, [2.0, -0.4, 0.25], [5.85, -0.4, 0.25], [5.85, 11.05, 0.25], [5.85, 11.05, hpZ], [5.15, 11.05, hpZ]];
    refs.flowSun = flow(sunPts, 'f-sun');
    refs.flowGrid = flow(gridPts, 'f-exp');
    refs.flowHp = flow(hpPts, 'f-heat');
    var b = Pm(2.0, -2.8, 0), tp = Pm(2.0, -2.8, 2.6), arm1 = Pm(1.5, -2.8, 2.2), arm2 = Pm(2.5, -2.8, 2.2);
    el('line', { x1: b[0], y1: b[1], x2: tp[0], y2: tp[1], 'class': 'pole' });
    el('line', { x1: arm1[0], y1: arm1[1], x2: arm2[0], y2: arm2[1], 'class': 'pole' });
    var hubP = Pm(HUB[0], HUB[1], HUB[2]);
    refs.hubNode = el('circle', { cx: hubP[0], cy: hubP[1], r: 6, 'class': 'node', stroke: '#8fb4ff' });
  }
  function flow(list, cls) {
    line(list, 'flow-base ' + cls);
    return line(list, 'flow ' + cls + ' anim-fwd');
  }

  /* =====================================================================
   * 4. Labels (HTML boven op de SVG)
   * ===================================================================== */
  var tags = {};
  function makeTag(key, cls, anchor, dx, dy, align) {
    var d = document.createElement('div');
    d.className = 'tag ' + cls;
    d.style.left = (anchor[0] + (dx || 0)) + 'px';
    d.style.top = (anchor[1] + (dy || 0)) + 'px';
    if (align === 'left') { d.style.webkitTransform = 'translate(0,-50%)'; d.style.transform = 'translate(0,-50%)'; }
    d.setAttribute('data-target', key);
    $('labels').appendChild(d);
    tags[key] = d;
  }
  function buildTags() {
    var a = refs.anchor;
    makeTag('sun', 'sun', a.sun);
    makeTag('zolder', 'floor', a.zolder, 8, 0, 'left');
    makeTag('floor1', 'floor', a.floor1, 8, 0, 'left');
    makeTag('floor0', 'floor heat', a.floor0, 8, 0, 'left');
    makeTag('hp', 'heat', a.hp, 0, 0, 'left');
    makeTag('grid', 'exp', a.grid);
  }

  /* =====================================================================
   * 5. Renderen van de state naar het scherm
   * ===================================================================== */
  var VENT_TXT = { auto: 'auto', '1': 'stand 1', '2': 'stand 2', '3': 'stand 3', boost: 'boost' };
  var VENT_SPEED = { auto: 2.2, '1': 3.2, '2': 1.8, '3': 1.0, boost: 0.6 };

  function setAnim(node, kw, reverse) {
    if (kw < 0.02) { node.setAttribute('class', node.getAttribute('class').replace(/anim-\w+/, 'anim-off')); return; }
    node.setAttribute('class', node.getAttribute('class').replace(/anim-\w+/, reverse ? 'anim-rev' : 'anim-fwd'));
    var dur = clamp(2.4 - kw * 0.45, 0.45, 2.4).toFixed(2) + 's';
    node.style.webkitAnimationDuration = dur; node.style.animationDuration = dur;
  }
  function setClass(node, cls) { node.setAttribute('class', cls); }

  function render() {
    var s = state, exp = s.grid < 0, k;

    // energie-kaart
    $('grid-big').innerHTML = nl(Math.abs(s.grid));
    $('grid-big').className = 'big' + (exp ? '' : ' imp');
    $('grid-word').innerHTML = exp ? 'naar het net' : 'van het net';
    $('grid-chip').innerHTML = exp ? 'Teruglevering' : 'Afname';
    $('grid-chip').className = 'chip' + (exp ? '' : ' imp');
    var H = s.has;
    $('st-sun').innerHTML = nlIf(H.solar, s.solar);
    $('st-home').innerHTML = nl(s.home);
    $('st-hp').innerHTML = nlIf(H.hp, s.hp);
    $('st-ac').innerHTML = nlIf(H.ac, s.ac);
    $('td-sun').innerHTML = nlIf(H.today && H.solar, s.todaySun);
    $('td-use').innerHTML = nlIf(H.today, s.todayUse);
    $('td-net').innerHTML = H.today ? (s.todayNet > 0 ? '+' : '') + nl(s.todayNet) : '&ndash;';
    renderChart();

    // klimaat: thermostaat + Weheat + airco's
    var th = s.thermo;
    $('th-temp').innerHTML = nlIf(H.thermo, th.temp) + '°';
    $('th-set').innerHTML = nlIf(H.thermo, th.set) + '°';
    $('th-state').innerHTML = !H.thermo ? 'nog niet gekoppeld' : (th.heating ? 'verwarmt' : 'op temperatuur');
    $('th-state').className = 'z-state' + (H.thermo && th.heating ? ' heating' : '');
    $('wh-info').innerHTML = (H.weheat && wp.state ? 'Warmtepomp: <b>' + wpShort(wp.state) + '</b>' + (isNaN(wp.cop) || s.hp < 0.15 ? '' : ' &middot; COP <b>' + nl(s.cop) + '</b>') :
      (H.hp ? 'Warmtepomp &middot; <b>' + nl(s.hp) + ' kW</b>' : 'Warmtepomp')) + ' <span class="card-more">details &rsaquo;</span>';
    segSelect('mode-seg', 'data-mode', s.mode);
    // Thuis/Eco/Weg alleen tonen als de thermostaat die standen kent (via HomeKit vaak niet)
    $('mode-seg').style.display = (th.presets && th.presets.length) ? '' : 'none';
    $('sch-info').innerHTML = schInfo();
    $('door-open').style.display = (H.door || !LIVE) ? '' : 'none';
    renderEnergy();
    $('sch-open').className = 'sch-btn' + (H.sched && state.schedOn ? ' on' : '');
    schRender();
    renderAcs();
    renderScreens();
    renderSheet();
    var su = selfUse();
    $('selfuse').className = 'selfuse' + (su === null ? ' hidden' : '');
    if (su !== null) $('selfuse').innerHTML = 'Vandaag <b>' + su + '%</b> van je zonnestroom<br>zelf gebruikt';
    if (MOBILE) renderMobile();

    // ventilatie
    segSelect('vent-seg', 'data-v', H.vent ? s.vent : null);
    $('vent-info').innerHTML = H.vent ? 'Vocht badkamer ' + Math.round(s.humidity) + '%' : 'nog niet gekoppeld';

    // verlichting (LUUMR, 2e verdieping)
    var lampEls = $('lights').children, nOn = 0;
    for (k = 0; k < lampEls.length; k++) {
      lampEls[k].className = 'lamp' + (s.lights[k] ? ' on' : '');
      lampEls[k].querySelector('.lamp-st').innerHTML = s.lightsWall[k] ? 'uit (muurknop)' : (!s.lightsHas[k] ? 'niet gekoppeld' : (s.lights[k] ? 'Aan &middot; ' + Math.round(s.lightsBri[k]) + '%' : 'Uit'));
      if (s.lights[k]) nOn++;
      if (refs.glows[k]) refs.glows[k].setAttribute('opacity', s.lights[k] ? (0.35 + 0.65 * s.lightsBri[k] / 100).toFixed(2) : '0');
      if (refs.bulbs[k]) refs.bulbs[k].setAttribute('fill', s.lights[k] ? '#ffc94d' : '#3a4660');
    }

    // scene: zon, stromen, vloerverwarming, ventilatie
    for (k = 0; k < refs.panels.length; k++) setClass(refs.panels[k], s.solar > 0.05 ? 'panel active' : 'panel');
    setAnim(refs.flowSun, s.solar, false);
    setClass(refs.flowGrid, 'flow ' + (exp ? 'f-exp' : 'f-imp') + ' anim-fwd');
    setAnim(refs.flowGrid, Math.abs(s.grid), !exp);
    setAnim(refs.flowHp, s.hp, false);
    refs.hubNode.setAttribute('stroke', exp ? '#4fe0a5' : '#6fc8ff');
    var heating = th.heating, acOn = 0, acOnUp = 0;
    for (k = 0; k < s.acs.length; k++) {
      if (s.acs[k].mode !== 'off') { acOn++; if (ACS[k].floor === 2) acOnUp++; }
      if (refs.acFlows[k]) setClass(refs.acFlows[k], 'acflow ' + (s.acs[k].mode === 'off' ? '' : s.acs[k].mode + ' anim-fwd'));
    }
    for (k = 0; k < refs.ufh.length; k++) {
      refs.ufh[k].setAttribute('opacity', th.heating ? '0.9' : '0.18');
      setClass(refs.ufh[k], 'ufh ' + (th.heating ? 'anim-rev' : ''));
      refs.ufh[k].style.webkitAnimationDuration = '3s'; refs.ufh[k].style.animationDuration = '3s';
    }
    refs.thermo.setAttribute('class', 'thermo' + (th.heating ? ' on' : ''));
    setClass(refs.duct, H.vent ? 'duct anim-fwd' : 'duct');
    refs.duct.style.webkitAnimationDuration = VENT_SPEED[s.vent] + 's';
    refs.duct.style.animationDuration = VENT_SPEED[s.vent] + 's';

    // labels
    tags.sun.innerHTML = '<span class="t-k">Zonnepanelen</span><span class="t-v c-sun">' + nlIf(H.solar, s.solar) + ' kW</span>';
    tags.zolder.innerHTML = '<span class="t-k">2e verdieping</span><span class="t-v"><small>Ventilatie</small> ' + (H.vent ? VENT_TXT[s.vent] : '&ndash;') + '</span>' +
      '<span class="t-k" style="color:' + (nOn || acOnUp ? '#ffc94d' : '#7d8aa0') + '">' + nOn + ' lamp' + (nOn === 1 ? '' : 'en') + ' &middot; ' + acOnUp + ' airco</span>';
    var sk1 = -1;
    for (k = 0; k < ACS.length; k++) if (ACS[k].floor === 1) sk1 = k;
    tags.floor1.innerHTML = '<span class="t-k">1e verdieping</span>' + (sk1 >= 0 ?
      '<span class="t-v"><small>' + ACS[sk1].name + '</small> ' + nl(s.acs[sk1].temp) + '°</span>' +
      '<span class="t-k" style="color:' + AC_COL[s.acs[sk1].mode] + '">airco ' + AC_TXT[s.acs[sk1].mode].toLowerCase() + '</span>' : '');
    tags.floor0.innerHTML = '<span class="t-k">Begane grond</span><span class="t-v">' + (H.thermo ? nl(th.temp) + '° <small>&rarr; ' + nl(th.set) + '°</small>' : '<small>thermostaat</small> &ndash;') + '</span>' +
      '<span class="t-k" style="color:' + (H.thermo && th.heating ? '#ff8a5c' : '#7d8aa0') + '">' + (!H.thermo ? 'nog niet gekoppeld' : (th.heating ? 'vloer verwarmt' : 'vloer uit')) + '</span>' +
      (H.weheat && wp.state && wp.state !== 'standby' && wp.state !== 'heating' ? '<span class="t-k" style="color:#ff8a5c">warmtepomp: ' + wpShort(wp.state) + '</span>' : '');
    tags.hp.innerHTML = '<span class="t-k">Weheat Blackbird</span><span class="t-v c-heat">' + nlIf(H.hp, s.hp) + ' kW <small>' +
      (H.weheat && wp.state ? wpShort(wp.state) : (H.hp ? (s.hp > 0.15 ? 'draait' : 'stand-by') : '')) + '</small></span>';
    tags.grid.className = 'tag ' + (exp ? 'exp' : 'imp');
    tags.grid.innerHTML = '<span class="t-k">Net</span><span class="t-v ' + (exp ? 'c-exp' : 'c-imp') + '">' + (exp ? '&uarr; ' : '&darr; ') + nl(Math.abs(s.grid)) + ' kW</span>';

    // weer
    $('w-temp').innerHTML = nl(s.outTemp) + '°';
    $('w-text').innerHTML = s.weatherText;
    $('rain').innerHTML = s.rainText;
  }

  function selfUse() {
    var s = state;
    if (!s.has.today || !s.has.solar || !(s.todaySun >= 0.3)) return null;
    return Math.round(clamp((s.todaySun - (s.todayExp || 0)) / s.todaySun, 0, 1) * 100);
  }

  /* ---------- telefoonversie: grote letters, grote knoppen ---------- */
  var MOBILE = Math.min(window.innerWidth, window.innerHeight) < 600;
  function mThermo(d) {
    var th = state.thermo;
    if (!state.has.thermo) return;
    th.set = clamp(Math.round(((isNaN(th.set) ? 20 : th.set) + d) * 2) / 2, 5, 28);
    setPend('thset', th.set);
    debounce('thset', function () { backend.setTemp(state.thermo.set); });
    render();
  }
  function mAcMode(k) {
    var ac = state.acs[k], order = [], q;
    if (!ac.has) return;
    for (q = 0; q < AC_ORDER.length; q++) if (AC_ORDER[q] === 'off' || !ac.modes || ac.modes.indexOf(AC_ORDER[q]) >= 0) order.push(AC_ORDER[q]);
    ac.mode = order[(order.indexOf(ac.mode) + 1) % order.length];
    setPend('acmode' + k, ac.mode);
    debounce('acmode' + k, function () { backend.setAcMode(k, state.acs[k].mode); }, 900);
    render();
  }
  function mAcSet(k, d) {
    var ac = state.acs[k];
    if (!ac.has) return;
    ac.set = clamp((isNaN(ac.set) ? 20 : ac.set) + d, 16, 30);
    setPend('acset' + k, ac.set);
    debounce('acset' + k, function () { backend.setAcTemp(k, state.acs[k].set); });
    render();
  }
  function mLamp(k) {
    if (!state.lightsHas[k]) return;
    state.lights[k] = !state.lights[k];
    setPend('light' + k, state.lights[k], 10000);
    backend.setLight(k, state.lights[k]); render();
  }
  function renderMobile() {
    var s = state, H = s.has, th = s.thermo, k, html = '', exp = s.grid < 0, d = new Date();
    var su = selfUse();
    html += '<div class="m-top"><div><div class="m-title">Thuis</div><div class="m-status">' + $('conn-text').innerHTML + '</div></div>' +
      '<div><div class="m-clock">' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</div><div class="m-weather">' + nl(s.outTemp) + '° &middot; ' + (s.weatherText || '') + '</div></div></div>';
    if (H.door || !LIVE) html += '<button class="m-door" data-m="door">Voordeur bekijken</button>';
    // energie
    html += '<div class="m-card m-tap" data-m="energy"><div class="m-h">Energie nu &middot; kW <span class="m-more">Details &rsaquo;</span></div>' +
      '<div class="m-big" style="color:' + (exp ? '#4fe0a5' : '#6fc8ff') + '">' + nl(Math.abs(s.grid)) + '<small>kW ' + (exp ? 'naar het net' : 'van het net') + '</small></div>' +
      '<div class="m-grid">' +
      '<div class="m-cell"><div class="m-cell-in"><div class="m-val c-sun">' + nlIf(H.solar, s.solar) + '</div><div class="m-lbl">Zon</div></div></div>' +
      '<div class="m-cell"><div class="m-cell-in"><div class="m-val c-home">' + nl(s.home) + '</div><div class="m-lbl">Huis</div></div></div>' +
      '<div class="m-cell"><div class="m-cell-in"><div class="m-val c-heat">' + nlIf(H.hp, s.hp) + '</div><div class="m-lbl">Warmtepomp</div></div></div>' +
      '<div class="m-cell"><div class="m-cell-in"><div class="m-val c-imp">' + nlIf(H.ac, s.ac) + '</div><div class="m-lbl">Airco\'s</div></div></div>' +
      '</div>' + (su !== null ? '<div class="m-line">Vandaag <b>' + su + '%</b> van de zonnestroom zelf gebruikt</div>' : '') + '</div>';
    // thermostaat
    html += '<div class="m-card"><div class="m-h">Verwarming</div>' +
      '<div class="m-thermo"><div><div class="m-now">' + nlIf(H.thermo, th.temp) + '°</div><div class="m-sub" style="color:' + (H.thermo && th.heating ? '#ff8a5c' : '#a8b4c8') + '">' +
      (!H.thermo ? 'nog niet gekoppeld' : (th.heating ? 'verwarmt' : 'op temperatuur')) + '</div></div>' +
      '<div class="m-ac-ctrl"><span class="m-setlbl">Instellen op</span><button class="m-btn" data-m="th" data-d="-0.5">&minus;</button><div class="m-set">' + nlIf(H.thermo, th.set) + '°</div>' +
      '<button class="m-btn" data-m="th" data-d="0.5">+</button></div>' +
      (H.sched && state.schedOn ? '<div class="m-line">Schema &middot; volgende: <b>' + schInfo() + '</b></div>' : '') + '</div></div>';
    html += '<button class="m-door m-hp" data-m="hp">Warmtepomp' + (H.weheat && wp.state ? ': ' + wpLabel(wp.state) : (H.hp ? ' &middot; ' + nl(s.hp) + ' kW' : '')) + ' &rsaquo;</button>';
    // airco's
    html += '<div class="m-card"><div class="m-h">Airco\'s</div>';
    for (k = 0; k < ACS.length; k++) {
      var a = s.acs[k];
      html += '<div class="m-row"><div class="m-info"><div class="m-name">' + ACS[k].name + '</div><div class="m-sub">nu ' + nl(a.temp) + '°</div>' +
        '<div class="m-ac-ctrl"><button class="m-mode ' + a.mode + '" data-m="acmode" data-k="' + k + '">' + AC_TXT[a.mode] + '</button>' +
        '<button class="m-btn" data-m="acset" data-k="' + k + '" data-d="-0.5">&minus;</button><div class="m-set">' + nl(a.set) + '°</div>' +
        '<button class="m-btn" data-m="acset" data-k="' + k + '" data-d="0.5">+</button></div></div></div>';
    }
    html += '</div>';
    // lampen (alleen als er minstens een gekoppeld is)
    var anyLamp = false;
    for (k = 0; k < CFG.lights.length; k++) if (s.lightsHas[k] || s.lightsWall[k]) anyLamp = true;
    if (anyLamp) {
      html += '<div class="m-card"><div class="m-h">Lampen</div><div class="m-lamps">';
      for (k = 0; k < CFG.lights.length; k++) {
        html += '<button class="m-lamp' + (s.lights[k] ? ' on' : '') + '" data-m="lamp" data-k="' + k + '">' + CFG.lights[k].name +
          (s.lightsWall[k] ? ' &middot; muurknop uit' : '') + '</button>';
      }
      html += '</div></div>';
    }
    $('mobile').innerHTML = html;
  }
  function bindMobile() {
    if (!MOBILE) return;
    document.documentElement.className += ' mobile';
    $('mobile').className = '';
    on($('mobile'), 'click', function (e) {
      var b = closest(e.target, 'data-m');
      if (!b) return;
      var m = b.getAttribute('data-m'), k = parseInt(b.getAttribute('data-k'), 10), d = parseFloat(b.getAttribute('data-d'));
      if (m === 'th') mThermo(d);
      else if (m === 'acmode') mAcMode(k);
      else if (m === 'acset') mAcSet(k, d);
      else if (m === 'lamp') mLamp(k);
      else if (m === 'door') doorOpen();
      else if (m === 'energy') { en.view = 'energy'; enOpen(); }
      else if (m === 'hp') hpOpen();
    });
  }

  var AC_ORDER = ['off', 'cool', 'heat', 'auto'];
  var AC_TXT = { off: 'Uit', cool: 'Koelt', heat: 'Warmt', auto: 'Auto' };
  var AC_COL = { off: '#7d8aa0', cool: '#6fc8ff', heat: '#ff8a5c', auto: '#4fe0a5' };
  function renderAcs() {
    var rows = $('ac-list').children, k, a;
    for (k = 0; k < rows.length; k++) {
      a = state.acs[k];
      rows[k].querySelector('.ac-now').innerHTML = 'nu ' + nl(a.temp) + '° &middot; ' + (ACS[k].floor === 2 ? '2e' : '1e') + ' verdieping';
      var m = rows[k].querySelector('.ac-mode');
      m.innerHTML = AC_TXT[a.mode]; m.className = 'ac-mode ' + a.mode;
      var st = rows[k].querySelector('.ac-set');
      st.innerHTML = nl(a.set) + '°'; st.className = 'ac-set' + (a.mode === 'off' ? ' off' : '');
    }
  }
  function renderScreens() {
    var rows = $('screen-list').children, k, sc, t;
    for (k = 0; k < rows.length; k++) {
      sc = state.screens[k];
      var f = refs.fabric[k];
      if (f) {   // doek van boven (z + 2,0) naar beneden tot de vensterbank (z + 0,74)
        var top = f.z + FAR, bot = top - (FAR - 0.74) * sc.pos / 100, w = f.win;
        f.setAttribute('points', sc.pos > 0 ? ptsM([[w[0], 9.24, top], [w[1], 9.24, top], [w[1], 9.24, bot], [w[0], 9.24, bot]]) : '');
      }
      if (!state.has.screens) t = 'niet gekoppeld';
      else if (sc.pos !== sc.target) t = sc.target > sc.pos ? 'Gaat omlaag&hellip;' : 'Gaat omhoog&hellip;';
      else if (sc.pos <= 0) t = 'Open';
      else if (sc.pos >= 100) t = 'Dicht';
      else t = Math.round(sc.pos) + '% dicht';
      rows[k].querySelector('.scr-st').innerHTML = t;
    }
  }
  function segSelect(id, attr, val) {
    var b = $(id).children, k;
    for (k = 0; k < b.length; k++) b[k].className = b[k].getAttribute(attr) === String(val) ? 'on' : '';
  }

  function renderChart() {
    var c = $('chart');
    while (c.firstChild) c.removeChild(c.firstChild);
    var W = 380, H = 42, bw = W / 24, max = 0.5, k, h = state.history;
    for (k = 0; k < 24; k++) { if (h[k].sun > max) max = h[k].sun; if (h[k].use > max) max = h[k].use; }
    var nowH = new Date().getHours(), pts = [];
    for (k = 0; k < 24; k++) {
      var bh = h[k].sun / max * (H - 12);
      el('rect', { x: (k * bw + 2).toFixed(1), y: (H - 10 - bh).toFixed(1), width: (bw - 4).toFixed(1), height: Math.max(bh, 1).toFixed(1),
        rx: 2, fill: '#ffc94d', opacity: k === nowH ? '1' : (h[k].sun > 0.02 ? '0.55' : '0.15') }, c);
      if (k <= nowH) pts.push((k * bw + bw / 2).toFixed(1) + ',' + (H - 10 - h[k].use / max * (H - 12)).toFixed(1));
    }
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: '#8fb4ff', 'stroke-width': 2, 'stroke-linejoin': 'round' }, c);
    var lbl = ['0', '6', '12', '18'];
    for (k = 0; k < 4; k++) {
      var t = el('text', { x: (k * 6 * bw + 2).toFixed(1), y: H, fill: '#5d6a80', 'font-size': 9 }, c);
      t.appendChild(document.createTextNode(lbl[k] + 'u'));
    }
  }

  function buildLights() {
    var box = $('lights'), k, d;
    for (k = 0; k < CFG.lights.length; k++) {
      d = document.createElement('div');
      d.className = 'lamp';
      d.setAttribute('data-lamp', k);
      d.innerHTML = '<div class="lamp-in"><div class="bulb"></div><div class="lamp-txt"><div class="lamp-name">' + CFG.lights[k].name + '</div><div class="lamp-st">Uit</div></div>' +
        '<button class="lamp-more" data-lampmore="' + k + '">&#9788;</button></div>';
      box.appendChild(d);
    }
  }

  // ---- lamp-paneel: aan/uit, helderheid en warmte ----
  var sheetK = -1, sliding = false;
  function openSheet(k) { sheetK = k; renderSheet(true); $('lamp-sheet').className = 'sheet'; }
  function renderSheet(force) {
    if (sheetK < 0) return;
    var k = sheetK, r = state.lightsCtRange[k];
    $('ls-name').innerHTML = CFG.lights[k].name + (state.lightsHas[k] ? '' : ' <small style="color:#7d8aa0">(niet gekoppeld)</small>');
    segSelect('ls-onoff', 'data-on', state.lights[k] ? '1' : '0');
    $('ls-bri-v').innerHTML = Math.round(state.lightsBri[k]) + '%';
    $('ls-ct-v').innerHTML = Math.round(state.lightsCt[k] / 100) * 100 + ' K';
    $('ls-ct-box').style.display = state.lightsHasCt[k] ? '' : 'none';
    if (force || !sliding) {
      $('ls-bri').value = Math.round(state.lightsBri[k]);
      $('ls-ct').min = r[0]; $('ls-ct').max = r[1]; $('ls-ct').value = state.lightsCt[k];
    }
  }
  function bindSheet() {
    on($('ls-close'), 'click', function () { sheetK = -1; $('lamp-sheet').className = 'sheet hidden'; });
    on($('ls-onoff'), 'click', function (e) {
      var b = closest(e.target, 'data-on'); if (!b || sheetK < 0) return;
      var k = sheetK; state.lights[k] = b.getAttribute('data-on') === '1';
      setPend('light' + k, state.lights[k], 10000); backend.setLight(k, state.lights[k]); render(); renderSheet();
    });
    function startSlide() { sliding = true; }
    function slide(key) {
      return function () {
        if (sheetK < 0) return;
        var k = sheetK, v = parseFloat(this.value);
        if (key === 'bri') state.lightsBri[k] = v; else state.lightsCt[k] = v;
        renderSheet(); render();
      };
    }
    function commit(key) {
      return function () {
        sliding = false;
        if (sheetK < 0) return;
        var k = sheetK, v = parseFloat(this.value);
        state.lights[k] = true; setPend('light' + k, true, 10000);
        if (key === 'bri') { state.lightsBri[k] = v; setPend('lbri' + k, v); backend.setLightLevel(k, { brightness_pct: Math.round(v) }); }
        else { state.lightsCt[k] = v; setPend('lct' + k, v); backend.setLightLevel(k, { color_temp_kelvin: Math.round(v) }); }
        render(); renderSheet();
      };
    }
    var ids = ['ls-bri', 'ls-ct'], keys = ['bri', 'ct'], q;
    for (q = 0; q < 2; q++) {
      on($(ids[q]), 'touchstart', startSlide); on($(ids[q]), 'mousedown', startSlide);
      on($(ids[q]), 'input', slide(keys[q])); on($(ids[q]), 'change', commit(keys[q]));
    }
  }

  function buildAcs() {
    var box = $('ac-list'), k, d;
    for (k = 0; k < ACS.length; k++) {
      d = document.createElement('div');
      d.className = 'ac-row';
      d.innerHTML = '<div class="ac-info"><div class="ac-name">' + ACS[k].name + '</div><div class="ac-now"></div></div>' +
        '<button class="ac-mode" data-acmode="' + k + '"></button>' +
        '<button class="rb sm" data-aci="' + k + '" data-acd="-0.5">&minus;</button><div class="ac-set"></div>' +
        '<button class="rb sm" data-aci="' + k + '" data-acd="0.5">+</button>';
      box.appendChild(d);
    }
  }
  function buildScreens() {
    var box = $('screen-list'), k, d;
    for (k = 0; k < SCREENS.length; k++) {
      d = document.createElement('div');
      d.className = 'scr-row';
      d.innerHTML = '<div class="scr-info"><div class="scr-name">' + SCREENS[k].name + '</div><div class="scr-st"></div></div>' +
        '<button class="scr-btn" data-scr="' + k + '" data-cmd="up">&#9650;</button>' +
        '<button class="scr-btn my" data-scr="' + k + '" data-cmd="my">my</button>' +
        '<button class="scr-btn" data-scr="' + k + '" data-cmd="down">&#9660;</button>';
      box.appendChild(d);
    }
  }

  /* =====================================================================
   * 5b. Thermostaatschema
   *     Het weekschema staat in Home Assistant (input_text.thermostaat_schema) en
   *     een automatisering daar zet de thermostaat op elke wisseltijd op de juiste
   *     temperatuur. Opslag: 7 dagen (ma t/m zo) gescheiden door ';', per dag
   *     4 wissels 'HHMM-TTT' (TTT = graden x 10), bijv. 0630-205.
   * ===================================================================== */
  var SCH_E = CFG.entities.heatSchedule || 'input_text.thermostaat_schema';
  var SCH_ON_E = CFG.entities.heatScheduleOn || 'input_boolean.thermostaat_schema_aan';
  var SCH_NAMES = ['Opstaan', 'Weg', 'Thuis', 'Slapen'];
  var SCH_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  var SCH_DAYS_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
  function schParse(str) {
    var days = (str || '').split(';'), out = [], d, q, ps, p, m;
    if (days.length !== 7) return null;
    for (d = 0; d < 7; d++) {
      ps = days[d].split(','); p = [];
      for (q = 0; q < ps.length; q++) {
        m = /^(\d\d)(\d\d)-(\d{2,3})$/.exec(ps[q]);
        if (m) p.push({ m: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), v: parseInt(m[3], 10) / 10 });
      }
      if (p.length !== 4) return null;
      out.push(p);
    }
    return out;
  }
  function schDefault() {
    var a = [], d;
    for (d = 0; d < 7; d++) a.push(d < 5 ? '0630-200,0830-180,1700-200,2230-160' : '0800-200,1200-200,1700-200,2300-160');
    return schParse(a.join(';'));
  }
  function schStr(sc) {
    var days = [], d, q, p, t;
    for (d = 0; d < 7; d++) {
      p = [];
      for (q = 0; q < 4; q++) { t = Math.round(sc[d][q].v * 10); p.push(pad(Math.floor(sc[d][q].m / 60)) + pad(sc[d][q].m % 60) + '-' + (t < 100 ? '0' : '') + t); }
      days.push(p.join(','));
    }
    return days.join(';');
  }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function schNext() {
    var sc = state.sched; if (!sc) return null;
    var d = new Date(), wd = (d.getDay() + 6) % 7, now = d.getHours() * 60 + d.getMinutes(), q;
    for (q = 0; q < 4; q++) if (sc[wd][q].m > now) return { m: sc[wd][q].m, v: sc[wd][q].v, tomorrow: false };
    return { m: sc[(wd + 1) % 7][0].m, v: sc[(wd + 1) % 7][0].v, tomorrow: true };
  }
  function schInfo() {
    if (!state.has.sched) return 'instellen';
    if (!state.schedOn) return 'uit';
    var n = schNext();
    return n ? (n.tomorrow ? 'morgen ' : '') + hhmm(n.m) + ' &rarr; ' + nl(n.v) + '°' : 'aan';
  }

  var schSel = [], schEdit = null, schIsOpen = false;
  function schLoad(d) {
    var sc = state.sched || schDefault(), q;
    schEdit = [];
    for (q = 0; q < 4; q++) schEdit.push({ m: sc[d][q].m, v: sc[d][q].v });
  }
  function schOpen() {
    var d = (new Date().getDay() + 6) % 7;
    schSel = d < 5 ? [0, 1, 2, 3, 4] : [5, 6];
    schLoad(d); schIsOpen = true; schRender();
    $('sch-wrap').className = '';
  }
  function schClose() { schIsOpen = false; $('sch-wrap').className = 'hidden'; }
  function schRender() {
    if (!schIsOpen) return;
    var h = '', d, q, p, names = [];
    for (d = 0; d < 7; d++) {
      h += '<button class="sch-day' + (schSel.indexOf(d) >= 0 ? ' on' : '') + '" data-schday="' + d + '">' + SCH_DAYS[d] + '</button>';
      if (schSel.indexOf(d) >= 0) names.push(SCH_DAYS_LONG[d]);
    }
    $('sch-days').innerHTML = h;
    h = '';
    for (q = 0; q < 4; q++) {
      p = schEdit[q];
      h += '<div class="sch-row"><div class="sch-name">' + SCH_NAMES[q] + '</div>' +
        '<button class="rb" data-scht="' + q + '" data-d="-15">&minus;</button><div class="sch-time">' + hhmm(p.m) + '</div>' +
        '<button class="rb" data-scht="' + q + '" data-d="15">+</button><div class="sch-gap"></div>' +
        '<button class="rb" data-schv="' + q + '" data-d="-0.5">&minus;</button><div class="sch-temp">' + nl(p.v) + '°</div>' +
        '<button class="rb" data-schv="' + q + '" data-d="0.5">+</button></div>';
    }
    $('sch-rows').innerHTML = h;
    segSelect('sch-onoff', 'data-schon', state.schedOn ? '1' : '0');
    $('sch-note').innerHTML = !state.has.sched ? 'Het schema is nog niet ingesteld in Home Assistant (zie de handleiding, stap &ldquo;Thermostaatschema&rdquo;).' :
      (names.length ? 'Opslaan geldt voor: <b>' + names.join(', ') + '</b>' : 'Kies minstens &eacute;&eacute;n dag.');
    $('sch-save').className = 'sch-b1' + (!names.length || !state.has.sched ? ' off' : '');
  }
  function bindSched() {
    on($('sch-open'), 'click', schOpen);
    on($('sch-cancel'), 'click', schClose);
    on($('sch-sheet'), 'click', function (e) {
      var b = closest(e.target, 'data-schday'), i, p;
      if (b) {
        var d = parseInt(b.getAttribute('data-schday'), 10);
        i = schSel.indexOf(d);
        if (i >= 0) schSel.splice(i, 1); else schSel.push(d);
        schSel.sort();
        if (schSel.length === 1) schLoad(schSel[0]);
        schRender(); return;
      }
      var qk = closest(e.target, 'data-schq');
      if (qk) {
        var w = qk.getAttribute('data-schq');
        schSel = w === 'wd' ? [0, 1, 2, 3, 4] : (w === 'we' ? [5, 6] : [0, 1, 2, 3, 4, 5, 6]);
        schLoad(schSel[0]); schRender(); return;
      }
      var t = closest(e.target, 'data-scht');
      if (t) {
        p = schEdit[parseInt(t.getAttribute('data-scht'), 10)];
        p.m = clamp(Math.round((p.m + parseInt(t.getAttribute('data-d'), 10)) / 15) * 15, 0, 23 * 60 + 45);
        schRender(); return;
      }
      var v = closest(e.target, 'data-schv');
      if (v) {
        p = schEdit[parseInt(v.getAttribute('data-schv'), 10)];
        p.v = clamp(Math.round((p.v + parseFloat(v.getAttribute('data-d'))) * 2) / 2, 5, 28);
        schRender(); return;
      }
      var o = closest(e.target, 'data-schon');
      if (o && state.has.sched) {
        state.schedOn = o.getAttribute('data-schon') === '1';
        setPend('schon', state.schedOn); backend.setSchedOn(state.schedOn);
        schRender(); render();
      }
    });
    on($('sch-save'), 'click', function () {
      if (!schSel.length || !state.has.sched) return;
      var sc = state.sched || schDefault(), k, q, ed = schEdit.slice().sort(function (a, b) { return a.m - b.m; });
      for (k = 0; k < schSel.length; k++) {
        sc[schSel[k]] = [];
        for (q = 0; q < 4; q++) sc[schSel[k]].push({ m: ed[q].m, v: ed[q].v });
      }
      state.sched = sc;
      var str = schStr(sc);
      setPend('sched', str); backend.setSched(str);
      schClose(); render();
    });
  }

  /* =====================================================================
   * 5c. Voordeur-camera (Tapo-deurbel): alleen kijken als je erop tikt.
   *     Het beeld komt als losse foto's via Home Assistant (camera_proxy),
   *     dat werkt ook op de oude iPad. Na 2 minuten sluit het vanzelf.
   * ===================================================================== */
  var door = { id: null, pic: null, open: false, timer: null, until: 0 };
  state.has.door = false;
  function doorFind(map) {
    var want = CFG.entities.doorCamera, k, best = null;
    if (want) return map[want] ? want : null;
    for (k in map) {
      if (k.indexOf('camera.') !== 0) continue;
      if (k.indexOf('voordeur') >= 0) return k;
      if (!best && /tapo|d235|deurbel/.test(k)) best = k;
    }
    return best;
  }
  function doorMsg(t) { $('door-msg').innerHTML = t; $('door-msg').style.display = t ? '' : 'none'; }
  function doorOpen() {
    lastTouch = new Date().getTime();
    door.open = true; door.until = new Date().getTime() + 120000; door.frigate = true;
    $('door-wrap').className = '';
    arcBuild(); arcTab('live');
    $('door-img').style.display = 'none';
    doorMsg(!LIVE ? 'Demo-modus: hier komt het beeld van de voordeur.' : (state.has.door ? 'Beeld laden&hellip;' : 'De deurbel is nog niet gekoppeld in Home Assistant.'));
    doorNext();
  }
  function doorClose() { door.open = false; clearTimeout(door.timer); $('door-wrap').className = 'hidden'; $('door-img').src = ''; arcStop(); }
  function doorNext() {
    clearTimeout(door.timer);
    if (!door.open || arc.tab !== 'live') return;
    if (new Date().getTime() > door.until) { doorClose(); return; }
    // eerst het beeld van Frigate proberen (één verbinding met de deurbel), anders via Home Assistant
    var useF = LIVE && door.frigate !== false;
    if (!useF && (!state.has.door || !door.pic)) { door.timer = setTimeout(doorNext, 2000); return; }
    var img = new Image(), t0 = new Date().getTime();
    img.onload = function () {
      if (!door.open) return;
      $('door-img').src = img.src; $('door-img').style.display = ''; doorMsg('');
      door.timer = setTimeout(doorNext, Math.max(300, 1000 - (new Date().getTime() - t0)));
    };
    img.onerror = function () {
      if (!door.open) return;
      if (useF) { door.frigate = false; door.timer = setTimeout(doorNext, 50); return; }
      doorMsg('Even geen beeld. Staat &ldquo;Altijd aan&rdquo; aan in de Tapo-app?');
      door.timer = setTimeout(doorNext, 3000);
    };
    img.src = useF ? fBase() + '/api/' + ARC_CAM + '/latest.jpg?h=720&_=' + t0 :
      ha.base() + door.pic + (door.pic.indexOf('?') >= 0 ? '&' : '?') + '_=' + t0;
  }
  function bindDoor() {
    on($('door-open'), 'click', doorOpen);
    on($('door-close'), 'click', doorClose);
  }

  /* =====================================================================
   * 5d. Energie-overzicht (tik op de energiekaart)
   *     Dag/maand/jaar-tellers komen uit Home Assistant (utility_meter,
   *     homeassistant/energie.yaml). Prijzen staan in input_number-helpers.
   * ===================================================================== */
  var EN_SRC = ['afname', 'teruglevering', 'zon', 'warmtepomp', 'airco'];
  var EN_PER = [['vandaag', 'Vandaag'], ['gisteren', 'Gisteren'], ['maand', 'Deze maand'], ['vorigemaand', 'Vorige maand'], ['jaar', 'Dit jaar']];
  var en = { view: 'energy', open: false, per: 'vandaag', has: false, p: {}, price: 0.27, feed: 0.27, hasPrice: false, phases: null };
  function enNum(x) { var f = parseFloat(x); return isNaN(f) ? NaN : f; }
  function enRead(map) {
    var P = { vandaag: {}, gisteren: {}, maand: {}, vorigemaand: {}, jaar: {} }, k, e, src, any = false, q, ph = [];
    for (k = 0; k < EN_SRC.length; k++) {
      src = EN_SRC[k];
      e = map['sensor.energie_' + src + '_dag'];
      if (e) { any = true; P.vandaag[src] = enNum(e.state); P.gisteren[src] = enNum(e.attributes && e.attributes.last_period); }
      e = map['sensor.energie_' + src + '_maand'];
      if (e) { P.maand[src] = enNum(e.state); P.vorigemaand[src] = enNum(e.attributes && e.attributes.last_period); }
      e = map['sensor.energie_' + src + '_jaar'];
      if (e) P.jaar[src] = enNum(e.state);
    }
    en.has = any; en.p = P;
    var pr = map['input_number.stroomprijs'], fd = map['input_number.terugleververgoeding'];
    en.hasPrice = !!(pr && fd);
    if (pr && !isNaN(enNum(pr.state))) en.price = usePend('enprice', enNum(pr.state));
    if (fd && !isNaN(enNum(fd.state))) en.feed = usePend('enfeed', enNum(fd.state));
    for (q = 1; q <= 3; q++) { e = map['sensor.p1_meter_vermogen_fase_' + q]; if (e && !isNaN(enNum(e.state))) ph.push(enNum(e.state)); }
    en.phases = ph.length === 3 ? ph : null;
  }
  function enStats(per) {
    var s = state, P = en.p[per] || {}, r;
    if (!LIVE) {
      var f = { vandaag: 1, gisteren: 1.1, maand: 9, vorigemaand: 26, jaar: 310 }[per];
      r = { imp: (s.todayUse - s.todaySun + (s.todayExp || 0)) * f, exp: (s.todayExp || 0) * f, sun: s.todaySun * f, hp: 4.2 * f, ac: 0.6 * f };
    } else if (en.has) {
      r = { imp: P.afname, exp: P.teruglevering, sun: P.zon, hp: P.warmtepomp, ac: P.airco };
    } else if (per === 'vandaag' && s.has.today) {
      r = { imp: s.todayUse - s.todaySun + (s.todayExp || 0), exp: s.todayExp || 0, sun: s.todaySun, hp: NaN, ac: NaN };
    } else {
      r = { imp: NaN, exp: NaN, sun: NaN, hp: NaN, ac: NaN };
    }
    if (isNaN(r.exp)) r.exp = 0;
    if (isNaN(r.sun) || !s.has.solar) r.sun = isNaN(r.sun) ? 0 : r.sun;
    r.use = r.imp + r.sun - r.exp;
    r.rest = r.use - (isNaN(r.hp) ? 0 : r.hp) - (isNaN(r.ac) ? 0 : r.ac);
    r.self = r.sun >= 0.3 ? clamp((r.sun - r.exp) / r.sun, 0, 1) : NaN;
    r.cost = r.imp * en.price - r.exp * en.feed;
    return r;
  }
  function eur(v) {
    if (v === null || v === undefined || isNaN(v)) return '&ndash;';
    return (v < -0.004 ? '&minus;' : '') + '&euro;&nbsp;' + Math.abs(v).toFixed(2).replace('.', ',');
  }
  function kwh(v) { return isNaN(v) ? '&ndash;' : nl(v, v >= 100 ? 0 : 1) + ' kWh'; }
  function enRow(label, val, extra, cls) {
    if (extra === '&ndash;') extra = '';
    return '<div class="en-row' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><span>' + val + (extra ? ' <small>' + extra + '</small>' : '') + '</span></div>';
  }
  function enTile(label, val, col) {
    return '<div class="en-tile"><div class="en-tv" style="color:' + col + '">' + val + '</div><div class="en-tl">' + label + '</div></div>';
  }
  function enChart() {
    var h = state.history, k, max = 0.3, n = 0, out = '', x, bh;
    for (k = 0; k < 24; k++) { if (h[k].n) n++; if (h[k].use > max) max = h[k].use; if (h[k].sun > max) max = h[k].sun; }
    if (LIVE && n < 2) return '';
    out = '<div class="en-sec">Vandaag per uur <small><span class="c-home">&#9632;</span> verbruik &nbsp;<span class="c-sun">&#9632;</span> zon</small></div>' +
      '<svg class="en-chart" viewBox="0 0 480 130" preserveAspectRatio="none">';
    for (k = 0; k < 24; k++) {
      x = k * 20;
      bh = h[k].use / max * 100; out += '<rect x="' + (x + 2) + '" y="' + (108 - bh) + '" width="7.5" height="' + bh + '" fill="#8fb4ff" rx="1.5"/>';
      bh = h[k].sun / max * 100; out += '<rect x="' + (x + 10) + '" y="' + (108 - bh) + '" width="7.5" height="' + bh + '" fill="#ffc94d" rx="1.5"/>';
      if (k % 3 === 0) out += '<text x="' + (x + 2) + '" y="125" fill="#7d8aa0" font-size="11">' + k + 'u</text>';
    }
    return out + '</svg>';
  }
  function enBase() {
    var h = state.history, k, min = NaN;
    for (k = 1; k <= 5; k++) if (h[k].n && (isNaN(min) || h[k].use < min)) min = h[k].use;
    if (!LIVE) min = 0.18;
    return min;
  }
  function renderEnergy() {
    if (!en.open) return;
    if (en.view === 'hp') { renderHp(); return; }
    var s = state, H = s.has, r = enStats(en.per), k, html = '', d = new Date();
    var exp = s.grid < 0, other = s.home - (H.hp ? s.hp : 0) - (H.ac ? s.ac : 0);
    html += '<div class="en-head"><span class="en-title">Energie</span><button class="door-x" data-en="close">Sluiten</button></div>';
    html += '<div class="en-sec">Nu</div><div class="en-tiles">' +
      enTile(exp ? 'naar het net' : 'van het net', nl(Math.abs(s.grid), 2) + ' kW', exp ? '#4fe0a5' : '#6fc8ff') +
      enTile('zonnepanelen', H.solar ? nl(s.solar, 2) + ' kW' : '&ndash;', '#ffc94d') +
      enTile('huis totaal', nl(s.home, 2) + ' kW', '#8fb4ff') +
      enTile('warmtepomp', H.hp ? nl(s.hp, 2) + ' kW' : '&ndash;', '#ff8a5c') +
      enTile('airco\'s', H.ac ? nl(s.ac, 2) + ' kW' : '&ndash;', '#6fc8ff') +
      enTile('rest van het huis', nl(Math.max(0, other), 2) + ' kW', '#e8edf5') + '</div>';
    if (en.phases) html += '<div class="en-note">Per fase: L1 ' + Math.round(en.phases[0]) + ' W &middot; L2 ' + Math.round(en.phases[1]) + ' W &middot; L3 ' + Math.round(en.phases[2]) + ' W</div>';
    html += '<div class="seg en-tabs">';
    for (k = 0; k < EN_PER.length; k++) html += '<button data-enper="' + EN_PER[k][0] + '"' + (en.per === EN_PER[k][0] ? ' class="on"' : '') + '>' + EN_PER[k][1] + '</button>';
    html += '</div>';
    var pct = function (v) { return isNaN(v) || !(r.use > 0) ? '' : Math.round(v / r.use * 100) + '%'; };
    html += '<div class="en-grid"><div class="en-col"><div class="en-sec">Kosten (schatting)</div>' +
      enRow('Afgenomen van het net', kwh(r.imp), eur(r.imp * en.price)) +
      enRow('Teruggeleverd', kwh(r.exp), r.exp > 0 ? '&minus;' + eur(r.exp * en.feed).replace('&minus;', '') : '') +
      enRow('<b>Netto kosten</b>', '<b>' + eur(r.cost) + '</b>', '', 'en-total');
    if (en.per === 'maand' && !isNaN(r.cost)) {
      var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), el = d.getDate() - 1 + (d.getHours() + d.getMinutes() / 60) / 24;
      if (el > 0.5) html += enRow('Verwachting hele maand', eur(r.cost / el * dim));
    }
    html += '</div><div class="en-col"><div class="en-sec">Verbruik</div>' +
      enRow('Huis totaal', kwh(r.use), eur(r.use * en.price)) +
      enRow('&nbsp;&nbsp;Warmtepomp', kwh(r.hp), pct(r.hp)) +
      enRow('&nbsp;&nbsp;Airco\'s', kwh(r.ac), pct(r.ac)) +
      enRow('&nbsp;&nbsp;Rest van het huis', kwh(r.rest), pct(r.rest)) +
      enRow('Zonnepanelen opgewekt', kwh(r.sun), isNaN(r.self) ? '' : Math.round(r.self * 100) + '% zelf gebruikt') + '</div></div>';
    if (en.per === 'vandaag') html += enChart();
    var base = enBase();
    if (!isNaN(base)) html += '<div class="en-note">Sluipverbruik (laagste uur vannacht): <b>' + Math.round(base * 1000) + ' W</b>, dat is ongeveer <b>' + eur(base * 8760 * en.price) + '</b> per jaar.</div>';
    html += '<div class="en-sec">Tarieven</div>' +
      '<div class="en-price"><span>Stroomprijs per kWh</span><button class="rb" data-enp="price" data-d="-0.01">&minus;</button><b>' + eur(en.price) + '</b><button class="rb" data-enp="price" data-d="0.01">+</button></div>' +
      '<div class="en-price"><span>Terugleververgoeding per kWh</span><button class="rb" data-enp="feed" data-d="-0.01">&minus;</button><b>' + eur(en.feed) + '</b><button class="rb" data-enp="feed" data-d="0.01">+</button></div>' +
      '<div class="en-note">Inclusief belasting en btw, zonder vaste kosten. Terugleververgoeding = wat teruggeleverde stroom je oplevert: tot en met 2026 (saldering) is dat de stroomprijs min de terugleverkosten van je leverancier. ' +
      (LIVE && !en.has ? '<br><b>Nog niet alles zichtbaar:</b> installeer het energie-pakket (zie handleiding, stap &ldquo;Energie&rdquo;).' : '') + '</div>';
    $('en-box').innerHTML = html;
  }
  function enOpen() { lastTouch = new Date().getTime(); en.open = true; $('en-wrap').className = ''; $('en-wrap').scrollTop = 0; renderEnergy(); }
  function enClose() { en.open = false; $('en-wrap').className = 'hidden'; }
  function bindEnergy() {
    on($('card-energy'), 'click', function () { en.view = 'energy'; enOpen(); });
    on($('wh-info'), 'click', function (e) { e.stopPropagation(); hpOpen(); });
    on($('en-wrap'), 'click', function (e) {
      if (closest(e.target, 'data-en')) { enClose(); return; }
      var t = closest(e.target, 'data-enper');
      if (t) { en.per = t.getAttribute('data-enper'); renderEnergy(); return; }
      var p = closest(e.target, 'data-enp');
      if (p) {
        var key = p.getAttribute('data-enp'), v = clamp(Math.round(((key === 'price' ? en.price : en.feed) + parseFloat(p.getAttribute('data-d'))) * 100) / 100, 0, 1);
        if (key === 'price') en.price = v; else en.feed = v;
        setPend(key === 'price' ? 'enprice' : 'enfeed', v);
        debounce('en' + key, function () { backend.setPrice(key, v); });
        renderEnergy();
      }
    });
  }

  /* =====================================================================
   * 5e. Warmtepomp (Weheat Blackbird) - alle gegevens uit de Weheat-integratie.
   *     Entiteiten worden automatisch gevonden via de COP-sensor; de rest
   *     heeft hetzelfde voorvoegsel (bijv. sensor.blackbird_p80_...).
   * ===================================================================== */
  var wp = { pre: null, items: [], state: null, cop: NaN, flow: NaN, dev: '' };
  var WP_STATE = { standby: 'stand-by', water_check: 'watercontrole', heating: 'verwarmt het huis', cooling: 'koelt',
    dhw: 'maakt warm water (boiler)', legionella_prevention: 'legionellapreventie (boiler extra heet)', defrosting: 'ontdooit de buitenunit',
    self_test: 'zelftest', manual_control: 'handmatige bediening', on: 'aan', off: 'uit' };
  var WP_SHORT = { standby: 'stand-by', heating: 'verwarmt', cooling: 'koelt', dhw: 'boiler', legionella_prevention: 'boiler extra heet',
    defrosting: 'ontdooit', water_check: 'controle', self_test: 'zelftest', manual_control: 'handmatig' };
  function wpShort(st) { return WP_SHORT[st] || wpLabel(st); }
  function wpLabel(st) { return WP_STATE[st] || (st || '').replace(/_/g, ' '); }
  function wpRead(map) {
    var k, pre = CFG.entities.weheatPrefix || null, obj, it, a, u, nm, low, items = [], cop;
    if (!pre) for (k in map) if (/^sensor\..+_cop$/.test(k) && k.indexOf('energie') < 0) { pre = k.slice(7, -4); break; }
    wp.pre = pre; wp.items = items; wp.state = null; wp.cop = NaN; wp.flow = NaN;
    if (!pre) return;
    cop = map['sensor.' + pre + '_cop'];
    wp.dev = cop && cop.attributes && cop.attributes.friendly_name ? cop.attributes.friendly_name.replace(/\s*COP\s*$/i, '') : '';
    for (k in map) {
      obj = k.split('.');
      if ((obj[0] !== 'sensor' && obj[0] !== 'binary_sensor') || obj[1].indexOf(pre + '_') !== 0) continue;
      a = map[k].attributes || {}; u = a.unit_of_measurement || '';
      nm = (a.friendly_name || obj[1]).replace(wp.dev, '').replace(/^\s+/, '');
      nm = nm.charAt(0).toUpperCase() + nm.slice(1);
      low = (k + ' ' + nm).toLowerCase();
      it = { id: k, name: nm, unit: u, st: map[k].state, v: parseFloat(map[k].state), bin: obj[0] === 'binary_sensor', low: low };
      it.grp = it.bin ? 'parts' : (/dhw|sww|sanitair|tapwater|boiler|warm water|warmwater/.test(low) ? 'dhw' :
        (u === 'W' || u === 'kW' || /_cop$/.test(k) || u === '%' ? 'now' : (u === '°C' ? 'temp' : (u === 'kWh' ? 'tot' : (isNaN(it.v) ? 'status' : 'other')))));
      if (/_cop$/.test(k)) wp.cop = it.v;
      if (u === '°C' && /water/.test(low) && !/doel|target|huis|sww|dhw/.test(low) && /outlet|uitlaat|aanvoer|uitgang|temperatuur uit\b/.test(low)) wp.flow = it.v;
      // toestand: de ruwe waarde is in elke taal hetzelfde (heating, dhw, standby, ...)
      if (!it.bin && !u && WP_STATE[it.st] && it.st !== 'on' && it.st !== 'off' && !/cool|koel|control|methode|regel/.test(low)) {
        if (!wp.state || /state|status|toestand/.test(low)) wp.state = it.st;
      }
      if (it.st === 'unavailable' || it.st === 'unknown') continue;
      items.push(it);
    }
    items.sort(function (x, y) { return x.name < y.name ? -1 : 1; });
  }
  function wpVal(it) {
    if (it.bin) return it.st === 'on' ? 'aan' : 'uit';
    if (isNaN(it.v) || /^\d{4}-\d\d-\d\d/.test(it.st)) return wpLabel(it.st);
    var d = it.unit === 'W' || it.unit === '%' || /rpm/i.test(it.unit) ? 0 : (it.unit === 'kWh' && it.v >= 100 ? 0 : 1);
    return nl(it.v, d) + (it.unit ? ' ' + (it.unit === '°C' ? '°' : it.unit) : '');
  }
  function renderHp() {
    var s = state, H = s.has, html = '', g, k, it, r = enStats('vandaag'), any = false;
    var GR = [['now', 'Nu'], ['temp', 'Temperaturen'], ['dhw', 'Boiler (warm water)'], ['status', 'Status'], ['parts', 'Onderdelen binnenunit'], ['other', 'Overig'], ['tot', 'Tellerstanden (totaal sinds installatie)']];
    html += '<div class="en-head"><span class="en-title">Warmtepomp</span><button class="door-x" data-en="close">Sluiten</button></div>';
    html += '<div class="en-tiles">' +
      enTile('stroom nu (kWh-meter)', H.hp ? nl(s.hp, 2) + ' kW' : '&ndash;', '#ff8a5c') +
      enTile(wp.state ? wpLabel(wp.state) : 'wat hij doet', wp.state ? wpShort(wp.state) : (H.hp ? (s.hp > 0.15 ? 'draait' : 'stand-by') : '&ndash;'), '#e8edf5') +
      enTile('COP nu', isNaN(wp.cop) ? '&ndash;' : nl(wp.cop), '#4fe0a5') +
      enTile('verbruik vandaag', kwh(r.hp), '#ff8a5c') +
      enTile('kosten vandaag', isNaN(r.hp) ? '&ndash;' : eur(r.hp * en.price), '#ffc94d') +
      enTile('vloer (thermostaat)', H.thermo ? (s.thermo.heating ? 'vraagt warmte' : 'geen vraag') : '&ndash;', '#8fb4ff') + '</div>';
    if (!wp.pre) {
      html += '<div class="en-note">Koppel de <b>Weheat</b>-integratie in Home Assistant om te zien wat de warmtepomp precies doet: verwarmen, boiler, ontdooien, temperaturen van de vaten, COP en meer (zie handleiding, stap &ldquo;Weheat&rdquo;).</div>';
    } else {
      for (g = 0; g < GR.length; g++) {
        var rows = '';
        for (k = 0; k < wp.items.length; k++) { it = wp.items[k]; if (it.grp === GR[g][0]) rows += enRow(it.name, wpVal(it)); }
        if (rows) { any = true; html += '<div class="en-sec">' + GR[g][1] + '</div>' + rows; }
      }
      if (!any) html += '<div class="en-note">Weheat is gekoppeld, maar er komen (nog) geen gegevens binnen.</div>';
    }
    $('en-box').innerHTML = html;
  }
  function hpOpen() { en.view = 'hp'; enOpen(); }

  /* =====================================================================
   * 5f. Archief (Frigate): terugkijken per 10 minuten en stukjes bewaren.
   *     Beeld komt rechtstreeks van Frigate (poort 5000), bewaren en
   *     verwijderen gaat via Home Assistant (rest_command, homeassistant/frigate.yaml).
   * ===================================================================== */
  var arc = { built: false, tab: 'live', day: 0, hour: -1, start: 0, saved: [], hasPkg: false, playing: '' };
  var ARC_CAM = 'voordeur', ARC_BLK = 600;
  function fBase() { return 'http://' + location.hostname + ':5000'; }
  function arcBuild() {
    if (arc.built) return;
    arc.built = true;
    var box = document.querySelector('#door-wrap .door-box');
    var tabs = document.createElement('div');
    tabs.className = 'seg arc-tabs'; tabs.id = 'arc-tabs';
    tabs.innerHTML = '<button data-arct="live">Live</button><button data-arct="arch">Terugkijken</button><button data-arct="saved">Bewaard</button>';
    box.insertBefore(tabs, $('door-img'));
    var a = document.createElement('div');
    a.id = 'arc'; a.style.display = 'none';
    a.innerHTML = '<div id="arc-pick"></div><div class="arc-player"><video id="arc-video" controls playsinline webkit-playsinline preload="none"></video>' +
      '<div id="arc-cap" class="arc-cap"></div><div id="arc-bar" class="arc-bar"></div></div><div id="arc-msg" class="arc-msg"></div>';
    box.appendChild(a);
    on(tabs, 'click', function (e) { var b = closest(e.target, 'data-arct'); if (b) arcTab(b.getAttribute('data-arct')); });
    on(a, 'click', arcClick);
    on($('arc-video'), 'error', function () {
      if (arc.playing) arcMsg('Deze opname kan niet worden afgespeeld. Is er toen opgenomen, en staat poort 5000 aan bij Frigate?');
    });
  }
  function arcMsg(t) { $('arc-msg').innerHTML = t || ''; }
  function arcStop() {
    var v = $('arc-video');
    if (v) { try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e2) {} }
    arc.playing = '';
  }
  function arcTab(t) {
    arc.tab = t;
    segSelect('arc-tabs', 'data-arct', t);
    var live = t === 'live';
    $('door-img').style.display = live && $('door-img').getAttribute('src') ? '' : 'none';
    $('door-msg').style.display = live ? '' : 'none';
    $('arc').style.display = live ? 'none' : '';
    if (live) { arcStop(); door.until = new Date().getTime() + 120000; doorNext(); }
    else { clearTimeout(door.timer); arcMsg(''); arcRender(); }
  }
  function dayStart(off) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off); return d; }
  function arcLabel(ts) {
    var d = new Date(ts * 1000);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function arcRender() {
    if (!arc.built) return;
    var h = '', k, now = new Date().getTime() / 1000;
    if (arc.tab === 'arch') {
      var base = dayStart(arc.day).getTime() / 1000;
      h += '<div class="arc-row">';
      for (k = 0; k < 2; k++) h += '<button class="arc-chip' + (arc.day === k ? ' on' : '') + '" data-arcday="' + k + '">' + (k ? 'Gisteren' : 'Vandaag') + '</button>';
      h += '<span class="arc-hint">Tik op een uur en daarna op een stukje van 10 minuten.</span></div><div class="arc-hours">';
      for (k = 0; k < 24; k++) {
        var past = base + k * 3600 < now;
        h += '<button class="arc-h' + (arc.hour === k ? ' on' : '') + (past ? '' : ' off') + '" data-arch="' + k + '">' + pad(k) + '</button>';
      }
      h += '</div>';
      if (arc.hour >= 0) {
        h += '<div class="arc-blocks">';
        for (k = 0; k < 6; k++) {
          var st = base + arc.hour * 3600 + k * ARC_BLK, ok = st < now - 20;
          h += '<button class="arc-b' + (arc.start === st ? ' on' : '') + (ok ? '' : ' off') + '" data-arcs="' + st + '">' + pad(arc.hour) + ':' + pad(k * 10) + '</button>';
        }
        h += '</div>';
      }
    } else {
      if (!arc.hasPkg && LIVE) h += '<div class="arc-hint">Bewaarde stukjes verschijnen hier zodra het Frigate-pakket in Home Assistant staat (zie handleiding).</div>';
      else if (!arc.saved.length) h += '<div class="arc-hint">Nog niets bewaard. Ga naar <b>Terugkijken</b>, speel een stukje af en tik op <b>Bewaren</b>.</div>';
      h += '<div class="arc-list">';
      for (k = 0; k < arc.saved.length; k++) {
        var it = arc.saved[k];
        h += '<div class="arc-item"><button class="arc-play" data-arcf="' + it.file + '" data-arcn="' + (it.name || '') + '">&#9654; ' + (it.name || it.file) +
          (it.busy ? ' <small>(wordt opgeslagen&hellip;)</small>' : '') + '</button><button class="arc-del" data-arcdel="' + it.id + '">Verwijderen</button></div>';
      }
      h += '</div>';
    }
    $('arc-pick').innerHTML = h;
    var bar = '';
    if (arc.playing === 'clip') bar = '<button class="arc-nav" data-arcstep="-1">&lsaquo; 10 min</button><button class="arc-save" data-arcsave="1">Bewaren</button><button class="arc-nav" data-arcstep="1">10 min &rsaquo;</button>';
    $('arc-bar').innerHTML = bar;
  }
  function arcPlay(url, cap, kind) {
    var v = $('arc-video');
    arc.playing = kind; arcMsg('');
    v.src = url; $('arc-cap').innerHTML = cap;
    try { v.load(); var pr = v.play(); if (pr && pr['catch']) pr['catch'](function () {}); } catch (e) {}
    arcRender();
  }
  function arcPlayBlock(st) {
    var now = new Date().getTime() / 1000;
    if (st >= now - 20) return;
    arc.start = st;
    arc.hour = new Date(st * 1000).getHours();
    var end = Math.min(st + ARC_BLK, Math.floor(now) - 10);
    arcPlay(fBase() + '/api/' + ARC_CAM + '/start/' + st + '/end/' + end + '/clip.mp4', arcLabel(st) + ' &ndash; ' + arcLabel(end).slice(-5), 'clip');
  }
  function arcClick(e) {
    lastTouch = new Date().getTime();
    var b;
    if ((b = closest(e.target, 'data-arcday'))) { arc.day = parseInt(b.getAttribute('data-arcday'), 10); arc.hour = -1; arcRender(); return; }
    if ((b = closest(e.target, 'data-arch'))) { if (b.className.indexOf('off') < 0) { arc.hour = parseInt(b.getAttribute('data-arch'), 10); arcRender(); } return; }
    if ((b = closest(e.target, 'data-arcs'))) { if (b.className.indexOf('off') < 0) arcPlayBlock(parseInt(b.getAttribute('data-arcs'), 10)); return; }
    if ((b = closest(e.target, 'data-arcstep'))) {
      var ns = arc.start + parseInt(b.getAttribute('data-arcstep'), 10) * ARC_BLK;
      if (ns < dayStart(1).getTime() / 1000) return;
      arc.day = ns < dayStart(0).getTime() / 1000 ? 1 : 0;
      arcPlayBlock(ns); return;
    }
    if ((b = closest(e.target, 'data-arcsave'))) {
      if (!LIVE) { arcMsg('Demo-modus: bewaren werkt alleen met Home Assistant.'); return; }
      var end = Math.min(arc.start + ARC_BLK, Math.floor(new Date().getTime() / 1000) - 10);
      ha.call('rest_command', 'frigate_bewaren', { start: arc.start, end: end, name: 'Voordeur ' + arcLabel(arc.start) });
      arcMsg('Bewaard: <b>' + arcLabel(arc.start) + '</b>. Je vindt het onder <b>Bewaard</b> (het opslaan duurt even).');
      return;
    }
    if ((b = closest(e.target, 'data-arcf'))) {
      arcPlay(fBase() + '/exports/' + b.getAttribute('data-arcf'), b.getAttribute('data-arcn'), 'saved'); return;
    }
    if ((b = closest(e.target, 'data-arcdel'))) {
      if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.innerHTML = 'Zeker weten?'; return; }
      ha.call('rest_command', 'frigate_verwijderen', { id: b.getAttribute('data-arcdel') });
      for (var k = 0; k < arc.saved.length; k++) if (arc.saved[k].id === b.getAttribute('data-arcdel')) { arc.saved.splice(k, 1); break; }
      arcStop(); $('arc-cap').innerHTML = ''; arcRender();
    }
  }
  function arcRead(map) {
    var e = map['sensor.frigate_bewaard'];
    arc.hasPkg = !!e;
    var items = e && e.attributes && e.attributes.items;
    if (items && items.length !== undefined) {
      arc.saved = items.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
      if (arc.tab === 'saved' && door.open && !arc.playing) arcRender();
    }
  }

  /* =====================================================================
   * 6. Bediening
   * ===================================================================== */
  function bindControls() {
    on($('card-climate'), 'click', function (e) {
      var b = closest(e.target, 'data-thermo');
      if (b) {
        var th = state.thermo;
        th.set = clamp(Math.round(((isNaN(th.set) ? 20 : th.set) + parseFloat(b.getAttribute('data-thermo'))) * 2) / 2, 5, 28);
        setPend('thset', th.set);
        debounce('thset', function () { backend.setTemp(state.thermo.set); });
        render(); return;
      }
      var am = closest(e.target, 'data-acmode');
      if (am) {
        var ai = parseInt(am.getAttribute('data-acmode'), 10), ac = state.acs[ai];
        var order = [], q;
        for (q = 0; q < AC_ORDER.length; q++) if (AC_ORDER[q] === 'off' || !ac.modes || ac.modes.indexOf(AC_ORDER[q]) >= 0) order.push(AC_ORDER[q]);
        ac.mode = order[(order.indexOf(ac.mode) + 1) % order.length];
        setPend('acmode' + ai, ac.mode);
        debounce('acmode' + ai, function () { backend.setAcMode(ai, state.acs[ai].mode); }, 900);
        render(); return;
      }
      var ad = closest(e.target, 'data-acd');
      if (ad) {
        var aj = parseInt(ad.getAttribute('data-aci'), 10);
        state.acs[aj].set = clamp((isNaN(state.acs[aj].set) ? 20 : state.acs[aj].set) + parseFloat(ad.getAttribute('data-acd')), 16, 30);
        setPend('acset' + aj, state.acs[aj].set);
        debounce('acset' + aj, function () { backend.setAcTemp(aj, state.acs[aj].set); });
        render(); return;
      }
      var m = closest(e.target, 'data-mode');
      if (m) { state.mode = m.getAttribute('data-mode'); setPend('mode', state.mode); backend.setMode(state.mode); render(); }
    });
    on($('vent-seg'), 'click', function (e) {
      var b = closest(e.target, 'data-v');
      if (b) { state.vent = b.getAttribute('data-v'); setPend('vent', state.vent); backend.setVent(state.vent); render(); }
    });
    on($('lights'), 'click', function (e) {
      var mo = closest(e.target, 'data-lampmore');
      if (mo) { openSheet(parseInt(mo.getAttribute('data-lampmore'), 10)); return; }
      var l = closest(e.target, 'data-lamp');
      if (l) {
        var k = parseInt(l.getAttribute('data-lamp'), 10);
        state.lights[k] = !state.lights[k];
        setPend('light' + k, state.lights[k], 10000);
        backend.setLight(k, state.lights[k]); render();
      }
    });
    on($('screen-list'), 'click', function (e) {
      var b = closest(e.target, 'data-scr');
      if (!b) return;
      var k = parseInt(b.getAttribute('data-scr'), 10), cmd = b.getAttribute('data-cmd'), sc = state.screens[k];
      if (cmd === 'up') sc.target = 0;
      else if (cmd === 'down') sc.target = 100;
      else sc.target = sc.pos !== sc.target ? sc.pos : (CFG.screenMyPos || 60);   // my: stoppen of naar favoriet
      backend.setScreen(k, cmd); render();
    });
    // tabbladen in de kaarten
    var tabGroups = document.querySelectorAll('.tabs'), g;
    for (g = 0; g < tabGroups.length; g++) on(tabGroups[g], 'click', function (e) {
      var b = closest(e.target, 'data-tab');
      if (!b) return;
      var btns = this.children, k;
      for (k = 0; k < btns.length; k++) {
        var on_ = btns[k] === b, pane = $('pane-' + btns[k].getAttribute('data-tab'));
        btns[k].className = on_ ? 'on' : '';
        pane.className = 'pane' + (on_ ? '' : ' hidden');
      }
      if (this.getAttribute('data-tabs') === 'lights') $('all-off').style.visibility = b.getAttribute('data-tab') === 'lamps' ? 'visible' : 'hidden';
    });
    on($('all-off'), 'click', function () {
      for (var k = 0; k < state.lights.length; k++) if (state.lights[k]) { state.lights[k] = false; setPend('light' + k, false, 10000); backend.setLight(k, false); }
      render();
    });
    // tik op een verdieping of label -> bijbehorende kaart licht op
    var TARGET = { '0': 'card-climate', '1': 'card-climate', '2': 'card-lights', '3': 'card-energy', sun: 'card-energy', zolder: 'card-vent',
      floor0: 'card-climate', floor1: 'card-climate', hp: 'card-energy', grid: 'card-energy' };
    function flash(id) {
      var c = $(id); if (!c) return;
      c.className = c.className.replace(' flash', '') + ' flash';
      setTimeout(function () { c.className = c.className.replace(' flash', ''); }, 900);
    }
    on($('scene'), 'click', function (e) {
      var f = closest(e.target, 'data-floor'), t = closest(e.target, 'data-target');
      if (t) flash(TARGET[t.getAttribute('data-target')]);
      else if (f) flash(TARGET[f.getAttribute('data-floor')]);
    });
  }

  /* =====================================================================
   * 7. Klok + dimmen (scherm sparen, minder licht 's nachts)
   * ===================================================================== */
  var DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tickClock() {
    var d = new Date(), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    houseImg();
    $('clock').innerHTML = hm; $('dim-clock').innerHTML = hm;
    $('date').innerHTML = DAYS[d.getDay()].charAt(0).toUpperCase() + DAYS[d.getDay()].slice(1) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('dim-sub').innerHTML = nl(state.outTemp) + '° buiten &middot; ' + (state.grid < 0 ? 'je levert ' : 'je neemt ') + nl(Math.abs(state.grid)) + ' kW ' + (state.grid < 0 ? 'terug' : 'af');
  }
  var lastTouch = new Date().getTime(), panelOff = false, reloadStamp = null;
  // nachtstand: tussen nightFrom en nightTo gaat het scherm helemaal zwart (tik = wakker)
  function hm(str) { var p = (str || '0:0').split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function isNight() {
    if (!CFG.nightFrom || !CFG.nightTo) return false;
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), a = hm(CFG.nightFrom), b = hm(CFG.nightTo);
    return a > b ? (m >= a || m < b) : (m >= a && m < b);
  }
  // rust-stand: als het scherm gedimd of zwart is, staan de animaties stil en wordt er minder vaak opgehaald (scheelt stroom)
  function dimSet(c) {
    $('dim').className = c;
    var h = document.documentElement, cls = h.className.replace(/ ?(rest|blackout)/g, '');
    if (c.indexOf('on') === 0) cls += ' rest';
    if (c.indexOf('black') >= 0) cls += ' blackout';
    h.className = cls;
  }
  function bindDim() {
    if (!CFG.dimAfterSec) return;
    function wake(e) {
      lastTouch = new Date().getTime();
      if ($('dim').className.indexOf('on') === 0) { dimSet(''); e.preventDefault(); e.stopPropagation(); }
    }
    on(document, 'touchstart', wake);
    on(document, 'mousedown', wake);
    setInterval(function () {
      if (MOBILE) return;
      var idle = new Date().getTime() - lastTouch > CFG.dimAfterSec * 1000;
      if ((panelOff || isNight()) && idle) dimSet('on black');  // nacht of op afstand uit: helemaal zwart
      else if (idle && $('dim').className === '') dimSet('on');
    }, 5000);
  }

  /* =====================================================================
   * 8. Backends: demo (nepdata) en Home Assistant (REST API)
   * ===================================================================== */
  var demo = {
    t: 0, cloud: 0.8,
    start: function () {
      // geschiedenis tot nu verzinnen zodat de grafiek gevuld is
      var nowH = new Date().getHours(), k;
      for (k = 0; k < 24; k++) {
        if (k <= nowH) {
          state.history[k].sun = demo.sunAt(k + 0.5) * (0.7 + 0.3 * Math.sin(k * 1.7));
          state.history[k].use = 0.35 + (k >= 6 && k <= 9 ? 0.9 : 0) + (k >= 17 && k <= 21 ? 1.3 : 0) + 0.25 * Math.abs(Math.sin(k));
          state.todaySun += state.history[k].sun; state.todayUse += state.history[k].use;
        }
      }
      demo.step(); setInterval(demo.step, 3000);
    },
    sunAt: function (h) {
      var month = new Date().getMonth(), season = 0.35 + 0.65 * Math.max(0, Math.sin((month - 2) / 12 * 6.2832 + 1.2) * 0.5 + 0.5);
      var len = 8 + season * 8, mid = 13.4;
      var x = (h - (mid - len / 2)) / len;
      return x <= 0 || x >= 1 ? 0 : 3.6 * season * Math.sin(Math.PI * x);
    },
    step: function () {
      var d = new Date(), h = d.getHours() + d.getMinutes() / 60, z;
      demo.cloud = clamp(demo.cloud + (Math.random() - 0.5) * 0.12, 0.45, 1);
      state.solar = demo.sunAt(h) * demo.cloud;
      var th = state.thermo, target = state.mode === 'away' ? th.set - 3 : (state.mode === 'eco' ? th.set - 1.5 : th.set);
      th.heating = th.temp < target - 0.1;
      th.temp = clamp(th.temp + (th.heating ? 0.03 : -0.01), 14, 26);
      var heatOn = th.heating, acKw = 0;
      state.flowTemp = heatOn ? 33 + Math.random() * 3 : 26;
      for (z = 0; z < state.acs.length; z++) {
        var a = state.acs[z];
        if (a.mode !== 'off') { acKw += 0.35 + Math.random() * 0.1; a.temp += (a.set - a.temp) * 0.05; }
        else a.temp += (th.temp - 1.5 - a.temp) * 0.01;
      }
      state.hp = heatOn ? 0.7 + Math.random() * 0.4 : 0.06;
      state.cop = clamp(3.2 + (state.outTemp - 2) * 0.12 + (Math.random() - 0.5) * 0.2, 2.2, 5.5);
      var base = 0.28 + Math.random() * 0.15, k;
      for (k = 0; k < state.lights.length; k++) if (state.lights[k]) base += 0.008;
      state.home = base + state.hp + acKw + (state.vent === 'boost' ? 0.05 : 0.02);
      state.grid = state.home - state.solar;
      state.todaySun += state.solar * 3 / 3600; state.todayUse += state.home * 3 / 3600;
      state.todayNet = state.todaySun - state.todayUse;
      state.todayExp = (state.todayExp || 0) + Math.max(0, -state.grid) * 3 / 3600;
      state.history[d.getHours()].sun = Math.max(state.history[d.getHours()].sun, state.solar);
      state.history[d.getHours()].use = state.home;
      state.humidity = clamp(state.humidity + (Math.random() - 0.5) * 2 - (state.vent === 'boost' ? 1 : 0), 40, 80);
      render(); tickClock();
    },
    setTemp: function () {}, setMode: function () {}, setVent: function () {}, setLight: function () {}, setSched: function () {}, setSchedOn: function () {}, setPrice: function () {},
    setAcMode: function () {}, setAcTemp: function () {}, setScreen: function () {}, setLightLevel: function () {}
  };
  // demo: screens bewegen zichtbaar
  setInterval(function () {
    if (CFG.mode === 'homeassistant') return;
    var moved = false, k, sc;
    for (k = 0; k < state.screens.length; k++) {
      sc = state.screens[k];
      if (sc.pos !== sc.target) { sc.pos = sc.target > sc.pos ? Math.min(sc.target, sc.pos + 10) : Math.max(sc.target, sc.pos - 10); moved = true; }
    }
    if (moved) renderScreens();
  }, 400);

  var ha = {
    base: function () { return (CFG.homeassistant.url || '').replace(/\/$/, ''); },
    req: function (method, path, body, cb) {
      var x = new XMLHttpRequest();
      x.open(method, ha.base() + path, true);
      x.setRequestHeader('Authorization', 'Bearer ' + CFG.homeassistant.token);
      x.setRequestHeader('Content-Type', 'application/json');
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        var ok = x.status >= 200 && x.status < 300;
        $('conn-dot').className = 'dot ' + (ok ? 'live' : 'err');
        $('conn-text').innerHTML = ok ? 'Verbonden' : 'Geen verbinding (' + x.status + ')';
        if (ok && cb) { try { cb(JSON.parse(x.responseText)); } catch (err) {} }
      };
      x.send(body ? JSON.stringify(body) : null);
    },
    call: function (domain, service, data) { ha.req('POST', '/api/services/' + domain + '/' + service, data, function () { setTimeout(ha.poll, 2500); }); },
    num: function (map, id, div) { var e = map[id]; var v = e ? parseFloat(e.state) : NaN; return isNaN(v) ? 0 : v / (div || 1); },
    ok: function (map, id) { var e = id && map[id]; return !!(e && e.state !== 'unavailable' && e.state !== 'unknown'); },
    // tellerstanden om middernacht ophalen (voor "vandaag")
    base0: null, baseDay: null,
    loadBase: function () {
      var E = CFG.entities, ids = [], d = new Date(), q;
      var list = [E.gridImportTotal, E.gridExportTotal, E.solarEnergyTotal];
      for (q = 0; q < list.length; q++) if (list[q]) ids.push(list[q]);
      ha.baseDay = d.getDate();
      var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 5), end = new Date(start.getTime() + 10 * 60000);
      ha.req('GET', '/api/history/period/' + encodeURIComponent(start.toISOString()) + '?filter_entity_id=' + ids.join(',') +
        '&end_time=' + encodeURIComponent(end.toISOString()) + '&minimal_response&no_attributes', null, function (res) {
        var b = {}, r, v;
        for (r = 0; r < res.length; r++) if (res[r].length) {
          v = parseFloat(res[r][0].state);
          if (!isNaN(v)) b[res[r][0].entity_id] = v;
        }
        ha.base0 = b;
      });
    },
    // grafiek: uurgemiddelden, bewaard op de iPad zodat herladen ze niet wist
    histKey: function () { var d = new Date(); return 'thuis_hist_' + d.getFullYear() + '_' + d.getMonth() + '_' + d.getDate(); },
    loadHist: function () {
      try { var j = JSON.parse(window.localStorage.getItem(ha.histKey()) || 'null'); if (j && j.length === 24) state.history = j; } catch (e) {}
    },
    addSample: function () {
      var hh = state.history[new Date().getHours()], n = hh.n || 0;
      hh.sun = (hh.sun * n + state.solar) / (n + 1);
      hh.use = (hh.use * n + state.home) / (n + 1);
      hh.n = Math.min(n + 1, 720);
      try { window.localStorage.setItem(ha.histKey(), JSON.stringify(state.history)); } catch (e) {}
    },
    poll: function () {
      ha.req('GET', '/api/states', null, function (list) {
        var map = {}, E = CFG.entities, k;
        for (k = 0; k < list.length; k++) map[list[k].entity_id] = list[k];
        var H = state.has;
        H.solar = ha.ok(map, E.solarPower); H.hp = ha.ok(map, E.heatPumpPower); H.ac = ha.ok(map, E.acPower);
        H.thermo = ha.ok(map, E.thermostat); H.vent = ha.ok(map, E.ventilation);
        state.grid = ha.num(map, E.gridPower, 1000);
        state.solar = Math.abs(ha.num(map, E.solarPower, 1000));
        state.hp = Math.abs(ha.num(map, E.heatPumpPower, 1000));
        state.ac = Math.abs(ha.num(map, E.acPower, 1000));
        state.home = Math.max(0, state.grid + state.solar);
        // vandaag = tellerstand nu - tellerstand om middernacht (uit de geschiedenis van Home Assistant)
        if (ha.baseDay !== new Date().getDate()) ha.loadBase();
        var B = ha.base0 || {};
        if (B[E.gridImportTotal] !== undefined && ha.ok(map, E.gridImportTotal)) {
          var imp = ha.num(map, E.gridImportTotal) - B[E.gridImportTotal];
          var exq = ha.num(map, E.gridExportTotal) - (B[E.gridExportTotal] !== undefined ? B[E.gridExportTotal] : ha.num(map, E.gridExportTotal));
          state.todaySun = (B[E.solarEnergyTotal] !== undefined) ? Math.abs(ha.num(map, E.solarEnergyTotal) - B[E.solarEnergyTotal]) : 0;
          state.todayNet = exq - imp;
          state.todayExp = exq;
          state.todayUse = state.todaySun + imp - exq;
          H.today = true;
        }
        ha.zone(map[E.thermostat], state.thermo);
        enRead(map);
        arcRead(map);
        wpRead(map);
        H.weheat = !!wp.pre;
        if (!isNaN(wp.cop)) state.cop = wp.cop;
        if (!isNaN(wp.flow)) state.flowTemp = wp.flow;
        door.id = doorFind(map);
        door.pic = door.id && map[door.id].attributes ? map[door.id].attributes.entity_picture : null;
        H.door = !!door.pic;
        var es = map[SCH_E], eo = map[SCH_ON_E];
        H.sched = !!(es && eo);
        state.sched = es ? (schParse(usePend('sched', es.state)) || schDefault()) : null;
        state.schedOn = eo ? usePend('schon', eo.state === 'on') : false;
        for (k = 0; k < ACS.length; k++) {
          var ac = map[ACS[k].id], a = state.acs[k];
          a.has = !!(ac && ac.attributes && ac.state !== 'unavailable');
          if (!a.has) continue;
          a.modes = ac.attributes.hvac_modes || null;
          a.temp = parseFloat(ac.attributes.current_temperature) || a.temp;
          a.set = usePend('acset' + k, parseFloat(ac.attributes.temperature) || a.set);
          a.mode = usePend('acmode' + k, ac.state === 'heat_cool' ? 'auto' : (AC_TXT[ac.state] ? ac.state : (ac.state === 'off' ? 'off' : 'auto')));
        }
        H.screens = false;
        for (k = 0; k < SCREENS.length; k++) {
          var cv = map[SCREENS[k].id], sc = state.screens[k];
          if (!cv) continue;
          H.screens = true;
          var p = cv.attributes && cv.attributes.current_position;
          sc.pos = sc.target = (p !== undefined && p !== null) ? 100 - p : (cv.state === 'closed' ? 100 : 0);
          if (cv.state === 'opening') sc.target = 0;
          if (cv.state === 'closing') sc.target = 100;
        }
        var fan = map[E.ventilation];
        if (fan && fan.attributes && fan.attributes.preset_mode) state.vent = usePend('vent', ha.ventFromPreset(fan.attributes.preset_mode));
        state.humidity = ha.num(map, E.bathHumidity) || state.humidity;
        for (k = 0; k < CFG.lights.length; k++) {
          state.lightsHas[k] = ha.ok(map, CFG.lights[k].id);
          // bestaat de lamp wel, maar is hij onbereikbaar? Dan staat de muurknop (stroom) uit.
          state.lightsWall[k] = !!(map[CFG.lights[k].id] && map[CFG.lights[k].id].state === 'unavailable');
          var le = map[CFG.lights[k].id], la = (le && le.attributes) || {};
          if (la.brightness) state.lightsBri[k] = usePend('lbri' + k, Math.max(1, Math.round(la.brightness / 2.55)));
          if (la.color_temp_kelvin) state.lightsCt[k] = usePend('lct' + k, la.color_temp_kelvin);
          if (la.min_color_temp_kelvin && la.max_color_temp_kelvin) state.lightsCtRange[k] = [la.min_color_temp_kelvin, la.max_color_temp_kelvin];
          if (la.supported_color_modes) state.lightsHasCt[k] = la.supported_color_modes.indexOf('color_temp') >= 0;
          state.lights[k] = usePend('light' + k, !!(map[CFG.lights[k].id] && map[CFG.lights[k].id].state === 'on'));
        }
        // op afstand: paneel herladen (input_button) en scherm zwart (input_boolean)
        var rb = map[E.panelReload];
        if (rb) { if (reloadStamp !== null && rb.state !== reloadStamp) { location.reload(); return; } reloadStamp = rb.state; }
        var so = map[E.panelScreenOff];
        panelOff = !!(so && so.state === 'on');
        if (!MOBILE && panelOff && new Date().getTime() - lastTouch > 15000) dimSet('on black');
        if (!panelOff && $('dim').className === 'on black') dimSet('');
        var w = map[E.weather];
        if (w && w.attributes) {
          var t = parseFloat(w.attributes.temperature);
          if (!isNaN(t)) state.outTemp = t;
          state.weatherText = ha.weatherNl(w.state);
          state.rainText = /rainy|pouring|lightning|snowy|hail/.test(w.state) ? 'Nu neerslag' : 'Nu droog';
        }
        ha.addSample();
        render(); tickClock();
      });
    },
    zone: function (e, z) {
      if (!e || !e.attributes) return;
      z.temp = parseFloat(e.attributes.current_temperature) || z.temp;
      z.set = usePend('thset', parseFloat(e.attributes.temperature) || z.set);
      z.presets = e.attributes.preset_modes || null;
      z.heating = e.attributes.hvac_action ? e.attributes.hvac_action === 'heating' : z.temp < z.set - 0.1;
    },
    PRESETS: { auto: 'auto', '1': 'low', '2': 'medium', '3': 'high', boost: 'timer' },
    ventFromPreset: function (p) { for (var k in ha.PRESETS) if (ha.PRESETS[k] === p) return k; return 'auto'; },
    weatherNl: function (s) {
      var m = { sunny: 'Zonnig', 'clear-night': 'Helder', partlycloudy: 'Half bewolkt', cloudy: 'Bewolkt', rainy: 'Regen', pouring: 'Zware regen', fog: 'Mist', snowy: 'Sneeuw', windy: 'Winderig', lightning: 'Onweer' };
      return m[s] || s;
    },
    start: function () {
      $('conn-text').innerHTML = 'Verbinden&hellip;';
      ha.loadHist(); ha.loadBase(); ha.poll();
      // in rust-stand maar 1 op de 6 keer ophalen (elke 30 s i.p.v. 5 s)
      var pollN = 0;
      setInterval(function () { pollN++; if (document.documentElement.className.indexOf('rest') >= 0 && pollN % 6) return; ha.poll(); }, CFG.homeassistant.pollMs || 5000);
      // nieuwe dag: grafiek leeg
      setInterval(function () { if (ha.baseDay !== new Date().getDate()) { for (var k = 0; k < 24; k++) state.history[k] = { sun: 0, use: 0 }; } }, 60000);
    },
    setPrice: function (key, v) {
      if (!en.hasPrice) return;
      ha.call('input_number', 'set_value', { entity_id: key === 'price' ? 'input_number.stroomprijs' : 'input_number.terugleververgoeding', value: v });
    },
    setSched: function (str) { if (!state.has.sched) return; ha.call('input_text', 'set_value', { entity_id: SCH_E, value: str }); },
    setSchedOn: function (v) { if (!state.has.sched) return; ha.call('input_boolean', v ? 'turn_on' : 'turn_off', { entity_id: SCH_ON_E }); },
    setTemp: function (t) { if (!state.has.thermo) return; ha.call('climate', 'set_temperature', { entity_id: CFG.entities.thermostat, temperature: t }); },
    setMode: function (m) { if (!state.has.thermo || !state.thermo.presets || state.thermo.presets.indexOf(m) < 0) return; ha.call('climate', 'set_preset_mode', { entity_id: CFG.entities.thermostat, preset_mode: m }); },
    setAcMode: function (k, m) {
      if (!state.acs[k].has) return;
      if (m === 'off') ha.call('climate', 'turn_off', { entity_id: ACS[k].id });
      else ha.call('climate', 'set_hvac_mode', { entity_id: ACS[k].id, hvac_mode: m });
    },
    setAcTemp: function (k, t) { if (!state.acs[k].has) return; ha.call('climate', 'set_temperature', { entity_id: ACS[k].id, temperature: t }); },
    setScreen: function (k, cmd) {
      if (!state.has.screens) return;
      ha.call('cover', cmd === 'up' ? 'open_cover' : (cmd === 'down' ? 'close_cover' : 'stop_cover'), { entity_id: SCREENS[k].id });
    },
    setVent: function (v) { if (!state.has.vent) return; ha.call('fan', 'set_preset_mode', { entity_id: CFG.entities.ventilation, preset_mode: ha.PRESETS[v] }); },
    setLightLevel: function (k, data) {
      if (!state.lightsHas[k]) return;
      data.entity_id = CFG.lights[k].id;
      ha.call('light', 'turn_on', data);
    },
    setLight: function (k, onOff) { if (!state.lightsHas[k]) return; ha.call('light', onOff ? 'turn_on' : 'turn_off', { entity_id: CFG.lights[k].id }); }
  };

  var backend = CFG.mode === 'homeassistant' ? ha : demo;

  /* =====================================================================
   * 9. Start
   * ===================================================================== */
  // Op een kleiner scherm (telefoon, of in de Home Assistant-app) het hele paneel passend schalen.
  function fitScreen() {
    var w = window.innerWidth, h = window.innerHeight, sc = Math.min(w / 1024, h / 768), a = $('app');
    if (sc >= 0.999) { sc = 1; }
    a.style.webkitTransformOrigin = '0 0'; a.style.transformOrigin = '0 0';
    a.style.webkitTransform = 'scale(' + sc + ')'; a.style.transform = 'scale(' + sc + ')';
    a.style.margin = '0'; a.style.left = Math.max(0, (w - 1024 * sc) / 2) + 'px'; a.style.top = Math.max(0, (h - 768 * sc) / 2) + 'px';
  }
  if (Math.min(window.innerWidth, window.innerHeight) >= 600) {
    fitScreen();
    on(window, 'resize', fitScreen);
  }
  on(window, 'orientationchange', function () { setTimeout(fitScreen, 300); });

  buildScene();
  buildTags();
  buildLights();
  buildAcs();
  buildScreens();
  bindControls();
  bindSheet();
  bindSched();
  bindDoor();
  bindEnergy();
  if (!LIVE) state.sched = schDefault();
  bindMobile();
  bindDim();
  render();
  tickClock();
  setInterval(tickClock, 10000);
  backend.start();
  if (CFG_ERROR) {
    $('conn-dot').className = 'dot err';
    $('conn-text').innerHTML = 'Fout in config.js &ndash; demo';
  }
})();
