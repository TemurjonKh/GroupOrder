# Reads Subway Korea's allergy chart image cell by cell. Rows come from supabase/menus/sources/subway-allergy-chart-rows.json,
# transcribed by hand; each section is divided evenly and marks are classified twice (ring fill and box fill).
# Usage: python3 -I scripts/read-subway-chart.py allergy_img.png rows.json out.json
THR=.965
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB');W,H=im.size;px=im.load()
names=json.load(open(sys.argv[2]))
COLS=["egg","milk","buckwheat","peanut","soy","wheat","mackerel","crab","shrimp","pork","peach","tomato","sulfites","walnut","chicken","beef","squid","shellfish","pine_nut"]
sh=dict(zip(COLS,"난유메땅대밀고게새돼복토황호닭쇠오조잣"))
cx=[386+i*(1502-386)/18 for i in range(19)]
dark=lambda x,y:max(px[x,y])<85
# Section bars: at the far right of the chart the bar is solid dark green, with no text in it.
def bar(y):
    n=sum(1 for x in range(900,1530,6) if px[x,y][0]<50 and 50<px[x,y][1]<110 and px[x,y][2]<70)
    return n>90
ys=[y for y in range(H) if bar(y)]
bars=[]
for y in ys:
    if bars and y-bars[-1][1]<=3: bars[-1][1]=y
    else: bars.append([y,y])
print('bars',bars,file=sys.stderr)
bars=[b for b in bars if b[1]-b[0]>40]
keys=list(names)
assert len(bars)==len(keys),(len(bars),len(keys))
# bottom edge of the last section: last row with green lines
def line(y): return sum(1 for x in range(360,1530,3) if px[x,y][1]>px[x,y][0]+25 and px[x,y][0]<140)>330
last=max(y for y in range(H) if line(y))
out={}
fills={}
for k,(a,b),nxt in zip(keys,bars,[x[0] for x in bars[1:]]+[last]):
    top,bot=b+1,nxt-1;n=len(names[k]);h=(bot-top)/n
    assert 40<h<45,(k,n,h)
    print(k,n,'pitch',round(h,2),file=sys.stderr)
    for i,name in enumerate(names[k]):
        y0=top+i*h;y1=y0+h;m={}
        for c,x0 in zip(COLS,cx):
            pts=[(x,y) for y in range(int(y0)+6,int(y1)-5) for x in range(int(x0)-18,int(x0)+19) if dark(x,y)]
            if len(pts)<25: continue
            xs=[p[0] for p in pts];yy=[p[1] for p in pts]
            mx,my=(min(xs)+max(xs))/2,(min(yy)+max(yy))/2;R=max(max(xs)-min(xs),max(yy)-min(yy))/2
            ring=[0,0]
            for dy in range(-int(R)-1,int(R)+2):
              for dx in range(-int(R)-1,int(R)+2):
                r=math.hypot(dx,dy)/R
                if .62<=r<=.82:
                    ring[1]+=1; ring[0]+=dark(int(mx+dx),int(my+dy))
            m[c]=round(ring[0]/ring[1],2); w=max(xs)-min(xs)+1;hh=max(yy)-min(yy)+1; fills[(k,name,c)]=round(len(pts)/(w*hh),2)
        out[f"{k}/{name}"]=m
vals=sorted(v for r in out.values() for v in r.values())
h=[0]*11
for v in vals:h[int(v*10)]+=1
print('ring fill histogram',h,file=sys.stderr)
res={}
for key,m in out.items():
    res[key]={"contains":[c for c,v in m.items() if v>=THR],"may_contain":[c for c,v in m.items() if v<THR]}
    print(key,''.join(sh[c]+'●' for c in res[key]['contains']),''.join(sh[c]+'★' for c in res[key]['may_contain']))
json.dump(res,open(sys.argv[3],'w'),ensure_ascii=False,indent=0)
print('near threshold',[(k,c,v) for k,m in out.items() for c,v in m.items() if .84<=v<.99],file=sys.stderr)

dis=[(k,c,m[c],fills[(k.split('/')[0],k.split('/',1)[1],c)]) for k,m in out.items() for c in m if (m[c]>=THR)!=(fills[(k.split('/')[0],k.split('/',1)[1],c)]>=.66)]
print('DISAGREE',dis,file=sys.stderr)
print('cells',sum(len(m) for m in out.values()),'contains',sum(len(r['contains']) for r in res.values()),'may',sum(len(r['may_contain']) for r in res.values()),file=sys.stderr)
