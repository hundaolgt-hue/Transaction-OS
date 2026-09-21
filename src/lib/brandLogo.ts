import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

/** URL of the bank's logo if one has been dropped into public/brand/, else null. */
export function brandLogoUrl(): string | null {
  for (const f of ['logo.svg', 'logo.png', 'logo.webp']) {
    try {
      const p = path.join(process.cwd(), 'public', 'brand', f);
      if (fs.existsSync(p)) return `/brand/${f}?v=${Math.round(fs.statSync(p).mtimeMs)}`;
    } catch { /* ignore */ }
  }
  return null;
}

/** The logo as something pdfmake can place on a cover page, or null. */
export function brandLogoPdfNode(): Record<string, unknown> | null {
  const dir = path.join(process.cwd(), 'public', 'brand');
  try {
    const svg = path.join(dir, 'logo.svg');
    if (fs.existsSync(svg)) return { svg: fs.readFileSync(svg, 'utf8'), fit: [130, 42], absolutePosition: { x: 417, y: 30 } };
    const png = path.join(dir, 'logo.png');
    if (fs.existsSync(png)) return { image: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`, fit: [130, 42], absolutePosition: { x: 417, y: 30 } };
  } catch { /* ignore */ }
  return null;
}
