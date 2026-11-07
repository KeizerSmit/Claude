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
    solar: 0, home: 0, hp: 0, grid: 0,          // kW (grid > 0 = afname, < 0 = teruglevering)
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
  for (i = 0; i < CFG.lights.length; i++) state.lights.push(i === 0 || i === 2);
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
   * 3. Isometrische 3D-scene (SVG)
   *    Coordinaten in meters: x = lengte (0..9), y = breedte (0..6), z = hoogte.
   *    Opengewerkte "exploded" weergave: elke verdieping zweeft los zodat
   *    je erin kijkt. Later te vervangen door een render van je eigen woning.
   * ===================================================================== */
  var NS = 'http://www.w3.org/2000/svg';
  var svg = $('house');
  var S = 24, OX = 270, OY = 378;              // schaal en oorsprong op scherm
  var LEN = 9, WID = 6, SLAB = 0.3, WALL = 1.1;
  var FLOOR_Z = [0, 4.2, 8.4];
  var ROOF_Z = FLOOR_Z[2] + SLAB + 2.5, RIDGE = 2.7;   // dak zweeft los boven de zolder

  function P(x, y, z) {
    return [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
  }
  function ptsStr(list) {
    var out = [], k, p;
    for (k = 0; k < list.length; k++) { p = P(list[k][0], list[k][1], list[k][2]); out.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
    return out.join(' ');
  }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name), k;
    for (k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  function face(list, cls, parent) { return el('polygon', { points: ptsStr(list), 'class': cls }, parent); }
  function line(list, cls, parent) { return el('polyline', { points: ptsStr(list), 'class': cls }, parent); }
  function box(x, y, z, dx, dy, dz, cls, parent) {
    var g = el('g', {}, parent);
    face([[x, y + dy, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], cls + '-front', g);
    face([[x + dx, y, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x + dx, y, z + dz]], cls + '-right', g);
    face([[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], cls + '-top', g);
    return g;
  }
  function circleFlat(cx, cy, z, r) { // cirkel op de vloer -> ellips op scherm
    var list = [], a;
    for (a = 0; a < 24; a++) list.push([cx + r * Math.cos(a / 24 * 6.2832), cy + r * Math.sin(a / 24 * 6.2832), z]);
    return list;
  }
  function text(x, y, z, str, cls, parent) {
    var p = P(x, y, z);
    var t = el('text', { x: p[0].toFixed(1), y: p[1].toFixed(1), 'class': cls, 'text-anchor': 'middle' }, parent);
    t.appendChild(document.createTextNode(str));
    return t;
  }

  var refs = { floors: [], glows: [], bulbs: [], panels: [] };

  function buildScene() {
    var defs = el('defs', {});
    var rg = el('radialGradient', { id: 'glowGrad' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#ffc94d', 'stop-opacity': '0.75' }, rg);
    el('stop', { offset: '100%', 'stop-color': '#ffc94d', 'stop-opacity': '0' }, rg);

    // grond + raster
    face([[-1.4, -1.0, -0.02], [11.8, -1.0, -0.02], [11.8, 9.8, -0.02], [-1.4, 9.8, -0.02]], 'ground');
    var gx;
    for (gx = 0; gx <= 11; gx += 2) line([[gx, -1.0, 0], [gx, 9.8, 0]], 'grid-line');
    for (gx = 0; gx <= 9; gx += 2) line([[-1.4, gx, 0], [11.8, gx, 0]], 'grid-line');

    // ---- begane grond ----
    var f0 = el('g', { 'class': 'floor', 'data-floor': '0' });
    refs.floors.push(f0);
    buildFloorShell(f0, FLOOR_Z[0], [5.5]);
    var z0 = FLOOR_Z[0] + SLAB + 0.01, y, row = 0, path = [];
    for (y = 0.8; y <= 5.5; y += 0.55) {        // vloerverwarming-slang
      if (row % 2 === 0) { path.push([0.6, y, z0]); path.push([8.5, y, z0]); }
      else { path.push([8.5, y, z0]); path.push([0.6, y, z0]); }
      row++;
    }
    refs.ufh = line(path, 'ufh', f0);
    refs.ufh.setAttribute('stroke-dasharray', '6 6');
    text(2.7, 0.9, z0 + 0.6, 'Woonkamer', 'room-name', f0);
    text(7.2, 0.9, z0 + 0.6, 'Keuken', 'room-name', f0);
    hitArea(f0, FLOOR_Z[0]);

    // ---- warmtepomp buitenunit ----
    var hp = el('g', { 'class': 'hp' });
    box(9.9, 3.5, 0, 1.25, 0.6, 1.0, 'hp', hp);
    face(circleOnFront(10.52, 4.11, 0.5, 0.34), 'hp-grill', hp).setAttribute('style', 'fill:#4a5568');
    face(circleOnFront(10.52, 4.11, 0.5, 0.12), 'hp-hub', hp).setAttribute('style', 'fill:#2a3242');
    refs.hp = hp;

    // ---- eerste verdieping ----
    var f1 = el('g', { 'class': 'floor', 'data-floor': '1' });
    refs.floors.push(f1);
    buildFloorShell(f1, FLOOR_Z[1], [3.5, 5.5]);
    var z1 = FLOOR_Z[1] + SLAB + 0.01;
    var roomCenters = [[1.75, 3.0], [4.5, 3.0], [7.25, 3.0]];
    var r;
    for (r = 0; r < roomCenters.length; r++) {
      refs.glows.push(el('polygon', { points: ptsStr(circleFlat(roomCenters[r][0], roomCenters[r][1], z1, 1.5)), fill: 'url(#glowGrad)', opacity: '0' }, f1));
    }
    text(1.75, 5.2, z1, 'Slaapkamer', 'room-name', f1);
    text(4.5, 5.2, z1, 'Bad', 'room-name', f1);
    text(7.25, 5.2, z1, 'Kamer 2', 'room-name', f1);
    for (r = 0; r < roomCenters.length; r++) {
      var top = P(roomCenters[r][0], roomCenters[r][1], z1 + 1.9), bot = P(roomCenters[r][0], roomCenters[r][1], z1 + 1.15);
      el('line', { x1: top[0], y1: top[1], x2: bot[0], y2: bot[1], stroke: '#3a4660', 'stroke-width': 1 }, f1);
      refs.bulbs.push(el('circle', { cx: bot[0], cy: bot[1], r: 4.5, fill: '#3a4660' }, f1));
    }
    hitArea(f1, FLOOR_Z[1]);

    // ---- zolder + dak ----
    var f2 = el('g', { 'class': 'floor', 'data-floor': '2' });
    refs.floors.push(f2);
    var z2 = FLOOR_Z[2];
    box(0, 0, z2, LEN, WID, SLAB, 'slab', f2);
    var zt = z2 + SLAB;
    // ventilatie-unit (WTW / mechanische afzuiging) met kanalen
    box(1.0, 2.6, zt, 1.7, 1.3, 1.0, 'unit', f2);
    refs.ducts = [];
    refs.ducts.push(line([[1.85, 3.25, zt + 1.0], [1.85, 3.25, ROOF_Z + 0.9]], 'duct', f2));
    refs.ducts.push(line([[2.7, 3.25, zt + 0.45], [5.0, 3.25, zt + 0.45], [5.0, 3.25, zt - 1.2]], 'duct', f2));
    text(6.4, 4.6, zt, 'Zolder', 'room-name', f2);
    // dak: achterste vlak + achtergevel doorzichtig
    face([[0, 0, ROOF_Z], [LEN, 0, ROOF_Z], [LEN, 3, ROOF_Z + RIDGE], [0, 3, ROOF_Z + RIDGE]], 'gable', f2);
    face([[0, 0, ROOF_Z], [0, WID, ROOF_Z], [0, 3, ROOF_Z + RIDGE]], 'gable', f2);
    // voorste dakvlak (glas-effect) + zonnepanelen
    face([[0, WID, ROOF_Z], [LEN, WID, ROOF_Z], [LEN, 3, ROOF_Z + RIDGE], [0, 3, ROOF_Z + RIDGE]], 'roof', f2);
    var c, t, x0, t0, t1;
    for (c = 0; c < 4; c++) {
      for (t = 0; t < 2; t++) {
        x0 = 3.3 + c * 1.35; t0 = 0.1 + t * 0.44; t1 = t0 + 0.4;
        refs.panels.push(face([
          [x0, WID - 3 * t0, ROOF_Z + RIDGE * t0], [x0 + 1.25, WID - 3 * t0, ROOF_Z + RIDGE * t0],
          [x0 + 1.25, WID - 3 * t1, ROOF_Z + RIDGE * t1], [x0, WID - 3 * t1, ROOF_Z + RIDGE * t1]
        ], 'panel', f2));
      }
    }
    face([[LEN, 0, ROOF_Z], [LEN, WID, ROOF_Z], [LEN, 3, ROOF_Z + RIDGE]], 'gable', f2);
    hitArea(f2, FLOOR_Z[2]);

    // ---- energiestromen ----
    var HUB = [-0.7, 6.7, 0.2];
    var sunPts = [[3.3, WID - 0.3, ROOF_Z + 0.27], [0, WID, ROOF_Z], [HUB[0], HUB[1], ROOF_Z], HUB];
    var gridPts = [HUB, [HUB[0], 9.4, 0.2]];
    var hpPts = [HUB, [10.52, HUB[1], 0.2], [10.52, 4.3, 0.2]];
    refs.flowSun = flow(sunPts, 'f-sun');
    refs.flowGrid = flow(gridPts, 'f-exp');
    refs.flowHp = flow(hpPts, 'f-heat');

    // elektriciteitsmast (net)
    var b = P(HUB[0], 9.4, 0), tp = P(HUB[0], 9.4, 2.4), arm1 = P(HUB[0] - 0.5, 9.4, 2.0), arm2 = P(HUB[0] + 0.5, 9.4, 2.0);
    el('line', { x1: b[0], y1: b[1], x2: tp[0], y2: tp[1], 'class': 'pole' });
    el('line', { x1: arm1[0], y1: arm1[1], x2: arm2[0], y2: arm2[1], 'class': 'pole' });
    var hubP = P(HUB[0], HUB[1], HUB[2]);
    refs.hubNode = el('circle', { cx: hubP[0], cy: hubP[1], r: 6, 'class': 'node', stroke: '#8fb4ff' });

    refs.anchor = {
      sun: P(4.5, 3, ROOF_Z + RIDGE + 1.9),
      vent: P(LEN, 0, FLOOR_Z[2] + 1.0),
      hp: P(10.5, 4.1, -1.6),
      grid: P(HUB[0], 9.6, -1.1),
      floor0: P(LEN, 0, FLOOR_Z[0] + 1.0),
      floor1: P(LEN, 0, FLOOR_Z[1] + 1.0)
    };
  }

  function circleOnFront(cx, y, cz, r) { // cirkel in het voorvlak van de warmtepomp
    var list = [], a;
    for (a = 0; a < 20; a++) list.push([cx + r * Math.cos(a / 20 * 6.2832), y + 0.001, cz + r * Math.sin(a / 20 * 6.2832)]);
    return list;
  }

  function buildFloorShell(g, z, partitions) {
    box(0, 0, z, LEN, WID, SLAB, 'slab', g);
    box(0, 0, z + SLAB, LEN, 0.18, WALL, 'wall', g);           // achtermuur
    box(0, 0.18, z + SLAB, 0.18, WID - 0.18, WALL, 'wall', g);  // zijmuur
    for (var k = 0; k < partitions.length; k++) {
      box(partitions[k], 0.18, z + SLAB, 0.1, 3.6, WALL * 0.55, 'part', g);
    }
  }
  function hitArea(g, z) { // onzichtbaar vlak om op te tikken
    face([[0, 0, z], [LEN, 0, z], [LEN, WID, z], [LEN, WID, z + 2], [0, WID, z + 2], [0, 0, z + 2]], 'floor-hit', g);
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
    makeTag('sun', 'sun', a.sun, 0, -26);
    makeTag('vent', 'floor', a.vent, 8, 0, 'left');
    makeTag('floor1', 'floor', a.floor1, 8, 0, 'left');
    makeTag('floor0', 'floor heat', a.floor0, 8, 0, 'left');
    makeTag('hp', 'heat', a.hp, -6, 6);
    makeTag('grid', 'exp', a.grid, 0, 0);
  }

  /* =====================================================================
   * 5. Renderen van de state naar het scherm
   * ===================================================================== */
  var VENT_TXT = { auto: 'Automatisch', '1': 'Stand 1', '2': 'Stand 2', '3': 'Stand 3', boost: 'Boost 30 min' };
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

    // verlichting
    var lampEls = $('lights').children, nOn = 0, roomOn = [0, 0, 0];
    for (k = 0; k < lampEls.length; k++) {
      lampEls[k].className = 'lamp' + (s.lights[k] ? ' on' : '');
      lampEls[k].querySelector('.lamp-st').innerHTML = s.lights[k] ? 'Aan' : 'Uit';
      if (s.lights[k]) { nOn++; roomOn[CFG.lights[k].room || 0]++; }
    }
    for (k = 0; k < refs.glows.length; k++) {
      refs.glows[k].setAttribute('opacity', roomOn[k] ? '1' : '0');
      refs.bulbs[k].setAttribute('fill', roomOn[k] ? '#ffc94d' : '#3a4660');
    }

    // scene: zon, stromen, vloerverwarming, ventilatie
    for (k = 0; k < refs.panels.length; k++) setClass(refs.panels[k], s.solar > 0.05 ? 'panel active' : 'panel');
    setAnim(refs.flowSun, s.solar, false);
    setClass(refs.flowGrid, 'flow ' + (exp ? 'f-exp' : 'f-imp') + ' anim-fwd');
    setAnim(refs.flowGrid, Math.abs(s.grid), !exp);
    setAnim(refs.flowHp, s.hp, false);
    refs.hubNode.setAttribute('stroke', exp ? '#4fe0a5' : '#6fc8ff');
    var heating = s.zones.down.heating || s.zones.up.heating;
    refs.ufh.setAttribute('opacity', s.zones.down.heating ? '0.9' : '0.18');
    setClass(refs.ufh, 'ufh ' + (s.zones.down.heating ? 'anim-rev' : ''));
    refs.ufh.style.webkitAnimationDuration = '3s'; refs.ufh.style.animationDuration = '3s';
    for (k = 0; k < refs.ducts.length; k++) {
      setClass(refs.ducts[k], 'duct anim-fwd');
      refs.ducts[k].style.webkitAnimationDuration = VENT_SPEED[s.vent] + 's';
      refs.ducts[k].style.animationDuration = VENT_SPEED[s.vent] + 's';
    }

    // labels
    tags.sun.innerHTML = '<span class="t-k">Zonnepanelen</span><span class="t-v c-sun">' + nl(s.solar) + ' kW</span>';
    tags.vent.innerHTML = '<span class="t-k">Ventilatie</span><span class="t-v">' + VENT_TXT[s.vent] + '</span>';
    tags.floor1.innerHTML = '<span class="t-k">Boven</span><span class="t-v">' + nl(s.zones.up.temp) + '° <small>&rarr; ' + nl(s.zones.up.set) + '°</small></span>' +
      '<span class="t-k" style="color:' + (nOn ? '#ffc94d' : '#7d8aa0') + '">' + (nOn ? nOn + ' lamp' + (nOn > 1 ? 'en' : '') + ' aan' : 'lampen uit') + '</span>';
    tags.floor0.innerHTML = '<span class="t-k">Beneden</span><span class="t-v">' + nl(s.zones.down.temp) + '° <small>&rarr; ' + nl(s.zones.down.set) + '°</small></span>' +
      '<span class="t-k" style="color:' + (s.zones.down.heating ? '#ff8a5c' : '#7d8aa0') + '">' + (s.zones.down.heating ? 'vloer verwarmt' : 'vloer uit') + '</span>';
    tags.hp.innerHTML = '<span class="t-k">Warmtepomp</span><span class="t-v c-heat">' + nl(s.hp) + ' kW <small>' + (heating ? 'verwarmt' : 'stand-by') + '</small></span>';
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
    var TARGET = { '0': 'card-climate', '1': 'card-lights', '2': 'card-vent', sun: 'card-energy', vent: 'card-vent',
      floor0: 'card-climate', floor1: 'card-lights', hp: 'card-energy', grid: 'card-energy' };
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
