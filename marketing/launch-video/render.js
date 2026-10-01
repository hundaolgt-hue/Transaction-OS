const { chromium } = require('playwright'); const { spawn } = require('child_process');
const [,, startF, endF, out, fpsArg, scaleArg] = process.argv; const FPS=+fpsArg||60;
(async()=>{
 const b=await chromium.launch({args:['--no-proxy-server','--disable-gpu-vsync']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://127.0.0.1:8765/'+(process.env.PAGE||'index.html'));
 await p.evaluate(async()=>{await Promise.all(['800 40px Inter','300 40px Inter','500 40px "JetBrains Mono"','500 40px "Noto Sans Ethiopic"'].map(f=>document.fonts.load(f,'Aa ራፋ የግንባታ ፕሮጀክት ቁጥጥር ስራዓት ፎርሞች'))); await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 const vf=scaleArg?['-vf',`scale=${scaleArg}`]:[];
 const ff=spawn('ffmpeg',['-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-',...vf,'-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p','-tune','grain',out],{stdio:['pipe','inherit','inherit']});
 const t0=Date.now();
 for(let f=+startF; f<+endF; f++){
   await p.evaluate(t=>window.renderAt(t), f/FPS);
   const buf=await p.screenshot({type:'jpeg',quality:96});
   if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
   if(f%120===0) console.log(out,f,((Date.now()-t0)/1000).toFixed(0)+'s');
 }
 ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close();
})();
