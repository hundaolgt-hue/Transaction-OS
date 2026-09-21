/**
 * Due diligence report as a pdfmake document definition. Pure: the server
 * renders it with pdfmake's Node printer, the browser preview with pdfmake's
 * browser build. Legal, Financial and Combined share one skeleton; each adds
 * its own review chapters.
 */
import type { EngagementSnapshot } from '../repo/core';
import type { Finding, Document } from '../types';
import { getRulePack } from '../rulepacks';
import { buildDraftContext, type DraftContext } from '../drafting/context';
import { financialNarrative } from '../finance/analyze';
import { ruleTestResults } from '../agents/ruleEngine';
import { barChart, lineChart, donut, hbar, heatmap, PRINT_THEME } from '../charts/svg';
import { AGENT_META, GAP_LABEL, STAGE_META, TRANSACTION_LABEL, fmtDate, titleCase, riskBand, type AgentKey, type GapType, type Stage, type TransactionType } from '../domain';
import { mdToPdf, type Node } from './mdToPdf';
import { shell, cover, kpiRow, h1, h2, p, svg, simpleTable, sevCell, COLORS, SEV_COLOR } from './styles';

export type ReportKind = 'LEGAL' | 'FINANCIAL' | 'COMBINED';

export interface ReportMeta {
  firmName: string; preparedBy: string; reviewer?: string | null; approved?: boolean; date?: string;
  auditLog?: { at: string; actor: string; action: string }[];
  agentRuns?: { agent: string; at: string; summary: string | null; engine: string }[];
}

const n = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));
const pc = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const x2 = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(2)}x`);
const LIVE = ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'];
const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const LEGAL_CATS = ['CORPORATE', 'GOVERNANCE', 'LEGAL', 'REGULATORY'];
const FIN_CATS = ['FINANCIAL', 'TAX'];

function excerpt(d: Document | null, max = 900): string {
  if (!d?.extractedText) return '';
  const body = d.extractedText.split('\n').filter((l) => !l.startsWith('SYNTHETIC') && l.trim()).slice(1).join(' ');
  const flat = body.replace(/\|/g, ' ').replace(/-{3,}/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function findingBlock(f: Finding, docs: Map<string, string>, i: number): Node {
  return {
    unbreakable: false,
    stack: [
      { columns: [
        { text: `${i}. ${f.title}`, bold: true, fontSize: 10.2, width: '*' },
        { text: `${titleCase(f.severity)} · ${GAP_LABEL[f.gapType as GapType] ?? f.gapType}`, color: SEV_COLOR[f.severity], bold: true, fontSize: 8.4, alignment: 'right', width: 170 },
      ], margin: [0, 6, 0, 4] },
      simpleTable(['Attribute', 'Detail'], [
        ['Raised by', `${AGENT_META[f.agent as AgentKey]?.name ?? f.agent} · confidence ${Math.round(f.confidence * 100)}%`],
        ['Document', f.documentId ? docs.get(f.documentId) ?? '—' : 'No document on file'],
        ['Authority', f.citation ?? 'To be confirmed'],
        ['Status', `${titleCase(f.status)}${f.humanVerdict ? ` · expert verdict: ${titleCase(f.humanVerdict)}` : ' · awaiting expert verdict'}`],
      ], [110, '*']),
      { text: 'Observation', style: 'h4' },
      ...f.detail.split(/\n\n+/).map((t) => p(t)),
      ...(f.excerpt ? [{ table: { widths: ['*'], body: [[{ text: f.excerpt, fontSize: 8.6, color: COLORS.muted, italics: true }]] }, layout: 'card', margin: [0, 2, 0, 8] }] : []),
      { text: 'Recommended action', style: 'h4' },
      p(f.recommendation ?? 'To be determined by the reviewing expert.'),
      ...(f.resolutionNote ? [p([{ text: 'Resolution: ', bold: true }, f.resolutionNote])] : []),
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 499, y2: 2, lineWidth: 0.4, lineColor: '#e0e4e2' }], margin: [0, 4, 0, 4] },
    ],
  };
}

/** One review chapter per area: documents, tests applied, observations, findings. */
function areaChapter(c: DraftContext, category: string, findings: Finding[], docTitles: Map<string, string>, tests: ReturnType<typeof ruleTestResults>): Node[] {
  const reqs = c.snap.requirements.filter((r) => r.category === category);
  const out: Node[] = [h2(`${titleCase(category)} documents and matters`)];
  out.push(p(`${reqs.length} checklist item${reqs.length === 1 ? '' : 's'} in this area; ${reqs.filter((r) => ['ACCEPTED', 'WAIVED'].includes(r.status)).length} accepted or waived, ${reqs.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length} under review and ${reqs.filter((r) => ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status)).length} outstanding.`));
  for (const r of reqs) {
    const d = c.doc(r.code);
    const rt = tests.filter((t) => t.requirementCode === r.code);
    const rf = findings.filter((f) => f.requirementId === r.id);
    out.push({ text: `${r.code} — ${r.title}`, style: 'h3' });
    out.push(simpleTable(['Item', 'Position'], [
      ['Requirement', r.description ?? '—'],
      ['Authority', r.authorityRef ?? '—'],
      ['Document on file', d ? `${d.title} (v${d.version}, received ${fmtDate(d.createdAt)})` : 'None'],
      ['Checklist status', titleCase(r.status)],
      ['Tests applied', rt.length ? rt.map((t) => `${t.ruleId} ${t.result.toLowerCase()}`).join('; ') : 'No automated test for this item; reviewed for completeness only'],
      ['Findings', rf.length ? rf.map((f) => `${titleCase(f.severity)}: ${f.title}`).join('; ') : 'None raised'],
    ], [110, '*']));
    if (d) {
      out.push({ text: 'What the document shows', style: 'h4' });
      out.push(p(excerpt(d)));
    } else {
      out.push(p([{ text: 'Not on file. ', bold: true }, `No document has been received against ${r.code}. The matter cannot be concluded until it is.`]));
    }
  }
  return out;
}

export function buildDDReport(snap: EngagementSnapshot, kind: ReportKind, meta: ReportMeta): Node {
  const c = buildDraftContext(snap);
  const pack = getRulePack(snap.engagement.rulePackKey);
  const date = meta.date ?? fmtDate(new Date().toISOString());
  const agents = kind === 'LEGAL' ? ['LEGAL', 'PROSPECTUS'] : kind === 'FINANCIAL' ? ['FINANCIAL'] : ['LEGAL', 'FINANCIAL', 'PROSPECTUS'];
  const inScope = (f: Finding) => agents.includes(f.agent) || kind === 'COMBINED';
  const all = snap.findings.filter(inScope).filter((f) => !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
  const live = all.filter((f) => LIVE.includes(f.status));
  const docTitles = new Map(snap.documents.map((d) => [d.id, d.title]));
  const tests = ruleTestResults({ pack, documents: snap.documents, requirements: snap.requirements, agents: agents.filter((a) => a !== 'PROSPECTUS') });
  const cats = kind === 'LEGAL' ? LEGAL_CATS : kind === 'FINANCIAL' ? FIN_CATS : [...LEGAL_CATS, ...FIN_CATS];
  const title = kind === 'LEGAL' ? 'Legal Due Diligence Report' : kind === 'FINANCIAL' ? 'Financial Due Diligence Report' : 'Due Diligence Report — Legal, Financial and Tax';
  const sevCount = (s: string) => live.filter((f) => f.severity === s).length;
  const reqsInScope = snap.requirements.filter((r) => cats.includes(r.category));
  const f = c.fin, r = c.ratios;

  const content: Node[] = [];

  // ---------------------------------------------------------------- cover
  content.push(...cover({
    eyebrow: `${pack.name} · ${TRANSACTION_LABEL[snap.engagement.transactionType as TransactionType] ?? snap.engagement.transactionType}`,
    title, subtitle: snap.engagement.name, client: c.legalName, reference: snap.engagement.reference,
    firm: meta.firmName, date, status: meta.approved ? 'Approved' : 'Draft for expert review',
    lines: [
      ['Prepared for', `The board of directors of ${c.legalName}`],
      ['Prepared by', `${meta.firmName} — ${meta.preparedBy}`],
      ['Reviewing expert', meta.reviewer ?? 'To be assigned'],
      ['Rule pack', `${pack.name} (${pack.key} v${pack.version})`],
      ['Documents reviewed', `${snap.documents.length} documents against ${reqsInScope.length} checklist items`],
      ['Date', date],
    ],
  }));

  // ------------------------------------------------------ document control
  content.push({ text: 'Document control', style: 'h1' });
  content.push(simpleTable(['Version', 'Date', 'Author', 'Description'], [
    ['0.1', date, 'Advisor OS agents', 'Machine-assisted draft generated from the data room'],
    ['0.2', '—', meta.reviewer ?? '[Reviewer]', 'Expert review: findings confirmed, amended or rejected'],
    ['1.0', '—', meta.reviewer ?? '[Reviewer]', 'Approved for issue to the board'],
  ], [50, 70, 110, '*']));
  content.push(p('Distribution: this report is addressed to the board of directors of the issuer and to the transaction adviser. It may be disclosed to the Ethiopian Capital Market Authority in support of the filing. It must not be relied upon by any other person.'));
  content.push({ text: 'Sign-off', style: 'h2' });
  content.push(simpleTable(['Role', 'Name', 'Signature', 'Date'], [
    ['Engagement lead', meta.preparedBy, '', ''], ['Reviewing expert', meta.reviewer ?? '', '', ''], ['Quality reviewer', '', '', ''],
  ], ['*', '*', 110, 70]));
  content.push({ toc: { title: { text: 'Contents', style: 'h1' }, numberStyle: { fontSize: 9 } }, pageBreak: 'before' });

  // ------------------------------------------------------ executive summary
  content.push(h1('1. Executive summary'));
  content.push(kpiRow([
    ['Documents reviewed', String(snap.documents.length), `${snap.completeness.percent}% checklist completeness`],
    ['Open findings', String(live.length), `${sevCount('CRITICAL')} critical · ${sevCount('HIGH')} high`],
    ['Compliance score', String(snap.compliance.score), '100 is a clean file'],
    ['Stage', STAGE_META[snap.engagement.stage as Stage]?.label ?? snap.engagement.stage, snap.gate.canAdvance ? 'Gate satisfied' : 'Gate blocked'],
  ]));
  const crit = live.filter((x) => ['CRITICAL', 'HIGH'].includes(x.severity));
  content.push(p(`This report records the ${kind === 'COMBINED' ? 'legal, financial and tax' : kind === 'LEGAL' ? 'legal, corporate and regulatory' : 'financial and tax'} due diligence performed on ${c.legalName} (the "Company") in connection with ${snap.engagement.name}. The review covered ${reqsInScope.length} checklist items drawn from the ${pack.name} rule pack and ${snap.documents.length} documents supplied by the Company, and applied ${tests.length} automated tests in addition to the analytical procedures described in section 3.`));
  content.push(p(`${live.length} matter${live.length === 1 ? '' : 's'} remain${live.length === 1 ? 's' : ''} open. ${sevCount('CRITICAL') ? `${sevCount('CRITICAL')} ${sevCount('CRITICAL') === 1 ? 'is' : 'are'} critical and must be resolved before the Company proceeds to filing.` : 'None is critical.'} ${sevCount('HIGH')} ${sevCount('HIGH') === 1 ? 'is' : 'are'} rated high and should be resolved or fully disclosed before filing. ${snap.completeness.mandatoryMissing ? `${snap.completeness.mandatoryMissing} mandatory document${snap.completeness.mandatoryMissing === 1 ? ' is' : 's are'} still outstanding or under review, so conclusions on those areas are provisional.` : 'All mandatory documents are on file.'}`));
  if (f && kind !== 'LEGAL') content.push(p(financialNarrative(f, r)));
  content.push({ text: 'Principal matters', style: 'h2' });
  content.push(simpleTable(['#', 'Matter', 'Severity', 'Action before filing'],
    (crit.length ? crit : live).slice(0, 12).map((x, i) => [String(i + 1), x.title, sevCell(x.severity), x.recommendation ?? '—']),
    [16, 150, 52, '*']));
  const sevItems = SEV_ORDER.map((s) => ({ label: titleCase(s), value: sevCount(s), color: SEV_COLOR[s] })).filter((i) => i.value);
  if (sevItems.length) content.push(svg(donut({ items: sevItems, centre: String(live.length), sub: 'open findings', title: 'Open findings by severity', width: 460, height: 170 }), 430));
  content.push({ text: 'Assessment by area', style: 'h2' });
  content.push(simpleTable(['Area', 'Items', 'Complete', 'Open findings', 'Assessment'], cats.map((cat) => {
    const rq = snap.requirements.filter((x) => x.category === cat);
    const cp = snap.completeness.byCategory.find((b) => b.category === cat)?.percent ?? 0;
    const fs = live.filter((x) => rq.some((q) => q.id === x.requirementId) || (cat === 'FINANCIAL' && x.gapType === 'FINANCIAL' && !x.requirementId));
    const worst = SEV_ORDER.find((s) => fs.some((x) => x.severity === s));
    const rag = worst === 'CRITICAL' ? 'Red — blocking' : worst === 'HIGH' ? 'Amber — resolve before filing' : cp < 75 ? 'Amber — documents outstanding' : 'Green';
    return [titleCase(cat), String(rq.length), `${cp}%`, String(fs.length), { text: rag, color: rag.startsWith('Red') ? COLORS.critical : rag.startsWith('Amber') ? COLORS.high : COLORS.good, bold: true }];
  }), ['*', 40, 55, 70, 150], [1, 2, 3]));

  // ------------------------------------------------------------- scope
  content.push(h1('2. Scope, basis and limitations'));
  content.push(p(`${meta.firmName} was engaged by ${c.legalName} as transaction adviser for ${snap.engagement.name}. This report forms part of that engagement and addresses the matters an investor, the Ethiopian Capital Market Authority and the Company's directors would expect to be examined before an offering document is issued.`));
  content.push({ text: 'Scope', style: 'h2' });
  content.push({ ul: cats.map((cat) => `${titleCase(cat)}: ${snap.requirements.filter((x) => x.category === cat).map((x) => x.title).join('; ')}.`), style: 'li', margin: [8, 0, 0, 8] });
  content.push({ text: 'Basis of preparation', style: 'h2' });
  content.push(p(`The review was performed on the documents made available in the engagement data room as at ${date}. Each document was tested against the rules of the ${pack.name} rule pack (version ${pack.version}) and, where statements were provided, subjected to analytical review. Where a document was not provided, the corresponding matter is reported as outstanding and no conclusion is expressed.`));
  content.push(p(pack.disclaimer));
  content.push({ text: 'Limitations', style: 'h2' });
  content.push({ ul: [
    'No independent verification of the underlying records has been performed beyond the documents supplied.',
    'No site visits, physical inspections or management interviews are reflected in this draft; the reviewing expert should add them before approval.',
    'The review is not an audit and does not express an audit opinion on the financial statements.',
    'Legal references are drafting aids maintained by the adviser and must be confirmed against the Negarit Gazeta edition and the directive in force at the filing date.',
    'Documents in the data room for this demonstration engagement are synthetic and describe a fictional company.',
  ], style: 'li', margin: [8, 0, 0, 8] });

  // --------------------------------------------------------- methodology
  content.push(h1('3. Methodology'));
  content.push(p('The review combines three layers. Each finding in section 7 records which layer raised it.'));
  content.push(simpleTable(['Layer', 'What it does', 'Reproducible'], [
    ['Rule-pack tests', 'Presence, prohibition, currency and quantification tests on each document, each tied to a citation in the rule pack.', 'Yes — same result on every run'],
    ['Analytical review', 'Ratios and trends computed from the statements in the data room, tested against stated thresholds (for example receivable days, interest cover, covenant headroom).', 'Yes'],
    ['Expert review', 'The responsible expert confirms, amends or rejects every machine-raised finding and adds matters requiring judgement.', 'Recorded in the audit trail'],
  ], [95, '*', 110]));
  content.push({ text: 'Severity scale', style: 'h2' });
  content.push(simpleTable(['Severity', 'Meaning', 'Expected treatment'], [
    [sevCell('CRITICAL'), 'An impediment to filing or a matter that could invalidate the offer.', 'Resolve before filing; the stage gate blocks until it is closed.'],
    [sevCell('HIGH'), 'A material gap in compliance, disclosure or financial position.', 'Resolve before filing or disclose prominently with mitigation.'],
    [sevCell('MEDIUM'), 'A weakness that should be addressed or explained.', 'Address in the remediation plan; disclose if unresolved.'],
    [sevCell('LOW'), 'An editorial or housekeeping matter.', 'Correct in the next version of the document.'],
  ], [60, '*', 170]));
  content.push({ text: 'Test types', style: 'h2' });
  content.push(simpleTable(['Type', 'Description'], [
    ['Must contain', 'Every listed provision must appear in the document.'],
    ['Must contain any', 'At least one of a set of equivalent provisions must appear.'],
    ['Must not contain', 'A provision that creates exposure (for example a change-of-control clause or a modified opinion) must not appear.'],
    ['Currency', 'The most recent date in the document must fall within the staleness window.'],
    ['Quantification', 'A directive requires amounts, so the document must carry a schedule of figures.'],
    ['Editorial', 'Placeholders, missing execution and unqualified forward-looking statements.'],
  ], [110, '*']));
  content.push(p(`In total ${tests.length} rule tests were applied in this review: ${tests.filter((t) => t.result === 'PASS').length} passed, ${tests.filter((t) => t.result === 'FAIL').length} failed and ${tests.filter((t) => t.result === 'NOT TESTED').length} could not be run because the document was not on file. The full results are in Appendix C.`));

  // ------------------------------------------------------------ issuer
  content.push(h1('4. The Company'));
  content.push(simpleTable(['Attribute', 'Detail'], [
    ['Registered name', c.legalName],
    ['Legal form', c.fact('ECMA-C-003', 'legal form') ?? titleCase(snap.client.legalForm)],
    ['Registration number', c.fact('ECMA-C-003', 'registration number') ?? '—'],
    ['Date of registration', c.fact('ECMA-C-003', 'date of registration') ?? '—'],
    ['Head office', c.fact('ECMA-C-003', 'head office') ?? snap.client.addressLine ?? '—'],
    ['Principal business', c.fact('ECMA-C-003', 'principal business') ?? titleCase(snap.client.sector)],
    ['TIN', snap.client.tin ?? '—'],
    ['Registered capital', c.fact('ECMA-C-003', 'registered capital') ?? '—'],
    ['Auditor', c.fact('ECMA-F-001', 'auditor') ?? '—'],
  ], [130, '*']));
  const moa = c.text('ECMA-C-001').match(/OBJECTS\.\s*([^\n]+)/)?.[1];
  if (moa) content.push(p(moa));
  const reg = c.tables('ECMA-C-005')[0];
  if (reg) {
    content.push(h2('Shareholding'));
    content.push(mdToPdf(tableMd(reg))[0]);
    const vals = reg.rows.map((row) => ({ label: row[0], value: Number(String(row[2]).replace(/,/g, '')) || 0 }));
    content.push(svg(donut({ items: vals.slice(0, 7), centre: n(vals.reduce((a, b) => a + b.value, 0)), sub: 'shares in issue', title: 'Shareholder register', width: 480, height: 190 }), 450));
  }
  const bo = c.tables('ECMA-R-003')[0];
  if (bo) { content.push(h2('Beneficial ownership')); content.push(mdToPdf(tableMd(bo))[0]); }
  const cap = c.tables('ECMA-C-006')[0];
  if (cap) { content.push(h2('Capital history')); content.push(mdToPdf(tableMd(cap))[0]); }
  const dirs = c.tables('ECMA-G-003')[0];
  if (dirs) {
    content.push(h2('Board of directors'));
    content.push(mdToPdf(tableMd(dirs))[0]);
    const indep = dirs.rows.filter((row) => /^yes/i.test(row[2] ?? '')).length;
    content.push(p(`${indep} of ${dirs.rows.length} directors are recorded as independent (${pc(indep / dirs.rows.length)}). ${/one third/i.test(c.text('ECMA-C-002')) ? `The articles require at least one third of directors to be independent; the board ${indep / dirs.rows.length >= 1 / 3 ? 'meets' : 'does not meet'} that requirement.` : ''}`));
  }

  // ------------------------------------------------------------ legal
  if (kind !== 'FINANCIAL') {
    content.push(h1(`5. Legal and regulatory review`));
    content.push(p('This chapter works through each legal, corporate, governance and regulatory checklist item: what the requirement is, the document received, the tests applied and their results, and what the document shows.'));
    for (const cat of LEGAL_CATS) content.push(...areaChapter(c, cat, all, docTitles, tests));
    const lit = c.tables('ECMA-L-001')[0];
    if (lit) {
      content.push(h2('Litigation exposure'));
      const items = lit.rows.map((row) => ({ label: row[1], value: Number(String(row[3]).replace(/,/g, '')) || 0, color: COLORS.high })).filter((i) => i.value > 0);
      if (items.length) content.push(svg(hbar({ items, title: "Claims by amount (Birr '000)", format: (v) => v.toLocaleString('en-US') })));
      content.push(p(`Aggregate claimed amounts across ${lit.rows.length} matters are Birr ${n(items.reduce((a, b) => a + b.value, 0))} thousand. The schedule records counsel's assessment for each matter; the reviewing expert should confirm that provisions in the financial statements are consistent with those assessments.`));
    }
    const rp = c.tables('ECMA-G-004')[0];
    if (rp) { content.push(h2('Related-party transactions')); content.push(mdToPdf(tableMd(rp))[0]); content.push(...c.paras('ECMA-G-004').filter((x) => !/^Signed/.test(x)).map((x) => p(x))); }
  }

  // --------------------------------------------------------- financial
  if (kind !== 'LEGAL') {
    const num = kind === 'FINANCIAL' ? 5 : 6;
    content.push(h1(`${num}. Financial and tax review`));
    if (!f) {
      content.push(p('No parseable financial statements were found in the data room. The financial review cannot be completed until the audited statements are received.'));
    } else {
      content.push(p(`The analysis below is computed from "${f.source}" as filed in the data room. Figures are in Birr '000. The statements are stated to be prepared under IFRS; the auditor's opinion on the latest year is ${/qualified|adverse|disclaimer|except for/i.test(c.text('ECMA-F-003')) ? 'modified — see findings' : 'unmodified'}.`));
      content.push(h2('Income statement'));
      content.push(simpleTable(["Birr '000", ...f.years], [
        ['Revenue', ...f.revenue.map(n)], ['Cost of sales', ...f.cogs.map((v) => n(-v))], ['Gross profit', ...f.grossProfit.map(n)],
        ['Operating profit', ...f.operatingProfit.map(n)], ['Finance costs', ...f.financeCosts.map((v) => n(-v))], ['Profit before tax', ...f.pbt.map(n)], ['Profit for the year', ...f.pat.map(n)],
      ], undefined, [1, 2, 3, 4]));
      content.push(svg(barChart({ labels: f.years, series: [{ name: 'Revenue', values: f.revenue }, { name: 'Gross profit', values: f.grossProfit }, { name: 'Operating profit', values: f.operatingProfit }], line: { name: 'Gross margin', values: r.map((x) => x.grossMargin) }, title: "Revenue, profit and margin (Birr '000)" })));
      content.push(p(financialNarrative(f, r)));
      content.push(h2('Statement of financial position'));
      content.push(simpleTable(["Birr '000", ...f.years], [
        ['Total assets', ...f.totalAssets.map(n)], ['Inventories', ...f.inventories.map(n)], ['Trade receivables', ...f.receivables.map(n)],
        ['Cash', ...f.cash.map(n)], ['Total borrowings', ...f.borrowings.map(n)], ['Trade payables', ...f.payables.map(n)], ['Total equity', ...f.equity.map(n)],
      ], undefined, [1, 2, 3, 4]));
      content.push(svg(barChart({ labels: f.years, series: [{ name: 'Equity', values: f.equity }, { name: 'Borrowings', values: f.borrowings }], line: { name: 'Borrowings / equity', values: r.map((x) => x.gearing), format: (v) => `${v.toFixed(2)}x` }, title: 'Funding structure' })));
      if (f.opCash) {
        content.push(h2('Cash flow'));
        content.push(simpleTable(["Birr '000", ...f.years], [
          ['Net cash from operating activities', ...f.opCash.map(n)], ['Capital expenditure', ...(f.capex ?? []).map(n)],
          ['EBITDA', ...r.map((x) => n(x.ebitda))], ['Operating cash / EBITDA', ...r.map((x) => pc(x.cashConversion))],
        ], undefined, [1, 2, 3, 4]));
      }
      content.push(h2('Ratio analysis'));
      content.push(simpleTable(['Ratio', ...f.years, 'Comment'], [
        ['Revenue growth', ...r.map((x) => pc(x.revenueGrowth)), 'Year on year'],
        ['Gross margin', ...r.map((x) => pc(x.grossMargin)), ''],
        ['EBITDA margin', ...r.map((x) => pc(x.ebitdaMargin)), ''],
        ['Net margin', ...r.map((x) => pc(x.netMargin)), ''],
        ['Return on equity', ...r.map((x) => pc(x.roe)), ''],
        ['Return on assets', ...r.map((x) => pc(x.roa)), ''],
        ['Current ratio', ...r.map((x) => x2(x.currentRatio)), 'Threshold 1.20x'],
        ['Quick ratio', ...r.map((x) => x2(x.quickRatio)), ''],
        ['Borrowings / equity', ...r.map((x) => x2(x.gearing)), c.covenants.maxGearing ? `Covenant ${c.covenants.maxGearing}x` : ''],
        ['Net debt / EBITDA', ...r.map((x) => x2(x.netDebtToEbitda)), ''],
        ['Interest cover', ...r.map((x) => x2(x.interestCover)), 'Threshold 3.0x'],
        ['Receivable days', ...r.map((x) => x.dso.toFixed(0)), ''],
        ['Inventory days', ...r.map((x) => x.dio.toFixed(0)), ''],
        ['Payable days', ...r.map((x) => x.dpo.toFixed(0)), ''],
        ['Cash conversion cycle', ...r.map((x) => x.cashConversionCycle.toFixed(0)), 'Days'],
      ], undefined, [1, 2, 3]));
      content.push(svg(lineChart({ labels: f.years, series: [{ name: 'Receivable days', values: r.map((x) => x.dso) }, { name: 'Inventory days', values: r.map((x) => x.dio) }, { name: 'Payable days', values: r.map((x) => x.dpo) }], format: (v) => v.toFixed(0), title: 'Working capital days' })));
      if (c.analysis.length) {
        content.push(h2('Analytical flags'));
        content.push(simpleTable(['Flag', 'Severity', 'Basis'], c.analysis.map((a) => [a.title, sevCell(a.severity), a.detail]), [150, 55, '*']));
      }
      const fac = c.tables('ECMA-F-007')[0];
      if (fac) {
        content.push(h2('Borrowings and covenants'));
        content.push(mdToPdf(tableMd(fac))[0]);
        content.push(...c.paras('ECMA-F-007').filter((x) => !/^Signed/.test(x)).map((x) => p(x)));
        if (c.covenants.maxGearing) {
          const last = r[r.length - 1];
          content.push(p(`Headroom on the gearing covenant at ${last.year} was ${pc((c.covenants.maxGearing - last.gearing) / c.covenants.maxGearing)} (${x2(last.gearing)} against ${x2(c.covenants.maxGearing)}). The reviewing expert should confirm the projected covenant position through to the expected admission date.`));
        }
      }
      const proj = c.tables('ECMA-F-004');
      if (proj[0]) {
        content.push(h2('Projections'));
        content.push(mdToPdf(tableMd(proj[0]))[0]);
        const years = proj[0].header.slice(1);
        const revRow = proj[0].rows.find((row) => /^revenue/i.test(row[0]));
        const ebRow = proj[0].rows.find((row) => /^ebitda/i.test(row[0]));
        if (revRow && ebRow) content.push(svg(barChart({ labels: years, series: [{ name: 'Revenue', values: revRow.slice(1).map((v) => Number(v.replace(/,/g, ''))) }, { name: 'EBITDA', values: ebRow.slice(1).map((v) => Number(v.replace(/,/g, ''))) }], title: "Management projections (Birr '000)" })));
        content.push(...c.paras('ECMA-F-004').filter((x) => /control/i.test(x)).map((x) => p(x)));
        if (proj[1]) { content.push({ text: 'Sensitivities', style: 'h3' }); content.push(mdToPdf(tableMd(proj[1]))[0]); }
        if (f) {
          const lastRev = f.revenue[f.revenue.length - 1];
          const firstProj = revRow ? Number(revRow[1].replace(/,/g, '')) : null;
          if (firstProj) content.push(p(`The first projected year implies revenue growth of ${pc(firstProj / lastRev - 1)} on the last audited year, against a historical compound growth of ${pc(Math.pow(lastRev / f.revenue[0], 1 / (f.revenue.length - 1)) - 1)}. The reviewing expert should test the step-up in the year the new capacity is commissioned against the construction contract timetable.`));
        }
      }
      const val = c.tables('ECMA-F-006')[0];
      if (val) { content.push(h2('Valuation')); content.push(...c.paras('ECMA-F-006').slice(0, 2).map((x) => p(x))); content.push(mdToPdf(tableMd(val))[0]); }
      content.push(h2('Tax'));
      content.push(p(`Tax clearance: ${c.fact('ECMA-T-001', 'date of issue') ? `issued ${c.fact('ECMA-T-001', 'date of issue')}, validity ${c.fact('ECMA-T-001', 'validity') ?? 'not stated'}.` : 'not on file.'}`));
      const vat = c.tables('ECMA-T-002')[0];
      if (vat) {
        content.push(mdToPdf(tableMd(vat))[0]);
        const late = vat.rows.filter((row) => /^no/i.test(row[5] ?? '')).length;
        content.push(p(`${vat.rows.length} monthly returns reviewed; ${late} filed late.`));
      }
      const td = c.tables('ECMA-T-003')[0];
      if (td) { content.push({ text: 'Open assessments', style: 'h3' }); content.push(mdToPdf(tableMd(td))[0]); }
      for (const cat of FIN_CATS) content.push(...areaChapter(c, cat, all, docTitles, tests));
    }
  }

  // ------------------------------------------------------------ findings
  const fNum = kind === 'COMBINED' ? 7 : 6;
  content.push(h1(`${fNum}. Findings register`));
  content.push(p(`${all.length} finding${all.length === 1 ? '' : 's'} are recorded in scope, of which ${live.length} remain open. Each is set out below with the document tested, the authority relied upon and the action recommended.`));
  content.push(simpleTable(['#', 'Finding', 'Agent', 'Severity', 'Status'], all.map((x, i) => [String(i + 1), x.title, AGENT_META[x.agent as AgentKey]?.short ?? x.agent, sevCell(x.severity), titleCase(x.status)]), [18, '*', 58, 52, 72]));
  const sorted = [...all].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  sorted.forEach((x, i) => content.push(findingBlock(x, docTitles, i + 1)));

  // --------------------------------------------------------------- risks
  content.push(h1(`${fNum + 1}. Risk assessment`));
  if (snap.risks.length) {
    content.push({ columns: [
      { svg: heatmap({ cells: snap.risks, title: 'Inherent risk', width: 240 }), width: 240 },
      { svg: heatmap({ cells: snap.risks.map((k) => ({ likelihood: k.residualLikelihood, impact: k.residualImpact })), title: 'Residual risk (after mitigation)', width: 240 }), width: 240 },
    ], columnGap: 18, margin: [0, 4, 0, 12] });
    content.push(simpleTable(['Code', 'Risk', 'Category', 'Inherent', 'Residual'], snap.risks.map((k) => [k.code, k.title, titleCase(k.category), `${k.inherentScore} (${riskBand(k.inherentScore).label})`, String(k.residualScore)]), [40, '*', 70, 75, 45]));
    for (const k of snap.risks) {
      content.push({ text: `${k.code} — ${k.title}`, style: 'h3' });
      content.push(p(k.description.split('\n\n')[0]));
      content.push(simpleTable(['Aspect', 'Assessment'], [
        ['Likelihood × impact', `${k.likelihood} × ${k.impact} = ${k.inherentScore}`],
        ['Mitigation', k.mitigation ?? '—'],
        ['Residual', `${k.residualLikelihood} × ${k.residualImpact} = ${k.residualScore}`],
        ['Disclosure strategy', k.disclosureStrategy ?? '—'],
        ['Placement in the offering document', k.prospectusPlacement ?? 'Risk Factors'],
      ], [120, '*']));
    }
  } else {
    content.push(p('The risk register is empty. Run the Risk Agent to derive it from the findings.'));
  }

  // ------------------------------------------------------ recommendations
  content.push(h1(`${fNum + 2}. Recommendations and conditions before filing`));
  content.push(p('The actions below are ordered by severity. Items marked as conditions should be satisfied before the offering document is lodged with the Authority.'));
  content.push(simpleTable(['#', 'Action', 'Severity', 'Condition to filing'], sorted.filter((x) => LIVE.includes(x.status)).map((x, i) => [String(i + 1), x.recommendation ?? x.title, sevCell(x.severity), ['CRITICAL', 'HIGH'].includes(x.severity) ? 'Yes' : 'No']), [18, '*', 55, 70]));
  const outstanding = snap.requirements.filter((q) => cats.includes(q.category) && ['MISSING', 'REQUESTED', 'REJECTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(q.status));
  if (outstanding.length) {
    content.push({ text: 'Documents to be received or accepted', style: 'h2' });
    content.push(simpleTable(['Code', 'Document', 'Status', 'Mandatory'], outstanding.map((q) => [q.code, q.title, titleCase(q.status), q.mandatory ? 'Yes' : 'No']), [70, '*', 80, 55]));
  }

  // ----------------------------------------------------------- appendices
  content.push(h1('Appendix A — Document index'));
  content.push(simpleTable(['Code', 'Document', 'Version', 'Received', 'Status', 'Size'], snap.documents.map((d) => {
    const q = snap.requirements.find((x) => x.id === d.requirementId);
    return [q?.code ?? 'Unfiled', d.title, `v${d.version}`, fmtDate(d.createdAt), titleCase(d.status), `${(d.sizeBytes / 1024).toFixed(1)} KB`];
  }), [62, '*', 36, 62, 58, 44]));

  content.push(h1('Appendix B — Checklist status'));
  content.push(simpleTable(['Code', 'Requirement', 'Category', 'Weight', 'Mandatory', 'Status'], snap.requirements.map((q) => [q.code, q.title, titleCase(q.category), String(q.weight), q.mandatory ? 'Yes' : 'No', titleCase(q.status)]), [62, '*', 62, 34, 46, 64]));
  content.push(svg(hbar({ items: snap.completeness.byCategory.map((b) => ({ label: titleCase(b.category), value: b.percent, color: b.percent >= 75 ? COLORS.good : b.percent >= 40 ? COLORS.high : COLORS.critical })), max: 100, format: (v) => `${v}%`, title: 'Completeness by category' })));

  content.push(h1('Appendix C — Rule tests and results'));
  content.push(p('Every automated test applied in this review, with the document it was applied to and the result. A test is "not tested" when no document was on file.'));
  content.push(simpleTable(['Rule', 'Test', 'Document', 'Severity if failed', 'Result'], tests.map((t) => [t.ruleId, t.title, t.documentTitle ?? `— (${t.requirementCode})`, sevCell(t.severity), { text: t.result, bold: true, color: t.result === 'PASS' ? COLORS.good : t.result === 'FAIL' ? COLORS.critical : COLORS.faint }]), [34, '*', 130, 55, 50]));

  content.push(h1('Appendix D — Authorities referred to'));
  const auths = [...new Set([...snap.requirements.map((q) => q.authorityRef), ...pack.rules.map((x) => x.citation)].filter(Boolean) as string[])].sort();
  content.push({ ul: auths.map((a) => ({ text: a, style: 'li' })), margin: [8, 0, 0, 8] });
  content.push(p(pack.disclaimer));

  content.push(h1('Appendix E — Glossary'));
  content.push(simpleTable(['Term', 'Meaning'], [
    ['AABE', 'Accounting and Auditing Board of Ethiopia'], ['DSO / receivable days', 'Trade receivables ÷ revenue × 365'],
    ['DIO / inventory days', 'Inventories ÷ cost of sales × 365'], ['DPO / payable days', 'Trade payables ÷ cost of sales × 365'],
    ['EBITDA', 'Operating profit before depreciation and amortisation'], ['ECMA', 'Ethiopian Capital Market Authority'],
    ['ESX', 'Ethiopian Securities Exchange'], ['Gearing', 'Total borrowings ÷ total equity'],
    ['IFRS', 'International Financial Reporting Standards'], ['Interest cover', 'Operating profit ÷ finance costs'],
    ['Rule pack', 'The versioned set of checklist items, tests and drafting requirements applied to the engagement'],
    ['Stage gate', 'The completeness threshold and critical-finding test an engagement must pass to advance a stage'],
  ], [120, '*']));

  content.push(h1('Appendix F — Review record'));
  if (meta.agentRuns?.length) {
    content.push({ text: 'Agent runs', style: 'h2' });
    content.push(simpleTable(['When', 'Agent', 'Engine', 'Summary'], meta.agentRuns.slice(0, 30).map((a) => [fmtDate(a.at), AGENT_META[a.agent as AgentKey]?.short ?? a.agent, a.engine === 'ANTHROPIC' ? 'Reasoning' : 'Rules', a.summary ?? '']), [62, 58, 50, '*']));
  }
  if (meta.auditLog?.length) {
    content.push({ text: 'Audit trail extract', style: 'h2' });
    content.push(simpleTable(['When', 'Actor', 'Action'], meta.auditLog.slice(0, 40).map((a) => [fmtDate(a.at), a.actor, a.action]), [70, 130, '*']));
  }
  content.push({ text: 'Expert review record', style: 'h2' });
  content.push(simpleTable(['Item', 'Record'], [
    ['Reviewer', meta.reviewer ?? ''], ['Date of review', ''], ['Findings confirmed', ''], ['Findings amended or rejected, with reasons', ''],
    ['Additional matters identified', ''], ['Site visits and interviews performed', ''], ['Conclusion', ''], ['Signature', ''],
  ], [180, '*']));

  return shell({ title, subtitle: snap.engagement.name, firm: meta.firmName, client: c.legalName, reference: snap.engagement.reference, draft: !meta.approved, content });
}

function tableMd(t: { header: string[]; rows: string[][] }): string {
  return [`| ${t.header.join(' | ')} |`, `|${t.header.map(() => '---').join('|')}|`, ...t.rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

export { tableMd, PRINT_THEME };
