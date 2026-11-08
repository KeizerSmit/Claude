import sys,struct; sys.path.insert(0,'.')
from tlv import *
defs=find_all(0x157c)
def hid(o,ln):
    for t,oo,l in parse(o,o+ln):
        if t==0x07d0:
            for t2,o2,l2 in parse(oo,oo+l):
                if t2==0x05dc:
                    for t3,o3,l3 in parse(o2,o2+l2):
                        if t3==0x05de: return int.from_bytes(d[o3:o3+l3],'little')
D=[]  # per def: dict
byid={}
for i,(o,ln,_) in enumerate(defs):
    e={'i':i,'off':o,'end':o+ln,'name':None,'bbox':None,'ent':None,'children':[]}
    for t,oo,l in parse(o,o+ln):
        if t==0x1388:
            e['ent']=(oo,oo+l); byid[hid(oo,l)]=i
            for t2,o2,l2 in parse(oo,oo+l):
                if t2==0x13a0: e['bbox']=struct.unpack_from('<6d',d,o2)
        if t==0x157e: e['name']=d[oo:oo+l].decode()
    D.append(e)
# instances
names=find_all(0x1965)
INST=[]
for o,ln,p in names:
    # parent record = siblings; find enclosing record start: scan the containing container
    pass
# Better: walk each entities container and collect instance-like records (children containing 0x1967)
def collect(o,end):
    res=[]
    def rec(o,end):
        ch=parse(o,end)
        if not ch: return
        tags=[t for t,_,_ in ch]
        if 0x1967 in tags:
            r={}
            for t,oo,l in ch:
                if t==0x1965: r['name']=d[oo:oo+l].decode('utf-8','replace')
                if t==0x1966: r['xf']=struct.unpack_from('<13d',d,oo)
                if t==0x1967: r['ref']=byid[int.from_bytes(d[oo:oo+l],'little')]
            res.append(r); return
        for t,oo,l in ch:
            if t in (0x1388,0x1389,0x138a,0x138b): continue  # skip geometry, handled elsewhere
            if l>=6: rec(oo,oo+l)
    rec(o,end); return res
# instances inside each def's entities: look in 0x1388 children other than vertex/edge/face lists
for e in D:
    if not e['ent']: continue
    o,end=e['ent']
    for t,oo,l in parse(o,end):
        if t in (0x1389,0x138a,0x138b,0x13a0,0x07d0): continue
        if l>=6: e['children']+=collect(oo,oo+l)
# root entities: outside defs
root=find_all(0x1f9)[0]
# root instance: one with 0x1967 at model root
allinst={}
for e in D:
    for c in e['children']: c['parent']=e['i']
rootinst=None
o,ln,_=root
for r in collect(o,o+ln):
    if r.get('name','').startswith('Woning'): rootinst=r
I=[1,0,0,0,1,0,0,0,1,0,0,0,1]
def apply(xf,p):
    x,y,z=p
    return (x*xf[0]+y*xf[3]+z*xf[6]+xf[9], x*xf[1]+y*xf[4]+z*xf[7]+xf[10], x*xf[2]+y*xf[5]+z*xf[8]+xf[11])
def compose(a,b): # world of b inside a
    pts=[apply(b,(1,0,0)),apply(b,(0,1,0)),apply(b,(0,0,1)),apply(b,(0,0,0))]
    w=[apply(a,p) for p in pts]; o=w[3]
    return [w[0][0]-o[0],w[0][1]-o[1],w[0][2]-o[2], w[1][0]-o[0],w[1][1]-o[1],w[1][2]-o[2], w[2][0]-o[0],w[2][1]-o[1],w[2][2]-o[2], o[0],o[1],o[2],1]
def wbbox(xf,bb):
    xs=[];ys=[];zs=[]
    for X in (bb[0],bb[3]):
        for Y in (bb[1],bb[4]):
            for Z in (bb[2],bb[5]):
                p=apply(xf,(X,Y,Z)); xs.append(p[0]);ys.append(p[1]);zs.append(p[2])
    return (min(xs),min(ys),min(zs),max(xs),max(ys),max(zs))
M=0.0254
def walk(inst,xf,depth,out,path):
    e=D[inst['ref']]; x=compose(xf,inst['xf'])
    bb=wbbox(x,e['bbox']) if e['bbox'] else None
    out.append((depth,path+[inst.get('name','?')],bb,inst,x))
    for c in e['children']: walk(c,x,depth+1,out,path+[inst.get('name','?')])
TREE=[]
#walk(rootinst,I,0,TREE,[])
rootinst={'name':'Woning','ref':648,'xf':I}
walk(rootinst,I,0,TREE,[])
