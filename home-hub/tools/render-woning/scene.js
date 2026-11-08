import * as THREE from 'three';
const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 1200), H = +(P.get('h') || 1380);
const NIGHT = P.get('night') === '1';
const g = await (await fetch('geom.json')).json();

// ---------- materialen ----------
const col = n => { const c = g.mat[n]; return c ? new THREE.Color(`rgb(${c[0]},${c[1]},${c[2]})`) : new THREE.Color('#dddddd'); };
const OVERRIDE = {
  Gevelsteen_oranje: '#b9653a', Falzinc_grijs: '#5f6670', PV_paneel: '#1d2a4a', Glas_HR: '#9fc6dc',
  Gras: '#6f8f58', Bestrating_grijs: '#8e8c88', Dekvloer_grijs: '#cfc8bb', Vloertegel_antraciet: '#6b6b6e',
  Rockpanel_antraciet: '#3f4247', Isolatie: '#d9c98a'
};
function matFor(name) {
  const c = OVERRIDE[name] ? new THREE.Color(OVERRIDE[name]) : col(name);
  const glass = name === 'Glas_HR' || /glas/i.test(name || '');
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: glass ? 0.1 : (name === 'PV_paneel' ? 0.35 : 0.9), metalness: (name === 'Chroom' || name === 'RVS') ? 0.6 : 0.0,
    side: THREE.DoubleSide, transparent: glass, opacity: glass ? 0.32 : 1, depthWrite: !glass, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  return m;
}

// ---------- triangulatie ----------
function newell(loop) { const n = new THREE.Vector3(); for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1]); } return n.normalize(); }
const byMat = {}; const edges = {};
function addFace(f, bucketKey) {
  const loops = f.l.filter(l => l.length >= 3); if (!loops.length) return;
  const n = newell(loops[0]); if (!isFinite(n.x)) return;
  const u = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
  const v = n.clone().cross(u);
  const to2 = p => new THREE.Vector2(p[0] * u.x + p[1] * u.y + p[2] * u.z, p[0] * v.x + p[1] * v.y + p[2] * v.z);
  const outer = loops[0].map(to2), holes = loops.slice(1).map(l => l.map(to2));
  let tris; try { tris = THREE.ShapeUtils.triangulateShape(outer, holes); } catch (e) { return; }
  const all = [].concat(...loops);
  const key = bucketKey + '|' + (f.m || 'none');
  const b = byMat[key] || (byMat[key] = { pos: [], m: f.m, lvl: bucketKey });
  for (const t of tris) for (const i of t) b.pos.push(all[i][0], all[i][1], all[i][2]);
  const e = edges[bucketKey] || (edges[bucketKey] = []);
  if (f.m !== 'Glas_HR') for (const l of loops) for (let i = 0; i < l.length; i++) { const a = l[i], c = l[(i + 1) % l.length]; e.push(a[0], a[1], a[2], c[0], c[1], c[2]); }
}
// buckets: terrein apart, rest = gebouw
const NEAR_RE = /Voorgevel|Bouwmuur_rechts|Kozijnen_voorgevel|Gevelplint_voor|HWA_voor|Fundering_voorgevel|Fundering_bouwmuur_rechts/;
const PART_RE = /Binnenwanden|Binnendeuren|Nieuwe_scheidingswanden|Nieuwe_deuren|^Wand_|Hekwerk|Deur_/;
for (const f of g.faces) {
  const terr = f.p[1] === 'Terrein';
  if (terr && f.p.includes('Buitenberging_hout')) continue;
  const ps = f.p.join('/');
  const cat = terr ? 'terrain' : (NEAR_RE.test(ps) && !/Boeiboord/.test(ps) ? 'near' : (f.p.some(n => PART_RE.test(n)) ? 'part' : 'house'));
  addFace(f, cat);
}

// ---------- eigen toevoegingen: meubels, Weheat, aircos ----------
const extra = [];
function boxF(x0, x1, y0, y1, z0, z1, color, key = 'house') { extra.push({ x0, x1, y0, y1, z0, z1, color, key }); }
// woonkamer (voor, rechts): bank, salontafel, kleed, eettafel bij de tuinpui
boxF(2.95, 5.05, 0.75, 1.65, 0.0, 0.42, '#7b8494'); boxF(2.95, 5.05, 0.75, 0.98, 0.42, 0.85, '#6f7888'); boxF(4.7, 5.05, 0.98, 1.65, 0.42, 0.62, '#6f7888'); boxF(2.95, 3.3, 0.98, 1.65, 0.42, 0.62, '#6f7888');
boxF(3.15, 4.85, 2.05, 3.55, 0.0, 0.012, '#c9b79c'); boxF(3.55, 4.45, 2.35, 3.05, 0.0, 0.42, '#8b6b4a');
boxF(2.9, 4.5, 9.6, 10.6, 0.72, 0.76, '#a07a52'); for (const [a, b] of [[2.95, 3.0], [4.4, 4.45]]) for (const [c, d] of [[9.65, 9.7], [10.5, 10.55]]) boxF(a, b, c, d, 0, 0.72, '#a07a52');
for (const x of [3.2, 3.9]) { boxF(x, x + 0.42, 9.15, 9.5, 0, 0.46, '#3e4450'); boxF(x, x + 0.42, 10.7, 11.05, 0, 0.46, '#3e4450'); }
boxF(2.75, 3.05, 7.0, 7.3, 0, 0.35, '#556b4a'); boxF(2.8, 3.0, 7.05, 7.25, 0.35, 0.95, '#6f9a58');
// slaapkamers 1e: bed Muriel (achter rechts), slaapkamer 2 (voor rechts), slaapkamer 3 (achter links)
const bed = (x0, y0, w, l, z, color) => { boxF(x0, x0 + w, y0, y0 + l, z, z + 0.48, '#f1efe9'); boxF(x0, x0 + w, y0 + l - 0.5, y0 + l, z + 0.48, z + 0.56, color); boxF(x0 + 0.08, x0 + w - 0.08, y0 + 0.05, y0 + 0.4, z + 0.48, z + 0.6, '#ffffff'); boxF(x0, x0 + w, y0 - 0.06, y0, z, z + 0.95, '#8b6b4a'); };
bed(3.25, 6.0, 1.6, 2.05, 2.9, '#c48a6a');
bed(3.7, 1.0, 1.4, 2.0, 2.9, '#8aa0c4');
bed(0.5, 6.4, 0.95, 2.0, 2.9, '#9cc49a');
// zolder: Margje (voor), Julius (achter)
bed(3.3, 0.8, 1.4, 2.0, 5.78, '#c49ab4'); bed(3.25, 6.5, 1.4, 2.0, 5.78, '#8ab4c4');
boxF(0.4, 1.6, 7.9, 8.5, 5.78, 6.52, '#e8e2d6'); // bureau Julius
// LG-buitenunit en Weheat Blackbird op het dak van de uitbouw (langs de rechter zijmuur, zoals op de foto)
boxF(4.78, 5.15, 9.7, 10.55, 3.0, 3.62, '#e9ebee', 'prop'); boxF(4.76, 4.78, 9.8, 10.45, 3.1, 3.5, '#9aa0a8', 'prop');
boxF(4.15, 5.15, 10.65, 11.45, 3.0, 3.92, '#24272d', 'prop'); boxF(4.2, 5.1, 10.7, 11.4, 3.92, 3.95, '#3a3f47', 'prop');
boxF(4.25, 5.05, 10.63, 10.65, 3.12, 3.82, '#15171b', 'prop');
// airco binnenunits (LG), hoog aan de wand
const ACS = [[1.45, 5.46, 1, 2], [3.75, 2.28, -1, 2], [3.85, 4.80, 1, 1]];
for (const [x, w, sd, fl] of ACS) { const y0 = sd > 0 ? w : w - 0.22, y1 = sd > 0 ? w + 0.22 : w, zb = fl === 1 ? 2.9 + 1.75 : 5.78 + 1.0;
  boxF(x - 0.45, x + 0.45, y0, y1, zb, zb + 0.3, '#f6f7f9', 'prop'); boxF(x - 0.42, x + 0.42, sd > 0 ? y1 : y0 - 0.005, sd > 0 ? y1 + 0.005 : y0, zb + 0.03, zb + 0.07, '#c9ced6', 'prop'); }
for (const b of extra) {
  const k = b.key + '|#' + b.color; const bk = byMat[k] || (byMat[k] = { pos: [], m: null, color: b.color, lvl: b.key });
  const q = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], z0 = b.z0, z1 = b.z1;
  const quad = (a, c, d, e) => bk.pos.push(...a, ...c, ...d, ...a, ...d, ...e);
  quad([b.x0, b.y0, z1], [b.x1, b.y0, z1], [b.x1, b.y1, z1], [b.x0, b.y1, z1]);
  const eg = edges[b.key] || (edges[b.key] = []);
  for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; eg.push(p[0], p[1], z1, r[0], r[1], z1, p[0], p[1], z0, p[0], p[1], z1); }
  for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; quad([p[0], p[1], z0], [r[0], r[1], z0], [r[0], r[1], z1], [p[0], p[1], z1]); }
}

// ---------- scene + verdiepingen (opengewerkt) ----------
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = NIGHT ? 1.15 : 1.05;
document.body.appendChild(renderer.domElement);

const LV = JSON.parse(P.get('lv') || 'null') || [
  { name: 'bg', z0: -1.2, z1: 2.0, fl: 0.0, off: 0 },
  { name: '1e', z0: 2.6, z1: 4.75, fl: 2.9, off: +(P.get('o1') || 3.2) },
  { name: 'zolder', z0: 5.5, z1: 7.12, fl: 5.78, off: +(P.get('o2') || 6.4) },
  { name: 'dak', z0: 7.12, z1: 20, fl: 7.12, off: +(P.get('o3') || 9.6) }
];
const clip = (z0, z1, off) => [new THREE.Plane(new THREE.Vector3(0, 0, 1), -(z0 + off)), new THREE.Plane(new THREE.Vector3(0, 0, -1), z1 + off)];
const geoms = {};
for (const k in byMat) {
  const b = byMat[k]; const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); geo.computeVertexNormals();
  geoms[k] = { geo, b };
}
const edgeGeo = {};
for (const k in edges) { const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edges[k], 3)); edgeGeo[k] = eg; }
const lineMat = (planes) => new THREE.LineBasicMaterial({ color: NIGHT ? '#0b0f18' : '#2a2f3a', transparent: true, opacity: 0.38, clippingPlanes: planes });
for (const L of LV) {
  const planes = clip(L.z0, L.z1, L.off);
  const grp = new THREE.Group(); grp.position.z = L.off;
  const roof = L.name === 'dak';
  const nextZ0 = (LV[LV.indexOf(L) + 1] || { z0: 30 }).z0;
  const cut = { house: planes, near: roof ? planes : clip(L.z0, L.fl + 0.95, L.off), part: roof ? planes : clip(L.z0, L.fl + 1.3, L.off), prop: clip(L.z0, nextZ0 - 0.01, L.off) };
  for (const k in geoms) {
    const { geo, b } = geoms[k]; if (!cut[b.lvl]) continue;
    const m = b.color ? new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85, side: THREE.DoubleSide }) : matFor(b.m);
    m.clippingPlanes = cut[b.lvl]; m.clipShadows = true;
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = !m.transparent; mesh.receiveShadow = true; grp.add(mesh);
  }
  for (const c of ['house', 'near', 'part', 'prop']) if (edgeGeo[c]) grp.add(new THREE.LineSegments(edgeGeo[c], lineMat(cut[c])));
  grp.userData.fit = true; scene.add(grp);
}
// terrein (bijgesneden rond het huis)
{
  const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.7), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 6.1), new THREE.Plane(new THREE.Vector3(0, 1, 0), 2.0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 15.0)];
  for (const k in geoms) { const { geo, b } = geoms[k]; if (b.lvl !== 'terrain') continue;
    const m = b.color ? new THREE.MeshStandardMaterial({ color: b.color, side: THREE.DoubleSide }) : matFor(b.m); m.clippingPlanes = planes;
    const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; scene.add(mesh); }
  scene.add(new THREE.LineSegments(edgeGeo.terrain, lineMat(planes)));
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.8, 17.0, 0.35), new THREE.MeshStandardMaterial({ color: NIGHT ? '#1b2333' : '#3b4558', roughness: 0.9 }));
  base.position.set(2.7, 6.5, -0.17 - 0.42 - 0.175 + 0.25); base.userData.fitBase = true; base.receiveShadow = true; scene.add(base);
}

// ---------- licht ----------
scene.add(new THREE.HemisphereLight(NIGHT ? '#6a7fb8' : '#e8eeff', NIGHT ? '#2a2f3c' : '#b4ab9c', NIGHT ? 1.0 : 1.25));
const fill = new THREE.DirectionalLight('#dfe6ff', NIGHT ? 0.1 : 0.55); fill.position.set(20, -25, 18); scene.add(fill);
const sun = new THREE.DirectionalLight(NIGHT ? '#9fb6e8' : '#fff1dc', NIGHT ? 0.7 : 2.4);
sun.position.set(16, -6, 24); sun.target.position.set(2.7, 6, 2); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
scene.add(sun);
if (NIGHT) {
  const o1 = LV[1].off, o2 = LV[2].off;
  const pts = [[3.8, 3.0, 1.5], [3.7, 10.2, 1.5], [1.0, 9.3, 1.5], [1.9, 1.5, 1.4],
    [3.9, 2.4, 2.9 + o1 + 1.3], [3.9, 6.9, 2.9 + o1 + 1.3], [1.3, 7.5, 2.9 + o1 + 1.3], [1.3, 1.6, 2.9 + o1 + 1.3],
    [2.7, 1.35, 5.78 + o2 + 1.1], [2.7, 7.5, 5.78 + o2 + 1.1], [3.9, 4.4, 5.78 + o2 + 1.1]];
  for (const p of pts) { const l = new THREE.PointLight('#ffc98a', 9, 6.5, 1.3); l.position.set(...p); scene.add(l); }
}

// ---------- camera (orthografisch, schuin van voren-rechts) ----------
const az = +(P.get('az') || 40), el = +(P.get('el') || 36), zoom = +(P.get('zoom') || 1);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200); cam.up.set(0, 0, 1);
const tgt = new THREE.Vector3(+(P.get('tx') || 2.7), +(P.get('ty') || 6.4), +(P.get('tz') || 4.6));
const dir = new THREE.Vector3(Math.cos(el * Math.PI / 180) * Math.sin(-az * Math.PI / 180) * -1, -Math.cos(el * Math.PI / 180) * Math.cos(az * Math.PI / 180), Math.sin(el * Math.PI / 180));
cam.position.copy(tgt).addScaledVector(dir, 60); cam.lookAt(tgt);
cam.updateMatrixWorld();
{ // automatisch passend maken op het gebouw (terrein telt niet mee)
  const inv = cam.matrixWorldInverse, v = new THREE.Vector3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  scene.traverse(o => { if (o.userData.fitBase) { const bb = new THREE.Box3().setFromObject(o); for (const xx of [bb.min.x, bb.max.x]) for (const yy of [bb.min.y, bb.max.y]) for (const zz of [bb.min.z, bb.max.z]) { v.set(xx, yy, zz).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } return; }
    if (!o.isMesh || !o.parent || !o.parent.userData.fit) return; const pos = o.geometry.attributes.position; const off = o.parent.position.z;
    const L = o.material.clippingPlanes; let zmax = 1e9, zmin = -1e9; if (L) { zmin = -L[0].constant; zmax = L[1].constant; }
    for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i); v.z = Math.min(Math.max(v.z + off, zmin), zmax); v.applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } });
  const pad = +(P.get('pad') || 0.06), aspect = W / H; let w = (x1 - x0), h = (y1 - y0); w *= 1 + pad * 2; h *= 1 + pad * 2;
  if (w / h > aspect) h = w / aspect; else w = h * aspect; const cx = (x0 + x1) / 2 + +(P.get('sx') || 0), cy = (y0 + y1) / 2 + +(P.get('sy') || 0);
  cam.left = cx - w / 2 / zoom; cam.right = cx + w / 2 / zoom; cam.top = cy + h / 2 / zoom; cam.bottom = cy - h / 2 / zoom; cam.updateProjectionMatrix();
}
renderer.render(scene, cam);
// projectie-coefficienten (wereld -> px) voor het paneel
cam.updateMatrixWorld(); const pm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
const e = pm.elements; // kolom-major
window.PROJ = { ax: e[0] * W / 2, bx: e[4] * W / 2, cx: e[8] * W / 2, dx: (e[12] + 1) * W / 2, ay: -e[1] * H / 2, by: -e[5] * H / 2, cy: -e[9] * H / 2, dy: (1 - e[13]) * H / 2, W, H, LV };
window.DONE = true;
