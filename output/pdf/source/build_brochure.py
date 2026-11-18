"""Four-page A5 TermJobs company and investor brochure.
Dependencies: reportlab, numpy, Pillow, pymupdf; fonts: macOS Avenir Next.
The cover sculpture is an original procedurally drawn 3D continuous loop.
"""
from pathlib import Path
import math
import re
import numpy as np
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/pdf/termjobs-brochure-a5.pdf'
TMP=ROOT/'tmp/pdfs'
TMP.mkdir(parents=True,exist_ok=True)
for name,index in [('Regular',7),('Medium',5),('Demi',2),('Bold',0),('Heavy',8)]:
    pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Avenir Next.ttc',subfontIndex=index))
W,H=A5
M=29
CW=W-2*M
BLACK='#050505';WHITE='#FFFFFF';GRAY='#B8B8B8';BODY='#555555';DARKRULE='#363636';RULE='#DCDCDC'

def make_sculpture():
    """A silver continuous loop, projected from a tube around a space curve."""
    n,k=640,112
    t=np.arange(n)*2*np.pi/n
    centers=np.stack([1.75*np.sin(t),.66*np.sin(2*t),.50*np.cos(t)],axis=1)
    tangents=np.stack([1.75*np.cos(t),1.32*np.cos(2*t),-.50*np.sin(t)],axis=1)
    tangents/=np.linalg.norm(tangents,axis=1)[:,None]
    u=np.cross(tangents,np.tile([0.,0.,1.],(n,1)))
    u/=np.linalg.norm(u,axis=1)[:,None]
    v=np.cross(tangents,u)
    angle=np.arange(k)*2*np.pi/k
    normals=u[:,None,:]*np.cos(angle)[None,:,None]+v[:,None,:]*np.sin(angle)[None,:,None]
    points=centers[:,None,:]+.205*normals
    ax,ay,az=[math.radians(a) for a in [21,-13,-9]]
    rx=np.array([[1,0,0],[0,math.cos(ax),-math.sin(ax)],[0,math.sin(ax),math.cos(ax)]])
    ry=np.array([[math.cos(ay),0,math.sin(ay)],[0,1,0],[-math.sin(ay),0,math.cos(ay)]])
    rz=np.array([[math.cos(az),-math.sin(az),0],[math.sin(az),math.cos(az),0],[0,0,1]])
    rot=rz@ry@rx
    points=points@rot.T;normals=normals@rot.T
    nx,ny,nz=normals[:,:,0],normals[:,:,1],normals[:,:,2]
    metal=.08+.22*np.maximum(nz,0)
    metal+=.56*np.exp(-((ny-.28)/.26)**2)*np.maximum(nz,0)**.30
    metal+=.30*np.exp(-((ny+.80)/.095)**2)
    metal+=.17*np.exp(-((nx+.80)/.22)**2)*np.maximum(nz,0)
    shades=np.clip(metal*255,12,250).astype(np.uint8)
    image=Image.new('RGB',(1800,850),(5,5,5));draw=ImageDraw.Draw(image)
    scale=min(1620/np.ptp(points[:,:,0]),710/np.ptp(points[:,:,1]))
    xy=np.stack([900+points[:,:,0]*scale,425-points[:,:,1]*scale],axis=2)
    depths=(points[:,:,2]+np.roll(points,-1,axis=0)[:,:,2]+np.roll(points,-1,axis=1)[:,:,2])/3
    for flat in np.argsort(depths.ravel()):
        i,j=divmod(int(flat),k);i2=(i+1)%n;j2=(j+1)%k
        polygon=[tuple(xy[i,j]),tuple(xy[i2,j]),tuple(xy[i2,j2]),tuple(xy[i,j2])]
        g=int((int(shades[i,j])+int(shades[i2,j])+int(shades[i2,j2])+int(shades[i,j2]))/4)
        draw.polygon(polygon,fill=(g,g,g))
    image.save(TMP/'connection-sculpture.png')
    return TMP/'connection-sculpture.png'

c=canvas.Canvas(str(OUT),pagesize=A5,pageCompression=1)
c.setTitle('TermJobs | Your workforce. Inside your workflow.')
c.setAuthor('TermJobs')
c.setSubject('AI-powered workforce platform | Company and investor brochure')

def rect(x,y,w,h,color,stroke=None,radius=0):
    c.setFillColor(HexColor(color))
    if stroke:c.setStrokeColor(HexColor(stroke));c.setLineWidth(.65)
    if radius:c.roundRect(x,H-y-h,w,h,radius,fill=1,stroke=bool(stroke))
    else:c.rect(x,H-y-h,w,h,fill=1,stroke=bool(stroke))

def line(x,y,x2,y2,color=RULE,width=.6):
    c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.line(x,H-y,x2,H-y2)

def text(s,x,y,size=10,font='Regular',color=BLACK,tracking=0):
    c.saveState();t=c.beginText(x,H-y-size);t.setFont(font,size);t.setCharSpace(tracking)
    t.setFillColor(HexColor(color));t.textOut(s);c.drawText(t);c.restoreState()

def label(s,x,y,color=BODY,size=6.3,tracking=1.2):
    text(s,x,y,size,'Demi',color,tracking)

def para(s,x,y,w,size=10,leading=14,color=BODY,font='Regular'):
    p=Paragraph(s,ParagraphStyle('p',fontName=font,fontSize=size,leading=leading,textColor=HexColor(color)))
    _,h=p.wrap(w,1000);p.drawOn(c,x,H-y-h);return y+h

SVG=(ROOT/'frontend/public/favicon.svg').read_text()

def mark(x,y,size=26,color=BLACK):
    c.saveState();c.translate(x,H-y-size);c.scale(size/340,size/340)
    c.translate(-57,365);c.scale(1,-1);c.setFillColor(HexColor(color))
    for d in re.findall(r'<path d="([^"]+)"',SVG):
        p=c.beginPath()
        for match in re.finditer(r'([ML])\s*([\d.]+),([\d.]+)|(Z)',d):
            if match[4]:p.close()
            elif match[1]=='M':p.moveTo(float(match[2]),float(match[3]))
            else:p.lineTo(float(match[2]),float(match[3]))
        c.drawPath(p,fill=1,stroke=0)
    c.restoreState()

def brand(dark=False):
    color=WHITE if dark else BLACK
    mark(M,23,26,color);label('TERMJOBS',M+34,32,color,9,1.9)

def footer(n,dark=False):
    color=GRAY if dark else BODY
    line(M,559,W-M,559,DARKRULE if dark else RULE)
    label('FIND BETTER. HIRE SMARTER. SCALE FASTER.',M,572,color,5.5,.8)
    text(f'{n:02d}',W-M-12,568,9,'Medium',color)

def page(n,dark=False):
    rect(0,0,W,H,BLACK if dark else WHITE);brand(dark);footer(n,dark)

# 01 / Poster cover with an original metallic connection sculpture.
page(1,True)
sculpture=make_sculpture()
c.drawImage(str(sculpture),-1,H-438,width=W+2,height=168,mask='auto')
label('AI-POWERED WORKFORCE PLATFORM',M,80,GRAY)
text('Your workforce.',M-2,102,38,'Heavy',WHITE,-1.2)
text('Inside your',M-2,144,38,'Heavy',WHITE,-1.2)
text('workflow.',M-2,186,38,'Heavy',WHITE,-1.2)
para('The right talent. The tools you know.<br/>One connected way to get work done.',M,238,335,11,15,GRAY,'Medium')
label('PEOPLE',M,424,GRAY,5.8)
label('INTELLIGENCE',168,424,GRAY,5.8)
label('POSSIBILITY',W-92,424,GRAY,5.8)
line(M,452,W-M,452,DARKRULE)
label('THIS IS TERMJOBS',M,467,WHITE)
para('An AI-assisted hiring and workforce platform connecting companies, staffing partners and talent. From the first hiring requirement to active engagements, TermJobs brings the journey together.',M,485,CW,10.3,14.5,GRAY)
c.showPage()

# 02 / Integration diagram.
page(2)
label('01 / MEET TEAMS WHERE THEY WORK',M,78)
text('Your systems.',M-1,99,32,'Heavy',BLACK,-.85)
text('Now, connected.',M-1,136,32,'Heavy',BLACK,-.85)
para('TermJobs integrates into the communication tools and business systems your team already uses, bringing hiring conversations, updates and actions into their daily workflow.',M,186,CW,10.2,14.5)
text('Create roles. Review talent. Move work forward.',M,240,10,'Demi')
cx,cy=W/2,349
for side in [-1,1]:
    start=cx+side*37;end=141 if side<0 else W-141
    for yy in [288,349,410]:
        p=c.beginPath();p.moveTo(start,H-cy)
        p.curveTo(start+side*31,H-cy,end-side*26,H-yy,end,H-yy)
        c.setStrokeColor(HexColor('#BDBDBD'));c.setLineWidth(.85);c.drawPath(p,stroke=1,fill=0)
for r,col in [(46,'#EAEAEA'),(40,'#D5D5D5')]:
    c.setStrokeColor(HexColor(col));c.setLineWidth(.6);c.circle(cx,H-cy,r,fill=0,stroke=1)
c.setFillColor(HexColor(BLACK));c.circle(cx,H-cy,34,fill=1,stroke=0)
mark(cx-18,cy-24,36,WHITE)
label('TERMJOBS',cx-22,cy+15,WHITE,5,.7)
nodes=[(M,267,'Microsoft Teams','TEAM COLLABORATION'),(M,328,'Zoho Cliq','BUSINESS CHAT'),(M,389,'Telegram','MESSAGING'),(W-M-112,267,'Discord','COMMUNITIES & TEAMS'),(W-M-112,328,'WhatsApp','MESSAGING'),(W-M-112,389,'Existing systems','YOUR BUSINESS TOOLS')]
for x,y,name,desc in nodes:
    rect(x,y,112,42,WHITE,'#CBCBCB',radius=4)
    text(name,x+10,y+8,10,'Demi')
    label(desc,x+10,y+26,BODY,4.7,.55)
rect(M,455,CW,84,BLACK,radius=5)
label('A CONVERSATION CAN START THE JOURNEY',M+13,467,GRAY,5.6,.8)
para('"We need six developers for a six-month project."',M+13,484,CW-26,10.5,14,WHITE,'Demi')
para('TermJobs helps turn the request into a structured hiring workflow.',M+13,511,CW-26,9,12,GRAY)
c.showPage()

# 03 / End-to-end capability and engagement models.
page(3,True)
label('02 / FROM INTENT TO IMPACT',M,78,GRAY)
text('One conversation.',M-1,99,31,'Heavy',WHITE,-.8)
text('An entire journey.',M-1,135,31,'Heavy',WHITE,-.8)
para('AI assists with the preparation and matching.<br/>Your people lead the decisions.',M,185,CW,10.5,15,GRAY)
steps=[
 ('01','Define & discover','Shape requirements, route approvals and bring applications and staffing-partner submissions together.'),
 ('02','Assess & match','Use resume insights, role matching and interview evaluations to understand candidate fit.'),
 ('03','Select & onboard','Connect hiring decisions with work orders, agreement reviews and onboarding steps.'),
 ('04','Manage & grow','Keep timesheets, expenses and vendor billing connected to the engagement.')
]
for i,(num,title,copy) in enumerate(steps):
    y=234+i*51
    line(M,y,W-M,y,DARKRULE)
    text(num,M,y+9,22,'Regular','#7C7C7C',-.5)
    text(title,M+43,y+8,11.5,'Demi',WHITE)
    para(copy,M+43,y+26,CW-43,8.8,12,GRAY)
label('FLEXIBLE WAYS TO BUILD YOUR WORKFORCE',M,456,GRAY,5.7,.9)
cols=[('Direct placement','Talent for permanent roles.'),('Contract workforce','Paid engagements, with a path to permanent roles.'),('Managed teams','Support to supply and manage your workforce.')]
for i,(a,b) in enumerate(cols):
    x=M+i*123
    line(x,478,x+108,478,'#757575')
    text(a,x,489,9.1,'Demi',WHITE)
    para(b,x,507,105,8.5,12,GRAY)
c.showPage()

# 04 / Vision, mission, business opportunity and company/investor calls to action.
page(4)
label('03 / THE FUTURE WE ARE BUILDING',M,78)
text('A world hired',M-1,99,32,'Heavy',BLACK,-.85)
text('on capability.',M-1,136,32,'Heavy',BLACK,-.85)
para('Our vision: skills matter more than job titles. Talent is discovered through capability. Businesses can access the people they need, when they need them.',M,187,CW,10.3,14.5)
rect(M,248,CW,75,BLACK)
label('OUR MISSION',M+13,260,GRAY,6)
para('Make workforce fulfilment simpler, more connected and more responsive to the way businesses grow.',M+13,278,CW-26,11.2,15.5,WHITE,'Medium')
label('ONE PLATFORM. ROOM TO GROW.',M,348,BODY,6.3)
thesis=[('Embedded in work','Meet teams inside the tools they already use.'),('Beyond the hire','Connect hiring with ongoing workforce operations.'),('A shared ecosystem','Bring businesses, staffing partners and talent together.')]
for i,(a,b) in enumerate(thesis):
    x=M+i*123
    text(a,x,369,9.2,'Demi')
    para(b,x,388,107,8.7,12.3)
rect(M,449,CW,94,BLACK,radius=5)
label('FOR COMPANIES',M+13,461,GRAY,5.6,.9)
text('Bring us your workforce challenge.',M+13,474,9.6,'Demi',WHITE)
label('FOR INVESTORS',M+13,497,GRAY,5.6,.9)
text('Explore the platform. Share the vision.',M+13,510,9.6,'Demi',WHITE)
qr=QrCodeWidget('https://www.termjobs.in/');qr.barFillColor=HexColor(BLACK)
b=qr.getBounds();size=60
rect(W-M-77,460,66,66,WHITE,radius=2)
d=Drawing(size,size,transform=[size/(b[2]-b[0]),0,0,size/(b[3]-b[1]),0,0]);d.add(qr)
renderPDF.draw(d,c,W-M-74,H-523)
text('termjobs.in',W-M-71,530,6.7,'Medium',WHITE)
c.linkURL('https://www.termjobs.in/',(M,H-543,W-M,H-449),relative=0)
c.showPage();c.save()

if __name__=='__main__':
    import pymupdf
    doc=pymupdf.open(OUT)
    assert len(doc)==4
    for i,p in enumerate(doc):
        assert abs(p.rect.width-W)<.1 and abs(p.rect.height-H)<.1
        p.get_pixmap(matrix=pymupdf.Matrix(2.5,2.5)).save(TMP/f'premium-page-{i+1}.png')
    print(f'Created {OUT}: {len(doc)} A5 pages')
