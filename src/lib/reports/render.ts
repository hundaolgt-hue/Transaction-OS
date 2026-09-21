import 'server-only';
/** Server-side PDF rendering with pdfmake's Node printer and its bundled Roboto. */
import { TABLE_LAYOUTS } from './styles';
import type { Node } from './mdToPdf';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsModule = require('pdfmake/build/vfs_fonts.js');

let printer: { createPdfKitDocument: (d: Node, o: Node) => Node } | null = null;

function getPrinter() {
  if (printer) return printer;
  const vfs: Record<string, string> = vfsModule.pdfMake?.vfs ?? vfsModule.vfs ?? vfsModule;
  const buf = (f: string) => Buffer.from(vfs[f], 'base64');
  printer = new PdfPrinter({
    Roboto: { normal: buf('Roboto-Regular.ttf'), bold: buf('Roboto-Medium.ttf'), italics: buf('Roboto-Italic.ttf'), bolditalics: buf('Roboto-MediumItalic.ttf') },
  });
  return printer!;
}

export function renderPdf(definition: Node): Promise<{ bytes: Buffer; pages: number }> {
  return new Promise((resolve, reject) => {
    try {
      const doc = getPrinter().createPdfKitDocument(definition, { tableLayouts: TABLE_LAYOUTS });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
        resolve({ bytes, pages });
      });
      doc.on('error', reject);
      doc.end();
    } catch (e) { reject(e); }
  });
}
