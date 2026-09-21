import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

/** The white-text lock-up as a pdfmake node for the dark cover band, or null if the file is missing. */
export function brandLogoPdfNode(): Record<string, unknown> | null {
  try {
    const png = path.join(process.cwd(), 'public', 'brand', 'logo-dark.png');
    if (!fs.existsSync(png)) return null;
    return { image: `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`, fit: [150, 44], absolutePosition: { x: 397, y: 30 } };
  } catch { return null; }
}
