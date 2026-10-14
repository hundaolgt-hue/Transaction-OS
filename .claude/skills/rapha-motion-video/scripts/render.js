// Deterministic frame renderer: loads the composition over HTTP, calls window.renderAt(t) for each
// frame, captures JPEG (q96 — PNG is ~7x slower) and pipes into ffmpeg.
// Usage: node render.js <startFrame> <endFrame> <out.mp4> [fps=60]
// Env:   URL (default http://127.0.0.1:8765/index.html)
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const [,, startF, endF, out, fpsArg] = process.argv; const FPS = +fpsArg || 60;
const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
const FONTS = ['800 40px Montserrat', '900 40px "Noto Sans Ethiopic"', '500 40px "Noto Sans Ethiopic"', '800 40px Inter', '300 40px Inter', '500 40px "JetBrains Mono"'];
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server', '--disable-gpu-vsync'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(URL);
  // Fonts declared with unicode-range only download when used: force-load every face before frame 0.
  await p.evaluate(async (F) => {
    await Promise.all(F.map(f => document.fonts.load(f, 'Aa 0123 ሀለሐመ ራፋ የግንባታ ፕሮጀክት').catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  }, FONTS);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-tune', 'grain', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = +startF; f < +endF; f++) {
    await p.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 120 === 0) console.log(out, f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
})();
