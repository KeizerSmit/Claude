import struct
d=open('model.dat','rb').read()
def parse(off,end):
    out=[]
    while off+6<=end:
        tag,ln=struct.unpack_from('<HI',d,off)
        if off+6+ln>end: return None
        out.append((tag,off+6,ln)); off+=6+ln
    return out if off==end else None
def find_all(tag,off=0,end=None,acc=None,path=()):
    if end is None: end=len(d)
    if acc is None: acc=[]
    ch=parse(off,end)
    if not ch: return acc
    for t,o,ln in ch:
        if t==tag: acc.append((o,ln,path))
        if ln>=6: find_all(tag,o,o+ln,acc,path+(t,))
    return acc
def show(off,end,depth,maxdepth,maxch=12,ind=0):
    ch=parse(off,end)
    if not ch: return
    for k,(tag,o,ln) in enumerate(ch[:maxch]):
        p=d[o:o+min(ln,32)]
        txt=''.join(chr(c) if 32<=c<127 else '.' for c in p)
        print('  '*(depth)+f'{tag:#06x} @{o} len={ln} {p.hex()[:64]} {txt}')
        if depth<maxdepth and ln>=6: show(o,o+ln,depth+1,maxdepth,maxch)
    if len(ch)>maxch: print('  '*depth+f'... {len(ch)} children')
