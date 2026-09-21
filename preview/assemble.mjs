import fs from 'node:fs';
const sql = fs.readFileSync('node_modules/sql.js/dist/sql-asm.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const aos = fs.readFileSync('preview/dist/aos.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const app = fs.readFileSync('preview/app.js', 'utf8');
const css = fs.readFileSync('preview/app.css', 'utf8');
const db = fs.readFileSync('data/preview.db').toString('base64');
const html = `<title>Advisor OS</title>
<meta name="description" content="Operating system for Ethiopian transaction advisers">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;450;500;600;700&display=swap">
<style>${css}</style>
<div id="app"><div class="loading">Loading the practice…</div></div>
<script type="text/plain" id="seed-db">${db}</script>
<script>${sql}</script>
<script>${aos}</script>
<script>${app}</script>
`;
fs.mkdirSync('preview/dist', { recursive: true });
fs.writeFileSync('preview/dist/advisor-os.html', html);
console.log('bytes', html.length);
