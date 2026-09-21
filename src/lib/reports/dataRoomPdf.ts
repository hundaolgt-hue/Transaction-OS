/** Render a data-room text document as a clean PDF, for download and upload tests. */
import { mdToPdf, type Node } from './mdToPdf';
import { STYLES, COLORS } from './styles';

export function dataRoomPdf(title: string, body: string, company: string): Node {
  const lines = body.split('\n');
  const banner = lines[0].startsWith('SYNTHETIC') ? lines.shift()! : '';
  // Title line, then key/value header block, then the body.
  while (lines.length && !lines[0].trim()) lines.shift();
  const heading = lines.shift() ?? title;
  const kv: [string, string][] = [];
  while (lines.length && (lines[0].trim() === '' || /^[A-Za-z][^:|]{1,60}: /.test(lines[0]))) {
    const l = lines.shift()!;
    const m = l.match(/^([^:]+): (.+)$/);
    if (m) kv.push([m[1], m[2]]);
    else if (kv.length) break;
  }
  const md = lines.join('\n').replace(/^([A-Z][A-Z0-9 ,'’()–—-]{10,})$/gm, '## $1');
  return {
    pageSize: 'A4',
    pageMargins: [56, 60, 56, 56],
    info: { title: heading, author: company, subject: 'Synthetic data-room document' },
    header: { text: banner, fontSize: 6.8, color: COLORS.critical, margin: [56, 22, 56, 0], alignment: 'center' },
    footer: (pg: number, pages: number) => ({ text: `${company} · ${heading} · ${pg}/${pages}`, fontSize: 7.5, color: COLORS.faint, margin: [56, 18, 56, 0] }),
    content: [
      { text: heading, fontSize: 15, bold: true, margin: [0, 0, 0, 10] },
      ...(kv.length ? [{ table: { widths: [150, '*'], body: kv.map(([k, v]) => [{ text: `${k}:`, fontSize: 8.6, color: COLORS.muted }, { text: v, fontSize: 9 }]) }, layout: 'plain', margin: [0, 0, 0, 12] }] : []),
      ...mdToPdf(md, { headingBase: 3 }),
    ],
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 9.4 },
  };
}
