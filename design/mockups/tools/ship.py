import math, random, sys
TEX = sys.argv[1] if len(sys.argv) > 1 else "/public/textures/"   # the app serves them at /textures/
random.seed(7)
f=lambda v: f"{v:.1f}".rstrip('0').rstrip('.')
# right contour of the hull (the starboard quarter turning away from us): cubic pieces
C1=((380,258),(400,330),(420,560),(424,800)); C2=((424,800),(426,900),(422,950),(418,1080))
def bez(c,t):
    (x0,y0),(x1,y1),(x2,y2),(x3,y3)=c; u=1-t
    return (u**3*x0+3*u*u*t*x1+3*u*t*t*x2+t**3*x3, u**3*y0+3*u*u*t*y1+3*u*t*t*y2+t**3*y3)
def E(y):
    for c in (C1,C2):
        if c[0][1]<=y<=c[3][1]:
            lo,hi=0,1
            for _ in range(40):
                m=(lo+hi)/2
                if bez(c,m)[1]<y: lo=m
                else: hi=m
            return bez(c,lo)[0]
    return 380
TOP="M -10 274 Q 150 222 380 258"
CONT="C 400 330 420 560 424 800 C 426 900 422 950 418 1080"
UNDER="C 414 1180 398 1270 372 1330"
HULL=f"{TOP} {CONT} {UNDER} L -10 1330 Z"
CX=150  # the stern's centreline
o=[]
a=o.append
a('<svg viewBox="0 0 560 1080" style="position: absolute; left: 0; top: 0; width: 560px; height: 1080px; overflow: visible">')
a('''<defs>
<clipPath id="sh-hull"><path d="%s"></path></clipPath>
<pattern id="sh-wood" width="512" height="96" patternUnits="userSpaceOnUse"><image href="%s" width="512" height="96"></image></pattern>
<linearGradient id="sh-under" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05272e" stop-opacity=".94"></stop><stop offset=".3" stop-color="#05303a" stop-opacity=".62"></stop><stop offset="1" stop-color="#021216" stop-opacity=".9"></stop></linearGradient>
<linearGradient id="sh-base" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#110b07"></stop><stop offset=".45" stop-color="#23170e"></stop><stop offset=".82" stop-color="#1c130c"></stop><stop offset="1" stop-color="#0c0806"></stop></linearGradient>
<linearGradient id="sh-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03171c" stop-opacity="0"></stop><stop offset=".55" stop-color="#03171c" stop-opacity=".35"></stop><stop offset="1" stop-color="#021014" stop-opacity=".9"></stop></linearGradient>
<linearGradient id="sh-gilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c07a"></stop><stop offset=".45" stop-color="#a47c3a"></stop><stop offset="1" stop-color="#4a3314"></stop></linearGradient>
<linearGradient id="sh-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8"></stop><stop offset=".5" stop-color="#f3a04a"></stop><stop offset="1" stop-color="#9a4a16"></stop></linearGradient>
<linearGradient id="sh-glassdim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a22"></stop><stop offset="1" stop-color="#1e120a"></stop></linearGradient>
<radialGradient id="sh-bronze" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#e0b872"></stop><stop offset=".5" stop-color="#8a6230"></stop><stop offset="1" stop-color="#2a1a0a"></stop></radialGradient>
<radialGradient id="sh-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffc878" stop-opacity=".55"></stop><stop offset=".45" stop-color="#ff8a1e" stop-opacity=".16"></stop><stop offset="1" stop-color="#ff8a1e" stop-opacity="0"></stop></radialGradient>
<linearGradient id="sh-quarter" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"></stop><stop offset=".7" stop-color="#000" stop-opacity=".45"></stop><stop offset="1" stop-color="#000" stop-opacity=".7"></stop></linearGradient>
<linearGradient id="sh-mast" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#07090a"></stop><stop offset=".75" stop-color="#141412"></stop><stop offset="1" stop-color="#6f9994"></stop></linearGradient>
</defs>''' % (HULL, TEX + 'wood-hull.png'))
# --- the hull
a(f'<path d="{HULL}" fill="url(#sh-base)"></path>')
a('<g clip-path="url(#sh-hull)">')
# transom strakes: gently crowned boards, staggered butt joints, a faint top highlight on each
y=286
while y<1330:
    tone=random.choice(['#2a1c12','#24180f','#1f150d','#2e1f14','#21160e'])
    a(f'<path d="M -10 {y} Q {CX} {y-9} 440 {y+5} L 440 {y+27} Q {CX} {y+17} -10 {y+26} Z" fill="{tone}"></path>')
    a(f'<path d="M -10 {y} Q {CX} {y-9} 440 {y+5}" stroke="#0a0604" stroke-width="2" fill="none"></path>')
    a(f'<path d="M -10 {y+2} Q {CX} {y-7} 440 {y+7}" stroke="rgba(255,214,160,.07)" stroke-width="1" fill="none"></path>')
    for bx in (random.randint(20,140), random.randint(200,340)):
        by=y-9*(1-((bx-CX)/300)**2)+4
        a(f'<path d="M {bx} {f(by)} v 24" stroke="#0a0604" stroke-width="1.6"></path>')
        a(f'<circle cx="{bx+6}" cy="{f(by+12)}" r="1.1" fill="#0a0604" opacity=".6"></circle>')
    y+=26
a('<rect x="-10" y="220" width="460" height="1120" fill="url(#sh-wood)" opacity=".6"></rect>')   # pre-tinted wood, normal blending
# grime running down from the windows and the ports
for x in (22,86,150,214,278,70,236):
    top=400 if x in (22,86,150,214,278) else 630
    a(f'<rect x="{x-6}" y="{top}" width="{random.randint(8,16)}" height="{random.randint(60,140)}" fill="#050302" opacity=".28"></rect>')
a('</g>')
# --- carved gilt taffrail and the skull crest
a(f'<path d="M -10 274 Q 150 222 380 258" stroke="#1a1006" stroke-width="16" fill="none"></path>')
a(f'<path d="M -10 272 Q 150 220 380 256" stroke="url(#sh-gilt)" stroke-width="9" fill="none"></path>')
a(f'<path d="M -10 290 Q 150 240 386 276" stroke="#a47c3a" stroke-width="3" fill="none" opacity=".8"></path>')
# rope scrollwork along the rail
for i in range(26):
    x=-6+i*15; yy=274-52*(1-((x-150)/390)**2)*0.9+8 if False else None
a('<path d="M -10 282 Q 150 231 382 266" stroke="#6b4e22" stroke-width="3" stroke-dasharray="3 6" fill="none"></path>')
# crest: skull and crossbones medallion
a(f'''<g transform="translate({CX} 244)">
<ellipse rx="44" ry="30" fill="#1a1006"></ellipse><ellipse rx="40" ry="26" fill="url(#sh-gilt)"></ellipse><ellipse rx="33" ry="20" fill="#2a1a0a"></ellipse>
<path d="M -22 -12 L 22 14 M 22 -12 L -22 14" stroke="#e8d7b0" stroke-width="5" stroke-linecap="round"></path>
<path d="M -11 -2 Q -12 -16 0 -17 Q 12 -16 11 -2 Q 11 4 6 6 L 6 10 L -6 10 L -6 6 Q -11 4 -11 -2 Z" fill="#efe2c2"></path>
<circle cx="-4.5" cy="-5" r="3.2" fill="#1a1006"></circle><circle cx="4.5" cy="-5" r="3.2" fill="#1a1006"></circle>
<path d="M -3 10 v -3 M 0 10 v -3 M 3 10 v -3" stroke="#1a1006" stroke-width="1.2"></path>
</g>''')
# --- upper stern gallery: five lit windows between carved pilasters, a quarter window where the hull turns
def window(cx, top, w, h, lit, broken=False, arch=True):
    x0=cx-w/2
    r=[]
    shape=f"M {f(x0)} {top+h} L {f(x0)} {top+w*0.35} Q {f(cx)} {f(top-w*0.18)} {f(x0+w)} {top+w*0.35} L {f(x0+w)} {top+h} Z" if arch else f"M {f(x0)} {top} h {w} v {h} h {-w} Z"
    r.append(f'<path d="{shape}" fill="#1a1006" transform="translate(0 0) scale(1)" stroke="#1a1006" stroke-width="10"></path>')
    r.append(f'<path d="{shape}" fill="none" stroke="url(#sh-gilt)" stroke-width="4"></path>')
    r.append(f'<path d="{shape}" fill="{"url(#sh-glass)" if lit else "url(#sh-glassdim)"}"></path>')
    # leaded panes
    for k in (1,2):
        r.append(f'<path d="M {f(x0)} {f(top+h*k/3+4)} h {w}" stroke="#2a1606" stroke-width="2.2"></path>')
    r.append(f'<path d="M {f(cx)} {f(top+2)} V {top+h}" stroke="#2a1606" stroke-width="2.2"></path>')
    if lit:
        for k in range(3):
            px=x0+random.choice([0,w/2]); py=top+h*k/3+4
            if random.random()<.45: r.append(f'<rect x="{f(px+1)}" y="{f(py+1)}" width="{f(w/2-2)}" height="{f(h/3-2)}" fill="#7a3a12" opacity=".55"></rect>')
    if broken:
        r.append(f'<path d="M {f(x0+w*.2)} {f(top+h*.2)} l {f(w*.25)} {f(h*.2)} l {f(-w*.1)} {f(h*.18)} l {f(w*.3)} {f(h*.12)}" stroke="#0a0604" stroke-width="2" fill="none"></path>')
    return r
glow=[]
xs=[CX+(i-2)*66 for i in range(5)]
for i,cx in enumerate(xs):
    lit = i!=4
    o.extend(window(cx,312,50,86,lit,broken=(i==3)))
    if lit: glow.append((cx,356,130))
# pilasters
for cx in [CX+(i-2)*66+33 for i in range(-1,5)]:
    if cx>360: continue
    a(f'<rect x="{cx-4}" y="300" width="8" height="100" fill="url(#sh-gilt)" opacity=".75"></rect><rect x="{cx-7}" y="296" width="14" height="6" fill="#a47c3a"></rect>')
o.extend(window(352,318,30,78,False,arch=True))
# gallery balcony: rail, turned balusters, a cap catching the moon on the right
a('<rect x="-10" y="404" width="398" height="8" fill="url(#sh-gilt)"></rect>')
a('<rect x="-10" y="412" width="398" height="26" fill="#0a0604"></rect>')
for x in range(2,388,17):
    a(f'<path d="M {x-3} 412 h 6 l -1 5 q 4 5 2 10 q 3 4 0 11 h -6 q -3 -7 0 -11 q -2 -5 2 -10 Z" fill="#8a6630"></path><path d="M {x+1} 414 v 22" stroke="#d9b56a" stroke-width="1" opacity=".5"></path>')
a('<rect x="-10" y="438" width="404" height="9" fill="#3a2810"></rect><rect x="-10" y="438" width="404" height="3" fill="#c8a25a" opacity=".8"></rect>')
# name board
a(f'''<g transform="translate({CX} 492)">
<path d="M -158 -24 Q -150 -30 -140 -24 L 140 -24 Q 150 -30 158 -24 L 164 0 L 158 24 Q 150 30 140 24 L -140 24 Q -150 30 -158 24 L -164 0 Z" fill="#1a1006"></path>
<path d="M -154 -20 L 154 -20 L 159 0 L 154 20 L -154 20 L -159 0 Z" fill="#4a1410" stroke="url(#sh-gilt)" stroke-width="3"></path>
<text x="0" y="9" text-anchor="middle" font-family="'IM Fell English SC', serif" font-size="28" letter-spacing="5" fill="#e2c07a" style="paint-order: stroke" stroke="#2a0a06" stroke-width="3">THE HUNDRED</text>
</g>''')
# lower cabin windows: smaller, only some lit
for i,cx in enumerate([CX-99, CX-33, CX+33, CX+99]):
    lit = i in (1,2)
    o.extend(window(cx,560,40,62,lit,arch=False))
    if lit: glow.append((cx,591,90))
# heavy wale with gilt edge
a('<path d="M -10 664 Q 150 652 424 668 L 424 690 Q 150 674 -10 686 Z" fill="#0b0705"></path>')
a('<path d="M -10 664 Q 150 652 424 668" stroke="#a47c3a" stroke-width="3" fill="none"></path>')
a('<path d="M -10 686 Q 150 674 424 690" stroke="#5a4020" stroke-width="2" fill="none"></path>')
# stern chasers: two ports, lids hinged up (red inside), bronze muzzles
for cx in (CX-86, CX+86):
    a(f'<path d="M {cx-35} 713 L {cx+35} 713 L {cx+40} 694 L {cx-40} 694 Z" fill="#6a1a12" stroke="#1a0604" stroke-width="2.5"></path>')
    a(f'<path d="M {cx-35} 713 L {cx+35} 713" stroke="#1a0604" stroke-width="4"></path>')
    a(f'<path d="M {cx-24} 713 L {cx-26} 696 M {cx+24} 713 L {cx+26} 696" stroke="#2b3134" stroke-width="4"></path>')
    a(f'<path d="M {cx} 694 Q {cx+6} 680 {cx+14} 672" stroke="#8a7a5a" stroke-width="1.5" fill="none"></path>')
    a(f'<rect x="{cx-32}" y="716" width="64" height="54" fill="#050302" stroke="#3a2810" stroke-width="4"></rect>')
    a(f'<rect x="{cx-32}" y="716" width="64" height="54" fill="url(#sh-glow)" opacity=".5"></rect>')
    a(f'<circle cx="{cx}" cy="744" r="21" fill="url(#sh-bronze)" stroke="#1a0e04" stroke-width="2"></circle>')
    a(f'<circle cx="{cx}" cy="744" r="14" fill="#2a1a0a"></circle><circle cx="{cx}" cy="744" r="10" fill="#020101"></circle>')
    a(f'<path d="M {cx+8} 727 a 19 19 0 0 1 11 11" stroke="#f3dca4" stroke-width="2" fill="none" opacity=".8"></path>')
# rudder: a broad tapered blade standing proud of the transom, short iron hinge straps
a(f'<path d="M {CX-30} 786 L {CX+30} 786 Q {CX+48} 980 {CX+64} 1290 L {CX-40} 1290 Q {CX-38} 980 {CX-30} 786 Z" fill="#000" opacity=".35" transform="translate(9 0)"></path>')
a(f'<path d="M {CX-30} 786 L {CX+30} 786 Q {CX+48} 980 {CX+64} 1290 L {CX-40} 1290 Q {CX-38} 980 {CX-30} 786 Z" fill="#2a1c11" stroke="#070403" stroke-width="3"></path>')
a(f'<path d="M {CX-30} 786 L {CX+30} 786 Q {CX+48} 980 {CX+64} 1290 L {CX-40} 1290 Q {CX-38} 980 {CX-30} 786 Z" fill="url(#sh-wood)" opacity=".8"></path>')
a(f'<path d="M {CX+30} 786 Q {CX+48} 980 {CX+64} 1290" stroke="#a9d8d0" stroke-width="2.5" fill="none" opacity=".6"></path>')
a(f'<rect x="{CX-36}" y="772" width="72" height="16" fill="#120b06" stroke="#070403" stroke-width="2"></rect>')
for y in (812, 872, 932):
    a(f'<path d="M {CX-34} {y} h 26 v 9 h -26 Z" fill="#2b3134" stroke="#0c0e0f" stroke-width="1.5"></path><path d="M {CX-34} {y} h 26" stroke="#9fb8b6" stroke-width="1.5" opacity=".6"></path>')
    a(f'<circle cx="{CX-14}" cy="{y+4.5}" r="2" fill="#0c0e0f"></circle>')
# the quarter turning away: darken toward the edge, then the moon's rim light on it
a(f'<g clip-path="url(#sh-hull)"><rect x="300" y="220" width="130" height="1120" fill="url(#sh-quarter)"></rect></g>')
a(f'<path d="M 380 258 {CONT}" stroke="#bff0e8" stroke-width="12" fill="none" opacity=".1"></path>')
a(f'<path d="M 380 258 {CONT}" stroke="#cdf6ef" stroke-width="2.2" fill="none" opacity=".7"></path>')
a(f'<path d="M 380 258 {CONT}" stroke="#050302" stroke-width="3" fill="none" transform="translate(-4 0)"></path>')
a(f'<path d="{TOP} {CONT} {UNDER}" stroke="#050302" stroke-width="5" fill="none"></path>')
# side gunports where the planks come out, lids propped open (seen edge-on)
for (py,t,s) in ((436,11,.55),(612,17,.75),(826,27,1)):   # = the plank y's in Plank.dc.html
    x=E(py)
    a(f'<rect x="{f(x-18*s)}" y="{f(py-12*s)}" width="{f(22*s)}" height="{f(t+22*s)}" fill="#050302"></rect>')
    a(f'<rect x="{f(x-18*s)}" y="{f(py-12*s)}" width="{f(22*s)}" height="{f(t+22*s)}" fill="url(#sh-glow)" opacity=".9"></rect>')
    a(f'<path d="M {f(x+1)} {f(py-12*s)} l {f(26*s)} {f(-34*s)}" stroke="#5a1410" stroke-width="{f(8*s)}" stroke-linecap="round"></path>')
    a(f'<path d="M {f(x+1)} {f(py-12*s)} l {f(26*s)} {f(-34*s)}" stroke="#1a0604" stroke-width="{f(2*s)}" transform="translate({f(3*s)} {f(1*s)})"></path>')
    a(f'<path d="M {f(x+24*s)} {f(py-44*s)} L {f(x+4)} {f(py-60*s)}" stroke="#6b5a3a" stroke-width="1.5"></path>')
# stern lantern on its bracket at the quarter
a('<path d="M 382 270 L 430 262 M 386 292 L 426 266" stroke="#15181a" stroke-width="5" fill="none" stroke-linecap="round"></path><path d="M 430 262 v 8" stroke="#15181a" stroke-width="3"></path>')
a('''<g transform="translate(430 326) scale(.95)">
<circle r="150" fill="url(#sh-glow)"></circle>
<path d="M -12 -40 L 12 -40 L 8 -48 L -8 -48 Z" fill="#a47c3a"></path><path d="M 0 -48 v -8" stroke="#a47c3a" stroke-width="3"></path>
<path d="M -20 -40 L 20 -40 L 16 -30 L -16 -30 Z" fill="url(#sh-gilt)"></path>
<path d="M -16 -30 L 16 -30 L 20 16 L -20 16 Z" fill="#ffd89a" stroke="#1a1006" stroke-width="3"></path>
<path d="M 0 -30 V 16 M -18 -8 H 18" stroke="#6b4a1a" stroke-width="2"></path>
<path d="M -22 16 L 22 16 L 14 26 L -14 26 Z" fill="url(#sh-gilt)"></path>
<circle cx="0" cy="-6" r="7" fill="#fff4d8"></circle>
</g>''')
# waterline: the hull going under, weed and barnacles, foam hugging it
a(f'<g clip-path="url(#sh-hull)"><rect x="-10" y="930" width="460" height="410" fill="url(#sh-deep)"></rect></g>')
for i in range(40):
    x=random.uniform(-6,E(960)-6); y=random.uniform(950,982)
    a(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(random.uniform(1.5,3.5))}" ry="{f(random.uniform(1.2,2.4))}" fill="#8a9a90" opacity="{f(random.uniform(.35,.7))}"></ellipse>')
foam="M -10 984"
x=-10
while x<E(984)+14:
    x+=random.uniform(10,22); foam+=f" Q {f(x-6)} {f(978+random.uniform(-4,4))} {f(x)} {f(984+random.uniform(-2,3))}"
a(f'<path d="{foam}" stroke="#d8f4ee" stroke-width="5" fill="none" opacity=".55" stroke-linecap="round"></path>')
a(f'<path d="{foam}" stroke="#d8f4ee" stroke-width="14" fill="none" opacity=".08"></path>')
# the sea in front of the hull: a swell over the waterline, then the reflections on it
sea="M -10 1340 L -10 986"
x=-10
while x<560:
    x+=40; sea+=f" Q {x-20} {f(978+random.uniform(-3,3))} {x} {f(988+random.uniform(-2,2))}"
sea+=" L 560 1340 Z"
a(f'<path d="{sea}" fill="url(#sh-under)"></path>')
crest=sea.split(" L 560")[0].replace("M -10 1340 L -10 986","M -10 986")
a(f'<path d="{crest}" stroke="#bfe9e2" stroke-width="2" fill="none" opacity=".35"></path>')
a(f'<path d="M 400 990 q 20 -6 40 0 q 20 6 40 0" stroke="#cdf6ef" stroke-width="2" fill="none" opacity=".25"></path>')
# the lit windows reflected in the water
for (gx,gy,gr) in glow:
    for k in range(7):
        yy=1000+k*11; w=random.uniform(14,34)*(1-k*.08)
        a(f'<rect x="{f(gx-w/2+random.uniform(-6,6))}" y="{yy}" width="{f(w)}" height="3" rx="1.5" fill="#ffb866" opacity="{f(.34-k*.04)}"></rect>')
# window glow spilling out (on top, screen)
for (gx,gy,gr) in glow:
    a(f'<circle cx="{gx}" cy="{gy}" r="{gr}" fill="url(#sh-glow)" opacity=".45"></circle>')   # normal blending: a translucent warm glow
# --- the ensign staff and a small tattered flag. The title ("Walk the Plank", 128px at top-left) ends at
# x~720 with its glyphs' bottom at y~172, so the staff runs UNDER it (y~199 at x=720, ~27px clear) and the flag
# flies clear to its right. Keep FX/FY in sync with the title in Plank.dc.html.
SX,SY=386,258          # the staff's foot, on the taffrail's quarter end
FX,FY=900,166          # the staff's head
a('<g data-part="ensign">')
a(f'<path d="M {SX} {SY} L {FX} {FY}" stroke="#050302" stroke-width="10" stroke-linecap="round"></path>')
a(f'<path d="M {SX} {SY} L {FX} {FY}" stroke="#4a3822" stroke-width="4" stroke-linecap="round"></path>')
a(f'<path d="M {SX+20} {SY-4.5} L {FX-6} {FY-1}" stroke="#a9d8d0" stroke-width="1.6" opacity=".55"></path>')     # moonlit top edge
a(f'<path d="M {SX+6} {SY+6} L {SX+40} {SY+30}" stroke="#15181a" stroke-width="5" stroke-linecap="round"></path>')  # iron heel strap
a(f'<circle cx="{FX+2}" cy="{FY-1}" r="8" fill="url(#sh-gilt)" stroke="#050302" stroke-width="3"></circle>')
# the flag hangs from the head and streams right; the fly end is torn into tongues, with two shot holes
W,H=170,104
fl=(f'M {FX+4} {FY+4} Q {FX+50} {FY-10} {FX+96} {FY+2} Q {FX+136} {FY+12} {FX+W} {FY-2} '
    f'L {FX+W-16} {FY+20} L {FX+W+6} {FY+30} L {FX+W-20} {FY+46} L {FX+W-2} {FY+60} L {FX+W-26} {FY+70} L {FX+W-12} {FY+90} '
    f'Q {FX+120} {FY+H} {FX+84} {FY+H-10} Q {FX+44} {FY+H-22} {FX+6} {FY+H} Z')
a(f'<path d="{fl}" fill="#050506" stroke="#000" stroke-width="8" stroke-linejoin="round"></path>')       # the outline pass
a(f'<path d="{fl}" fill="#141417"></path>')
a(f'<path d="M {FX+10} {FY+60} Q {FX+60} {FY+44} {FX+110} {FY+60} Q {FX+140} {FY+70} {FX+W-24} {FY+62}" stroke="#000" stroke-width="10" fill="none" opacity=".5"></path>')   # a fold
a(f'<path d="M {FX+8} {FY+4} Q {FX+50} {FY-8} {FX+96} {FY+4} Q {FX+134} {FY+13} {FX+W-6} {FY+1}" stroke="#9fd8d0" stroke-width="3" fill="none" opacity=".6"></path>')  # moonlight on the top hem
a(f'<circle cx="{FX+138}" cy="{FY+26}" r="6" fill="#0b2a31" stroke="#000" stroke-width="2"></circle><circle cx="{FX+30}" cy="{FY+84}" r="4.5" fill="#0b2a31" stroke="#000" stroke-width="2"></circle>')  # shot holes (sky through them)
a(f'<g transform="translate({FX+78} {FY+48}) rotate(-5) scale(1.25)">'
  '<path d="M -22 12 L 22 26 M 22 12 L -22 26" stroke="#050506" stroke-width="10" stroke-linecap="round"></path>'
  '<path d="M -22 12 L 22 26 M 22 12 L -22 26" stroke="#efe2c2" stroke-width="6" stroke-linecap="round"></path>'
  '<path d="M -14 -2 Q -15 -21 0 -22 Q 15 -21 14 -2 Q 14 5 8 8 L 8 13 L -8 13 L -8 8 Q -14 5 -14 -2 Z" fill="#efe2c2" stroke="#050506" stroke-width="3"></path>'
  '<circle cx="-5.5" cy="-6" r="4.2" fill="#141417"></circle><circle cx="5.5" cy="-6" r="4.2" fill="#141417"></circle>'
  '<path d="M -4 13 v -4 M 0 13 v -4 M 4 13 v -4" stroke="#141417" stroke-width="1.6"></path></g>')
a('</g>')
a('</svg>')
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'ship.svg'),'w').write('\n'.join(o))
print(len('\n'.join(o)), [round(E(y)) for y in (436,612,826,975)])
