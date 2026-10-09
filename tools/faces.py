import numpy as np, cv2, json
from PIL import Image, ImageDraw, ImageFilter
SRC=Image.open("tools/src.jpg").convert("RGB")
FX0,FY0,FX1,FY1=368,52,466,140
OM=(598.75,122.25); NM=(413.0,76.9); K=0.94; DY=[0.0]
def T(x,y): return (NM[0]+(x-OM[0])*K, NM[1]+(y-OM[1])*K+DY[0])
FW,FH=FX1-FX0,FY1-FY0
SS=8   # supersample factor (work)
OUT=2  # output factor
base=SRC.crop((FX0,FY0,FX1,FY1)).resize((FW*SS,FH*SS),Image.BICUBIC)
_Y,_X=np.mgrid[0:FH*OUT,0:FW*OUT]/OUT
def _ss(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
alpha=Image.fromarray((255*_ss(0,12,_X)*_ss(FW,FW-12,_X)*_ss(0,12,_Y)*_ss(FH,FH-12,_Y)).astype(np.uint8))
def P(x,y):
    x,y=T(x,y); return ((x-FX0)*SS,(y-FY0)*SS)
def pts(l): return [P(*p) for p in l]
def inpaint(img,boxes,blur=3):
    a=np.array(img); m=np.zeros(a.shape[:2],np.uint8)
    for b in boxes:
        if b[0]=='e':
            _,cx,cy,rx,ry=b; cx,cy=T(cx,cy); cv2.ellipse(m,(int((cx-FX0)*SS),int((cy-FY0)*SS)),(int(rx*SS),int(ry*SS)),0,0,360,255,-1)
        else:
            x0,y0,x1,y1=b; cv2.rectangle(m,P(x0,y0),P(x1,y1),255,-1)
    small=cv2.resize(a,(a.shape[1]//4,a.shape[0]//4),interpolation=cv2.INTER_AREA)
    ms=cv2.resize(m,(m.shape[1]//4,m.shape[0]//4),interpolation=cv2.INTER_NEAREST)
    r=cv2.inpaint(small,ms,6,cv2.INPAINT_TELEA)
    r=cv2.GaussianBlur(r,(0,0),blur)
    r=cv2.resize(r,(a.shape[1],a.shape[0]),interpolation=cv2.INTER_CUBIC)
    mf=cv2.GaussianBlur(m.astype(np.float32)/255,(0,0),SS*1.2)[...,None]
    out=(a*(1-mf)+r*mf).astype(np.uint8)
    return Image.fromarray(out)
def layer(): return Image.new('RGBA',base.size,(0,0,0,0))
def comp(img,lay,blur=0.0):
    if blur: lay=lay.filter(ImageFilter.GaussianBlur(blur*SS))
    i=img.convert('RGBA'); i.alpha_composite(lay); return i.convert('RGB')
def bez(p0,p1,p2,n=24):
    return [((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0],(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]) for t in np.linspace(0,1,n)]
def stroke(d,path,w0,w1,col):
    # tapered stroke by circles
    n=len(path)
    for i in range(n-1):
        a=P(*path[i]);b=P(*path[i+1]); t=i/(n-1); w=(w0+(w1-w0)*t)*SS/2
        for s in np.linspace(0,1,6):
            x=a[0]+(b[0]-a[0])*s;y=a[1]+(b[1]-a[1])*s
            d.ellipse([x-w,y-w,x+w,y+w],fill=col)
LASH=(26,18,24,255); SKIN_SH=(150,105,110,255)
# ---------- MOUTH helpers
MOUTH_ERASE=[('e',603.5,148.5,17,7.5)]
def mouth_open_o(img,open_=1.0):
    L=layer(); d=ImageDraw.Draw(L)
    cx,cy=603.5,150; rx,ry=6.8,5.6*open_
    outer=[(cx+rx*1.08*np.cos(a),cy+ry*1.05*np.sin(a)+ (0.6 if np.sin(a)>0 else 0)) for a in np.linspace(0,2*np.pi,60)]
    d.polygon(pts(outer),fill=(140,82,88,255))
    inner=[(cx+rx*0.86*np.cos(a),cy+ry*0.8*np.sin(a)) for a in np.linspace(0,2*np.pi,60)]
    d.polygon(pts(inner),fill=(66,30,36,255))
    # tongue
    d.ellipse([*P(cx-4.2,cy+0.8*ry*0.25),*P(cx+4.2,cy+ry*0.85)],fill=(150,84,92,255))
    # upper teeth
    d.chord([*P(cx-5.2,cy-ry*0.85),*P(cx+5.2,cy-ry*0.1)],180,360,fill=(214,204,208,255))
    img=comp(img,L,0.5)
    # lower lip sheen
    L2=layer(); d2=ImageDraw.Draw(L2)
    d2.ellipse([*P(cx-3.5,cy+ry*1.05),*P(cx+3.5,cy+ry*1.05+1.6)],fill=(230,170,170,120))
    return comp(img,L2,0.5)
def mouth_grin(img,wide=1.0):
    L=layer(); d=ImageDraw.Draw(L)
    top=bez((588,144.8),(603,147.5),(619,142.6),20)
    bot=bez((619,142.6),(605,160*wide+150*(1-wide)),(588,144.8),20)
    d.polygon(pts(top+bot),fill=(140,82,88,255))
    top2=bez((589.6,145.5),(603,148.3),(617.8,143.4),20)
    bot2=bez((617.8,143.4),(604.5,158.6*wide+150*(1-wide)),(589.6,145.5),20)
    d.polygon(pts(top2+bot2),fill=(66,30,36,255))
    # tongue
    d.ellipse([*P(598,152.5),*P(610,158.5)],fill=(150,84,92,255))
    # teeth upper band
    tt=bez((590.4,145.8),(603,149.2),(617.2,143.8),20)
    tb=bez((616.8,145.4),(603,151.0),(590.8,147.4),20)
    d.polygon(pts(tt+tb),fill=(214,204,208,255))
    img=comp(img,L,0.5)
    L2=layer(); d2=ImageDraw.Draw(L2)
    stroke(d2,bez((585.5,143.5),(587,144.2),(588.5,145.5),6),0.9,0.5,(90,50,55,200))
    stroke(d2,bez((621.5,141),(620.3,142),(619,143),6),0.9,0.5,(90,50,55,200))
    return comp(img,L2,0.3)
def mouth_grit(img):
    L=layer(); d=ImageDraw.Draw(L)
    top=bez((588,150),(603,143.2),(619,148),20)
    bot=bez((619,148),(603.5,156.5),(588,150),20)
    d.polygon(pts(top+bot),fill=(120,70,76,255))
    top2=bez((589.6,149.6),(603,144.6),(617.4,147.6),20)
    bot2=bez((617.4,147.6),(603.5,155),(589.6,149.6),20)
    d.polygon(pts(top2+bot2),fill=(212,202,206,255))
    img=comp(img,L,0.45)
    L2=layer(); d2=ImageDraw.Draw(L2)
    stroke(d2,bez((590.5,150),(603.5,151.4),(616.5,148.4),14),0.55,0.55,(110,80,86,255))
    for x in [595,599.5,604,608.5,613]:
        y0=146+abs(x-603.5)*0.06; stroke(d2,[(x,y0),(x+0.2,y0+7.2-abs(x-603.5)*0.15)],0.4,0.4,(150,128,134,220))
    return comp(img,L2,0.35)
def mouth_small_o(img):
    L=layer(); d=ImageDraw.Draw(L)
    cx,cy=603.5,151
    d.ellipse([*P(cx-4.2,cy-3.6),*P(cx+4.2,cy+4.2)],fill=(140,82,88,255))
    d.ellipse([*P(cx-3.2,cy-2.6),*P(cx+3.2,cy+3.2)],fill=(66,30,36,255))
    d.ellipse([*P(cx-2.2,cy+0.8),*P(cx+2.2,cy+3.0)],fill=(140,80,90,255))
    return comp(img,L,0.5)
# ---------- EYES
EYE_L=(577.5,125); EYE_R=(620,119.5)
EYE_ERASE=[('e',577.5,124.5,12.5,6.0),('e',620,119,12.5,5.8)]
def eyes_angry(img):
    # shadow over upper face
    L=layer(); d=ImageDraw.Draw(L)
    sh=np.zeros((base.size[1],base.size[0]),np.float32)
    Y,X=np.mgrid[0:base.size[1],0:base.size[0]]
    ys=(Y/SS+FY0-NM[1])/K+OM[1]; xs=(X/SS+FX0-NM[0])/K+OM[0]
    sh=np.clip((134-ys)/22,0,1)**1.3*np.exp(-((xs-600)/34)**2)*0.62
    L=Image.fromarray(np.dstack([np.full_like(sh,34),np.full_like(sh,8),np.full_like(sh,36),sh*255]).astype(np.uint8),'RGBA')
    img=comp(img,L,0)
    L=layer(); d=ImageDraw.Draw(L)
    for side in (0,1):
        if side==0: outer,inner,cy=(566.5,119.5),(588.5,126.2),125.8; irx=578.5
        else:       outer,inner,cy=(632,114.2),(608.5,121.8),120.5; irx=619.5
        mid=((outer[0]+inner[0])/2,(outer[1]+inner[1])/2+0.6)
        low_o=(outer[0]+(1.2 if side==0 else -1.2),outer[1]+3.4); low_i=(inner[0],inner[1]+1.6)
        lowmid=((low_o[0]+low_i[0])/2,(low_o[1]+low_i[1])/2+0.9)
        white=bez(outer,mid,inner,16)+bez(low_i,lowmid,low_o,16)
        d.polygon(pts(white),fill=(218,204,206,255))
        # iris (clip by drawing then masking)
        Ir=layer(); di=ImageDraw.Draw(Ir)
        di.ellipse([*P(irx-3.0,cy-3.6),*P(irx+3.0,cy+3.0)],fill=(40,14,16,255))
        di.ellipse([*P(irx-1.6,cy-2.0),*P(irx+1.6,cy+1.6)],fill=(150,20,24,255))
        di.ellipse([*P(irx-0.9,cy-1.3),*P(irx+0.9,cy+0.5)],fill=(255,90,80,255))
        m=Image.new('L',base.size,0); ImageDraw.Draw(m).polygon(pts(white),fill=255)
        Ir.putalpha(Image.fromarray((np.array(Ir.split()[3]).astype(np.float32)*np.array(m)/255).astype(np.uint8)))
        L.alpha_composite(Ir); d=ImageDraw.Draw(L)
        stroke(d,bez(outer,mid,inner,22),2.4,1.3,LASH)
        stroke(d,bez(low_o,lowmid,low_i,14),0.6,0.4,(90,60,66,200))
        # angry brow peeking below bangs
        if side==0: stroke(d,bez((570,113.6),(579,115.2),(588,119.6),14),1.6,1.9,(30,22,30,255))
        else:       stroke(d,bez((629,109.5),(620,111.4),(611,115.6),14),1.6,1.9,(30,22,30,255))
    return comp(img,L,0.38)
def eyes_happy(img):
    L=layer(); d=ImageDraw.Draw(L)
    stroke(d,bez((568.5,127.2),(577.5,119.5),(587.5,126.8),22),2.0,1.0,LASH)
    stroke(d,bez((631,121.2),(620,114.5),(609.5,122.6),22),2.0,1.0,LASH)
    stroke(d,[(566.8,127.6),(568.8,126.8)],0.9,0.6,LASH)
    stroke(d,[(632.5,121.8),(630.6,121.0)],0.9,0.6,LASH)
    img=comp(img,L,0.4)
    # blush
    L=layer(); d=ImageDraw.Draw(L)
    for (cx,cy) in [(575,135),(626,130)]:
        d.ellipse([*P(cx-8,cy-3.6),*P(cx+8,cy+3.6)],fill=(240,120,135,70))
    img=comp(img,L,1.2)
    L=layer(); d=ImageDraw.Draw(L)
    for (cx,cy) in [(575,135),(626,130)]:
        for k in range(-2,3):
            x=cx+k*2.6; stroke(d,[(x+1.0,cy-1.8),(x-1.0,cy+1.8)],0.55,0.45,(215,95,110,95))
    return comp(img,L,0.35)
def eyes_shock(img):
    L=layer(); d=ImageDraw.Draw(L)
    for (cx,cy) in [(577.5,124.2),(620,118.8)]:
        d.ellipse([*P(cx-6.2,cy-4.6),*P(cx+6.2,cy+4.4)],fill=(222,212,214,255))
        d.ellipse([*P(cx-1.5,cy-1.4),*P(cx+1.5,cy+1.6)],fill=(30,16,18,255))
        stroke(d,bez((cx-7,cy-2.0),(cx,cy-6.4),(cx+7,cy-2.4),20),1.8,1.8,LASH)
        stroke(d,bez((cx-5,cy+3.6),(cx,cy+5.4),(cx+5,cy+3.6),12),0.5,0.5,(110,70,76,200))
    img=comp(img,L,0.38)
    # sweat lines / pallor
    L=layer(); d=ImageDraw.Draw(L)
    Y,X=np.mgrid[0:base.size[1],0:base.size[0]]
    ys=(Y/SS+FY0-NM[1])/K+OM[1]; xs=(X/SS+FX0-NM[0])/K+OM[0]
    sh=np.clip((132-ys)/20,0,1)*np.exp(-((xs-600)/32)**2)*0.4
    L=Image.fromarray(np.dstack([np.full_like(sh,70),np.full_like(sh,84),np.full_like(sh,160),sh*255]).astype(np.uint8),'RGBA')
    return comp(img,L,0)
def eyes_closed(img):
    L=layer(); d=ImageDraw.Draw(L)
    stroke(d,bez((567.5,123.6),(577.5,128.6),(588.5,125.4),22),2.3,1.2,LASH)
    stroke(d,bez((631.5,118.0),(620,123.4),(609,120.6),22),2.3,1.2,LASH)
    stroke(d,[(566.0,122.6),(568.2,124.0)],1.0,0.6,LASH)
    stroke(d,[(633.0,117.0),(630.8,118.4)],1.0,0.6,LASH)
    return comp(img,L,0.4)
def make(eye_fn,mouth_fn):
    img=base.copy()
    boxes=[]
    if eye_fn: boxes+=EYE_ERASE
    if mouth_fn: boxes+=MOUTH_ERASE
    if boxes: img=inpaint(img,boxes)
    if eye_fn: img=eye_fn(img)
    if mouth_fn: img=mouth_fn(img)
    return img
variants={
 'base':base.copy(),
 'oh':make(None,mouth_open_o),
 'grin':make(eyes_happy,mouth_grin),
 'angry':make(eyes_angry,mouth_grit),
 'angryoh':make(eyes_angry,lambda i:mouth_open_o(i,1.15)),
 'shock':make(eyes_shock,mouth_small_o),
 'smug':make(None,mouth_grin),
 'wince':make(eyes_happy,lambda i:mouth_open_o(i,0.8)),
 'blink':make(eyes_closed,None),
}
names=list(variants)
atlas=Image.new('RGBA',(FW*OUT,FH*OUT*len(names)))
for i,n in enumerate(names):
    v=variants[n].resize((FW*OUT,FH*OUT),Image.LANCZOS).convert('RGBA'); v.putalpha(alpha)
    atlas.paste(v,(0,i*FH*OUT))
atlas.save('assets/faces.webp',quality=94,method=6); atlas.save('tools/faces.png')
json.dump({'names':names,'x':FX0,'y':FY0,'w':FW,'h':FH,'scale':OUT},open('assets/faces.json','w'))
# preview
pv=Image.new('RGB',(FW*3*len(names),FH*3))
for i,n in enumerate(names): pv.paste(variants[n].resize((FW*3,FH*3),Image.LANCZOS),(i*FW*3,0))
pv.save('/tmp/faces_prev.png')
