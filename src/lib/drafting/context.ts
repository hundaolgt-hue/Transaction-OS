/**
 * Everything the drafters and report builders need, pulled once from an
 * engagement snapshot: company facts, statements, ratios, offer terms and the
 * tables in the data room.
 */
import { parseTables, kv, num, bodyParagraphs, type Table } from '../extract';
import { extractFinancials, computeRatios, extractCovenants, analyticalFindings, docForCode, type Financials, type RatioYear, type Covenants, type AnalyticalFinding } from '../finance/analyze';
import type { EngagementSnapshot } from '../repo/core';
import type { Document } from '../types';

export interface DraftContext {
  snap: EngagementSnapshot;
  doc: (code: string) => Document | null;
  text: (code: string) => string;
  tables: (code: string) => Table[];
  fact: (code: string, ...keys: string[]) => string | null;
  paras: (code: string) => string[];
  fin: Financials | null;
  ratios: RatioYear[];
  covenants: Covenants;
  analysis: AnalyticalFinding[];
  offer: { shares: number | null; priceLow: number | null; priceHigh: number | null; price: number | null; par: number | null; gross: number | null; expenses: number | null; net: number | null };
  companyName: string;
  legalName: string;
  marketStudy: Document | null;
}

export function buildDraftContext(snap: EngagementSnapshot): DraftContext {
  const doc = (code: string) => docForCode(snap.documents, snap.requirements, code);
  const text = (code: string) => doc(code)?.extractedText ?? '';
  const fin = extractFinancials(snap.documents, snap.requirements);
  const ratios = fin ? computeRatios(fin) : [];
  const covenants = extractCovenants(snap.documents, snap.requirements);

  const board = text('ECMA-G-001');
  const proceeds = text('ECMA-F-005');
  const shares = num(board.match(/offer\s+([\d,]+)\s+new ordinary shares/i)?.[1]);
  const range = board.match(/price range of Birr\s*([\d,]+)\s*to Birr\s*([\d,]+)/i);
  const par = num(board.match(/Birr\s*([\d,]+)\s*par value/i)?.[1]);
  const grossLine = kv(proceeds, 'gross proceeds at the offer price');
  const price = num(grossLine?.match(/at Birr\s*([\d,]+)/i)?.[1]);
  const gross = num(grossLine?.match(/^Birr\s*([\d,]+)/i)?.[1]);
  const expenses = num(kv(proceeds, 'estimated offer expenses')?.replace(/^Birr\s*/i, ''));
  const net = num(kv(proceeds, 'net proceeds')?.replace(/^Birr\s*/i, ''));

  return {
    snap, doc, text,
    tables: (code) => parseTables(text(code)),
    fact: (code, ...keys) => kv(text(code), ...keys),
    paras: (code) => bodyParagraphs(text(code)),
    fin, ratios, covenants,
    analysis: fin ? analyticalFindings(fin, ratios, covenants) : [],
    offer: {
      shares, par, price,
      priceLow: num(range?.[1]), priceHigh: num(range?.[2]),
      gross, expenses, net,
    },
    companyName: snap.client.name,
    legalName: kv(text('ECMA-C-003'), 'name of business organisation') ?? snap.client.name,
    marketStudy: snap.documents.find((d) => /market study|industry/i.test(d.title)) ?? null,
  };
}

export const md = {
  table(t: Table | null | undefined, maxRows = 40): string {
    if (!t || !t.header.length) return '';
    const rows = t.rows.slice(0, maxRows);
    return [`| ${t.header.join(' | ')} |`, `|${t.header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  },
  rows(header: string[], rows: (string | number)[][]): string {
    const f = (c: string | number) => (typeof c === 'number' ? c.toLocaleString('en-US') : c);
    return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(f).join(' | ')} |`)].join('\n');
  },
  money: (v: number | null | undefined, unit = 'Birr') => (v == null ? '[INFORMATION REQUIRED]' : `${unit} ${Math.round(v).toLocaleString('en-US')}`),
  need: (what: string) => `[INFORMATION REQUIRED: ${what}]`,
  pct: (v: number | null | undefined, dp = 1) => (v == null ? '—' : `${(v * 100).toFixed(dp)}%`),
};

export const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
