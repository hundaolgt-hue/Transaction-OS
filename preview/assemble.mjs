import fs from 'node:fs';
const sql = fs.readFileSync('node_modules/sql.js/dist/sql-asm.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const aos = fs.readFileSync('preview/dist/aos.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const app = fs.readFileSync('preview/app.js', 'utf8');
const pdfmake = fs.readFileSync('node_modules/pdfmake/build/pdfmake.min.js', 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '').replace(/\uFFFD/g, '\\ufffd').replace(/<\/script/gi, '<\\/script');
const vfs = fs.readFileSync('node_modules/pdfmake/build/vfs_fonts.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('preview/app.css', 'utf8');
const db = fs.readFileSync('data/preview.db').toString('base64');
const img = (f) => 'data:image/png;base64,' + fs.readFileSync('public/brand/' + f).toString('base64');
const brandImg = JSON.stringify({ light: img('logo.png'), dark: img('logo-dark.png'), mark: img('mark.png') });
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Siinqee Advisor OS</title>
<link rel="icon" href="${img('mark.png')}">
<meta name="description" content="Siinqee Investment Bank transaction advisory workspace (preview)">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;450;500;600;700&display=swap">
<style>${css}</style>
<div id="app"><div class="loading">Loading the practice…<br><small id="slow-hint" style="display:none">Still loading? This preview needs JavaScript. Open the file in Chrome, Edge, Safari or Firefox — not in a phone file viewer, email or chat preview.</small><noscript><br><small>JavaScript is turned off, so the preview cannot start. Open this file in Chrome, Edge, Safari or Firefox.</small></noscript></div></div>
<script>setTimeout(function(){var h=document.getElementById("slow-hint");if(h)h.style.display="inline";},6000);</script>
<script type="text/plain" id="seed-db">${db}</script>
<script>${sql}</script>
<script>${pdfmake}</script>
<script>${vfs}</script>
<script>${aos}</script>
<script>window.BRAND_IMG=${brandImg};</script>
<script>${app}</script>
`;
fs.mkdirSync('preview/dist', { recursive: true });
fs.writeFileSync('preview/dist/advisor-os.html', html);
fs.writeFileSync('preview/dist/siinqee-advisor-os.html', html);
console.log('bytes', html.length);
