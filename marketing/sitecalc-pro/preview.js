const { chromium } = require('playwright');
(async()=>{
 const times=process.argv.slice(2).map(Number);
 const b=await chromium.launch({args:['--no-proxy-server','--allow-file-access-from-files','--disable-web-security']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await p.goto('http://127.0.0.1:8765/'+(process.env.PAGE||'index.html'));
 await p.evaluate(async()=>{await Promise.all(['800 40px Montserrat','900 40px "Noto Sans Ethiopic"','800 40px Inter','300 40px Inter','500 40px "JetBrains Mono"','500 40px "Noto Sans Ethiopic"'].map(f=>document.fonts.load(f,'Aa ራፋ የግንባታ ፕሮጀክት ቁጥጥር ስራዓት ፎርሞች'))); await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 for(const t of times){ await p.evaluate(t=>window.renderAt(t),t); await p.screenshot({path:`${process.env.OUT||"prev"}/f_${t.toFixed(2)}.png`}); }
 await b.close();
})();
