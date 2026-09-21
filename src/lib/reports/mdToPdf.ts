/** Markdown (the subset the drafters and agents emit) → pdfmake content. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Node = any;

function inline(s: string): Node[] {
  // Split on **bold**, *italic* / _italic_, and [INFORMATION REQUIRED …] markers.
  const out: Node[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|(?<![\w])_[^_\n]+_(?![\w])|\[INFORMATION REQUIRED[^\]]*\]|\[CONFIRM[^\]]*\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('[')) out.push({ text: tok, color: '#b5651d', bold: true, background: '#fbf1e6' });
    else out.push({ text: tok.slice(1, -1), italics: true });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out.map((n) => ({ ...n, text: String(n.text).replace(/`([^`]+)`/g, '$1') }));
}

function tableNode(lines: string[]): Node {
  const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(lines[0]);
  const body = lines.slice(2).map(cells).map((r) => head.map((_, i) => r[i] ?? ''));
  const numeric = head.map((_, i) => body.length > 0 && body.every((r) => /^[-(]?[\d,.]+%?x?\)?$|^—$|^$/.test(r[i])) && i > 0);
  return {
    table: {
      headerRows: 1,
      widths: head.map((_, i) => (i === 0 ? '*' : head.length > 4 ? 'auto' : '*')),
      body: [
        head.map((h, i) => ({ text: h, style: 'th', alignment: numeric[i] ? 'right' : 'left' })),
        ...body.map((r) => r.map((c, i) => ({ text: inline(c), style: 'td', alignment: numeric[i] ? 'right' : 'left' }))),
      ],
    },
    layout: 'report',
    margin: [0, 4, 0, 10],
  };
}

export function mdToPdf(src: string, opts: { headingBase?: number; tocPrefix?: string } = {}): Node[] {
  const lines = (src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out: Node[] = [];
  const para: string[] = [];
  const base = opts.headingBase ?? 2;
  const flush = () => {
    if (para.length) out.push({ text: inline(para.join(' ')), style: 'p' });
    para.length = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = Math.min(4, h[1].length + base - 1);
      out.push({ text: h[2].replace(/\*\*/g, ''), style: `h${level}` });
      continue;
    }
    if (/^\s*\|/.test(l) && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1] ?? '')) {
      flush();
      const block = [l, lines[i + 1]];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
      i--;
      out.push(tableNode(block));
      continue;
    }
    if (/^>\s?/.test(l)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      out.push({
        table: { widths: ['*'], body: [[{ text: inline(q.join(' ')), style: 'quote' }]] },
        layout: { hLineWidth: () => 0, vLineWidth: (k: number) => (k === 0 ? 2 : 0), vLineColor: () => '#1d7d5f', paddingLeft: () => 10, paddingTop: () => 6, paddingBottom: () => 6, fillColor: () => '#f2f7f5' },
        margin: [0, 4, 0, 10],
      });
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      flush();
      const ordered = /^\s*\d+[.)]\s+/.test(l);
      const items: Node[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        items.push({ text: inline(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')), style: 'li' });
        i++;
      }
      i--;
      out.push(ordered ? { ol: items, margin: [8, 0, 0, 8] } : { ul: items, margin: [8, 0, 0, 8] });
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push({ canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#d4d9d7' }], margin: [0, 4, 0, 8] }); continue; }
    if (!l.trim()) { flush(); continue; }
    para.push(l.trim());
  }
  flush();
  return out;
}
