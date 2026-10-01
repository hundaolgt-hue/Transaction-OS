// ===================== AMHARIC 20s CUT =====================
const AMSHEETS=__AMSHEETS__.slice(0,80);
h('style',{},document.head,`
.am{font-family:'Noto Sans Ethiopic',sans-serif;letter-spacing:0}
.amh{font-family:'Noto Sans Ethiopic',sans-serif;font-weight:700;font-size:96px;line-height:1.28;letter-spacing:0;color:#fff}
.ameb{font-family:'Noto Sans Ethiopic',sans-serif;font-size:30px;font-weight:600;letter-spacing:.06em;color:var(--amber)}
.amcap{font-family:'Noto Sans Ethiopic',sans-serif;font-size:32px;font-weight:400;color:var(--mute);letter-spacing:0}
.card.amc{left:-175px;width:350px}
.card.amc span{font-family:'Noto Sans Ethiopic',sans-serif;font-size:22px;font-weight:600}
.thead.amt{font-family:'Noto Sans Ethiopic',sans-serif;font-size:19px;letter-spacing:0;text-transform:none}
#bug.amb{font-family:'Noto Sans Ethiopic',sans-serif;letter-spacing:.08em;font-size:22px}
`);
let WA=2.35, WB=3.3, GF=1.0;

// ---------- 1 · HOOK (0–3.3) ----------
scene(0,3.3,(r,s)=>{
 s.cv=h('canvas',{width:W,height:H,class:'abs',style:'left:0;top:0'},r); s.ctx=s.cv.getContext('2d');
 h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;background:radial-gradient(ellipse 70% 20% at 50% 43%,rgba(2,3,7,.85),transparent 75%)'},r);
 s.lines=[words(r,'እያንዳንዱ *ብር።','amh abs center','font-size:116px'),words(r,'እያንዳንዱ *ቀን።','amh abs center','font-size:116px')];
 s.lines.forEach((w,i)=>w.style.top=(680+i*160)+'px');
},(t,lt,s)=>{
 drawGrid(s.ctx,lt);
 s.lines.forEach((w,i)=>{const t0=.3+i*.85; reveal(w,lt,t0,{st:.14,d:1.1,dy:60,bl:22,sc:.04});
   w.style.opacity=(i<1?1-.55*E.ioC(P(lt,t0+.85,t0+1.4)):1)*(1-E.iC(P(lt,2.65,3.25)));});
},{fi:.01,fo:.4,zout:1.12});

// ---------- 2 · LOGO (2.95–6.6) ----------
scene(2.95,6.6,(r,s)=>{
 s.g=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;transform-origin:540px 550px'},r);
 s.glow=h('div',{class:'abs',style:'left:240px;top:250px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(232,164,71,.45),transparent 65%)'},s.g);
 s.svg=h('svg:svg',{width:240,height:240,viewBox:'0 0 240 240',style:'position:absolute;left:420px;top:430px;overflow:visible'},s.g);
 const defs=h('svg:defs',{},s.svg); const lg=h('svg:linearGradient',{id:'lgA',x1:0,y1:0,x2:1,y2:1},defs);
 h('svg:stop',{offset:'0','stop-color':'#FFD596'},lg); h('svg:stop',{offset:'1','stop-color':'#C9781D'},lg);
 s.rect=h('svg:rect',{x:8,y:8,width:224,height:224,rx:56,fill:'none',stroke:'url(#lgA)','stroke-width':7,pathLength:1,'stroke-dasharray':'1 1','stroke-linecap':'round'},s.svg);
 s.inner=h('svg:rect',{x:70,y:70,width:100,height:100,rx:22,fill:'url(#lgA)',style:'transform-origin:120px 120px'},s.svg);
 s.w1=chars(s.g,'ራፋ','abs center grad am','top:715px;font-size:210px;font-weight:700;line-height:1.1');
 s.w2=words(s.g,'የግንባታ ፕሮጀክት / ቁጥጥር ስራዓት','abs center am','top:985px;font-size:74px;font-weight:300;line-height:1.28;color:#E7EBF0');
 s.lat=words(s.g,'RAPHA PROJECTCONTROL','abs center','top:1200px;font-size:24px;font-weight:600;letter-spacing:.34em;color:#8C96A6');
 s.ul=h('div',{class:'abs',style:'left:540px;top:1262px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,#E8A447,transparent)'},s.g);
 s.sub=words(s.g,'የፕሮጀክት ቁጥጥር፣ በአዲስ መልክ።','abs center am','top:1295px;font-size:44px;font-weight:500;color:#C9D1DC');
},(t,lt,s)=>{
 const pd=E.ioC(P(lt,.05,1.05)); s.rect.setAttribute('stroke-dashoffset',(1-pd).toFixed(4));
 const pi=E.oB(P(lt,.7,1.3)); s.inner.style.transform=`scale(${pi}) rotate(${(1-pi)*-90}deg)`; s.inner.style.opacity=C(P(lt,.7,.95));
 s.glow.style.opacity=(.25+.75*E.oC(P(lt,.7,1.8)))*(.85+.15*Math.sin(lt*2));
 s.svg.style.filter=`drop-shadow(0 0 ${(18*E.oC(P(lt,.8,1.8))).toFixed(1)}px rgba(232,164,71,.7))`;
 reveal(s.w1,lt,.75,{st:.12,d:1.2,dy:90,bl:24});
 reveal(s.w2,lt,1.0,{st:.1,d:1.1,dy:50,bl:16});
 reveal(s.lat,lt,1.35,{st:.08,dy:20});
 const pu=E.oE(P(lt,1.45,2.5)); s.ul.style.width=(pu*520)+'px'; s.ul.style.marginLeft=(-pu*260)+'px';
 reveal(s.sub,lt,1.6,{st:.1,d:1.1});
 const zo=E.iC(P(lt,2.95,3.65));
 tf(s.g,{s:1+lt*.015+zo*1.6});
},{fi:.35,fo:.45,zout:1.15});

// ---------- 3 · 80 FORMS (6.3–9.6) ----------
scene(6.3,9.6,(r,s)=>{
 s.top=h('div',{class:'abs',style:'left:0;top:0;width:1080px'},r);
 s.cnt=h('div',{class:'abs center grad tn',style:'top:150px;font-size:330px;font-weight:800;letter-spacing:-.06em;line-height:1'},s.top,'0');
 s.lab=words(s.top,'ፎርሞች። አንድ *ሥርዓት።','abs center amh','top:500px;font-size:84px');
 s.hw=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;perspective:2600px;perspective-origin:540px 600px'},r);
 s.ring=h('div',{class:'abs',style:'left:540px;top:1230px;transform-style:preserve-3d'},s.hw);
 s.cards=AMSHEETS.map(([n,nm])=>h('div',{class:'card amc'},s.ring,`<b>${n}</b><span>${nm}</span>`));
},(t,lt,s)=>{
 s.cnt.textContent=Math.round(80*E.oE(P(lt,.15,1.7)));
 tf(s.cnt,{s:.9+.1*E.oE(P(lt,.1,1.2)),o:E.oC(P(lt,.05,.5)),b:(1-E.oC(P(lt,.05,.6)))*20});
 reveal(s.lab,lt,.55,{st:.12,d:1.1});
 const rot=-30-lt*22;
 s.ring.style.transform=`translateY(${(-45*lt).toFixed(1)}px) rotateX(-14deg) rotateY(${rot.toFixed(2)}deg)`;
 s.cards.forEach((c,i)=>{const a=i*30, pi=E.oE(P(lt,.02+i*.012,.02+i*.012+1.1));
   const R=540+(1-pi)*700, y=(i-36)*16+(1-pi)*-300;
   const cs=Math.cos((a+rot)*Math.PI/180);
   c.style.transform=`rotateY(${a}deg) translateZ(${R.toFixed(1)}px) translateY(${y.toFixed(1)}px)`;
   c.style.opacity=(pi*(.08+.92*Math.pow((cs+1)/2,1.6))).toFixed(3);
   const hl=C((cs-.86)/.14); c.style.borderColor=`rgba(232,164,71,${(.14+.86*hl).toFixed(3)})`;
   c.style.boxShadow=hl>.01?`0 0 ${(40*hl).toFixed(1)}px rgba(232,164,71,${(.45*hl).toFixed(3)})`:'none';});
},{fi:.4,fo:.45});

// ---------- 4 · BOQ (9.3–12.7) ----------
scene(9.3,12.7,(r,s)=>{
 s.eb=words(r,'10 · የተሞላ የሥራ መጠን ዝርዝር','abs center ameb','top:235px');
 s.hd=words(r,'እስከ መጨረሻው ብር / *ድረስ የተሰላ።','abs center amh','top:290px;font-size:84px');
 s.pw=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;perspective:2200px;perspective-origin:540px 900px'},r);
 s.panel=h('div',{class:'abs glass',style:'left:60px;top:560px;width:960px;height:690px;overflow:hidden;transform-origin:50% 40%'},s.pw);
 h('div',{class:'abs',style:'left:0;top:0;width:960px;height:60px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;padding-left:24px'},s.panel,
  '<i style="width:12px;height:12px;border-radius:6px;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:6px;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:6px;background:#28c840"></i><span class="am" style="margin-left:18px;font-size:19px;color:#8C96A6">ራፋ · 10 የሥራ መጠን ዝርዝር</span>');
 const tb=h('div',{class:'tbl',style:'top:60px'},s.panel);
 h('div',{class:'trow thead amt',style:'top:0'},tb,'<div class="c1">ንጥል</div><div class="c2">መግለጫ</div><div class="c3">መለኪያ</div><div class="c4">ብዛት</div><div class="c5">የአንዱ ዋጋ</div><div class="c6">ጠቅላላ ዋጋ</div>');
 s.scan=h('div',{class:'abs',style:'left:0;width:960px;height:70px;background:linear-gradient(90deg,transparent,rgba(232,164,71,.16),transparent)'},tb);
 s.rows=BOQ.map((b,i)=>{const d=h('div',{class:'trow',style:`top:${56+i*70}px;height:70px`},tb,
   `<div class="c1">${b[0]}</div><div class="c2">${b[1]}</div><div class="c3">${b[2]}</div><div class="c4 num">${fmt(b[3])}</div><div class="c5 num">${fmt(b[4])}</div><div class="c6 num">0</div>`);
   d.amt=d.lastChild; d.v=b[3]*b[4]; return d;});
 s.sheen=h('div',{class:'abs',style:'left:-400px;top:-200px;width:300px;height:1200px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);transform:rotate(20deg)'},s.panel);
 s.te=words(r,'የውል ዋጋ · ብር','abs center ameb','top:1345px');
 s.tot=h('div',{class:'abs center grad tn',style:'top:1400px;font-size:150px;font-weight:800;letter-spacing:-.05em;line-height:1'},r,'0');
 s.tc=words(r,'ቫትን ሳይጨምር · 54 ንጥሎች · 12 የሥራ ዘርፎች','abs center amcap','top:1585px');
},(t,lt,s)=>{
 reveal(s.eb,lt,.15,{st:.06,dy:20}); reveal(s.hd,lt,.25,{st:.09,d:1.1});
 const p=E.oQ(P(lt,0,3.4));
 tf(s.panel,{rx:L(30,7,p)+Math.sin(lt*.7)*1.2,ry:L(-24,-5,p),rz:L(6,0,p),z:L(-480,0,p),y:L(200,0,p),o:E.oC(P(lt,.05,.7))});
 s.rows.forEach((d,i)=>{const t0=.45+i*.1, pr=E.oE(P(lt,t0,t0+.9)); tf(d,{x:(1-pr)*140,o:pr,b:(1-pr)*10});
   const pa=E.ioC(P(lt,t0+.25,t0+.95)); d.amt.textContent=fmt(d.v*pa); d.amt.style.color=pa>0&&pa<1?'#FFD596':'#fff';});
 const sp=P(lt,.45,1.75); s.scan.style.top=(56+sp*7*70)+'px'; s.scan.style.opacity=(Math.sin(sp*Math.PI)).toFixed(3);
 s.sheen.style.left=(-400+E.ioC(P(lt,1.4,2.8))*1700)+'px';
 reveal(s.te,lt,1.3,{st:.06,dy:20});
 const pt=E.ioE(P(lt,1.35,2.85)); s.tot.textContent=fmt(CONTRACT*pt);
 const tg=Math.sin(Math.PI*P(lt,2.75,3.4));
 tf(s.tot,{o:E.oC(P(lt,1.3,1.7)),s:1+.04*tg,b:(1-E.oC(P(lt,1.3,1.8)))*14});
 s.tot.style.filter=(s.tot.style.filter==='none'?'':s.tot.style.filter)+` drop-shadow(0 0 ${(30*tg).toFixed(1)}px rgba(232,164,71,.6))`;
 reveal(s.tc,lt,2.1,{st:.06,dy:20});
},{fi:.4,fo:.45});

// ---------- 5 · GANTT (12.4–15.7) ----------
scene(12.4,15.7,(r,s)=>{
 s.eb=words(r,'22 · የሥራ መርሐ ግብር (ጋንት)','abs center ameb','top:235px');
 s.hd=words(r,'46 ተግባራት። / አንድ *ወሳኝ *መስመር።','abs center amh','top:290px;font-size:84px');
 s.pw=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;perspective:2400px;perspective-origin:540px 1000px'},r);
 s.panel=h('div',{class:'abs glass',style:'left:40px;top:540px;width:1000px;height:1000px;overflow:hidden'},s.pw);
 const X0=360; s.dx=d=>X0+d;
 const start=new Date(2025,9,6);
 h('div',{class:'abs',style:'left:0;top:0;width:1000px;height:56px;border-bottom:1px solid rgba(255,255,255,.08)'},s.panel);
 for(let m=0;m<20;m++){const d=new Date(2025,9+m,1); const day=Math.round((d-start)/864e5); if(day<0||day>600) continue;
   const x=s.dx(day); h('div',{class:'abs',style:`left:${x}px;top:56px;width:1px;height:950px;background:rgba(255,255,255,${m%3===0?.07:.03})`},s.panel);
   if(m%3===0) h('div',{class:'abs mono',style:`left:${x+6}px;top:18px;font-size:15px;color:#8C96A6;letter-spacing:.08em`},s.panel,String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2));}
 s.rows=ACT.map((a,i)=>{const d=h('div',{class:'grow',style:`top:${64+i*40}px`},s.panel);
   h('div',{class:'gid',style:a[4]?'color:#E8A447':''},d,a[0]); h('div',{class:'gnm'},d,a[1]);
   if(a[3]===0){d.bar=h('div',{class:'gms',style:`left:${s.dx(a[2])}px;background:${a[4]?'#E8A447':'#9FB6D9'};transform:rotate(45deg)`},d);d.ms=1;}
   else d.bar=h('div',{class:'gbar',style:`left:${s.dx(a[2])}px;width:${a[3]}px;background:${a[4]?'linear-gradient(90deg,#C9781D,#FFC979)':'linear-gradient(90deg,rgba(91,143,232,.6),rgba(170,196,240,.9))'};${a[4]?'box-shadow:0 0 14px rgba(232,164,71,.45)':''}`},d);
   return d;});
 s.svg=h('svg:svg',{width:1000,height:1000,style:'position:absolute;left:0;top:0;overflow:visible'},s.panel);
 let dpath='', prev=null; ACT.forEach((a,i)=>{ if(!a[4]) return; const y=64+i*40+20; if(prev){ dpath+=` L ${s.dx(prev)} ${y} L ${s.dx(a[2])} ${y}`;} else dpath=`M ${s.dx(a[2])} ${y}`; prev=a[2]+a[3]; dpath+=` L ${s.dx(a[2]+a[3])} ${y}`; });
 s.cp=h('svg:path',{d:dpath,fill:'none',stroke:'#FFD596','stroke-width':2.2,pathLength:1,'stroke-dasharray':'1 1','stroke-linejoin':'round',style:'filter:drop-shadow(0 0 6px rgba(232,164,71,.9))'},s.svg);
 s.dd=h('div',{class:'abs',style:'top:56px;width:2px;height:944px;background:linear-gradient(180deg,#fff,rgba(255,255,255,.1));box-shadow:0 0 18px rgba(255,255,255,.6)'},s.panel);
 s.ddl=h('div',{class:'abs am',style:'top:958px;font-size:17px;color:#fff;white-space:nowrap'},s.panel,'የመረጃ ቀን · 30/09/2026');
 s.stats=[["570","ቀናት በውል"],["359","ያለፉ ቀናት"],["63%","ያገለገለ ጊዜ"]].map((st,i)=>{const d=h('div',{class:'abs',style:`left:${60+i*330}px;top:1590px;width:300px;text-align:center`},r,
   `<div class="tn grad" style="font-size:96px;font-weight:800;letter-spacing:-.05em;line-height:1">0</div><div class="amcap" style="font-size:28px;margin-top:12px">${st[1]}</div>`);d.n=d.firstChild;d.v=st[0];return d;});
},(t,lt,s)=>{
 reveal(s.eb,lt,.15,{st:.06,dy:20}); reveal(s.hd,lt,.25,{st:.09,d:1.1});
 const p=E.oQ(P(lt,0,3.3)); tf(s.panel,{rx:L(24,4,p),ry:L(16,2,p),rz:L(-4,0,p),z:L(-400,0,p),o:E.oC(P(lt,.05,.6))});
 s.rows.forEach((d,i)=>{const t0=.35+i*.04, pr=E.oE(P(lt,t0,t0+1.0)); d.style.opacity=E.oC(P(lt,t0-.1,t0+.4));
   if(d.ms) d.bar.style.transform=`rotate(45deg) scale(${E.oB(P(lt,t0,t0+.6))})`; else d.bar.style.transform=`scaleX(${pr.toFixed(4)})`;});
 s.cp.setAttribute('stroke-dashoffset',(1-E.ioC(P(lt,1.1,2.5))).toFixed(4));
 const dd=E.ioC(P(lt,1.4,2.6)); const x=s.dx(359*dd); s.dd.style.left=x+'px'; s.ddl.style.left=(x-100)+'px';
 const pdd=C(P(lt,1.35,1.6)); s.dd.style.opacity=pdd; s.ddl.style.opacity=pdd;
 s.stats.forEach((d,i)=>{const t0=1.8+i*.12, pc=E.ioC(P(lt,t0,t0+1.1)); d.n.textContent=Math.round(parseInt(d.v)*pc)+(d.v.endsWith('%')?'%':'');
   tf(d,{o:E.oC(P(lt,t0-.1,t0+.4)),y:(1-E.oE(P(lt,t0-.1,t0+.8)))*40});});
},{fi:.4,fo:.45});

// ---------- 6 · S-CURVE (15.4–18.2) ----------
scene(15.4,18.2,(r,s)=>{
 s.eb=words(r,'30 · የጊዜያዊ ክፍያ ምስክር ወረቀት','abs center ameb','top:235px');
 s.hd=words(r,'የተሠራው ሥራ፣ / *በትክክል *ይከፈላል።','abs center amh','top:290px;font-size:84px');
 const PX0=110,PX1=1000,PY0=600,PY1=1270, xm=m=>PX0+(PX1-PX0)*m/18, yv=v=>PY1-(PY1-PY0)*v/100;
 s.svg=h('svg:svg',{width:1080,height:1920,style:'position:absolute;left:0;top:0'},r);
 const defs=h('svg:defs',{},s.svg);
 const ag=h('svg:linearGradient',{id:'ag',x1:0,y1:0,x2:0,y2:1},defs); h('svg:stop',{offset:0,'stop-color':'rgba(232,164,71,.45)'},ag); h('svg:stop',{offset:1,'stop-color':'rgba(232,164,71,0)'},ag);
 s.grid=h('svg:g',{},s.svg);
 [0,25,50,75,100].forEach(v=>{h('svg:line',{x1:PX0,x2:PX1,y1:yv(v),y2:yv(v),stroke:'rgba(255,255,255,.08)','stroke-width':1},s.grid);
   const tx=h('svg:text',{x:PX0-16,y:yv(v)+6,'text-anchor':'end',fill:'#8C96A6','font-size':18,'font-family':'JetBrains Mono'},s.grid); tx.textContent=v+'M';});
 ['10/25','01/26','04/26','07/26','10/26','01/27','04/27'].forEach((lb,i)=>{const tx=h('svg:text',{x:xm(i*3),y:PY1+40,'text-anchor':'middle',fill:'#8C96A6','font-size':17,'font-family':'JetBrains Mono'},s.grid);tx.textContent=lb;});
 h('svg:line',{x1:PX0,x2:PX1,y1:yv(94.34),y2:yv(94.34),stroke:'rgba(255,213,150,.45)','stroke-width':1.5,'stroke-dasharray':'6 8'},s.grid);
 const ct=h('svg:text',{x:PX1,y:yv(94.34)-14,'text-anchor':'end',fill:'#FFD596','font-size':21,'font-family':'Noto Sans Ethiopic'},s.grid); ct.textContent='የውል ዋጋ · 94.34M';
 const lg=x=>1/(1+Math.exp(-.52*(x-9.2))); const l0=lg(0),l1=lg(18.6);
 const plan=[];for(let m=0;m<=18.6;m+=.25) plan.push([xm(Math.min(m,18)),yv(94.34*(lg(m)-l0)/(l1-l0))]);
 s.plan=plan; s.planP=h('svg:path',{fill:'none',stroke:'rgba(220,230,245,.55)','stroke-width':3,'stroke-dasharray':'2 9','stroke-linecap':'round'},s.svg);
 s.planL=h('svg:text',{x:xm(14.2)+18,y:yv(80),fill:'rgba(220,230,245,.8)','font-size':24,'font-family':'Noto Sans Ethiopic'},s.svg); s.planL.textContent='የታቀደ';
 s.act=catmull(IPC.map((v,m)=>[xm(m),yv(v)]),30);
 s.area=h('svg:path',{fill:'url(#ag)'},s.svg);
 s.actP=h('svg:path',{fill:'none',stroke:'#FFC979','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round',style:'filter:drop-shadow(0 0 10px rgba(232,164,71,.85))'},s.svg);
 s.drop=h('svg:line',{stroke:'rgba(255,213,150,.5)','stroke-width':1.5,'stroke-dasharray':'3 5'},s.svg);
 s.halo=h('svg:circle',{r:30,fill:'rgba(232,164,71,.25)'},s.svg);
 s.dot=h('svg:circle',{r:11,fill:'#fff',stroke:'#E8A447','stroke-width':4},s.svg);
 s.tag=h('div',{class:'abs mono tn',style:'font-size:22px;color:#1a1206;background:#FFD596;padding:6px 12px;border-radius:10px;white-space:nowrap;font-weight:500'},r,'');
 s.bars=[]; for(let m=1;m<IPC.length;m++){const v=IPC[m]-IPC[m-1]; const bh=v/9.5*120; const b=h('svg:rect',{x:xm(m)-14,y:PY1+70+(130-bh),width:28,height:bh,rx:5,fill:'rgba(91,143,232,.75)',style:`transform-origin:${xm(m)}px ${PY1+200}px`},s.svg); b.m=m; s.bars.push(b);}
 s.bl=h('svg:text',{x:PX0,y:PY1+64,fill:'#8C96A6','font-size':19,'font-family':'Noto Sans Ethiopic'},s.svg); s.bl.textContent='ወርሃዊ ጊዜያዊ ክፍያ · 2 → 12';
 s.big=h('div',{class:'abs center tn acc',style:'top:1530px;font-size:140px;font-weight:800;letter-spacing:-.05em;line-height:1.1'},r,'0.0');
 s.bc=words(r,'ሚሊዮን ብር · እስከ 12ኛው ጊዜያዊ ክፍያ የተለካ','abs center amcap','top:1700px');
 s.PY1=PY1;
},(t,lt,s)=>{
 reveal(s.eb,lt,.15,{st:.06,dy:20}); reveal(s.hd,lt,.25,{st:.09,d:1.1});
 s.grid.style.opacity=E.oC(P(lt,.2,.8));
 const pp=E.ioC(P(lt,.35,1.4)); s.planP.setAttribute('d',toD(partial(s.plan,Math.max(.001,pp)))); s.planL.style.opacity=C(P(lt,1.2,1.5));
 const pa=E.ioS(P(lt,.6,2.2)); const pts=partial(s.act,Math.max(.001,pa)); const hd=pts[pts.length-1];
 s.actP.setAttribute('d',toD(pts)); s.area.setAttribute('d',toD(pts)+` L ${hd[0].toFixed(1)} ${s.PY1} L ${pts[0][0]} ${s.PY1} Z`);
 const vis=C(P(lt,.6,.8)); [s.dot,s.halo,s.drop].forEach(e=>e.style.opacity=vis); s.tag.style.opacity=vis;
 s.dot.setAttribute('cx',hd[0]); s.dot.setAttribute('cy',hd[1]); s.halo.setAttribute('cx',hd[0]); s.halo.setAttribute('cy',hd[1]); s.halo.setAttribute('r',(26+8*Math.sin(lt*5)).toFixed(1));
 s.drop.setAttribute('x1',hd[0]); s.drop.setAttribute('x2',hd[0]); s.drop.setAttribute('y1',hd[1]); s.drop.setAttribute('y2',s.PY1);
 const curV=(s.PY1-hd[1])/(s.PY1-600)*100; s.tag.textContent=curV.toFixed(1)+'M'; s.tag.style.left=(hd[0]-56)+'px'; s.tag.style.top=(hd[1]-74)+'px';
 const mNow=pa*11; s.bars.forEach(b=>{const k=E.oB(C((mNow-b.m+1)*1.4)); b.style.transform=`scaleY(${k.toFixed(3)})`; b.style.fill=(b.m===11&&pa>.98)?'#FFC979':'rgba(91,143,232,.75)';});
 s.bl.style.opacity=E.oC(P(lt,.6,1));
 const pb=E.ioC(P(lt,1.2,2.2)); s.big.textContent=(56.1*pb).toFixed(1);
 tf(s.big,{o:E.oC(P(lt,1.1,1.5)),b:(1-E.oC(P(lt,1.1,1.6)))*14}); reveal(s.bc,lt,1.6,{st:.06,dy:20});
},{fi:.4,fo:.45});

// ---------- 7 · END (17.9–20) ----------
scene(17.9,20.0,(r,s)=>{
 s.glow=h('div',{class:'abs',style:'left:140px;top:200px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(232,164,71,.32),transparent 65%)'},r);
 s.svg=h('svg:svg',{width:180,height:180,viewBox:'0 0 240 240',style:'position:absolute;left:450px;top:470px;overflow:visible;filter:drop-shadow(0 0 16px rgba(232,164,71,.7))'},r);
 const defs=h('svg:defs',{},s.svg); const lg=h('svg:linearGradient',{id:'lgB',x1:0,y1:0,x2:1,y2:1},defs);
 h('svg:stop',{offset:'0','stop-color':'#FFD596'},lg); h('svg:stop',{offset:'1','stop-color':'#C9781D'},lg);
 s.rect=h('svg:rect',{x:8,y:8,width:224,height:224,rx:56,fill:'none',stroke:'url(#lgB)','stroke-width':8,pathLength:1,'stroke-dasharray':'1 1'},s.svg);
 s.inner=h('svg:rect',{x:70,y:70,width:100,height:100,rx:22,fill:'url(#lgB)',style:'transform-origin:120px 120px'},s.svg);
 s.w=chars(r,'ራፋ','abs center grad am','top:680px;font-size:150px;font-weight:700;line-height:1.1');
 s.n=words(r,'የግንባታ ፕሮጀክት / ቁጥጥር ስራዓት','abs center am','top:870px;font-size:58px;font-weight:600;line-height:1.3;color:#fff');
 s.l1=words(r,'እያንዳንዱ ብርና እያንዳንዱ ቀን / የት *እንደሚሄድ *ይወቁ።','abs center am','top:1075px;font-size:46px;font-weight:500;line-height:1.4;color:#C9D1DC');
 s.f2=words(r,'ራፋ ኢንጂነሪንግ እና ኮንሰልቲንግ','abs center am','top:1480px;font-size:30px;color:#8C96A6');
},(t,lt,s)=>{
 s.rect.setAttribute('stroke-dashoffset',(1-E.ioC(P(lt,0,.8))).toFixed(4));
 const pi=E.oB(P(lt,.45,1.0)); s.inner.style.transform=`scale(${pi})`; s.inner.style.opacity=C(P(lt,.45,.65));
 s.glow.style.opacity=E.oC(P(lt,.2,1.2))*(.85+.15*Math.sin(lt*2));
 reveal(s.w,lt,.25,{st:.12,d:1.1,dy:60,bl:20}); reveal(s.n,lt,.45,{st:.08,d:1.0});
 reveal(s.l1,lt,.7,{st:.07,d:1.0}); reveal(s.f2,lt,1.0,{st:.08,dy:16});
},{fi:.35,fo:.55,zout:1});

// ===================== OVERLAYS =====================
const bug=h('div',{id:'bug',class:'amb'},stage,'<b>▣</b>&nbsp;&nbsp;ራፋ የግንባታ ፕሮጀክት ቁጥጥር ስራዓት');
h('div',{id:'vig'},stage);
const flash=h('div',{class:'abs',style:'inset:0;background:#fff;opacity:0;mix-blend-mode:screen'},stage);
window.renderAt=function(t){
 const a=t*.18;
 tf(orbs[0],{x:200+Math.sin(a)*160,y:300+Math.cos(a*.8)*140});
 tf(orbs[1],{x:880+Math.cos(a*.9)*150,y:1650+Math.sin(a*1.1)*120,o:.55+.45*Math.sin(t*.5)});
 tf(orbs[2],{x:540+Math.sin(a*.6)*220,y:1000+Math.cos(a*.5)*260});
 bg.style.opacity=C(P(t,.3,1.5))*(1-P(t,19.3,20));
 for(const s of scenes){
  if(t<s.a||t>s.b){s.root.style.display='none';continue;}
  s.root.style.display='block';
  const lt=t-s.a, ei=E.oC(P(t,s.a,s.a+s.fi)), eo=E.iC(P(t,s.b-s.fo,s.b));
  s.root.style.opacity=(ei*(1-eo)).toFixed(4);
  s.root.style.transform=`scale(${(L(s.zin,1,ei)*L(1,s.zout,eo)).toFixed(4)})`;
  const bl=(1-ei)*12+eo*16; s.root.style.filter=bl>.1?`blur(${bl.toFixed(2)}px)`:'none';
  s.update(t,lt,s);
 }
 bug.style.opacity=(C(P(t,6.8,7.4))*(1-C(P(t,17.5,17.9)))*.9).toFixed(3);
 const f1=Math.max(0,1-Math.abs(t-3.15)/0.28)*.5, f2=Math.max(0,1-Math.abs(t-6.45)/0.25)*.22;
 flash.style.opacity=(f1+f2).toFixed(3);
};
window.DURATION=20;
document.fonts.ready.then(()=>{window.READY=true;});
</script></body></html>
