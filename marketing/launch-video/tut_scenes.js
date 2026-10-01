// ===================== 50s TUTORIAL =====================
h('style',{},document.head,`
.am{font-family:'Noto Sans Ethiopic',sans-serif;letter-spacing:0}
.tt{font-weight:700;font-size:82px;line-height:1.06;letter-spacing:-.04em;color:#fff}
.tam{font-family:'Noto Sans Ethiopic',sans-serif;font-size:34px;font-weight:500;color:#E8A447;letter-spacing:0}
.shot{border-radius:26px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 50px 140px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.06)}
.shot img{image-rendering:auto}
.tag{position:absolute;left:84px;height:52px;padding:0 20px;border-radius:14px;background:rgba(10,18,32,.86);border:1px solid rgba(232,164,71,.6);color:#FFD596;
  font-family:'JetBrains Mono';font-size:22px;display:flex;align-items:center;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.hl{position:absolute;border:3px solid #FFB547;border-radius:8px;box-shadow:0 0 0 4000px rgba(4,9,18,.42),0 0 26px rgba(255,181,71,.9),inset 0 0 14px rgba(255,181,71,.35)}
.bl{position:absolute;left:70px;width:940px;display:flex;gap:24px;align-items:flex-start}
.bl i{font-style:normal;flex:none;width:52px;height:52px;border-radius:26px;background:linear-gradient(160deg,#FFD596,#C9781D);color:#1a1206;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center;margin-top:2px;box-shadow:0 0 22px rgba(232,164,71,.45)}
.bl span{font-size:35px;line-height:1.3;font-weight:500;color:#E9EDF2;letter-spacing:-.012em}
.bl span b{color:#fff;font-weight:700}
.rail{position:absolute;left:70px;top:1782px;width:940px;height:6px;display:flex;gap:8px}
.rail div{flex:1;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;position:relative}
.rail div i{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#C9781D,#FFD596);transform-origin:0 50%}
.rlab{position:absolute;left:0;width:1080px;top:1806px;text-align:center;font-family:'JetBrains Mono';font-size:19px;letter-spacing:.24em;color:rgba(255,255,255,.5);text-transform:uppercase}
.node{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:75px;display:flex;align-items:center;justify-content:center;font-size:62px;font-weight:800;
  background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.18);color:rgba(255,255,255,.5)}
.nlab{position:absolute;width:300px;margin-left:-150px;text-align:center;font-size:30px;font-weight:600;line-height:1.2;letter-spacing:-.01em}
.nlab em{display:block;font-style:normal;font-family:'JetBrains Mono';font-size:19px;color:#E8A447;font-weight:500;margin-top:8px;letter-spacing:.06em}
.rule{position:absolute;left:90px;width:900px;height:84px;border-radius:20px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;padding:0 26px;gap:22px}
.rule span{flex:1;font-size:32px;font-weight:500}
.rule b{width:120px;height:46px;border-radius:23px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';font-size:20px;font-weight:500}
`);
const IMG={start:[1145,1208],setup:[1138,841],contract:[1141,790],boq:[1129,1250],activities:[1640,853],gantt:[1700,672],cashflow:[1642,835],ipc:[1139,1293],dashboard:[821,1096],parties:[1118,301],lookahead:[1065,1103],diary:[1645,639],docreg:[1115,691],owner:[1124,1201]};
const VW=960;
function shot(parent,name,{crop,top=470,hh=820}={}){
 const [W,H]=IMG[name]; const [x0,y0,cw,ch]=crop||[0,0,W,H];
 const wrap=h('div',{class:'abs',style:`left:0;top:0;width:1080px;height:1920px;perspective:2400px;perspective-origin:540px ${top+hh/2}px`},parent);
 const card=h('div',{class:'abs shot',style:`left:60px;top:${top}px;width:${VW}px;height:${hh}px`},wrap);
 const inner=h('div',{class:'abs',style:`left:0;top:0;width:${cw}px;height:${ch}px;overflow:hidden;transform-origin:0 0`},card);
 h('img',{src:`tut/${name}.jpg`,style:`position:absolute;left:${-x0}px;top:${-y0}px;width:${W}px;height:${H}px`},inner);
 const glare=h('div',{class:'abs',style:`left:-500px;top:-300px;width:340px;height:${hh+600}px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:rotate(18deg);mix-blend-mode:soft-light`},card);
 return {wrap,card,inner,glare,x0,y0,cw,ch,hh,hls:[],cx:x0+cw/2,cy:y0+ch/2,z:1};
}
function hl(sh,x,y,w,hgt,a,b){const d=h('div',{class:'hl',style:`left:${x-sh.x0}px;top:${y-sh.y0}px;width:${w}px;height:${hgt}px;opacity:0`},sh.inner); d.a=a; d.b=b; sh.hls.push(d); return d;}
function camera(sh,lt,moves,start){
 let [cx,cy,z]=start||[sh.x0+sh.cw/2,sh.y0+sh.ch/2,1];
 for(const m of moves){const e=E.ioC(P(lt,m[0],m[1])); if(e<=0) break; cx=L(cx,m[2],e); cy=L(cy,m[3],e); z=L(z,m[4],e);}
 const s=VW/sh.cw*z;
 let tx=VW/2-(cx-sh.x0)*s, ty=sh.hh/2-(cy-sh.y0)*s;
 const iw=sh.cw*s, ih=sh.ch*s;
 tx= iw>=VW? C(tx,VW-iw,0) : (VW-iw)/2;
 ty= ih>=sh.hh? C(ty,sh.hh-ih,0) : (sh.hh-ih)/2;
 sh.inner.style.transform=`translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
 sh.hls.forEach(d=>{const pin=E.oE(P(lt,d.a,d.a+.55)), pout=E.iC(P(lt,d.b-.35,d.b)); const o=pin*(1-pout);
   d.style.opacity=o.toFixed(3); d.style.borderWidth=(3/s).toFixed(2)+'px'; d.style.borderRadius=(8/s).toFixed(2)+'px';
   d.style.transform=`scale(${(1.25-.25*pin).toFixed(4)})`;});
}
function cardIn(sh,lt,{rx=24,ry=-14,dur=2.2,glareAt=1.6}={}){
 const p=E.oQ(P(lt,0,dur));
 tf(sh.card,{rx:L(rx,0,p)+Math.sin(lt*.6)*.8,ry:L(ry,0,p),z:L(-420,0,p),y:L(180,0,p),o:E.oC(P(lt,.05,.6))});
 sh.glare.style.left=(-500+E.ioC(P(lt,glareAt,glareAt+1.4))*1800)+'px';
}
function bullets(parent,list,top=1340,gap=118){return list.map((tx,i)=>h('div',{class:'bl',style:`top:${top+i*gap}px`},parent,`<i>${i+1}</i><span>${tx}</span>`));}
function showBullets(bs,lt,times){bs.forEach((d,i)=>{const p=E.oE(P(lt,times[i],times[i]+1.0)); tf(d,{x:(1-p)*60,o:p,b:(1-p)*10});});}
function header(r,eb,title,am){
 const s={};
 s.eb=words(r,eb,'abs center eyebrow','top:190px;font-size:22px');
 s.t=words(r,title,'abs center tt','top:236px');
 s.am=words(r,am,'abs center tam','top:340px');
 return s;}
function showHeader(hd,lt){reveal(hd.eb,lt,.1,{st:.04,dy:16}); reveal(hd.t,lt,.18,{st:.07,d:1.1}); reveal(hd.am,lt,.45,{st:.07,d:1.0,dy:24});}
function tagChip(r,text,top){return h('div',{class:'tag',style:`top:${top}px`},r,`<span style="color:#E8A447">▣</span>${text}`);}
function showTag(tg,lt,t0=.7){const p=E.oB(P(lt,t0,t0+.7)); tf(tg,{s:.6+.4*p,o:C(P(lt,t0,t0+.3))});}

// ---------- 0 · INTRO (0–4.3) ----------
scene(0,4.3,(r,s)=>{
 s.fl=['boq','gantt','ipc','dashboard','cashflow','setup'].map((n,i)=>{const [W,H]=IMG[n]; const w=420, hh=w*H/W;
   const d=h('div',{class:'abs shot',style:`left:${[40,620,-60,700,120,560][i]}px;top:${[160,260,980,1080,1500,1600][i]}px;width:${w}px;height:${hh}px;border-radius:16px`},r);
   h('img',{src:`tut/${n}.jpg`,style:'width:100%;height:100%'},d); d.i=i; return d;});
 s.shade=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;background:radial-gradient(ellipse 75% 32% at 50% 48%,rgba(2,3,7,.94),rgba(2,3,7,.55) 70%,rgba(2,3,7,.35))'},r);
 s.svg=h('svg:svg',{width:120,height:120,viewBox:'0 0 240 240',style:'position:absolute;left:480px;top:560px;overflow:visible;filter:drop-shadow(0 0 14px rgba(232,164,71,.7))'},r);
 const defs=h('svg:defs',{},s.svg); const lg=h('svg:linearGradient',{id:'lgT',x1:0,y1:0,x2:1,y2:1},defs);
 h('svg:stop',{offset:'0','stop-color':'#FFD596'},lg); h('svg:stop',{offset:'1','stop-color':'#C9781D'},lg);
 s.rect=h('svg:rect',{x:8,y:8,width:224,height:224,rx:56,fill:'none',stroke:'url(#lgT)','stroke-width':10,pathLength:1,'stroke-dasharray':'1 1'},s.svg);
 s.inner=h('svg:rect',{x:70,y:70,width:100,height:100,rx:22,fill:'url(#lgT)',style:'transform-origin:120px 120px'},s.svg);
 s.eb=words(r,'Tutorial · መማሪያ','abs center eyebrow','top:720px;font-size:24px');
 s.t=words(r,'Run a building project / from award to / *final *account.','abs center tt','top:775px;font-size:84px');
 s.sub=words(r,'One linked workbook. Type each fact once.','abs center cap','top:1060px;font-size:36px;color:#C9D1DC');
},(t,lt,s)=>{
 s.fl.forEach(d=>{const i=d.i, p=E.oE(P(lt,.0+i*.08,1.6+i*.08));
   tf(d,{x:Math.sin(lt*.3+i)*14,y:(1-p)*120-lt*(10+i*3),rz:[-8,6,7,-6,5,-7][i],s:.85+.15*p,o:p*.55,b:3+ (i%2)*2});});
 s.rect.setAttribute('stroke-dashoffset',(1-E.ioC(P(lt,.1,1.0))).toFixed(4));
 const pi=E.oB(P(lt,.6,1.2)); s.inner.style.transform=`scale(${pi})`; s.inner.style.opacity=C(P(lt,.6,.8));
 reveal(s.eb,lt,.5,{st:.05,dy:16}); reveal(s.t,lt,.7,{st:.07,d:1.2}); reveal(s.sub,lt,1.7,{st:.06,dy:20});
},{fi:.3,fo:.5});

// ---------- 1 · START HERE (4.0–8.7) ----------
scene(4.0,8.7,(r,s)=>{
 s.hd=header(r,'00 Start · Finding your way around','Start here.','እዚህ ይጀምሩ');
 s.sh=shot(r,'start',{top:460,hh:800});
 hl(s.sh,585,150,540,152,1.5,2.9); hl(s.sh,30,528,1100,352,3.1,4.6);
 s.tag=tagChip(r,'00 Start',430);
 s.bs=bullets(r,['<b>All checks pass</b> turns green when every rule on 09 Check is met.','One tile per sheet, grouped by phase. <b>Click to jump.</b>','Type only in the <b>cream cells</b>. Black text is a formula.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[1.2,2.1,855,225,1.75],[2.8,3.6,580,720,1.12]],[572,500,1]);
 showBullets(s.bs,lt,[1.6,3.1,3.7]);
});

// ---------- 2 · STEP 1 SETUP (8.4–13.1) ----------
scene(8.4,13.1,(r,s)=>{
 s.hd=header(r,'Step 1 of 5 · One-time setup','Set up the project.','ደረጃ 1 — ፕሮጀክቱን ማዘጋጀት');
 s.sh=shot(r,'setup',{crop:[0,0,845,841],top:460,hh:800});
 hl(s.sh,30,106,335,46,1.4,2.5); hl(s.sh,30,180,362,92,2.4,3.4); hl(s.sh,30,296,362,58,3.3,4.6);
 s.tag=tagChip(r,'02 Setup',430);
 s.bs=bullets(r,['Choose the language: <b>English, Amharic or Both</b>.','Type the company, project, location and contract no.','Pick the working week. Set the <b>data date</b> each month.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[1.0,1.7,260,140,1.55],[2.2,2.8,260,230,1.55],[3.1,3.7,260,330,1.55]],[422,300,1]);
 showBullets(s.bs,lt,[1.4,2.4,3.3]);
});

// ---------- 3 · STEP 2 CONTRACT (12.8–17.5) ----------
scene(12.8,17.5,(r,s)=>{
 s.hd=header(r,'Step 2 of 5 · One-time setup','Contract data & parties.','ደረጃ 2 — የውል መረጃ እና ተዋዋዮች');
 s.sh=shot(r,'contract',{crop:[0,0,705,790],top:460,hh:800});
 hl(s.sh,30,374,345,322,1.5,3.2); hl(s.sh,30,258,345,22,3.2,4.6);
 s.tag=tagChip(r,'03 Contract Data',430);
 s.bs=bullets(r,['Contract sum, advance, retention, LDs and VAT, <b>exactly as the contract</b>.','The <b>completion date</b> calculates itself.','Fill 04 Parties: letters and forms take names from here.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[1.0,1.8,250,520,1.45],[2.9,3.6,250,250,1.6]],[352,395,1]);
 showBullets(s.bs,lt,[1.5,3.1,3.7]);
});

// ---------- 4 · STEP 3 BOQ (17.2–21.9) ----------
scene(17.2,21.9,(r,s)=>{
 s.hd=header(r,'Step 3 of 5 · Scope and cost','The priced BOQ.','ደረጃ 3 — የዋጋ ዝርዝር (BOQ)');
 s.sh=shot(r,'boq',{top:460,hh:800});
 hl(s.sh,24,309,920,27,1.3,2.5); hl(s.sh,24,815,1098,27,2.4,3.5); hl(s.sh,120,968,1002,26,3.4,4.6);
 s.tag=tagChip(r,'10 BOQ',430);
 s.bs=bullets(r,['One line per item, <b>exactly as tendered</b>.','<b>B2-C-03</b> = bill 2, concrete, item 3.','11 BOQ Summary prints the collection, <b>ready to sign</b>.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[.9,1.6,420,330,1.55],[2.0,2.7,560,830,1.25],[3.0,3.6,620,960,1.25]],[565,420,1]);
 showBullets(s.bs,lt,[1.3,2.4,3.4]);
});

// ---------- 5 · STEP 4 PROGRAMME (21.6–26.5) ----------
scene(21.6,26.5,(r,s)=>{
 s.hd=header(r,'Step 4 of 5 · Planning and time','Build the programme.','ደረጃ 4 — የሥራ መርሐ ግብሩን ማዘጋጀት');
 s.sh=shot(r,'activities',{top:460,hh:800});
 hl(s.sh,1205,172,96,580,1.2,2.6);
 s.sg=shot(r,'gantt',{crop:[0,0,1700,672],top:460,hh:800});
 hl(s.sg,1080,440,345,140,3.4,4.8);
 s.tag=tagChip(r,'20 Activities',430); s.tag2=tagChip(r,'22 Gantt',430);
 s.bs=bullets(r,['List activities, crews and up to <b>four predecessors</b>.','21 CPM finds dates, float and the <b>critical path</b>, in plain formulas.','22 Gantt draws it. Approve it, then <b>save the baseline</b>.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[.9,1.7,1120,440,1.95]],[600,430,1.65]);
 const sw=E.ioC(P(lt,2.4,3.0));
 s.sh.wrap.style.opacity=(1-sw).toFixed(3); s.tag.style.opacity=(C(P(lt,.7,1))*(1-sw)).toFixed(3);
 tf(s.sg.card,{o:sw,s:L(1.08,1,E.oQ(P(lt,2.4,3.4))),b:(1-sw)*12}); s.sg.glare.style.left=(-500+E.ioC(P(lt,3.2,4.4))*1800)+'px';
 s.tag2.style.opacity=sw.toFixed(3);
 camera(s.sg,lt,[[2.4,4.4,1180,470,2.4]],[800,400,2.15]);
 showBullets(s.bs,lt,[1.2,2.6,3.5]);
});

// ---------- 6 · STEP 5 COST-LOAD (26.2–30.9) ----------
scene(26.2,30.9,(r,s)=>{
 s.hd=header(r,'Step 5 of 5 · Scope and cost','Cost-load the programme.','ደረጃ 5 — ወጪን ከተግባራት ጋር ማገናኘት');
 s.sh=shot(r,'cashflow',{crop:[0,0,1520,835],top:460,hh:800});
 hl(s.sh,440,140,318,262,1.6,3.0); hl(s.sh,598,140,160,262,3.0,4.6);
 s.tag=tagChip(r,'16 WBS Map → 38 Cash Flow',430);
 s.bs=bullets(r,['16 WBS Map links each BOQ item to its activities, <b>with a % share</b>.','That builds the <b>planned value curve</b> and cash-flow forecast.','Log actual costs on 17. <b>18 Cost Report</b> compares them.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[1.0,1.9,600,290,1.7],[2.8,3.6,690,300,1.85]],[380,300,1.55]);
 showBullets(s.bs,lt,[1.5,2.8,3.6]);
});

// ---------- 7 · MONTHLY CYCLE (30.6–37.9) ----------
scene(30.6,37.9,(r,s)=>{
 s.hd=header(r,'Every month','Five steps. Every month.','ወርሃዊ ዑደት');
 s.ringG=h('div',{class:'abs',style:'left:0;top:0;width:1080px;height:1920px;transform-origin:540px 950px'},r);
 const CX=540,CY=950,R=300; s.CX=CX;s.CY=CY;s.R=R;
 s.svg=h('svg:svg',{width:1080,height:1920,style:'position:absolute;left:0;top:0'},s.ringG);
 h('svg:circle',{cx:CX,cy:CY,r:R,fill:'none',stroke:'rgba(255,255,255,.08)','stroke-width':6},s.svg);
 s.arc=h('svg:circle',{cx:CX,cy:CY,r:R,fill:'none',stroke:'#FFC979','stroke-width':6,pathLength:1,'stroke-dasharray':'0 1','stroke-linecap':'round',style:`transform-origin:${CX}px ${CY}px;transform:rotate(-90deg);filter:drop-shadow(0 0 10px rgba(232,164,71,.9))`},s.svg);
 s.comet=h('svg:circle',{r:14,fill:'#fff',style:'filter:drop-shadow(0 0 14px #FFB547)'},s.svg);
 const ST=[['Set the data date','02 Setup'],['Update progress','20 Activities'],['Add measurements','31 Measurement'],['Set the IPC No. & print','30 IPC'],['Check, then issue','09 Check']];
 s.nodes=ST.map((st,i)=>{const a=-Math.PI/2+i*2*Math.PI/5, x=CX+R*Math.cos(a), y=CY+R*Math.sin(a);
   const n=h('div',{class:'node',style:`left:${x}px;top:${y}px`},s.ringG,String(i+1));
   const LP=[[540,470],[905,985],[790,1300],[290,1300],[175,985]][i];
   const lb=h('div',{class:'nlab',style:`left:${LP[0]}px;top:${LP[1]}px`},s.ringG,`${st[0]}<em>${st[1]}</em>`);
   n.lb=lb; return n;});
 s.center=h('div',{class:'abs center',style:'top:880px'},s.ringG,'<div class="tn grad" style="font-size:120px;font-weight:800;letter-spacing:-.05em;line-height:1">0/5</div>');
 s.cn=s.center.firstChild;
 s.sh=shot(r,'ipc',{top:470,hh:860});
 hl(s.sh,35,870,1098,25,5.2,7.3); hl(s.sh,100,895,830,26,6.0,7.3);
 s.tag=tagChip(r,'30 IPC',440);
 s.cap=words(r,'The certificate, ledger, cash flow, reports and dashboard *update *themselves.','abs center','top:1400px;width:920px;left:80px;font-size:40px;font-weight:600;line-height:1.3;color:#E9EDF2;letter-spacing:-.015em');
},(t,lt,s)=>{
 showHeader(s.hd,lt);
 const pr=E.ioS(P(lt,.7,4.0));
 s.arc.setAttribute('stroke-dasharray',`${pr.toFixed(4)} 1`);
 const a=-Math.PI/2+pr*2*Math.PI; s.comet.setAttribute('cx',s.CX+s.R*Math.cos(a)); s.comet.setAttribute('cy',s.CY+s.R*Math.sin(a)); s.comet.style.opacity=C(P(lt,.6,.8))*(1-C(P(lt,4.0,4.3)));
 let lit=0;
 s.nodes.forEach((n,i)=>{const ti=.7+3.3*(i/5); const p=E.oB(P(lt,ti,ti+.5)); const on=lt>=ti; if(on) lit++;
   n.style.background=on?'linear-gradient(160deg,#FFD596,#C9781D)':'rgba(255,255,255,.05)'; n.style.color=on?'#1a1206':'rgba(255,255,255,.5)';
   n.style.borderColor=on?'rgba(255,213,150,.9)':'rgba(255,255,255,.18)'; n.style.boxShadow=on?'0 0 40px rgba(232,164,71,.6)':'none';
   tf(n,{s:on?1+.12*Math.sin(Math.PI*C(P(lt,ti,ti+.5))):(.8+.2*E.oE(P(lt,.2+i*.08,.9+i*.08))),o:E.oC(P(lt,.2+i*.08,.7+i*.08))});
   tf(n.lb,{o:on?1:.35*E.oC(P(lt,.3+i*.08,.8+i*.08)),y:(1-E.oE(P(lt,ti-.1,ti+.6)))*16});});
 s.cn.textContent=lit+'/5';
 const k=E.ioC(P(lt,4.2,5.0));
 tf(s.ringG,{s:1-.35*k,y:-260*k,o:1-k,b:10*k});
 tf(s.sh.card,{o:k,y:(1-E.oQ(P(lt,4.2,5.6)))*500,rx:(1-E.oQ(P(lt,4.2,5.6)))*22});
 s.sh.wrap.style.display=k>0?'block':'none'; s.tag.style.display=k>0?'flex':'none';
 showTag(s.tag,lt,4.7); s.sh.glare.style.left=(-500+E.ioC(P(lt,5.4,6.6))*1800)+'px';
 camera(s.sh,lt,[[4.9,5.9,580,860,1.4]],[570,560,1]);
 reveal(s.cap,lt,5.4,{st:.06,dy:24});
});

// ---------- 8 · CHECK (37.6–42.3) ----------
scene(37.6,42.3,(r,s)=>{
 s.hd=header(r,'09 Check · Quality control','Check before you issue.','ማንኛውንም ሰነድ ከማውጣትዎ በፊት ያረጋግጡ');
 const R=['Predecessors listed in order','No open-ended activities','No negative float','Every BOQ item mapped to activities','WBS shares add up to 100%','Measurements on known items','IPC arithmetic'];
 s.rules=R.map((tx,i)=>{const d=h('div',{class:'rule',style:`top:${470+i*100}px`},r,`<span>${tx}</span><b>FIX</b>`); d.b=d.querySelector('b'); return d;});
 s.pill=h('div',{class:'abs',style:'left:140px;top:1215px;width:800px;height:130px;border-radius:65px;background:linear-gradient(160deg,rgba(46,125,79,.95),rgba(29,92,56,.95));display:flex;align-items:center;justify-content:center;gap:22px;font-size:54px;font-weight:700;color:#fff;letter-spacing:-.03em;box-shadow:0 0 60px rgba(46,170,100,.45)'},r,'<span style="font-size:60px">✓</span> All checks pass');
 s.bs=bullets(r,['<b>50+ rules</b> run every time the workbook calculates.','Anything red shows here and on 00 Start. <b>Fix it, then print.</b>'],1420,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt);
 s.rules.forEach((d,i)=>{const t0=.5+i*.09, p=E.oE(P(lt,t0,t0+.9)); tf(d,{x:(1-p)*80,o:p,b:(1-p)*8});
   const ok=lt>1.5+i*.22; d.b.textContent=ok?'OK':'FIX';
   d.b.style.background=ok?'rgba(46,170,100,.22)':'rgba(220,70,60,.22)'; d.b.style.color=ok?'#7BE0A6':'#FF8A80';
   d.b.style.border=ok?'1px solid rgba(123,224,166,.6)':'1px solid rgba(255,138,128,.6)';
   const pop=Math.sin(Math.PI*C(P(lt,1.5+i*.22,1.75+i*.22))); d.b.style.transform=`scale(${1+.18*pop})`;});
 const pp=E.oB(P(lt,3.1,3.8)); tf(s.pill,{s:.7+.3*pp,o:C(P(lt,3.1,3.35))});
 showBullets(s.bs,lt,[1.0,3.4]);
});

// ---------- 9 · DASHBOARD (42.0–46.7) ----------
scene(42.0,46.7,(r,s)=>{
 s.hd=header(r,'01 Dashboard · Reporting','One page. Four questions.','ሪፖርት እና ዳሽቦርድ');
 s.sh=shot(r,'dashboard',{top:460,hh:800});
 hl(s.sh,28,140,770,78,1.2,2.4); hl(s.sh,28,230,420,282,2.3,3.4); hl(s.sh,734,108,62,20,3.4,4.6);
 s.tag=tagChip(r,'01 Dashboard',430);
 s.bs=bullets(r,['On time? On budget? Getting paid? <b>Safe?</b>','Six KPI tiles, the S-curve, critical activities and alerts.','Switch <b>View → Owner</b> before sending. Your costs stay private.'],1325,128);
},(t,lt,s)=>{
 showHeader(s.hd,lt); cardIn(s.sh,lt); showTag(s.tag,lt);
 camera(s.sh,lt,[[.8,1.5,410,180,1.15],[1.9,2.6,250,370,1.25],[3.0,3.7,700,140,1.6]],[410,360,1]);
 showBullets(s.bs,lt,[1.2,2.3,3.4]);
});

// ---------- 10 · OUTRO (46.4–50) ----------
scene(46.4,50.0,(r,s)=>{
 s.glow=h('div',{class:'abs',style:'left:140px;top:300px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(232,164,71,.32),transparent 65%)'},r);
 s.svg=h('svg:svg',{width:170,height:170,viewBox:'0 0 240 240',style:'position:absolute;left:455px;top:520px;overflow:visible;filter:drop-shadow(0 0 16px rgba(232,164,71,.7))'},r);
 const defs=h('svg:defs',{},s.svg); const lg=h('svg:linearGradient',{id:'lgO',x1:0,y1:0,x2:1,y2:1},defs);
 h('svg:stop',{offset:'0','stop-color':'#FFD596'},lg); h('svg:stop',{offset:'1','stop-color':'#C9781D'},lg);
 s.rect=h('svg:rect',{x:8,y:8,width:224,height:224,rx:56,fill:'none',stroke:'url(#lgO)','stroke-width':8,pathLength:1,'stroke-dasharray':'1 1'},s.svg);
 s.inner=h('svg:rect',{x:70,y:70,width:100,height:100,rx:22,fill:'url(#lgO)',style:'transform-origin:120px 120px'},s.svg);
 s.w=words(r,'You’re *ready.','abs center','top:750px;font-size:130px;font-weight:800;letter-spacing:-.05em;color:#fff');
 s.l1=words(r,'Start with the Sample file. Then copy the Blank one for your project.','abs center','top:930px;left:110px;width:860px;font-size:40px;font-weight:500;line-height:1.35;color:#C9D1DC;letter-spacing:-.01em');
 s.am=words(r,'ደረጃ 1–5 ን በቅደም ተከተል ይከተሉ።','abs center am','top:1080px;font-size:36px;font-weight:500;color:#E8A447');
 s.f1=words(r,'Rapha ProjectControl · Tutorial','abs center','top:1460px;font-size:30px;font-weight:600;color:#fff;letter-spacing:-.01em');
 s.f2=words(r,'Rapha Engineering & Consulting','abs center','top:1510px;font-size:26px;color:#6B7585');
},(t,lt,s)=>{
 s.rect.setAttribute('stroke-dashoffset',(1-E.ioC(P(lt,0,1.0))).toFixed(4));
 const pi=E.oB(P(lt,.6,1.2)); s.inner.style.transform=`scale(${pi})`; s.inner.style.opacity=C(P(lt,.6,.8));
 s.glow.style.opacity=E.oC(P(lt,.3,1.5))*(.85+.15*Math.sin(lt*2));
 reveal(s.w,lt,.4,{st:.14,d:1.3,dy:60,bl:20}); reveal(s.l1,lt,.9,{st:.04,d:1.0}); reveal(s.am,lt,1.4,{st:.08});
 reveal(s.f1,lt,1.7,{st:.06,dy:16}); reveal(s.f2,lt,1.9,{st:.06,dy:16});
},{fi:.35,fo:.7,zout:1});

// ===================== OVERLAYS =====================
const CH=[['Start',4.0],['Step 1',8.4],['Step 2',12.8],['Step 3',17.2],['Step 4',21.6],['Step 5',26.2],['Monthly',30.6],['Check',37.6],['Dashboard',42.0]];
const rail=h('div',{class:'rail'},stage); const segs=CH.map(()=>{const d=h('div',{},rail);return h('i',{},d);});
const rlab=h('div',{class:'rlab'},stage,'');
h('div',{id:'vig'},stage);
const flash=h('div',{class:'abs',style:'inset:0;background:#fff;opacity:0;mix-blend-mode:screen'},stage);
window.renderAt=function(t){
 const a=t*.12;
 tf(orbs[0],{x:200+Math.sin(a)*160,y:300+Math.cos(a*.8)*140});
 tf(orbs[1],{x:880+Math.cos(a*.9)*150,y:1650+Math.sin(a*1.1)*120,o:.55+.45*Math.sin(t*.35)});
 tf(orbs[2],{x:540+Math.sin(a*.6)*220,y:1000+Math.cos(a*.5)*260});
 bg.style.opacity=C(P(t,0,1.2))*(1-P(t,49.2,50));
 for(const s of scenes){
  if(t<s.a||t>s.b){s.root.style.display='none';continue;}
  s.root.style.display='block';
  const lt=t-s.a, ei=E.oC(P(t,s.a,s.a+s.fi)), eo=E.iC(P(t,s.b-s.fo,s.b));
  s.root.style.opacity=(ei*(1-eo)).toFixed(4);
  s.root.style.transform=`scale(${(L(s.zin,1,ei)*L(1,s.zout,eo)).toFixed(4)})`;
  const bl=(1-ei)*12+eo*16; s.root.style.filter=bl>.1?`blur(${bl.toFixed(2)}px)`:'none';
  s.update(t,lt,s);
 }
 const vis=C(P(t,4.1,4.6))*(1-C(P(t,46.2,46.6)));
 rail.style.opacity=vis; rlab.style.opacity=vis*.9;
 let cur=0; CH.forEach((c,i)=>{const end=i+1<CH.length?CH[i+1][1]:46.4; const f=C((t-c[1])/(end-c[1])); segs[i].style.transform=`scaleX(${f.toFixed(4)})`; if(t>=c[1]) cur=i;});
 rlab.textContent=`${CH[cur][0]}  ·  ${cur+1} / ${CH.length}`;
};
window.DURATION=50;
document.fonts.ready.then(()=>{window.READY=true;});
</script></body></html>
