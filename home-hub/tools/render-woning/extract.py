import sys, struct, json, zipfile, re
sys.path.insert(0, '.')
exec(open('model.py').read())
def ival(o, l): return int.from_bytes(d[o:o+l], 'little')
def rid(o, l):
    # id from a record that contains 0x07d0 or 0x05dc
    for t, oo, ll in parse(o, o+l) or []:
        if t == 0x05dc:
            for t2, o2, l2 in parse(oo, oo+ll): 
                if t2 == 0x05de: return ival(o2, l2)
        if t == 0x07d0:
            r = rid(oo, ll)
            if r is not None: return r
    return None
def attr07(o, l, tag):
    for t, oo, ll in parse(o, o+l) or []:
        if t == 0x07d0:
            for t2, o2, l2 in parse(oo, oo+ll):
                if t2 == tag: return ival(o2, l2)
    return None
# materials
MAT = {}
for o, ln, p in find_all(0x32c8):
    mid = rid(o, ln); name = None
    for t, oo, ll in parse(o, o+ln):
        if t == 0x32cc: name = d[oo:oo+ll].decode('utf-8', 'replace')
    MAT[mid] = name
z = zipfile.ZipFile(sys.argv[1]); COL = {}
for n in z.namelist():
    if n.endswith('material.xml'):
        x = z.read(n).decode(); m = re.search(r'name="([^"]+)"[^>]*colorRed="(\d+)" colorGreen="(\d+)" colorBlue="(\d+)"[^>]*trans="([\d.]+)" useTrans="(\d)"', x)
        if m: COL[m.group(1)] = [int(m.group(2)), int(m.group(3)), int(m.group(4)), float(m.group(5)) if m.group(6) == '1' else 1.0]
GEO = {}
stats = {}
def defgeo(i):
    if i in GEO: return GEO[i]
    e = D[i]; faces = []
    if not e['ent']: GEO[i] = faces; return faces
    o, end = e['ent']; V = {}; E = {}
    for t, oo, l in parse(o, end):
        if t == 0x1389:
            for t2, o2, l2 in parse(oo, oo+l):
                if t2 == 0x09c4:
                    vid = rid(o2, l2); xyz = None
                    for t3, o3, l3 in parse(o2, o2+l2):
                        if t3 == 0x09c5: xyz = struct.unpack_from('<3d', d, o3)
                    V[vid] = xyz
        if t == 0x138a:
            for t2, o2, l2 in parse(oo, oo+l):
                if t2 == 0x0bb8:
                    eid = rid(o2, l2); a = b = None
                    for t3, o3, l3 in parse(o2, o2+l2):
                        if t3 == 0x0bb9: a = ival(o3, l3)
                        if t3 == 0x0bba: b = ival(o3, l3)
                    E[eid] = (a, b)
    for t, oo, l in parse(o, end):
        if t != 0x138b: continue
        for t2, o2, l2 in parse(oo, oo+l):
            if t2 != 0x0dac: continue
            m1 = attr07(o2, l2, 0x07d1); m2 = None; loops = []
            for t3, o3, l3 in parse(o2, o2+l2):
                if t3 == 0x0daf: m2 = ival(o3, l3)
                if t3 == 0x0dae:
                    for t4, o4, l4 in parse(o3, o3+l3):
                        if t4 != 0x1194: continue
                        for t5, o5, l5 in parse(o4, o4+l4):
                            if t5 != 0x1195: continue
                            pts = []
                            for t6, o6, l6 in parse(o5, o5+l5):
                                if t6 != 0x0fa0: continue
                                eid = rv = None
                                for t7, o7, l7 in parse(o6, o6+l6):
                                    if t7 == 0x0fa1: eid = ival(o7, l7)
                                    if t7 == 0x0fa2: rv = ival(o7, l7)
                                a, b = E[eid]
                                pts.append(V[b] if rv else V[a])
                            loops.append(pts)
            stats[(m1, m2)] = stats.get((m1, m2), 0) + 1
            faces.append({'m': m1, 'mb': m2, 'loops': loops})
    GEO[i] = faces; return faces
OUT = []
def inst_mat(inst_off):
    return None
def walk2(inst, xf, path, inh):
    e = D[inst['ref']]; x = compose(xf, inst['xf'])
    m = inst.get('mat') or inh
    for f in defgeo(inst['ref']):
        mm = f['m'] or m
        loops = [[[round(c * M, 4) for c in apply(x, p)] for p in lp] for lp in f['loops']]
        OUT.append({'p': path, 'm': MAT.get(mm) if mm else None, 'l': loops})
    for c in e['children']: walk2(c, x, path + [c.get('name', '?')], m)
walk2({'name': 'Woning', 'ref': 648, 'xf': I}, I, ['Woning'], None)
print('faces', len(OUT), 'mat pairs', sorted(stats.items(), key=lambda kv: -kv[1])[:12], file=sys.stderr)
from collections import Counter
print(Counter(o['m'] for o in OUT).most_common(40), file=sys.stderr)
json.dump({'mat': COL, 'faces': OUT}, open('geom.json', 'w'), separators=(',', ':'))
