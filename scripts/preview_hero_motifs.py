"""Three motif frames and an optional short preview clip only. The approved render_hero.py is a read-only dependency.

Replaces its background plate at the boundary before the existing title layers.
Never writes production posters/videos or edits title rendering/compositing code.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('approved_hero', ROOT/'scripts/render_hero.py')
hero = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hero)
SCALE = 2
SERIF = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 16*SCALE)


def reference_figure(reference):
    # Use only the luminous anatomical motif from the supplied reference.
    # The source image stays untouched; navy surroundings/secondary figure are
    # rejected by the foreground luminance mask in this temporary render pass.
    source = Image.open(reference).convert('RGB')
    if source.size != (2048, 682):
        source = source.resize((2048, 682), Image.Resampling.LANCZOS)
    rgb = np.asarray(source.crop((839,157,1209,527)))
    alpha = np.clip((rgb[:,:,0].astype(float)-94)*1.5,0,184).astype(np.uint8)
    pixels = np.zeros((*alpha.shape,4),dtype=np.uint8)
    pixels[:,:,:3] = (217,228,239)
    pixels[:,:,3] = alpha
    return Image.fromarray(pixels)


# Independent, deterministic streams; randomness affects placement, never title data.
MOTIFS = [
    ('cube',83,79,30,.84,1.3), ('sphere',548,55,24,.71,2.8),
    ('icosahedron',732,434,24,.63,5.2), ('triangle',297,471,27,.76,3.5),
    ('golden',405,258,34,.50,4.7), ('square_circle',122,408,25,.62,6.1),
    ('octahedron',-105,285,28,.67,7.4), ('orbit',596,367,35,.48,8.9),
    ('cube',-358,477,18,.56,9.6), ('sphere',358,329,16,.43,10.8),
    ('tetrahedron',831,267,23,.55,11.3), ('angle',-585,124,32,.70,12.9),
    ('square_circle',-759,57,20,.61,14.1),
    ('octahedron',194,202,17,.52,17.2), ('cube',624,239,20,.64,18.8),
    ('triangle',-270,345,18,.57,20.1), ('golden',-904,306,27,.48,21.7),
    ('orbit',-512,201,27,.58,23.4), ('square_circle',784,148,17,.50,25.6),
    ('tetrahedron',-90,493,21,.68,27.3), ('sphere',454,442,20,.61,28.7),
    ('triangle',670,31,16,.58,30.4), ('angle',-704,418,24,.60,32.1),
    ('cube',-1120,85,21,.72,33.9), ('octahedron',921,341,18,.56,35.6),
    ('golden',262,127,29,.49,37.3), ('orbit',-330,40,26,.66,39.1),
]
EQUATIONS = [
    ('φ = (1 + √5) / 2',210,507,16,.72,2.1),
    ('a² + b² = c²',471,420,15,.59,4.4),
    ('x² + y² = r²',671,96,16,.61,6.7),
    ('A = πr²',-145,238,14,.67,8.3),
    ('sin²θ + cos²θ = 1',-416,382,14,.53,10.6),
    ('θ = π / 3',250,33,15,.64,12.4),
    ('R = a / √3',-677,486,14,.62,14.9),
    ('a : b = 1 : φ',-832,65,13,.58,16.1),
    ('C = 2πr',63,291,13,.59,18.4),
    ('V = 4πr³ / 3',-548,451,14,.66,22.7),
    ('e^(iπ) + 1 = 0',388,254,14,.55,26.5),
    ('Fₙ₊₁ = Fₙ + Fₙ₋₁',-1048,363,13,.53,31.8),
]
FONTS={size:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',size*SCALE) for size in (13,14,15,16)}


def stream(t,x0,y0,depth,seed):
    # Different path lengths produce modest speed differences and parallax.
    # Every path still closes after 48s, with wrapping hidden at both ends.
    span=1420+depth*190+38*math.sin(seed)
    left=-220-depth*40
    phase=t*math.tau/hero.AMBIENT_SECONDS
    x=left+((x0-left+span*t/hero.AMBIENT_SECONDS+5*math.sin(phase+seed))%span)
    y=y0+(3+depth*6)*math.sin(phase+seed*1.7)
    fade=hero.smooth((x+145)/120)*(1-hero.smooth((x-650)/440))
    # Recurring geometric texture passes behind the title at a lower intensity.
    title_zone=hero.smooth((x-185)/65)*(1-hero.smooth((x-1040)/80))*hero.smooth((y-105)/25)*(1-hero.smooth((y-222)/35))
    opacity=fade*(.52+.48*depth)*(1-.42*title_zone)
    return x,y,opacity,phase+seed


def background(t, figure):
    plate=Image.new('RGBA',(hero.W*SCALE,hero.H*SCALE))
    draw=ImageDraw.Draw(plate,'RGBA')

    def line(points,alpha=70):
        draw.line([(round(x*SCALE),round(y*SCALE)) for x,y in points],fill=(210,225,239,round(alpha*1.10)),width=2,joint='curve')

    def circle(cx,cy,r,alpha=50,squash=1,angle=0,start=0,sweep=math.tau):
        pts=[]
        for a in np.linspace(start,start+sweep,85):
            x=r*math.cos(a);y=r*math.sin(a)*squash
            pts.append((cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle)))
        line(pts,alpha)

    def solid(kind,x,y,size,opacity,phase):
        if kind=='cube':
            vertices=[(a,b,c) for a in (-1,1) for b in (-1,1) for c in (-1,1)]
            edges=[(i,j) for i,a in enumerate(vertices) for j,b in enumerate(vertices) if j>i and sum(a[k]!=b[k] for k in range(3))==1]
        elif kind=='tetrahedron':
            vertices=[(1,1,1),(-1,-1,1),(-1,1,-1),(1,-1,-1)]
            edges=[(i,j) for i in range(4) for j in range(i+1,4)]
        elif kind=='octahedron':
            vertices=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
            edges=[(i,j) for i,a in enumerate(vertices) for j,b in enumerate(vertices) if j>i and sum(a[k]*b[k] for k in range(3))==0]
        else:
            phi=(1+math.sqrt(5))/2
            vertices=[(0,a,b*phi) for a in (-1,1) for b in (-1,1)]+[(a,b*phi,0) for a in (-1,1) for b in (-1,1)]+[(a*phi,0,b) for a in (-1,1) for b in (-1,1)]
            edges=[(i,j) for i,a in enumerate(vertices) for j,b in enumerate(vertices) if j>i and abs(np.linalg.norm(np.array(a)-b)-2)<1e-6]
        ax=.34+.22*math.sin(phase);ay=.57+phase+.23*math.sin(phase*2)
        rx=np.array([[1,0,0],[0,math.cos(ax),-math.sin(ax)],[0,math.sin(ax),math.cos(ax)]])
        ry=np.array([[math.cos(ay),0,math.sin(ay)],[0,1,0],[-math.sin(ay),0,math.cos(ay)]])
        verts=np.asarray(vertices)@rx.T@ry.T
        pts=[(x+size*a/(1+c*.13),y+size*b/(1+c*.13)) for a,b,c in verts]
        if kind=='cube':
            faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
        else:
            connected={tuple(sorted(edge)) for edge in edges}
            faces=[(a,b,c) for a in range(len(vertices)) for b in range(a+1,len(vertices)) for c in range(b+1,len(vertices)) if all(pair in connected for pair in ((a,b),(b,c),(a,c)))]
        for face in sorted(faces,key=lambda ids:sum(verts[i,2] for i in ids),reverse=True):
            draw.polygon([(round(pts[i][0]*SCALE),round(pts[i][1]*SCALE)) for i in face],fill=(91,137,175,round(19*opacity)))
        for i,j in edges:
            line([pts[i],pts[j]],opacity*(102+18*(verts[i,2]+verts[j,2])/2))
        # Local depth accents, not a free particle swarm.
        for i,(px,py) in enumerate(pts):
            if i%4==0:
                draw.ellipse(((px-.6)*SCALE,(py-.6)*SCALE,(px+.6)*SCALE,(py+.6)*SCALE),fill=(207,224,238,round(92*opacity)))

    for kind,x0,y0,size,depth,seed in MOTIFS:
        x,y,opacity,phase=stream(t,x0,y0,depth,seed)
        if opacity<.006:
            continue
        angle=phase+.16*math.sin(phase+depth)
        if kind in ('cube','icosahedron','octahedron','tetrahedron'):
            solid(kind,x,y,size,opacity,phase)
        elif kind=='sphere':
            circle(x,y,size,85*opacity)
            circle(x,y,size,46*opacity,.36,angle)
            circle(x,y,size,38*opacity,.36,angle+math.pi/2)
            circle(x,y,size*1.38,29*opacity,.33,-.32)
        elif kind=='triangle':
            pts=[(x+size*math.cos(angle+a),y+size*math.sin(angle+a)) for a in (-math.pi/2,math.pi/6,5*math.pi/6)]
            line(pts+[pts[0]],88*opacity)
            circle(x,y,size,32*opacity)
        elif kind=='orbit':
            circle(x,y,size,46*opacity,.48,angle)
            circle(x,y,size*.79,39*opacity,.48,angle+.6)
            circle(x,y,size*1.12,30*opacity,.35,angle-.35,start=.4,sweep=math.pi*1.38)
        elif kind=='angle':
            pts=[(x+a*math.cos(angle)-b*math.sin(angle),y+a*math.sin(angle)+b*math.cos(angle)) for a,b in [(size,0),(0,0),(size*.52,-size*.85)]]
            line(pts,69*opacity)
            circle(x,y,size*.52,41*opacity,angle=angle,start=-math.pi/3,sweep=math.pi/3)
        elif kind=='square_circle':
            pts=[(x+size*(a*math.cos(angle)-b*math.sin(angle)),y+size*(a*math.sin(angle)+b*math.cos(angle))) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            line(pts+[pts[0]],73*opacity)
            circle(x,y,size,54*opacity)
            line([pts[0],pts[2]],23*opacity)
        elif kind=='golden':
            # A true 1:phi rectangle with an internal square and circular arc.
            width=size*1.618; height=size
            tilt=.12*math.sin(phase)
            def rotate(points):
                return [(x+a*math.cos(tilt)-b*math.sin(tilt),y+a*math.sin(tilt)+b*math.cos(tilt)) for a,b in points]
            line(rotate([(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2),(-width/2,-height/2)]),79*opacity)
            split=-width/2+height
            line(rotate([(split,-height/2),(split,height/2)]),35*opacity)
            arc=[(split+height*math.cos(a),height/2+height*math.sin(a)) for a in np.linspace(math.pi,math.pi*1.5,65)]
            line(rotate(arc),48*opacity)

    # One anatomical figure, intermittent within a deeper, non-fixed trajectory.
    hx,hy,opacity,phase=stream(t,150,361,.83,3.7)
    hy+=16*math.sin(t*math.tau/48+.7)
    human=figure.resize((207*SCALE,207*SCALE),Image.Resampling.LANCZOS)
    human=human.rotate(2.3*math.sin(phase),resample=Image.Resampling.BICUBIC)
    human.putalpha(human.getchannel('A').point(lambda a:round(a*opacity*.9)))
    plate.alpha_composite(human,(round((hx-103.5)*SCALE),round((hy-103.5)*SCALE)))

    # The second figure enters from outside the left edge on its own
    # uninterrupted trajectory; only the shared spatial fades control visibility.
    hx,hy,opacity,phase=stream(t-8.149972,-245,320,.76,8.2)
    hy+=10*math.sin(t*math.tau/48+2.4)
    human=figure.resize((184*SCALE,184*SCALE),Image.Resampling.LANCZOS)
    human=human.rotate(1.8*math.sin(phase),resample=Image.Resampling.BICUBIC)
    human.putalpha(human.getchannel('A').point(lambda a:round(a*opacity*.86)))
    plate.alpha_composite(human,(round((hx-92)*SCALE),round((hy-92)*SCALE)))

    for text,x0,y0,size,depth,seed in EQUATIONS:
        x,y,opacity,phase=stream(t,x0,y0,depth,seed)
        draw.text((round(x*SCALE),round(y*SCALE)),text,font=FONTS[size],fill=(215,228,239,round(121*opacity)))
    # A restrained halo from this motif plate alone, below every locked title layer.
    halo=plate.filter(ImageFilter.GaussianBlur(1.5*SCALE))
    halo.putalpha(halo.getchannel('A').point(lambda a:round(a*.24)))
    plate=Image.alpha_composite(halo,plate)
    return plate.resize((hero.W,hero.H),Image.Resampling.LANCZOS)


def frame(t,ambient,motifs=None):
    original=Image.alpha_composite
    count=0
    title_layers=[]

    def boundary(back,front):
        nonlocal count
        count+=1
        # Calls 2–5 are the approved facet face, facet edges, BRAIN and STORM.
        # Their pixels and the actual compositing operation remain untouched.
        if 2<=count<=5:
            title_layers.append(hashlib.sha256(front.tobytes()).hexdigest())
        if count==2 and motifs is not None:
            back=motifs
        return original(back,front)

    Image.alpha_composite=boundary
    try:
        result=hero.render(t,ambient)
    finally:
        Image.alpha_composite=original
    assert len(title_layers)==4
    return result,title_layers


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--reference',required=True,type=Path)
    args.add_argument('--video',action='store_true',help='An 32-second separate preview; never the production sequence')
    options=args.parse_args()
    figure=reference_figure(options.reference)
    source_before=hashlib.sha256((ROOT/'scripts/render_hero.py').read_bytes()).hexdigest()
    for name,t,ambient in ([] if options.video else [('intro',.75,False),('mid-motion',2.5,False),('ambient',17,True)]):
        _,locked=frame(t,ambient)
        preview,actual=frame(t,ambient,background(t,figure))
        assert locked==actual, 'STOP: title layer differs from approved renderer'
        target=ROOT/f'public/assets/hero/preview-timing-{name}.png'
        preview.save(target)
        print(f'{target.name}: {t}s; four title layer hashes identical to baseline')
    assert source_before==hashlib.sha256((ROOT/'scripts/render_hero.py').read_bytes()).hexdigest()
    assert np.array_equal(np.asarray(background(5,figure)),np.asarray(background(53,figure)))
    if options.video:
        target=ROOT/'public/assets/hero/hero-motifs-timing-preview.mp4'
        command=['ffmpeg','-hide_banner','-loglevel','error','-y',
                 '-f','rawvideo','-pix_fmt','rgb24','-s',f'{hero.W}x{hero.H}',
                 '-r',str(hero.FPS),'-i','-','-an','-c:v','libx264',
                 '-preset','medium','-crf','20','-pix_fmt','yuv420p',
                 '-movflags','+faststart',str(target)]
        with subprocess.Popen(command,stdin=subprocess.PIPE) as process:
            for index in range(32*hero.FPS):
                t=index/hero.FPS
                rendered,_=frame(t,t>=5,background(t,figure))
                process.stdin.write(rendered.tobytes())
            process.stdin.close()
            if process.wait():
                raise RuntimeError('Preview encoding failed')
        print(f'{target.name}: separate 32-second preview, 24fps, 1536x540')
    assert source_before==hashlib.sha256((ROOT/'scripts/render_hero.py').read_bytes()).hexdigest()
    print('Approved renderer untouched; motif loop periodic; production files never written')


if __name__=='__main__':
    main()
