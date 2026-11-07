/* Thuis - wandpaneel
 * Let op: ES5 only (iOS 9 Safari op iPad 2). Dus: var, function(){}, XMLHttpRequest,
 * geen let/const, arrow functions, template strings, fetch of Promise.
 */
(function () {
  'use strict';

  var CFG = window.HUB_CONFIG || { mode: 'demo', lights: [], entities: {} };

  /* =====================================================================
   * 1. Model: alles wat het scherm toont zit in dit ene object.
   * ===================================================================== */
  var state = {
    solar: 0, home: 0, hp: 0, grid: 0, cop: 4.1,         // kW (grid > 0 = afname, < 0 = teruglevering)
    todaySun: 0, todayUse: 0, todayNet: 0,     // kWh
    zones: {
      down: { temp: 20.6, set: 21.0, heating: true },
      up:   { temp: 18.9, set: 19.0, heating: false }
    },
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

  /* =====================================================================
   * 2. Helpers
   * ===================================================================== */
  function $(id) { return document.getElementById(id); }
  function nl(v, d) { // getal in Nederlandse notatie
    return v.toFixed(d === undefined ? 1 : d).replace('.', ',');
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function on(elm, ev, fn) { elm.addEventListener(ev, fn, false); }
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
  var S = 21, OX = 296, OY = 428;              // schaal en oorsprong op scherm

  // verdiepingen: echte vloerhoogte -> hoogte in de opengewerkte tekening
  var LV = [{ real: 0.00, off: 0.0 }, { real: 2.90, off: 4.6 }, { real: 5.78, off: 9.2 }];
  var LIFT = 4.7;       // zoveel zweeft het dak boven de zolder
  var CUT = 6.40;       // boven deze hoogte hoort de gevel bij het dakdeel
  var EAVE = 7.31, RIDGE = 9.74, RIDGE_X = 2.685;
  var NEAR = 0.9, FAR = 2.0, PART = 1.0;       // hoogte waarop muren zijn "doorgezaagd"

  function ZZ(lv, z) { return LV[lv].off + (z - LV[lv].real); }
  function ZR(z) { return LV[2].off + (z - LV[2].real) + LIFT; }
  function roofZ(x) { return RIDGE - Math.abs(x - RIDGE_X) * 0.8663; }   // hoogte dakvlak (dakhelling ~41 graden)

  function P(X, Y, Z) { return [OX + (X - Y) * 0.866 * S, OY + (X + Y) * 0.5 * S - Z * S]; }
  function Pm(x, y, z) { return P(x + 0.12, 12 - y, z); }   // model -> scherm (rechtshandig: niet gespiegeld)

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
  function face(list, cls, parent) { return el('polygon', { points: ptsM(list), 'class': cls }, parent); }
  function line(list, cls, parent) { return el('polyline', { points: ptsM(list), 'class': cls }, parent); }
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

  var refs = { floors: [], glows: [], bulbs: [], panels: [], ufh: [] };

  function buildScene() {
    var defs = el('defs', {});
    var rg = el('radialGradient', { id: 'glowGrad' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#ffc94d', 'stop-opacity': '0.8' }, rg);
    el('stop', { offset: '100%', 'stop-color': '#ffc94d', 'stop-opacity': '0' }, rg);

    // ---- terrein: stoep, tuin, terras ----
    face([[-1.2, -2.6, -0.02], [6.6, -2.6, -0.02], [6.6, 15.4, -0.02], [-1.2, 15.4, -0.02]], 'grass');
    face([[-1.2, -2.6, -0.01], [6.6, -2.6, -0.01], [6.6, -0.05, -0.01], [-1.2, -0.05, -0.01]], 'paving');
    face([[0.12, 11.9, -0.01], [5.25, 11.9, -0.01], [5.25, 14.9, -0.01], [0.12, 14.9, -0.01]], 'paving');

    // ---- warmtepomp buitenunit (Weheat Blackbird) achter in de tuin ----
    var hp = el('g', {});
    box(4.4, 5.7, 13.0, 13.55, 0, 1.0, 'hp', hp);
    box(4.4, 5.7, 13.0, 13.55, 1.0, 1.07, 'hpcap', hp);
    var fan = [], a;
    for (a = 0; a < 20; a++) fan.push([5.05 + 0.34 * Math.cos(a / 20 * 6.2832), 12.999, 0.52 + 0.34 * Math.sin(a / 20 * 6.2832)]);
    face(fan, 'hp-fan', hp);

    buildGround();
    buildFirst();
    buildAttic();
    buildRoof();
    buildFlows();

    // labels: verdiepingen in een kolom rechts naast het huis
    var COL = 446;
    refs.anchor = {
      sun: Pm(RIDGE_X, 5.5, ZR(RIDGE) + 2.2),
      zolder: [COL, Pm(5.49, 9.5, ZZ(2, 6.6))[1]],
      floor1: [COL, Pm(5.49, 9.5, ZZ(1, 3.6))[1]],
      floor0: [COL, Pm(5.49, 0, 0)[1] - 18],
      hp: [COL, Pm(5.05, 13.27, 0)[1] + 46],
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
    var th = Pm(2.53, 4.48, 1.56);
    refs.thermo = el('circle', { cx: th[0], cy: th[1], r: 4, 'class': 'thermo' }, g);
    // nabije muren: voorgevel (met voordeuropening) en rechter bouwmuur
    box(0.12, 0.53, 0, 0.4, z, z + NEAR, 'brick', g);
    box(1.69, 5.25, 0, 0.4, z, z + NEAR, 'brick', g);
    box(0.53, 1.69, 0, 0.4, z, z + 0.02, 'paving-step', g);
    box(5.25, 5.49, 0, 11.9, z, z + NEAR, 'party', g);
    flushText();
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
    face([[0.12, 0.4, z + 0.01], [2.42, 0.4, z + 0.01], [2.42, 3.03, z + 0.01], [0.12, 3.03, z + 0.01]], 'tile', g);
    text(1.27, 1.6, z + 0.02, 'Badkamer', g);
    text(3.87, 2.4, z + 0.02, 'Slaapkamer 2', g);
    text(3.87, 6.9, z + 0.02, 'Slaapkamer 1', g);
    text(1.27, 7.5, z + 0.02, 'Slaapkamer 3', g);
    var it = [];
    it = it.concat(partition([
      [2.42, 2.49, 0.4, 9.1], [1.32, 2.42, 3.03, 3.10], [0.12, 2.42, 5.80, 5.87], [2.49, 5.25, 4.73, 4.80], [0.12, 1.32, 3.03, 3.10]
    ], z, PART, g));
    it = it.concat(stairs(0.12, 1.37, 2.45, 5.85, 6, z, g));
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
    text(2.7, 1.35, z + 0.02, 'Slaapkamer 5', g);
    text(3.9, 4.75, z + 0.02, 'Badkamer', g);
    text(2.7, 7.5, z + 0.02, 'Slaapkamer 4', g);
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
    var hpPts = [HUB, [2.0, -0.4, 0.25], [5.85, -0.4, 0.25], [5.85, 13.27, 0.25], [5.7, 13.27, 0.25]];
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
    $('st-sun').innerHTML = nl(s.solar);
    $('st-home').innerHTML = nl(s.home);
    $('st-hp').innerHTML = nl(s.hp);
    $('td-sun').innerHTML = nl(s.todaySun);
    $('td-use').innerHTML = nl(s.todayUse);
    $('td-net').innerHTML = (s.todayNet > 0 ? '+' : '') + nl(s.todayNet);
    renderChart();

    // klimaat
    renderZone('d', s.zones.down);
    renderZone('u', s.zones.up);
    segSelect('mode-seg', 'data-mode', s.mode);

    // ventilatie
    segSelect('vent-seg', 'data-v', s.vent);
    $('vent-info').innerHTML = 'Vocht badkamer ' + Math.round(s.humidity) + '%';

    // verlichting (LUUMR, 2e verdieping)
    var lampEls = $('lights').children, nOn = 0;
    for (k = 0; k < lampEls.length; k++) {
      lampEls[k].className = 'lamp' + (s.lights[k] ? ' on' : '');
      lampEls[k].querySelector('.lamp-st').innerHTML = s.lights[k] ? 'Aan' : 'Uit';
      if (s.lights[k]) nOn++;
      if (refs.glows[k]) refs.glows[k].setAttribute('opacity', s.lights[k] ? '1' : '0');
      if (refs.bulbs[k]) refs.bulbs[k].setAttribute('fill', s.lights[k] ? '#ffc94d' : '#3a4660');
    }

    // scene: zon, stromen, vloerverwarming, ventilatie
    for (k = 0; k < refs.panels.length; k++) setClass(refs.panels[k], s.solar > 0.05 ? 'panel active' : 'panel');
    setAnim(refs.flowSun, s.solar, false);
    setClass(refs.flowGrid, 'flow ' + (exp ? 'f-exp' : 'f-imp') + ' anim-fwd');
    setAnim(refs.flowGrid, Math.abs(s.grid), !exp);
    setAnim(refs.flowHp, s.hp, false);
    refs.hubNode.setAttribute('stroke', exp ? '#4fe0a5' : '#6fc8ff');
    var heating = s.zones.down.heating || s.zones.up.heating;
    for (k = 0; k < refs.ufh.length; k++) {
      refs.ufh[k].setAttribute('opacity', s.zones.down.heating ? '0.9' : '0.18');
      setClass(refs.ufh[k], 'ufh ' + (s.zones.down.heating ? 'anim-rev' : ''));
      refs.ufh[k].style.webkitAnimationDuration = '3s'; refs.ufh[k].style.animationDuration = '3s';
    }
    refs.thermo.setAttribute('class', 'thermo' + (s.zones.down.heating ? ' on' : ''));
    setClass(refs.duct, 'duct anim-fwd');
    refs.duct.style.webkitAnimationDuration = VENT_SPEED[s.vent] + 's';
    refs.duct.style.animationDuration = VENT_SPEED[s.vent] + 's';

    // labels
    tags.sun.innerHTML = '<span class="t-k">Zonnepanelen</span><span class="t-v c-sun">' + nl(s.solar) + ' kW</span>';
    tags.zolder.innerHTML = '<span class="t-k">2e verdieping</span><span class="t-v"><small>Ventilatie</small> ' + VENT_TXT[s.vent] + '</span>' +
      '<span class="t-k" style="color:' + (nOn ? '#ffc94d' : '#7d8aa0') + '">' + (nOn ? nOn + ' lamp' + (nOn > 1 ? 'en' : '') + ' aan' : 'lampen uit') + '</span>';
    tags.floor1.innerHTML = '<span class="t-k">1e verdieping</span><span class="t-v">' + nl(s.zones.up.temp) + '° <small>&rarr; ' + nl(s.zones.up.set) + '°</small></span>' +
      '<span class="t-k" style="color:' + (s.zones.up.heating ? '#ff8a5c' : '#7d8aa0') + '">' + (s.zones.up.heating ? 'radiatoren aan' : 'radiatoren uit') + '</span>';
    tags.floor0.innerHTML = '<span class="t-k">Begane grond</span><span class="t-v">' + nl(s.zones.down.temp) + '° <small>&rarr; ' + nl(s.zones.down.set) + '°</small></span>' +
      '<span class="t-k" style="color:' + (s.zones.down.heating ? '#ff8a5c' : '#7d8aa0') + '">' + (s.zones.down.heating ? 'vloer verwarmt' : 'vloer uit') + '</span>';
    tags.hp.innerHTML = '<span class="t-k">Weheat Blackbird</span><span class="t-v c-heat">' + nl(s.hp) + ' kW <small>' + (heating ? 'COP ' + nl(s.cop) : 'stand-by') + '</small></span>';
    tags.grid.className = 'tag ' + (exp ? 'exp' : 'imp');
    tags.grid.innerHTML = '<span class="t-k">Net</span><span class="t-v ' + (exp ? 'c-exp' : 'c-imp') + '">' + (exp ? '&uarr; ' : '&darr; ') + nl(Math.abs(s.grid)) + ' kW</span>';

    // weer
    $('w-temp').innerHTML = nl(s.outTemp) + '°';
    $('w-text').innerHTML = s.weatherText;
    $('rain').innerHTML = s.rainText;
  }

  function renderZone(p, z) {
    $('z' + p + '-temp').innerHTML = nl(z.temp) + '°';
    $('z' + p + '-set').innerHTML = nl(z.set) + '°';
    $('z' + p + '-state').innerHTML = z.heating ? 'verwarmt' : 'op temperatuur';
    $('z' + p + '-state').className = 'z-state' + (z.heating ? ' heating' : '');
  }
  function segSelect(id, attr, val) {
    var b = $(id).children, k;
    for (k = 0; k < b.length; k++) b[k].className = b[k].getAttribute(attr) === String(val) ? 'on' : '';
  }

  function renderChart() {
    var c = $('chart');
    while (c.firstChild) c.removeChild(c.firstChild);
    var W = 380, H = 54, bw = W / 24, max = 0.5, k, h = state.history;
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
      d.innerHTML = '<div class="lamp-in"><div class="bulb"></div><div><div class="lamp-name">' + CFG.lights[k].name + '</div><div class="lamp-st">Uit</div></div></div>';
      box.appendChild(d);
    }
  }

  /* =====================================================================
   * 6. Bediening
   * ===================================================================== */
  function bindControls() {
    on($('card-climate'), 'click', function (e) {
      var b = closest(e.target, 'data-zone');
      if (b) {
        var z = state.zones[b.getAttribute('data-zone')];
        z.set = clamp(Math.round((z.set + parseFloat(b.getAttribute('data-d'))) * 2) / 2, 5, 28);
        backend.setTemp(b.getAttribute('data-zone'), z.set);
        render(); return;
      }
      var m = closest(e.target, 'data-mode');
      if (m) { state.mode = m.getAttribute('data-mode'); backend.setMode(state.mode); render(); }
    });
    on($('vent-seg'), 'click', function (e) {
      var b = closest(e.target, 'data-v');
      if (b) { state.vent = b.getAttribute('data-v'); backend.setVent(state.vent); render(); }
    });
    on($('lights'), 'click', function (e) {
      var l = closest(e.target, 'data-lamp');
      if (l) {
        var k = parseInt(l.getAttribute('data-lamp'), 10);
        state.lights[k] = !state.lights[k];
        backend.setLight(k, state.lights[k]); render();
      }
    });
    on($('all-off'), 'click', function () {
      for (var k = 0; k < state.lights.length; k++) if (state.lights[k]) { state.lights[k] = false; backend.setLight(k, false); }
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
    $('clock').innerHTML = hm; $('dim-clock').innerHTML = hm;
    $('date').innerHTML = DAYS[d.getDay()].charAt(0).toUpperCase() + DAYS[d.getDay()].slice(1) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('dim-sub').innerHTML = nl(state.outTemp) + '° buiten &middot; ' + (state.grid < 0 ? 'je levert ' : 'je neemt ') + nl(Math.abs(state.grid)) + ' kW ' + (state.grid < 0 ? 'terug' : 'af');
  }
  var lastTouch = new Date().getTime();
  function bindDim() {
    if (!CFG.dimAfterSec) return;
    function wake(e) {
      lastTouch = new Date().getTime();
      if ($('dim').className === 'on') { $('dim').className = ''; e.preventDefault(); e.stopPropagation(); }
    }
    on(document, 'touchstart', wake);
    on(document, 'mousedown', wake);
    setInterval(function () {
      if (new Date().getTime() - lastTouch > CFG.dimAfterSec * 1000) $('dim').className = 'on';
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
      for (z in state.zones) if (state.zones.hasOwnProperty(z)) {
        var zone = state.zones[z], target = state.mode === 'away' ? zone.set - 3 : (state.mode === 'eco' ? zone.set - 1.5 : zone.set);
        zone.heating = zone.temp < target - 0.1;
        zone.temp += zone.heating ? 0.03 : -0.01;
        zone.temp = clamp(zone.temp, 14, 26);
      }
      var heatOn = state.zones.down.heating || state.zones.up.heating;
      state.hp = heatOn ? 0.7 + Math.random() * 0.4 : 0.06;
      state.cop = clamp(3.2 + (state.outTemp - 2) * 0.12 + (Math.random() - 0.5) * 0.2, 2.2, 5.5);
      var base = 0.28 + Math.random() * 0.15, k;
      for (k = 0; k < state.lights.length; k++) if (state.lights[k]) base += 0.008;
      state.home = base + state.hp + (state.vent === 'boost' ? 0.05 : 0.02);
      state.grid = state.home - state.solar;
      state.todaySun += state.solar * 3 / 3600; state.todayUse += state.home * 3 / 3600;
      state.todayNet = state.todaySun - state.todayUse;
      state.history[d.getHours()].sun = Math.max(state.history[d.getHours()].sun, state.solar);
      state.history[d.getHours()].use = state.home;
      state.humidity = clamp(state.humidity + (Math.random() - 0.5) * 2 - (state.vent === 'boost' ? 1 : 0), 40, 80);
      render(); tickClock();
    },
    setTemp: function () {}, setMode: function () {}, setVent: function () {}, setLight: function () {}
  };

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
    call: function (domain, service, data) { ha.req('POST', '/api/services/' + domain + '/' + service, data, function () { setTimeout(ha.poll, 800); }); },
    num: function (map, id, div) { var e = map[id]; var v = e ? parseFloat(e.state) : NaN; return isNaN(v) ? 0 : v / (div || 1); },
    poll: function () {
      ha.req('GET', '/api/states', null, function (list) {
        var map = {}, E = CFG.entities, k;
        for (k = 0; k < list.length; k++) map[list[k].entity_id] = list[k];
        state.grid = ha.num(map, E.gridPower, 1000);
        state.solar = Math.abs(ha.num(map, E.solarPower, 1000));
        state.hp = ha.num(map, E.heatPumpPower, 1000);
        state.cop = ha.num(map, E.heatPumpCop) || state.cop;
        state.home = Math.max(0, state.grid + state.solar);
        state.todaySun = ha.num(map, E.solarToday);
        state.todayNet = ha.num(map, E.gridExportToday) - ha.num(map, E.gridImportToday);
        state.todayUse = state.todaySun - state.todayNet;
        ha.zone(map[E.climateDown], state.zones.down);
        ha.zone(map[E.climateUp], state.zones.up);
        var fan = map[E.ventilation];
        if (fan && fan.attributes && fan.attributes.preset_mode) state.vent = ha.ventFromPreset(fan.attributes.preset_mode);
        state.humidity = ha.num(map, E.bathHumidity) || state.humidity;
        for (k = 0; k < CFG.lights.length; k++) state.lights[k] = !!(map[CFG.lights[k].id] && map[CFG.lights[k].id].state === 'on');
        var w = map[E.weather];
        if (w && w.attributes) { state.outTemp = parseFloat(w.attributes.temperature) || state.outTemp; state.weatherText = ha.weatherNl(w.state); }
        var h = new Date().getHours();
        state.history[h].sun = Math.max(state.history[h].sun, state.solar);
        state.history[h].use = state.home;
        render(); tickClock();
      });
    },
    zone: function (e, z) {
      if (!e || !e.attributes) return;
      z.temp = parseFloat(e.attributes.current_temperature) || z.temp;
      z.set = parseFloat(e.attributes.temperature) || z.set;
      z.heating = e.attributes.hvac_action ? e.attributes.hvac_action === 'heating' : z.temp < z.set - 0.1;
    },
    PRESETS: { auto: 'auto', '1': 'low', '2': 'medium', '3': 'high', boost: 'timer' },
    ventFromPreset: function (p) { for (var k in ha.PRESETS) if (ha.PRESETS[k] === p) return k; return 'auto'; },
    weatherNl: function (s) {
      var m = { sunny: 'Zonnig', 'clear-night': 'Helder', partlycloudy: 'Half bewolkt', cloudy: 'Bewolkt', rainy: 'Regen', pouring: 'Zware regen', fog: 'Mist', snowy: 'Sneeuw', windy: 'Winderig', lightning: 'Onweer' };
      return m[s] || s;
    },
    start: function () { ha.poll(); setInterval(ha.poll, CFG.homeassistant.pollMs || 5000); setInterval(tickClock, 10000); },
    setTemp: function (zone, t) { ha.call('climate', 'set_temperature', { entity_id: zone === 'down' ? CFG.entities.climateDown : CFG.entities.climateUp, temperature: t }); },
    setMode: function (m) { ha.call('climate', 'set_preset_mode', { entity_id: [CFG.entities.climateDown, CFG.entities.climateUp], preset_mode: m }); },
    setVent: function (v) { ha.call('fan', 'set_preset_mode', { entity_id: CFG.entities.ventilation, preset_mode: ha.PRESETS[v] }); },
    setLight: function (k, onOff) { ha.call('light', onOff ? 'turn_on' : 'turn_off', { entity_id: CFG.lights[k].id }); }
  };

  var backend = CFG.mode === 'homeassistant' ? ha : demo;

  /* =====================================================================
   * 9. Start
   * ===================================================================== */
  buildScene();
  buildTags();
  buildLights();
  bindControls();
  bindDim();
  render();
  tickClock();
  setInterval(tickClock, 10000);
  backend.start();
})();
