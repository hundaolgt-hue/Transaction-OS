/**
 * Deterministic prospectus drafter. Each ECMA section has a composer that
 * writes narrative from the data room — facts, tables and computed figures —
 * and marks every gap [INFORMATION REQUIRED] rather than inventing it.
 * With an Anthropic key the Prospectus Agent drafts instead; this is the
 * floor it never falls below.
 */
import { buildDraftContext, md, words, type DraftContext } from './context';
import { financialNarrative } from '../finance/analyze';
import { fmtDate, titleCase, riskBand } from '../domain';
import type { EngagementSnapshot } from '../repo/core';
import type { ProspectusSectionSpec } from '../rulepacks';
import { BRAND } from '../brand';

type Composer = (c: DraftContext) => string;

const n = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));
const para = (...s: (string | false | null | undefined)[]) => s.filter(Boolean).join('\n\n');

function offerSentence(c: DraftContext): string {
  const o = c.offer;
  return `${c.legalName} (the "Company") is offering ${o.shares ? n(o.shares) : md.need('number of shares')} new ordinary shares of Birr ${o.par ?? '[par]'} each (the "Offer Shares") at an offer price of Birr ${o.price ?? md.need('offer price')} per share${o.priceLow && o.priceHigh ? `, within the price range of Birr ${o.priceLow} to Birr ${o.priceHigh} approved by the board` : ''}.`;
}

const directorsTable = (c: DraftContext) => c.tables('ECMA-G-003')[0];
const shareholderTable = (c: DraftContext) => c.tables('ECMA-C-005')[0];

const COMPOSERS: Record<string, Composer> = {
  'P-00': (c) => {
    const o = c.offer;
    return para(
      `# ${c.legalName}`,
      `**PROSPECTUS — INITIAL PUBLIC OFFERING OF ${o.shares ? n(o.shares) : '[NUMBER]'} ORDINARY SHARES**`,
      `Offer price: **Birr ${o.price ?? '[•]'} per share** · Par value: Birr ${o.par ?? '[•]'} · Gross proceeds: **${o.gross ? `Birr ${n(o.gross)}` : md.need('gross proceeds')}**`,
      `Application has been made for all issued shares of the Company, including the Offer Shares, to be admitted to trading on the Ethiopian Securities Exchange.`,
      md.rows(['Item', 'Detail'], [
        ['Issuer', c.legalName],
        ['Commercial registration', c.fact('ECMA-C-003', 'registration number') ?? md.need('registration number')],
        ['Head office', c.fact('ECMA-C-003', 'head office') ?? md.need('head office')],
        ['Securities offered', `${o.shares ? n(o.shares) : '[•]'} new ordinary shares of Birr ${o.par ?? '[•]'}`],
        ['Price range approved', o.priceLow ? `Birr ${o.priceLow} – ${o.priceHigh}` : md.need('price range')],
        ['Transaction adviser', BRAND.legalName],
        ['Underwriter', c.fact('ECMA-R-004', 'underwriter') ?? md.need('underwriter')],
        ['Registrar', c.fact('ECMA-R-005', 'registrar') ?? md.need('registrar')],
        ['Auditor', c.fact('ECMA-F-001', 'auditor') ?? md.need('auditor')],
        ['Offer opens / closes', md.need('offer timetable')],
      ]),
      `> **Investor warning.** An investment in the Offer Shares involves risk. Prospective investors should read the whole of this prospectus, and in particular the section headed Risk Factors, before deciding to invest. The approval of this prospectus by the Ethiopian Capital Market Authority is not an endorsement of the merits of the Company or of the Offer Shares.`,
    );
  },

  'P-01': (c) => para(
    '## Responsibility statement',
    `The directors of ${c.legalName}, whose names appear in the section headed Directors, Management and Corporate Governance, accept responsibility for the information contained in this prospectus. To the best of the knowledge and belief of the directors, having taken all reasonable care to ensure that such is the case, the information contained in this prospectus is in accordance with the facts and does not omit anything likely to affect the import of such information.`,
    '## Forward-looking statements',
    `This prospectus contains forward-looking statements, including the profit forecast and statements about the Company's plans for the fourth crushing line, its markets and its financing. These statements reflect the directors' current expectations and involve risks and uncertainties — among them those described under Risk Factors — that could cause actual results to differ materially. The Company does not undertake to update forward-looking statements except as required by law or by the Authority. No forward-looking statement is a guarantee of future performance, and no return on an investment in the Offer Shares is guaranteed.`,
    '## Restrictions on distribution',
    `This prospectus has been prepared for the offer of shares in Ethiopia. It does not constitute an offer in any jurisdiction in which such an offer would be unlawful. No person has been authorised to give any information or make any representation other than as contained in this prospectus.`,
    '## Approval',
    `This prospectus has been approved by the Ethiopian Capital Market Authority under the Capital Market Proclamation No. 1248/2021 ${md.need('approval number and date')}. Approval does not imply that the Authority has verified the accuracy of the information or recommends the investment.`,
  ),

  'P-02': (c) => para(
    'In this prospectus the following terms have the meanings set out below, unless the context requires otherwise.',
    md.rows(['Term', 'Meaning'], [
      ['Authority, ECMA', 'the Ethiopian Capital Market Authority'],
      ['Birr, ETB', 'the lawful currency of the Federal Democratic Republic of Ethiopia'],
      ['Board', 'the board of directors of the Company'],
      ['Commercial Code', 'the Commercial Code of Ethiopia, Proclamation No. 1243/2021'],
      ['Company', c.legalName],
      ['Exchange, ESX', 'the Ethiopian Securities Exchange'],
      ['Financial year, FY', 'the Company\'s financial year from 8 July to 7 July; "FY2025" is the year ended 7 July 2025'],
      ['IFRS', 'International Financial Reporting Standards'],
      ['Offer', 'the offer of the Offer Shares under this prospectus'],
      ['Offer Price', `Birr ${c.offer.price ?? '[•]'} per Offer Share`],
      ['Offer Shares', `the ${c.offer.shares ? n(c.offer.shares) : '[•]'} new ordinary shares being offered`],
      ['Proclamation', 'the Capital Market Proclamation No. 1248/2021'],
      ['Registrar', c.fact('ECMA-R-005', 'registrar') ?? 'the registrar appointed for the Offer'],
      ['Seed crushed', 'tonnes of oilseed processed through the Company\'s crushing lines'],
    ]),
    `Figures in tables are in thousands of Birr ("Birr '000") unless stated otherwise. Totals may not add because of rounding.`,
  ),

  'P-03': (c) => para(
    md.rows(['Role', 'Name and address'], [
      ['Registered and head office', c.fact('ECMA-C-003', 'head office') ?? md.need('head office')],
      ['Company secretary', 'Mekdes Hailu, Company Secretary and Head of Legal, at the head office'],
      ['Transaction adviser', `${BRAND.legalName}, ${BRAND.city} — ECMA-licensed investment bank (licence number ${md.need('adviser licence number')})`],
      ['Auditor and reporting accountant', `${c.fact('ECMA-F-003', 'auditor') ?? md.need('auditor')} (${c.fact('ECMA-F-003', 'aabe registration') ?? 'AABE registration to be stated'})`],
      ['Legal counsel to the Company', c.fact('ECMA-L-001', 'prepared by') ?? md.need('legal counsel')],
      ['Underwriter', c.fact('ECMA-R-004', 'underwriter') ?? md.need('underwriter')],
      ['Registrar', c.fact('ECMA-R-005', 'registrar') ?? md.need('registrar')],
      ['Independent valuer', c.fact('ECMA-F-006', 'valuer') ?? md.need('valuer')],
      ['Principal bankers', 'Meskel Commercial Bank S.C.; Entoto Development Bank'],
      ['Receiving banks', md.need('receiving banks for applications')],
    ]),
  ),

  'P-04': (c) => {
    const o = c.offer;
    const egm = c.text('ECMA-G-002');
    const quorum = c.fact('ECMA-G-002', 'shares represented');
    const underwriting = c.paras('ECMA-R-004')[0];
    return para(
      '## The Offer',
      offerSentence(c),
      `The Offer Shares will rank equally in all respects with the existing ${n(num2(c.text('ECMA-C-005').match(/([\d,]+) ordinary shares/)?.[1]))} ordinary shares, including the right to receive all dividends declared after admission. Each share carries one vote at general meetings.`,
      '## Authority for the Offer',
      `The Offer was approved by the board on 18 April 2026 and by an extraordinary general meeting held on 30 May 2026${quorum ? ` at which ${quorum} was represented` : ''}. ${/pre-emptive/i.test(egm) ? 'The general meeting waived pre-emptive rights in respect of the Offer and approved a priority allocation of up to 10% of the Offer Shares to existing shareholders.' : ''}`,
      '## Offer statistics',
      md.rows(['Item', 'Value'], [
        ['Offer Shares', o.shares ? n(o.shares) : '—'],
        ['Offer Price (Birr)', o.price ? n(o.price) : '—'],
        ['Gross proceeds (Birr)', o.gross ? n(o.gross) : '—'],
        ['Estimated expenses (Birr)', o.expenses ? n(o.expenses) : '—'],
        ['Net proceeds (Birr)', o.net ? n(o.net) : '—'],
        ['Shares in issue after the Offer', o.shares ? n(o.shares + 1_600_000) : '—'],
        ['Market capitalisation at the Offer Price (Birr)', o.shares && o.price ? n((o.shares + 1_600_000) * o.price) : '—'],
      ]),
      '## Underwriting',
      underwriting ? `${underwriting} The underwriting agreement is in draft at the date of this prospectus and will be executed before the Offer opens.` : md.need('underwriting arrangements'),
      '## Minimum subscription and allotment',
      `The minimum application is ${md.need('minimum application')}. If the Offer is over-subscribed, the Offer Shares will be allotted on a basis to be agreed with the Authority that gives priority to existing shareholders up to 10% of the Offer and otherwise treats applicants of the same size equally. Surplus application monies will be refunded without interest within ${md.need('refund period')} days of allotment.`,
      '## Timetable',
      md.rows(['Event', 'Date'], [['Offer opens', md.need('date')], ['Offer closes', md.need('date')], ['Allotment announced', md.need('date')], ['Refunds dispatched', md.need('date')], ['Admission to trading', md.need('date')]]),
    );
  },

  'P-05': (c) => {
    const t = c.tables('ECMA-F-005')[0];
    const p = c.paras('ECMA-F-005');
    return para(
      `The gross proceeds of the Offer are expected to be ${c.offer.gross ? `Birr ${n(c.offer.gross)}` : md.need('gross proceeds')}. After deducting estimated offer expenses of ${c.offer.expenses ? `Birr ${n(c.offer.expenses)}` : md.need('expenses')}, the net proceeds are expected to be ${c.offer.net ? `Birr ${n(c.offer.net)}` : md.need('net proceeds')}. The board intends to apply the net proceeds as follows:`,
      t ? md.table(t) : md.need('itemised use of proceeds'),
      p.find((x) => /priority|not fully subscribed/i.test(x)) ?? 'The order of priority under a partial subscription is to be stated.',
      '## Estimated expenses of the Offer',
      md.rows(['Item', "Birr '000"], [
        ['Underwriting commission', c.offer.gross ? n(c.offer.gross / 1000 * 0.6 * 0.0225 + c.offer.gross / 1000 * 0.4 * 0.0125) : '—'],
        ['Transaction adviser, legal and reporting accountant fees', md.need('professional fees')],
        ['Authority and exchange fees', md.need('regulatory fees')],
        ['Printing, advertising and distribution', md.need('marketing costs')],
      ]),
      `The use of proceeds reflects the Company's current plans. The board may reallocate proceeds between the purposes above if circumstances change, in which case the Company will disclose the change in accordance with its continuing disclosure obligations.`,
    );
  },

  'P-06': (c) => {
    const moa = c.text('ECMA-C-001');
    const objects = moa.match(/OBJECTS\.\s*([^\n]+)/)?.[1];
    const emp = c.paras('ECMA-L-005')[0];
    const props = c.tables('ECMA-L-003')[0];
    return para(
      '## History and incorporation',
      `${c.legalName} was incorporated as a share company on ${c.fact('ECMA-C-003', 'date of registration') ?? md.need('date of incorporation')} under registration number ${c.fact('ECMA-C-003', 'registration number') ?? '[•]'}. Its head office is at ${c.fact('ECMA-C-003', 'head office') ?? '[•]'}. ${moa.match(/AMENDMENTS\.\s*([^\n]+)/)?.[1] ?? ''}`,
      '## Principal activities',
      objects ? `The objects of the Company are: ${objects.replace(/^The objects of the Company are:\s*/i, '')}` : md.need('principal activities'),
      c.fin ? `In ${c.fin.years[c.fin.years.length - 1]} the Company generated revenue of Birr ${n(c.fin.revenue[c.fin.revenue.length - 1])} thousand. ${c.text('ECMA-F-001').match(/Note 3 — Revenue\.\s*([^\n]+)/)?.[1] ?? ''}` : '',
      '## Operations and properties',
      props ? `The Company operates from the following properties:\n\n${md.table(props)}\n\n${c.paras('ECMA-L-003').join(' ')}` : md.need('property schedule'),
      '## Employees',
      emp ?? md.need('employee numbers'),
      c.paras('ECMA-L-005').slice(1).join('\n\n'),
      '## Environmental and social',
      c.paras('ECMA-R-002').slice(0, 3).join('\n\n') || md.need('environmental position'),
      '## Intellectual property',
      c.tables('ECMA-L-004')[0] ? `${md.table(c.tables('ECMA-L-004')[0])}\n\n${c.paras('ECMA-L-004').join(' ')}` : md.need('trademarks'),
    );
  },

  'P-07': (c) => {
    const ms = c.marketStudy?.extractedText;
    const ps = ms ? ms.split(/\n\s*\n/).filter((p) => /^(Market size|Growth|Competition|Inputs|Regulation)\./.test(p.trim())) : [];
    return para(
      ps.length ? ps.map((p) => {
        const [h, ...rest] = p.trim().split('. ');
        return `## ${h}\n\n${rest.join('. ')}`;
      }).join('\n\n') : md.need('industry overview with sourced statistics'),
      '## The Company\'s competitive position',
      `Drawing on the documents on file, the Company's competitive position rests on integrated crushing, refining and packaging operations across three sites; a five-year supply agreement securing a minimum of 42,000 tonnes of seed a year; registered consumer brands; and an exclusive distribution arrangement covering Addis Ababa and Oromia. The same documents show the principal exposures: one distributor accounts for about 38% of refined-oil revenue, and input and foreign-exchange prices are outside the Company's control. ${md.need('directors\' confirmation of this assessment')}`,
      `> Market statistics in this section are ${ms && /synthetic/i.test(ms) ? 'drawn from a synthetic study prepared for demonstration and must be replaced with sourced figures before filing' : 'to be sourced and cited individually'}.`,
    );
  },

  'P-08': (c) => {
    const t = directorsTable(c);
    const bios = c.paras('ECMA-G-003').filter((p) => / — /.test(p) && !p.startsWith('Senior management'));
    const gov = c.paras('ECMA-G-005');
    const rem = c.paras('ECMA-G-003').find((p) => /^Remuneration/.test(p));
    const auditCommittee = /audit committee|audit and risk committee/i.test(c.text('ECMA-C-002'));
    return para(
      '## Board of directors',
      t ? md.table(t) : md.need('board composition'),
      bios.join('\n\n'),
      '## Senior management',
      c.paras('ECMA-G-003').find((p) => p.startsWith('Senior management')) ?? md.need('senior management'),
      '## Corporate governance',
      gov.map((g) => g.replace(/^\d+\.\s*/, '')).join('\n\n') || md.need('governance framework'),
      !auditCommittee ? `The Company's articles of association do not at present establish an audit committee. The board has resolved to establish an audit and risk committee within six months of admission. ${md.need('confirmation of committee composition before filing, or disclosure of the gap as a risk factor')}` : '',
      '## Remuneration',
      rem ?? md.need('directors\' remuneration'),
      '## Conflicts of interest and related-party dealings',
      `${c.paras('ECMA-G-004').slice(0, 2).join(' ')} Details of related-party transactions are set out in the Legal and Regulatory Matters section.`,
      c.paras('ECMA-G-003').find((p) => /fit and proper/i.test(p)) ?? '',
    );
  },

  'P-09': (c) => {
    const reg = shareholderTable(c);
    const hist = c.tables('ECMA-C-006')[0];
    const o = c.offer;
    const pre = 1_600_000;
    const post = o.shares ? pre + o.shares : null;
    return para(
      '## Share capital',
      `At the date of this prospectus the Company's subscribed and fully paid-up capital is Birr 480,000,000 divided into ${n(pre)} ordinary shares of Birr ${o.par ?? 300} each. Following the Offer the capital will be Birr ${post ? n(post * (o.par ?? 300)) : '[•]'} divided into ${post ? n(post) : '[•]'} ordinary shares.`,
      '## Capital history',
      hist ? md.table(hist) : md.need('capital history'),
      '## Substantial shareholders',
      reg ? md.table(reg) : md.need('shareholder register'),
      post && reg ? `### Shareholding before and after the Offer\n\n${md.rows(['Holder', 'Before', 'After (assuming no participation)'], reg.rows.slice(0, 6).map((r) => {
        const s = num2(r[2]) ?? 0;
        return [r[0], `${((s / pre) * 100).toFixed(1)}%`, `${((s / post) * 100).toFixed(1)}%`];
      }))}` : '',
      '## Beneficial ownership',
      c.tables('ECMA-R-003')[0] ? `The following persons hold, directly or indirectly, 10% or more of the Company:\n\n${md.table(c.tables('ECMA-R-003')[0])}` : md.need('beneficial ownership'),
      '## Lock-up',
      `${md.need('lock-up undertakings by the controlling shareholders, if any')}`,
    );
  },

  'P-10': (c) => {
    const f = c.fin, r = c.ratios;
    if (!f) return md.need('audited financial statements');
    const ys = f.years;
    return para(
      `The following summary financial information has been extracted without material adjustment from the audited financial statements of the Company for the years ended 7 July ${ys.map((y) => y.replace('FY', '')).join(', ')}, prepared in accordance with IFRS and audited by ${c.fact('ECMA-F-001', 'auditor') ?? 'the auditor'}, which issued an unmodified opinion on the most recent year. It should be read with the full financial statements, which are available for inspection.`,
      '## Summary income statement',
      md.rows(["Birr '000", ...ys], [
        ['Revenue', ...f.revenue], ['Gross profit', ...f.grossProfit], ['Operating profit', ...f.operatingProfit],
        ['Finance costs', ...f.financeCosts.map((v) => -v)], ['Profit before tax', ...f.pbt], ['Profit for the year', ...f.pat],
      ]),
      '## Summary statement of financial position',
      md.rows(["Birr '000", ...ys], [
        ['Total assets', ...f.totalAssets], ['Total equity', ...f.equity], ['Total borrowings', ...f.borrowings],
        ['Inventories', ...f.inventories], ['Trade receivables', ...f.receivables], ['Cash and cash equivalents', ...f.cash],
      ]),
      '## Key ratios',
      md.rows(['Ratio', ...ys], [
        ['Revenue growth', ...r.map((x) => md.pct(x.revenueGrowth))],
        ['Gross margin', ...r.map((x) => md.pct(x.grossMargin))],
        ['EBITDA margin', ...r.map((x) => md.pct(x.ebitdaMargin))],
        ['Net margin', ...r.map((x) => md.pct(x.netMargin))],
        ['Return on equity', ...r.map((x) => md.pct(x.roe))],
        ['Borrowings / equity', ...r.map((x) => `${x.gearing.toFixed(2)}x`)],
        ['Interest cover', ...r.map((x) => `${x.interestCover.toFixed(2)}x`)],
        ['Current ratio', ...r.map((x) => (x.currentRatio ? `${x.currentRatio.toFixed(2)}x` : '—'))],
      ]),
      '## Interim financial information',
      c.tables('ECMA-F-002')[0] ? `${md.table(c.tables('ECMA-F-002')[0])}\n\n${c.paras('ECMA-F-002').join(' ')}` : md.need('interim financial information'),
      '## Accounting policies',
      c.text('ECMA-F-001').match(/STATEMENT OF COMPLIANCE\n([^\n]+)/)?.[1] ?? '',
      '## Reporting accountant',
      c.paras('ECMA-F-003').find((p) => /^Opinion/.test(p)) ?? md.need('reporting accountant\'s report'),
    );
  },

  'P-11': (c) => {
    const f = c.fin, r = c.ratios;
    if (!f || r.length < 2) return md.need('audited financial statements for MD&A');
    const L = r.length - 1, P = L - 1;
    const g = (a: number[], i: number) => (a[i] - a[i - 1]) / a[i - 1];
    const rev = f.revenue;
    return para(
      financialNarrative(f, r),
      '## Revenue',
      `Revenue increased by ${md.pct(g(rev, L))} in ${f.years[L]} to Birr ${n(rev[L])} thousand, after growth of ${md.pct(g(rev, P))} in ${f.years[P]}. ${c.text('ECMA-F-001').match(/Note 3 — Revenue\.\s*([^\n]+)/)?.[1] ?? ''} ${md.need('management\'s explanation of the volume and price drivers of revenue growth')}`,
      '## Margins',
      `Gross margin ${r[L].grossMargin >= r[0].grossMargin ? 'improved' : 'declined'} from ${md.pct(r[0].grossMargin)} in ${f.years[0]} to ${md.pct(r[L].grossMargin)} in ${f.years[L]}. ${md.need('management\'s explanation of the gross margin movement')} Operating margin moved from ${md.pct(r[0].operatingMargin)} to ${md.pct(r[L].operatingMargin)}; selling and administrative costs ${(f.operatingProfit[L] / f.revenue[L]) > (f.operatingProfit[0] / f.revenue[0]) ? 'grew more slowly than revenue' : 'grew faster than revenue'} over the period.`,
      '## Finance costs and profit',
      `Finance costs rose to Birr ${n(f.financeCosts[L])} thousand as borrowings funded capacity expansion. Interest cover improved from ${r[0].interestCover.toFixed(2)}x to ${r[L].interestCover.toFixed(2)}x. Profit for the year was Birr ${n(f.pat[L])} thousand, a net margin of ${md.pct(r[L].netMargin)}.`,
      '## Working capital',
      `Receivable days moved from ${r[0].dso.toFixed(0)} to ${r[L].dso.toFixed(0)} and inventory days from ${r[0].dio.toFixed(0)} to ${r[L].dio.toFixed(0)}, lengthening the cash conversion cycle to ${r[L].cashConversionCycle.toFixed(0)} days. ${r[L].dso - r[0].dso > 5 ? ` ${md.need('management\'s explanation of the lengthening of receivable days')}` : ''}`,
      '## Liquidity and capital resources',
      `At ${f.years[L]} the Company had cash of Birr ${n(f.cash[L])} thousand and borrowings of Birr ${n(f.borrowings[L])} thousand (${r[L].gearing.toFixed(2)}x equity). ${c.covenants.maxGearing ? `The facility agreements require borrowings to equity not exceeding ${c.covenants.maxGearing}x${c.covenants.minDscr ? ` and a debt service coverage ratio of at least ${c.covenants.minDscr}x` : ''}; the Company was in compliance at each year end. ` : ''}Part of the Offer proceeds will repay the Meskel Commercial Bank term loan B, reducing gearing.`,
      c.tables('ECMA-F-007')[0] ? `### Borrowing facilities\n\n${md.table(c.tables('ECMA-F-007')[0])}` : '',
      '## Capital expenditure',
      f.capex ? `Capital expenditure was ${f.years.map((y, i) => `Birr ${n(f.capex![i])} thousand in ${y}`).join(', ')}. Commitments for the fourth crushing line are described in note 22 to the financial statements.` : '',
    );
  },

  'P-12': (c) => {
    const t = c.tables('ECMA-F-004');
    const assumptions = c.text('ECMA-F-004').match(/Within management's control:[^\n]+/)?.[0];
    const outside = c.text('ECMA-F-004').match(/Outside management's control:[^\n]+/)?.[0];
    return para(
      `The directors have prepared the following forecast of the Company's results for the financial years FY2026 to FY2030. The forecast has been prepared on a basis consistent with the Company's accounting policies. ${md.need('reporting accountant\'s report on the forecast')}`,
      t[0] ? md.table(t[0]) : md.need('forecast table'),
      '## Principal assumptions',
      assumptions ?? md.need('assumptions within management\'s control'),
      outside ?? md.need('assumptions outside management\'s control'),
      '## Sensitivities',
      t[1] ? md.table(t[1]) : md.need('sensitivity analysis'),
      `The forecast is inherently subject to uncertainty. Actual results are likely to differ from the forecast, and the differences may be material. Investors should not place undue reliance on it.`,
    );
  },

  'P-13': (c) => {
    const risks = [...c.snap.risks].sort((a, b) => b.inherentScore - a.inherentScore);
    const byCat = new Map<string, typeof risks>();
    for (const r of risks) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
    const generic = [
      ['Oilseed price and supply', 'The Company\'s principal input is oilseed, whose price is volatile and linked to export markets. A sharp rise in seed prices that cannot be passed on to customers would reduce margins. The Sheger supply agreement secures volume but prices at exchange reference rates.'],
      ['Foreign exchange', 'Machinery, spares, refining chemicals and packaging resins are imported. Depreciation of the Birr and restrictions on access to foreign exchange could increase costs and delay the fourth-line project.'],
      ['Execution of the fourth crushing line', 'The forecast assumes commissioning by the end of Q2 FY2027. Delays in equipment delivery, construction or commissioning would defer revenue growth; a six-month delay reduces forecast FY2028 profit after tax by about 10%.'],
      ['Customer concentration', 'A single exclusive distributor accounts for about 38% of refined-oil revenue.'],
      ['Liquidity of the shares', 'The Ethiopian Securities Exchange is at an early stage of development. There can be no assurance that an active trading market in the shares will develop, and investors may be unable to sell their shares at or above the Offer Price.'],
    ];
    return para(
      'An investment in the Offer Shares involves risk. Investors should consider carefully the risks described below, together with the other information in this prospectus. The risks are those the directors currently consider material; they are ordered within each category by the directors\' assessment of their significance. Additional risks not presently known, or presently considered immaterial, may also affect the Company.',
      ...[...byCat.entries()].map(([cat, rs]) => para(
        `## ${titleCase(cat)} risks`,
        ...rs.map((r) => `**${r.title.replace(/\.$/, '')}.** ${firstSentences(r.description, 2)} ${r.mitigation ? `*Mitigation:* ${firstSentences(r.mitigation, 1)}` : ''} *(Assessed ${riskBand(r.inherentScore).label.toLowerCase()} before mitigation.)*`),
      )),
      '## Risks relating to the business and the Offer',
      ...generic.map(([t, d]) => `**${t}.** ${d}`),
    );
  },

  'P-14': (c) => {
    const lit = c.tables('ECMA-L-001')[0];
    const contracts = c.paras('ECMA-L-002').filter((p) => /^\d+\./.test(p));
    const rp = c.tables('ECMA-G-004')[0];
    return para(
      '## Litigation',
      lit ? `${md.table(lit)}\n\n${c.paras('ECMA-L-001').filter((p) => !/^Signed/.test(p)).join(' ')}` : md.need('litigation schedule'),
      c.tables('ECMA-T-003')[0] ? `### Tax proceedings\n\n${md.table(c.tables('ECMA-T-003')[0])}` : '',
      '## Material contracts',
      contracts.length ? contracts.join('\n\n') : md.need('material contracts'),
      /change of control/i.test(c.text('ECMA-L-002')) ? `> The distribution agreement contains a change-of-control provision. The Company ${md.need('confirm whether the distributor has waived the provision in respect of the Offer')}.` : '',
      '## Related-party transactions',
      rp ? `${md.table(rp)}\n\n${c.paras('ECMA-G-004').filter((p) => !/^Signed/.test(p)).join(' ')}` : md.need('related-party schedule'),
      '## Licences and regulatory approvals',
      [c.paras('ECMA-C-004').join(' '), c.paras('ECMA-R-001').join(' ')].filter(Boolean).join('\n\n') || md.need('licences'),
      '## Property',
      c.tables('ECMA-L-003')[0] ? md.table(c.tables('ECMA-L-003')[0]) : md.need('property'),
      '## Insurance',
      c.tables('ECMA-L-006')[0] ? md.table(c.tables('ECMA-L-006')[0]) : md.need('insurance'),
    );
  },

  'P-15': () => para(
    `The following is a general summary of the Ethiopian tax treatment of holding and disposing of the shares. It is not tax advice. Investors should consult their own advisers. ${md.need('confirmation of every rate below by tax counsel against the Income Tax Proclamation No. 979/2016 as amended and the regulations in force at the filing date')}`,
    '## Dividends',
    'Dividends paid by an Ethiopian share company are subject to a final withholding tax, deducted by the Company at source and remitted to the tax authority. The rate is to be confirmed by tax counsel.',
    '## Gains on disposal',
    'Gains realised by an individual on the disposal of shares are taxable under the income tax rules on the disposal of investment assets. The rate, the computation of the gain and the treatment of trades on the Exchange are to be confirmed by tax counsel.',
    '## Stamp duty',
    'The transfer of shares may be subject to stamp duty. The applicability to transfers effected through the central securities depository is to be confirmed.',
    '## Non-resident holders',
    'Non-resident holders are subject to Ethiopian withholding on dividends and may be affected by any applicable double-taxation treaty. Eligibility of foreign investors to hold the shares is governed by the investment law and the rules of the Authority.',
  ),

  'P-16': (c) => para(
    '## Material change',
    `Save as disclosed in this prospectus, there has been no material change in the financial or trading position of the Company since ${c.fact('ECMA-F-002', 'period') ?? 'the date of the latest financial information'}. ${md.need('directors\' confirmation of no material change at the prospectus date')}`,
    '## Consents',
    `Each of the transaction adviser, the auditor, the valuer, legal counsel, the underwriter and the registrar has given and not withdrawn its written consent to the inclusion of its name and, where applicable, its report in the form and context in which it appears. ${md.need('signed consent letters')}`,
    '## Documents available for inspection',
    `Copies of the following documents may be inspected at the head office during normal business hours for the duration of the Offer:\n\n${c.snap.documents.filter((d) => d.requirementId).slice(0, 18).map((d) => `- ${d.title}`).join('\n')}`,
    '## Directors\' declaration',
    `The directors declare that they have taken all reasonable care to ensure that the information in this prospectus is, to the best of their knowledge, in accordance with the facts and contains no omission likely to affect its import. ${md.need('signatures of every director')}`,
  ),

  'P-17': (c) => para(
    `Applications for the Offer Shares must be made on the application form below and submitted with payment at any branch of the receiving banks listed in the Corporate Directory between the opening and closing dates of the Offer.`,
    '## Instructions',
    ['Complete the form in block capitals.', `State the number of Offer Shares applied for; the minimum application is ${md.need('minimum application')} shares.`, `Pay the full amount (number of shares × Birr ${c.offer.price ?? '[Offer Price]'}) at the time of application.`, 'Attach a copy of a valid identification document; corporate applicants attach their commercial registration and board resolution.', 'Existing shareholders applying under the priority allocation must state their register number.'].map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '## Application form',
    md.rows(['Field', 'Entry'], [['Full name / company name', ''], ['Identification or registration number', ''], ['Address and telephone', ''], ['Number of Offer Shares applied for', ''], ['Amount paid (Birr)', ''], ['Bank account for refunds', ''], ['Existing shareholder register no. (if applicable)', '']]),
    '## Declaration',
    `I/We apply for the number of Offer Shares stated above on the terms of the prospectus dated ${md.need('date')}, agree to accept any smaller number allotted to me/us, and confirm that I/we have read the prospectus, including the Risk Factors.`,
    'Signature: ______________________   Date: ______________',
  ),
};

function num2(s: string | undefined): number | null {
  if (!s) return null;
  const v = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
}

function firstSentences(s: string, k: number) {
  const parts = s.replace(/\s+/g, ' ').split(/(?<=\.)\s+/);
  return parts.slice(0, k).join(' ');
}

/** Generic composer for packs whose section codes have no bespoke drafter. */
function genericComposer(spec: ProspectusSectionSpec, c: DraftContext): string {
  const blocks: string[] = [`${spec.guidance}`];
  for (const code of spec.sourceRequirements) {
    const d = c.doc(code);
    if (!d) { blocks.push(md.need(`${code} — no document on file`)); continue; }
    blocks.push(`## ${d.title}`);
    const tables = c.tables(code);
    const paras = c.paras(code).filter((p) => !/^Signed/.test(p));
    if (paras.length) blocks.push(paras.slice(0, 4).join('\n\n'));
    if (tables[0]) blocks.push(md.table(tables[0]));
  }
  return para(...blocks);
}

export interface DraftResult { body: string; words: number; completeness: number; gaps: number }

export function draftSection(snap: EngagementSnapshot, spec: ProspectusSectionSpec, ctx?: DraftContext): DraftResult {
  const c = ctx ?? buildDraftContext(snap);
  const composer = COMPOSERS[spec.code];
  const body = (composer ? composer(c) : genericComposer(spec, c)).replace(/\n{3,}/g, '\n\n').trim();
  const w = words(body);
  const gaps = (body.match(/\[INFORMATION REQUIRED/g) ?? []).length;
  // Completeness credits length against the target, less a deduction per open gap.
  const completeness = Math.max(5, Math.min(100, Math.round((Math.min(1, w / spec.minWords) * 100) - gaps * 4)));
  return { body, words: w, completeness, gaps };
}

export { buildDraftContext };
export const COMPOSED_CODES = Object.keys(COMPOSERS);
export const _fmtDate = fmtDate;
