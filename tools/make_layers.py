import numpy as np, json
from PIL import Image
from scipy.ndimage import gaussian_filter, label, binary_dilation
S0=np.asarray(Image.open('tools/src.jpg').convert('RGB')).astype(np.float32)
A0=np.asarray(Image.open('tools/cut_isnet-anime.png'))[...,3].astype(np.float32)/255
H0,W0=A0.shape
PAD=80; HEM=1478; H=1500; W=W0+2*PAD
yy0,xx0=np.mgrid[0:H0,0:W0]
L0=S0.mean(2)
# cleanup: dark background strips at bottom corners
A0[(xx0<30)&(yy0>935)&(L0<110)]=0
A0[(xx0>815)&(yy0>880)&(L0<120)]=0
A0[A0<0.03]=0
lab,n=label(A0>0.3); sz=np.bincount(lab.ravel()); sz[0]=0
A0*=binary_dilation(lab==sz.argmax(),iterations=3)
def ss(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0+1e-9),0,1); return t*t*(3-2*t)
# --- curves (source coords)
TOP=np.interp(np.arange(W0),[0,60,100,120,140,180,220,260,290,320,360,425,490,530,555,580,620,660,687,703,720,760,800,848],
                             [600,560,530,520,500,458,431,408,393,360,322,306,322,360,395,411,435,458,485,515,545,590,620,650])
est=np.interp(np.arange(W0),[0,30,100,200,300,400,500,600,700,800,848],[925,950,1000,1100,1155,1172,1155,1115,1040,945,905])
CR=np.zeros(W0)
for x in range(W0):
    a=int(est[x])-22; b=min(int(est[x])+22,H0-1)
    col=gaussian_filter(L0[a:b,x],1.0); CR[x]=a+np.argmin(col)
CR=gaussian_filter(CR,6)
c=416.0
def xr(y): return 812+(y-930)*0.16
def xl(y): return 2*c-xr(y)
# --- padded canvases
S=np.zeros((H,W,3),np.float32); A=np.zeros((H,W),np.float32)
S[:H0,PAD:PAD+W0]=S0; A[:H0,PAD:PAD+W0]=A0
yy,xx=np.mgrid[0:H,0:W]; X=xx-PAD  # source x
TOPp=np.full(W,9e9); TOPp[PAD:PAD+W0]=TOP; TOPp[:PAD]=TOP[0]; TOPp[PAD+W0:]=TOP[-1]
CRp=np.zeros(W); CRp[PAD:PAD+W0]=CR; CRp[:PAD]=CR[0]; CRp[PAD+W0:]=CR[-1]
out={}
def save(name,rgb,alpha,box,q=90):
    x0,y0,x1,y1=box
    img=np.dstack([rgb[y0:y1,x0:x1],alpha[y0:y1,x0:x1]*255]).clip(0,255).astype(np.uint8)
    # bleed colour into transparent pixels (avoid dark halos with linear filtering)
    a=img[...,3].astype(np.float32)/255
    rgbf=img[...,:3].astype(np.float32)
    num=gaussian_filter(rgbf*a[...,None],(6,6,0)); den=gaussian_filter(a,6)[...,None]+1e-4
    fill=num/den
    w=np.clip(a*4,0,1)[...,None]
    img[...,:3]=(rgbf*w+fill*(1-w)).clip(0,255).astype(np.uint8)
    im=Image.fromarray(img,'RGBA'); im.save(f'assets/{name}.webp',quality=q,method=6); im.save(f'tools/{name}.png')
    out[name]=dict(x=x0,y=y0,w=x1-x0,h=y1-y0)
T=TOPp[None,:]; C=CRp[None,:]
# UPPER: everything above belly top (+overlap hidden under belly)
au=A*(1-ss(T+30,T+48,yy))
au[yy>700]=0
save('upper',S,au,(0,0,W,700))
# BELLY
ab=A*ss(T-7,T-1,yy)*(1-ss(C+2.5,C+4.5,yy))
# complete tiny crop at the left belly edge (mirror of right silhouette)
for y in range(700,int(CR[0])+8):
    r=np.where(A0[y,:]>0.5)[0][-1]
    lx=2*c-r+PAD          # mirrored left silhouette (padded coords)
    ok=np.where(A0[y]>0.5)[0]
    first=PAD+ok[0]
    xs_=np.arange(W)
    if lx<first-0.5:
        x0=int(np.floor(lx))
        for x in range(x0,first+1):
            f=(first-x)/max(first-lx,1)
            S[y,x]=S[y,first+2]*(1-0.18*f)
            ab[y,x]=1.0
    ab[y]*=np.clip(xs_-lx+0.5,0,1)
    xo=int(np.floor(lx))
    for x in range(xo,xo+2): S[y,x]=(66,68,92)
save('belly',S,ab,(0,280,W,1200))
# SKIRT
sk=S.copy(); ask=np.zeros((H,W),np.float32)
rows=np.arange(H)
XL=xl(rows); XR=xr(rows)
XL=np.where(rows<940,np.minimum(XL,-5+(rows-860)*0.2),XL)
# extension: base = smoothed last rows, blending into lit dress colour, plus fabric grain
bot=gaussian_filter(S0[1236:1252].mean(0),(18,0))
BOT=np.zeros((W,3),np.float32); BOT[PAD:PAD+W0]=bot; BOT[:PAD]=bot[3]; BOT[PAD+W0:]=bot[-4]
lit=np.array(S0[1180:1250,60:120].reshape(-1,3).mean(0))
xs_=np.arange(W); prof=0.93+0.07*np.exp(-((xs_-PAD-416)/330.0)**2)
LIGHT=lit[None,:]*prof[:,None]
BOT=BOT*0.6+LIGHT*0.4
g=S0[700:880,250:600].mean(2); g=g-gaussian_filter(g,3)
GRt=np.tile(g,(1,int(np.ceil(W/g.shape[1]))+1))[:, :W]
GR=(GRt*0.8)[...,None]*np.ones(3)
for y in range(700,H):
    l,r=XL[y]+PAD,XR[y]+PAD
    m=ss(l-0.5,l+1.5,np.arange(W))*(1-ss(r-1.5,r+0.5,np.arange(W)))
    ask[y]=m
    if y<1259:
        # visible source part; hidden part behind belly: copy colour from below crease
        src=S[y].copy()
        for x in range(W):
            sx=min(max(x-PAD,0),W0-1)
            if y<CR[sx]+24:
                yy_=min(int(CR[sx])+26,H0-1); src[x]=S0[yy_,sx]
            elif x<PAD+2 or x>=PAD+W0-2 or A0[y,sx]<0.5:
                ok=np.where(A0[y,:]>0.5)[0]
                if len(ok):
                    j=ok[0]+3 if sx<416 else ok[-1]-3
                    src[x]=S0[y,j]
        sk[y]=src
    else:
        t=ss(1252,1310,y)
        sk[y]=BOT*(1-t)+LIGHT*t+GR[(y-1259)%GR.shape[0]]
for y in range(1215,1259):
    w=ss(1215,1252,y)
    sk[y]=sk[y]*(1-w)+(BOT+GR[(y-1215)%GR.shape[0]])*w
# rim shading + outline along sides
for y in range(880,H):
    for side in (0,1):
        e=XL[y]+PAD if side==0 else XR[y]+PAD
        d=np.abs(np.arange(W)-e)
        rim=np.exp(-d/16)*0.22; sk[y]*=(1-rim[:,None]*np.array([1,1,0.85]))
        ol=np.clip(1.6-d,0,1)[:,None]; sk[y]=sk[y]*(1-ol)+np.array([62,64,88])*ol
# vertical drape folds in extension
xs=np.arange(W)
fold=(np.sin(xs/23.0)*0.5+np.sin(xs/57.0+1.3)*0.5)
for y in range(1180,H):
    t=ss(1180,HEM,y)
    sk[y]*=1-(0.05*t*fold)[:,None]
# hem
hy=HEM-30*(1-((xs-PAD-c)/((XR[HEM]-XL[HEM])/2))**2).clip(0,1)*(-1)  # center lower
hy=HEM-30+30*(1-((xs-PAD-c)/((XR[HEM]-XL[HEM])/2))**2).clip(0,1)+4*np.sin(xs/31.0)
hy=np.minimum(hy,H-3)
for x in range(W):
    h=hy[x]
    for y in range(int(h)-22,H):
        d=h-y
        if d<0: ask[y,x]*=np.clip(1+d,0,1)
        elif d<16: sk[y,x]*=1-0.16*(1-d/16)
        if abs(d)<1.4: sk[y,x]=sk[y,x]*0.2+np.array([62,64,88])*0.8
# fade top of hidden skirt; hidden part must stay inside the belly silhouette
from scipy.ndimage import binary_erosion
bm=np.zeros((H,W),bool); bm[280:1200]=binary_erosion(np.asarray(Image.open('tools/belly.png'))[...,3]>200,iterations=4)
hid=(yy<C-8)
ask=np.where(hid,ask*bm,ask)
ask*=ss(700,760,yy)
save('skirt',sk,ask,(0,700,W,H))
fj=json.load(open('assets/faces.json'))
meta=dict(W=W,H=H,PAD=PAD,hem=HEM,center=c+PAD,parts=out,
          face=dict(x=fj['x']+PAD,y=fj['y'],w=fj['w'],h=fj['h'],names=fj['names']),
          bellyTop=float(TOP[416]),crease=float(CR[416]),
          bellyBox=dict(x0=float(PAD),x1=float(PAD+W0),y0=float(TOP[416]),y1=float(CR[416])))
json.dump(meta,open('assets/layers.json','w'),indent=1)
# composite preview
comp=np.zeros((H,W,3),np.float32)+np.array([40,160,60])
for n in ['skirt','upper','belly']:
    p=out[n]; im=np.asarray(Image.open(f'tools/{n}.png')).astype(np.float32)
    a=im[...,3:]/255; reg=comp[p['y']:p['y']+p['h'],p['x']:p['x']+p['w']]
    reg[:]=reg*(1-a)+im[...,:3]*a
Image.fromarray(comp.astype(np.uint8)).save('/tmp/comp.png')
print(meta)
