import { BRAND, PRINT_BRAND } from '../brand';
import type { Node } from './mdToPdf';

export const COLORS = {
  ink: '#16201c', muted: '#4a5652', faint: '#8a938f', rule: '#d4d9d7', accent: PRINT_BRAND.accent, accentSoft: PRINT_BRAND.accentSoft,
  critical: '#c42b36', high: '#b95a0f', medium: '#8a7600', low: '#1f7383', info: '#6b7377', good: PRINT_BRAND.good,
};

export const SEV_COLOR: Record<string, string> = {
  CRITICAL: COLORS.critical, HIGH: COLORS.high, MEDIUM: COLORS.medium, LOW: COLORS.low, INFO: COLORS.info,
};

export const TABLE_LAYOUTS = {
  report: {
    hLineWidth: (i: number, node: Node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
    vLineWidth: () => 0,
    hLineColor: (i: number) => (i <= 1 ? '#9aa3a0' : '#e0e4e2'),
    paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3.5, paddingBottom: () => 3.5,
    fillColor: (i: number) => (i === 0 ? '#eef1f0' : null),
  },
  plain: {
    hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 2, paddingBottom: () => 2,
  },
  card: {
    hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#d4d9d7', vLineColor: () => '#d4d9d7',
    paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 7, paddingBottom: () => 7,
  },
};

export const STYLES = {
  h1: { fontSize: 19, bold: true, color: COLORS.ink, margin: [0, 0, 0, 10] },
  h2: { fontSize: 13.5, bold: true, color: COLORS.ink, margin: [0, 14, 0, 6] },
  h3: { fontSize: 11.5, bold: true, color: COLORS.ink, margin: [0, 10, 0, 4] },
  h4: { fontSize: 10.5, bold: true, color: COLORS.muted, margin: [0, 8, 0, 3] },
  p: { fontSize: 9.6, lineHeight: 1.32, color: COLORS.ink, margin: [0, 0, 0, 7], alignment: 'justify' },
  li: { fontSize: 9.6, lineHeight: 1.3, color: COLORS.ink, margin: [0, 0, 0, 3] },
  th: { fontSize: 8.4, bold: true, color: COLORS.muted },
  td: { fontSize: 8.6, color: COLORS.ink, lineHeight: 1.18 },
  quote: { fontSize: 9.2, italics: true, color: COLORS.muted, lineHeight: 1.3 },
  small: { fontSize: 8, color: COLORS.faint },
  eyebrow: { fontSize: 8, bold: true, color: COLORS.accent, characterSpacing: 1.2 },
  label: { fontSize: 8, color: COLORS.faint },
  value: { fontSize: 10, bold: true, color: COLORS.ink },
  kpi: { fontSize: 18, bold: true, color: COLORS.ink },
  toc: { fontSize: 9.5, color: COLORS.ink },
};

export function shell(opts: {
  title: string; subtitle: string; firm: string; client: string; reference: string; draft: boolean; content: Node[];
}): Node {
  return {
    pageSize: 'A4',
    pageMargins: [48, 58, 48, 54],
    info: { title: opts.title, author: opts.firm, subject: `${opts.client} — ${opts.reference}`, creator: `${BRAND.name} — Advisor OS` },
    watermark: opts.draft ? { text: 'DRAFT — FOR EXPERT REVIEW', color: '#c0392f', opacity: 0.045, bold: true, fontSize: 46 } : undefined,
    header: (page: number) => (page === 1 ? null : {
      columns: [
        { text: `${opts.client}  ·  ${opts.title}`, style: 'small', margin: [48, 24, 0, 0] },
        { text: opts.reference, style: 'small', alignment: 'right', margin: [0, 24, 48, 0] },
      ],
    }),
    footer: (page: number, pages: number) => (page === 1 ? null : {
      columns: [
        { text: `${opts.firm} — Confidential. ${opts.draft ? 'Machine-assisted draft; not to be relied upon until approved by the responsible expert.' : 'Approved for issue.'}`, style: 'small', margin: [48, 16, 0, 0], width: '*' },
        { text: `Page ${page} of ${pages}`, style: 'small', alignment: 'right', margin: [0, 16, 48, 0], width: 90 },
      ],
    }),
    background: (page: number) => (page === 1 ? { canvas: [
      { type: 'rect', x: 0, y: 0, w: 595.28, h: 262, color: PRINT_BRAND.coverBand },
      { type: 'rect', x: 0, y: 262, w: 372, h: 4, color: PRINT_BRAND.coverRule },
      { type: 'rect', x: 372, y: 262, w: 223.28, h: 4, color: PRINT_BRAND.coverRule2 },
    ] } : null),
    content: opts.content,
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 9.6, color: COLORS.ink },
  };
}

/** Cover page shared by every generated document. */
export function cover(o: { eyebrow: string; title: string; subtitle: string; client: string; reference: string; firm: string; date: string; status: string; lines: [string, string][] }): Node[] {
  return [
    { text: `${o.firm.toUpperCase()}  ·  ${o.eyebrow.toUpperCase()}`, color: PRINT_BRAND.coverEyebrow, fontSize: 9, bold: true, characterSpacing: 1.6, margin: [0, 20, 0, 10] },
    { text: o.title, color: '#ffffff', fontSize: 25, bold: true, lineHeight: 1.1, margin: [0, 0, 0, 8] },
    { text: o.subtitle, color: PRINT_BRAND.coverSub, fontSize: 11.5, margin: [0, 0, 0, 0] },
    { text: '', margin: [0, 110, 0, 0] },
    { text: o.client, fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
    { text: `Engagement ${o.reference}`, style: 'small', margin: [0, 0, 0, 22] },
    {
      table: { widths: [150, '*'], body: o.lines.map(([k, v]) => [{ text: k, style: 'label' }, { text: v, fontSize: 9.6 }]) },
      layout: 'plain',
    },
    { text: '', margin: [0, 26, 0, 0] },
    {
      table: { widths: ['*'], body: [[{ text: [{ text: `Status: ${o.status}. `, bold: true }, 'This document was prepared with machine assistance by the Advisor OS agents of ' + o.firm + ' from the documents in the engagement data room. It must be reviewed and approved by the responsible expert before it is issued, relied upon or shared with any third party.'], fontSize: 8.6, color: COLORS.muted, lineHeight: 1.3 }]] },
      layout: 'card',
    },
    { text: `${o.firm}  ·  ${o.date}`, style: 'small', margin: [0, 18, 0, 0], pageBreak: 'after' },
  ];
}

export const kpiRow = (items: [string, string, string?][]): Node => ({
  table: {
    widths: items.map(() => '*'),
    body: [items.map(([label, value, sub]) => ({
      stack: [{ text: label.toUpperCase(), style: 'label', characterSpacing: 0.6 }, { text: value, style: 'kpi', margin: [0, 3, 0, 1] }, ...(sub ? [{ text: sub, style: 'small' }] : [])],
    }))],
  },
  layout: 'card',
  margin: [0, 4, 0, 12],
});

export const h1 = (text: string, opts: { break?: boolean } = {}): Node =>
  ({ text, style: 'h1', tocItem: true, tocStyle: { bold: true }, tocMargin: [0, 6, 0, 0], ...(opts.break !== false ? { pageBreak: 'before' } : {}) });
export const h2 = (text: string): Node => ({ text, style: 'h2', tocItem: true, tocMargin: [14, 2, 0, 0], tocStyle: { fontSize: 9, color: COLORS.muted } });
export const p = (text: string | Node[]): Node => ({ text, style: 'p' });
export const svg = (markup: string, width = 499): Node => ({ svg: markup, width, margin: [0, 4, 0, 12] });

export function simpleTable(header: string[], rows: (string | number | Node)[][], widths?: (string | number)[], numericCols: number[] = []): Node {
  const fmt = (c: string | number | Node) => (typeof c === 'number' ? c.toLocaleString('en-US') : c);
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: widths ?? header.map((_, i) => (i === 0 ? '*' : 'auto')),
      body: [
        header.map((h, i) => ({ text: h, style: 'th', alignment: numericCols.includes(i) ? 'right' : 'left' })),
        ...rows.map((r) => r.map((c, i) => (typeof c === 'object' && c !== null ? { ...c, style: c.style ?? 'td' } : { text: fmt(c), style: 'td', alignment: numericCols.includes(i) ? 'right' : 'left' }))),
      ],
    },
    layout: 'report',
    margin: [0, 4, 0, 12],
  };
}

export const sevCell = (sev: string): Node => ({ text: sev.charAt(0) + sev.slice(1).toLowerCase(), color: SEV_COLOR[sev] ?? COLORS.muted, bold: true, style: 'td' });
