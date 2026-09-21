import { build } from 'esbuild';
import path from 'node:path';

const shim = (f) => path.resolve('preview/shims', f);
const redirects = [
  [/(^|\/)db$/, 'db.ts'], [/(^|\/)env$/, 'env.ts'], [/(^|\/)notify$/, 'notify.ts'],
  [/(^|\/)anthropic$/, 'anthropic.ts'],
];

await build({
  entryPoints: ['preview/entry.ts'],
  bundle: true, format: 'iife', globalName: 'AOS', platform: 'browser',
  target: 'es2020', minify: true, outfile: 'preview/dist/aos.js',
  plugins: [{
    name: 'browser-shims',
    setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: shim('empty.ts') }));
      b.onResolve({ filter: /.*/ }, (args) => {
        if (args.importer.includes('/preview/shims/')) return;
        if (!args.importer.includes('/src/lib/')) return;
        for (const [re, file] of redirects) if (re.test(args.path)) return { path: shim(file) };
      });
    },
  }],
});
console.log('built');
