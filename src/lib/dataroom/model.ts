/**
 * Financial model for the fictional issuer used by the demo data room.
 * Every statement in the data room is rendered from these numbers, so the
 * balance sheets balance and the cash flows reconcile to the cash line.
 * All figures are ETB '000.
 */

export const YEARS = ['FY2023', 'FY2024', 'FY2025'] as const;
export const PROJ_YEARS = ['FY2026', 'FY2027', 'FY2028', 'FY2029', 'FY2030'] as const;

export interface YearFin {
  revenue: number; cogs: number; gross: number; selling: number; admin: number; otherIncome: number;
  operating: number; depreciation: number; ebitda: number; financeCosts: number; pbt: number; tax: number; pat: number;
  ppe: number; rou: number; inventories: number; receivables: number; cash: number;
  nonCurrentAssets: number; currentAssets: number; totalAssets: number;
  shareCapital: number; retained: number; equity: number;
  borrowingsNC: number; borrowingsCurrent: number; leaseLiabilities: number; payables: number; taxPayable: number;
  nonCurrentLiabilities: number; currentLiabilities: number; totalLiabilities: number;
  dividends: number; capex: number; opCash: number; invCash: number; finCash: number;
}

const R = Math.round;

function build(): Record<string, YearFin> {
  const inp = {
    FY2023: { revenue: 2_095_440, cogsPct: 0.7646, selling: 98_400, admin: 123_156, other: 4_200, dep: 62_400, fin: 148_220, ppe: 1_388_902, rou: 79_650, inv: 421_004, rec: 299_776, cash: 121_338, cap: 400_000, pay: 407_995, lease: 86_350, div: 0, retOpen: 380_100 },
    FY2024: { revenue: 2_461_880, cogsPct: 0.7560, selling: 112_300, admin: 139_708, other: 5_100, dep: 71_800, fin: 166_900, ppe: 1_612_455, rou: 88_220, inv: 498_331, rec: 371_190, cash: 188_402, cap: 480_000, pay: 468_778, lease: 94_500, div: 24_000 },
    FY2025: { revenue: 2_884_506, cogsPct: 0.7483, selling: 131_900, admin: 156_512, other: 6_800, dep: 83_300, fin: 182_540, ppe: 1_842_110, rou: 96_400, inv: 612_880, rec: 468_220, cash: 142_655, cap: 480_000, pay: 532_997, lease: 102_750, div: 38_400 },
  } as const;

  const out: Record<string, YearFin> = {};
  let prevRetained = 0;
  let prev: YearFin | null = null;

  for (const y of YEARS) {
    const i = inp[y] as typeof inp.FY2023;
    const cogs = R(i.revenue * i.cogsPct);
    const gross = i.revenue - cogs;
    const operating = gross - i.selling - i.admin + i.other;
    const pbt = operating - i.fin;
    const tax = R(pbt * 0.3);
    const pat = pbt - tax;
    const retained = (y === 'FY2023' ? (inp.FY2023.retOpen) : prevRetained) + pat - i.div;
    const equity = i.cap + retained;
    const nonCurrentAssets = i.ppe + i.rou;
    const currentAssets = i.inv + i.rec + i.cash;
    const totalAssets = nonCurrentAssets + currentAssets;
    const taxPayable = R(tax * 0.35);
    // Borrowings balance the sheet; 18% falls due within a year.
    const borrowingsTotal = totalAssets - equity - i.pay - i.lease - taxPayable;
    const borrowingsCurrent = R(borrowingsTotal * 0.18);
    const borrowingsNC = borrowingsTotal - borrowingsCurrent;
    const nonCurrentLiabilities = borrowingsNC + i.lease;
    const currentLiabilities = borrowingsCurrent + i.pay + taxPayable;
    const capex = prev ? i.ppe - prev.ppe + i.dep : R(i.dep * 1.9);
    let opCash: number, invCash: number, finCash: number;
    if (prev) {
      const dWC = (i.inv - prev.inventories) + (i.rec - prev.receivables) - (i.pay - prev.payables);
      opCash = pat + i.dep + i.fin - dWC - (tax - taxPayable + prev.taxPayable);
      invCash = -capex;
      finCash = (i.cash - prev.cash) - opCash - invCash;
    } else {
      opCash = R(pat + i.dep + i.fin * 0.62);
      invCash = -capex;
      finCash = -R(opCash * 0.08) - opCash - invCash + R(opCash * 0.08) - 9_000;
    }
    const y2: YearFin = {
      revenue: i.revenue, cogs, gross, selling: i.selling, admin: i.admin, otherIncome: i.other,
      operating, depreciation: i.dep, ebitda: operating + i.dep, financeCosts: i.fin, pbt, tax, pat,
      ppe: i.ppe, rou: i.rou, inventories: i.inv, receivables: i.rec, cash: i.cash,
      nonCurrentAssets, currentAssets, totalAssets,
      shareCapital: i.cap, retained, equity,
      borrowingsNC, borrowingsCurrent, leaseLiabilities: i.lease, payables: i.pay, taxPayable,
      nonCurrentLiabilities, currentLiabilities, totalLiabilities: nonCurrentLiabilities + currentLiabilities,
      dividends: i.div, capex, opCash, invCash, finCash,
    };
    out[y] = y2;
    prevRetained = retained;
    prev = y2;
  }
  return out;
}

export const FIN = build();

export interface ProjYear { revenue: number; ebitda: number; depreciation: number; financeCosts: number; pbt: number; pat: number; capex: number; volumeKt: number; price: number; margin: number }

export const PROJ: Record<string, ProjYear> = (() => {
  const base = FIN.FY2025;
  const growth = [0.16, 0.22, 0.14, 0.09, 0.07];  // FY2027 step-up: fourth crushing line
  const margins = [0.192, 0.205, 0.214, 0.218, 0.22];
  const out: Record<string, ProjYear> = {};
  let rev = base.revenue;
  let dep = base.depreciation;
  let fin = base.financeCosts;
  PROJ_YEARS.forEach((y, i) => {
    rev = R(rev * (1 + growth[i]));
    const ebitda = R(rev * margins[i]);
    dep = R(dep * (i === 1 ? 1.24 : 1.05));
    fin = R(fin * (i === 0 ? 0.88 : 0.94)); // IPO proceeds retire part of the debt
    const pbt = ebitda - dep - fin;
    out[y] = {
      revenue: rev, ebitda, depreciation: dep, financeCosts: fin, pbt, pat: R(pbt * 0.7),
      capex: [520_000, 310_000, 140_000, 120_000, 120_000][i],
      volumeKt: [96, 118, 131, 139, 145][i], price: R(rev / [96, 118, 131, 139, 145][i]),
      margin: margins[i],
    };
  });
  return out;
})();

export const INTERIM = {
  period: 'nine months ended 7 April 2026',
  revenue: 2_341_880, gross: 601_220, operating: 358_910, financeCosts: 144_354, pbt: 214_556,
  pat: 150_189, totalAssets: 3_288_440, cash: 118_320, borrowings: 1_392_100, equity: 1_398_240,
  comparativeRevenue: 2_101_400, comparativePbt: 178_900,
};

export const OFFER = {
  newShares: 2_000_000, parValue: 300, priceLow: 420, priceHigh: 480, price: 450,
  existingShares: 1_600_000, gross: 900_000, expenses: 31_500,
};

export const PROCEEDS = [
  { use: 'Fourth crushing and refining line, Kality plant (equipment, installation, commissioning)', amount: 412_000, timing: 'FY2026–FY2027', priority: 1 },
  { use: 'Repayment of the Meskel Commercial Bank term facility (tranche B)', amount: 220_000, timing: 'Within 60 days of admission', priority: 2 },
  { use: 'Packaging line expansion — 1-litre and 5-litre PET, Bishoftu', amount: 96_500, timing: 'FY2027', priority: 3 },
  { use: 'Outgrower seed and input finance programme (sesame and niger seed)', amount: 70_000, timing: 'FY2026–FY2028', priority: 4 },
  { use: 'General working capital', amount: 70_000, timing: 'FY2026', priority: 5 },
];

export const fmt = (n: number) => n.toLocaleString('en-US');
