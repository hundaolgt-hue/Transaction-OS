// Render still frames at given times for a quick look before the full render.
// Usage: node preview.js <outDir> <t1> <t2> ...   (then montage them; see SKILL.md)
// Env:   URL (default http://127.0.0.1:8765/index.html)
const { chromium } = require('playwright'); const fs = require('fs');
const [,, outDir, ...ts] = process.argv;
const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
const FONTS = ['800 40px Montserrat', '900 40px "Noto Sans Ethiopic"', '500 40px "Noto Sans Ethiopic"', '800 40px Inter', '300 40px Inter', '500 40px "JetBrains Mono"'];
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(URL);
  await p.evaluate(async (F) => {
    await Promise.all(F.map(f => document.fonts.load(f, 'Aa 0123 ሀለሐመ ራፋ የግንባታ ፕሮጀክት').catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  }, FONTS);
  for (const t of ts.map(Number)) {
    await p.evaluate(t => window.renderAt(t), t);
    await p.screenshot({ path: `${outDir}/f_${t.toFixed(2)}.png` });
  }
  await b.close();
})();
