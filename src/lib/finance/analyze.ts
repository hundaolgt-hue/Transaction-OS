/**
 * Financial analysis over statements extracted from the data room.
 * Pure functions: the Financial Agent, the reports and the dashboard all use them.
 */
import { parseStatements, line, sentenceWith, type Statement } from '../extract';
import type { Document, Requirement } from '../types';

export interface Financials {
  years: string[];
  revenue: number[]; grossProfit: number[]; operatingProfit: number[]; financeCosts: number[];
  pbt: number[]; pat: number[]; depreciation: number[] | null;
  totalAssets: number[]; equity: number[]; borrowings: number[]; inventories: number[];
  receivables: number[]; payables: number[]; cash: number[]; currentAssets: number[]; currentLiabilities: number[];
  cogs: number[]; opCash: number[] | null; capex: number[] | null;
  source: string;
}

const abs = (a: number[] | null) => (a ? a.map((v) => Math.abs(v)) : null);

export function docForCode(docs: Document[], reqs: Requirement[], code: string): Document | null {
  const req = reqs.find((r) => r.code === code);
  if (!req) return null;
  return docs.filter((d) => d.requirementId === req.id).sort((a, b) => b.version - a.version)[0] ?? null;
}

export function extractFinancials(docs: Document[], reqs: Requirement[]): Financials | null {
  const doc = docForCode(docs, reqs, 'ECMA-F-001')
    ?? docs.find((d) => /financial statements|annual report/i.test(d.title));
  if (!doc?.extractedText) return null;
  const st: Statement | null = parseStatements(doc.extractedText);
  if (!st) return null;
  const req = (vals: number[] | null) => vals ?? st.years.map(() => 0);
  const revenue = line(st, 'revenue');
  if (!revenue) return null;
  const bNC = line(st, /^borrowings.*non-current/, 'borrowings');
  const bC = line(st, /^borrowings.*current portion/, /^short-term borrowings/);
  const borrowings = st.years.map((_, i) => (bNC?.[i] ?? 0) + (bC?.[i] ?? 0));
  return {
    years: st.years,
    revenue,
    cogs: req(abs(line(st, 'cost of sales'))),
    grossProfit: req(line(st, 'gross profit')),
    operatingProfit: req(line(st, 'operating profit')),
    financeCosts: req(abs(line(st, 'finance costs'))),
    pbt: req(line(st, 'profit before tax', /^loss before tax/)),
    pat: req(line(st, 'profit for the year', /^profit after tax/)),
    depreciation: abs(line(st, 'depreciation')),
    totalAssets: req(line(st, 'total assets')),
    equity: req(line(st, 'total equity')),
    borrowings,
    inventories: req(line(st, 'inventories')),
    receivables: req(line(st, 'trade and other receivables', 'trade receivables')),
    payables: req(line(st, 'trade and other payables', 'trade payables')),
    cash: req(line(st, 'cash and cash equivalents', 'cash')),
    currentAssets: req(line(st, 'total current assets')),
    currentLiabilities: req(line(st, 'total current liabilities')),
    opCash: line(st, 'net cash from operating'),
    capex: abs(line(st, 'capital expenditure')),
    source: doc.title,
  };
}

export interface RatioYear {
  year: string; revenueGrowth: number | null; grossMargin: number; operatingMargin: number; netMargin: number;
  ebitda: number | null; ebitdaMargin: number | null; roe: number; roa: number;
  currentRatio: number | null; quickRatio: number | null; gearing: number; netDebtToEbitda: number | null;
  interestCover: number; dso: number; dio: number; dpo: number; cashConversionCycle: number;
  cashConversion: number | null;
}

const div = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function computeRatios(f: Financials): RatioYear[] {
  return f.years.map((year, i) => {
    const ebitda = f.depreciation ? f.operatingProfit[i] + f.depreciation[i] : null;
    const curr = f.currentAssets[i] && f.currentLiabilities[i] ? div(f.currentAssets[i], f.currentLiabilities[i]) : null;
    return {
      year,
      revenueGrowth: i === 0 ? null : div(f.revenue[i] - f.revenue[i - 1], f.revenue[i - 1]),
      grossMargin: div(f.grossProfit[i], f.revenue[i]),
      operatingMargin: div(f.operatingProfit[i], f.revenue[i]),
      netMargin: div(f.pat[i], f.revenue[i]),
      ebitda, ebitdaMargin: ebitda === null ? null : div(ebitda, f.revenue[i]),
      roe: div(f.pat[i], f.equity[i]), roa: div(f.pat[i], f.totalAssets[i]),
      currentRatio: curr,
      quickRatio: curr === null ? null : div(f.currentAssets[i] - f.inventories[i], f.currentLiabilities[i]),
      gearing: div(f.borrowings[i], f.equity[i]),
      netDebtToEbitda: ebitda ? div(f.borrowings[i] - f.cash[i], ebitda) : null,
      interestCover: div(f.operatingProfit[i], f.financeCosts[i]),
      dso: div(f.receivables[i], f.revenue[i]) * 365,
      dio: div(f.inventories[i], f.cogs[i] || f.revenue[i]) * 365,
      dpo: div(f.payables[i], f.cogs[i] || f.revenue[i]) * 365,
      cashConversionCycle: (div(f.receivables[i], f.revenue[i]) + div(f.inventories[i], f.cogs[i] || f.revenue[i]) - div(f.payables[i], f.cogs[i] || f.revenue[i])) * 365,
      cashConversion: f.opCash && ebitda ? div(f.opCash[i], ebitda) : null,
    };
  });
}

export interface Covenants { maxGearing: number | null; minDscr: number | null; source: string | null }

export function extractCovenants(docs: Document[], reqs: Requirement[]): Covenants {
  const d = docForCode(docs, reqs, 'ECMA-F-007');
  const text = d?.extractedText ?? '';
  const g = text.match(/borrowings to equity (?:not to exceed|not exceeding|of not more than)\s*([0-9.]+)/i);
  const c = text.match(/coverage ratio (?:of )?not less than\s*([0-9.]+)/i);
  return { maxGearing: g ? Number(g[1]) : null, minDscr: c ? Number(c[1]) : null, source: d?.title ?? null };
}

export interface AnalyticalFinding {
  key: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; detail: string; recommendation: string; citation: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const x = (v: number) => `${v.toFixed(2)}x`;

/** Judgement-free analytical tests with stated thresholds, so every flag is explainable. */
export function analyticalFindings(f: Financials, r: RatioYear[], cov: Covenants): AnalyticalFinding[] {
  const out: AnalyticalFinding[] = [];
  const last = r[r.length - 1], first = r[0];
  const ly = last.year, fy = first.year;

  if (last.dso - first.dso > 5) {
    out.push({
      key: 'fa:dso', severity: 'MEDIUM', title: `Receivable days lengthened from ${first.dso.toFixed(0)} to ${last.dso.toFixed(0)} days`,
      detail: `Trade receivables grew faster than revenue between ${fy} and ${ly}: receivable days moved from ${first.dso.toFixed(1)} to ${last.dso.toFixed(1)} (threshold: an increase of more than 5 days). Lengthening collection periods can indicate looser credit terms, distributor stress or revenue recognised ahead of cash.`,
      recommendation: 'Obtain an aged receivables analysis by customer at the latest balance sheet date, test post-year-end cash receipts, and review the expected-credit-loss provision against the ageing.',
      citation: 'IFRS 9 (impairment); ECMA prospectus contents directive — working capital',
    });
  }
  if (last.interestCover < 3) {
    out.push({
      key: 'fa:icr', severity: last.interestCover < 2 ? 'HIGH' : 'MEDIUM',
      title: `Interest cover is ${x(last.interestCover)} in ${ly}`,
      detail: `Operating profit covers finance costs ${x(last.interestCover)} (threshold 3.0x; below 2.0x is high severity). Coverage was ${x(first.interestCover)} in ${fy}. Thin cover leaves little room for a margin squeeze or a rate rise.`,
      recommendation: 'Model interest cover under the downside case and disclose the sensitivity in the MD&A; confirm how much of the offer proceeds will retire debt.',
      citation: 'ECMA prospectus contents directive — capital resources',
    });
  }
  if (cov.maxGearing) {
    const headroom = (cov.maxGearing - last.gearing) / cov.maxGearing;
    if (headroom < 0) {
      out.push({ key: 'fa:gearing-breach', severity: 'HIGH', title: `Gearing ${x(last.gearing)} breaches the ${x(cov.maxGearing)} covenant`,
        detail: `Borrowings to equity of ${x(last.gearing)} at ${ly} exceed the covenant of ${x(cov.maxGearing)} in ${cov.source ?? 'the facility agreements'}.`,
        recommendation: 'Obtain written waivers from every lender before filing and disclose the breach as a principal risk factor.', citation: 'IFRS 7.18–7.19' });
    } else if (headroom < 0.25) {
      out.push({ key: 'fa:gearing-headroom', severity: 'MEDIUM', title: `Gearing headroom is ${pct(headroom)} against the ${x(cov.maxGearing)} covenant`,
        detail: `Borrowings to equity stood at ${x(last.gearing)} at ${ly} against a maximum of ${x(cov.maxGearing)} (${cov.source ?? 'facility agreements'}): headroom of ${pct(headroom)} (threshold 25%). Debt-funded capital expenditure before the offer proceeds arrive could narrow it further.`,
        recommendation: 'Project the covenant quarterly to the expected admission date including the capital programme, and obtain lender confirmation that the offer and use of proceeds do not trigger any default.',
        citation: 'IFRS 7.18–7.19; facility agreements' });
    }
  }
  if (last.currentRatio !== null && last.currentRatio < 1.2) {
    out.push({ key: 'fa:liquidity', severity: last.currentRatio < 1 ? 'HIGH' : 'MEDIUM', title: `Current ratio is ${x(last.currentRatio)} in ${ly}`,
      detail: `Current assets cover current liabilities ${x(last.currentRatio)} (threshold 1.2x). The quick ratio, excluding inventories, is ${x(last.quickRatio ?? 0)}.`,
      recommendation: 'Review the maturity profile of short-term borrowings and the availability of undrawn facilities; include a working capital statement in the prospectus.',
      citation: 'ECMA prospectus contents directive — working capital statement' });
  }
  if (last.cashConversion !== null && last.cashConversion < 0.6) {
    out.push({ key: 'fa:cash', severity: 'MEDIUM', title: `Operating cash conversion is ${pct(last.cashConversion)} of EBITDA`,
      detail: `Net cash from operating activities was ${pct(last.cashConversion)} of EBITDA in ${ly} (threshold 60%). Working capital absorbed a large share of earnings.`,
      recommendation: 'Reconcile EBITDA to operating cash flow and explain the working capital build in the MD&A.', citation: 'IAS 7' });
  }
  if (r.length >= 2 && last.grossMargin < r[r.length - 2].grossMargin - 0.02) {
    out.push({ key: 'fa:margin', severity: 'MEDIUM', title: `Gross margin fell to ${pct(last.grossMargin)}`,
      detail: `Gross margin fell by more than two percentage points year on year (from ${pct(r[r.length - 2].grossMargin)}).`,
      recommendation: 'Analyse the margin bridge by product and input cost.', citation: 'ECMA prospectus contents directive — MD&A' });
  }
  return out;
}

/** Plain-language summary of the numbers, used by reports, prospectus and the assistant. */
export function financialNarrative(f: Financials, r: RatioYear[], unit = "Birr '000"): string {
  const l = r[r.length - 1], fi = r[0];
  const cagr = Math.pow(f.revenue[f.revenue.length - 1] / f.revenue[0], 1 / (f.revenue.length - 1)) - 1;
  return `Revenue grew from ${f.revenue[0].toLocaleString('en-US')} to ${f.revenue[f.revenue.length - 1].toLocaleString('en-US')} (${unit}) between ${fi.year} and ${l.year}, a compound annual growth rate of ${pct(cagr)}. Gross margin moved from ${pct(fi.grossMargin)} to ${pct(l.grossMargin)} and net margin from ${pct(fi.netMargin)} to ${pct(l.netMargin)}. Return on equity was ${pct(l.roe)} in ${l.year}. Borrowings stood at ${x(l.gearing)} equity, with operating profit covering finance costs ${x(l.interestCover)}. Receivable days were ${l.dso.toFixed(0)} and inventory days ${l.dio.toFixed(0)}, giving a cash conversion cycle of ${l.cashConversionCycle.toFixed(0)} days.`;
}

export { sentenceWith };
