/**
 * Reports and the data room as real PDFs: page counts, and a round trip —
 * render each data-room document to PDF, extract it again, and require the
 * rule engine and the financial analysis to reach the same conclusions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-os-pdf-'));
process.env.DATA_DIR = tmp;

const { db, insert, id, now } = await import('../src/lib/db');
const repo = await import('../src/lib/repo/core');
const { runAgent } = await import('../src/lib/agents/runner');
const { ABYSSINIA_DATAROOM, COMPANY } = await import('../src/lib/dataroom/abyssinia');
const { dataRoomPdf } = await import('../src/lib/reports/dataRoomPdf');
const { buildDDReport } = await import('../src/lib/reports/ddReport');
const { buildProspectus } = await import('../src/lib/reports/prospectusPdf');
const { renderPdf } = await import('../src/lib/reports/render');
const { extractText } = await import('../src/lib/documents');
const { evaluateRules } = await import('../src/lib/agents/ruleEngine');
const { ecmaEquityPack } = await import('../src/lib/rulepacks/ecma-equity');
const { extractFinancials, computeRatios, analyticalFindings, extractCovenants } = await import('../src/lib/finance/analyze');

let orgId = '', engagementId = '';

beforeAll(async () => {
  db();
  orgId = id('org');
  insert('orgs', { id: orgId, name: 'Test Advisors', city: 'Addis Ababa', country: 'Ethiopia', createdAt: now() });
  const c = repo.createClient(orgId, { name: COMPANY.name });
  const e = repo.createEngagement(orgId, { clientId: c.id, name: 'IPO', transactionType: 'IPO', stage: 'DUE_DILIGENCE' });
  engagementId = e.id;
  const reqs = repo.listRequirements(e.id);
  for (const d of ABYSSINIA_DATAROOM) {
    const req = reqs.find((r) => r.code === d.code);
    repo.createDocument({ engagementId: e.id, requirementId: req?.id ?? null, title: d.title, fileName: d.fileName, storageKey: 'k', mimeType: 'text/plain', sizeBytes: d.body.length, version: 1, supersedesId: null, extractedText: d.body, pageCount: null, status: 'ACCEPTED', reviewNote: null, uploadedById: null, uploadedByRole: 'CLIENT' });
    if (req) repo.updateRequirement(req.id, { status: 'ACCEPTED' });
  }
  for (const agent of ['LEGAL', 'FINANCIAL', 'RISK', 'PROSPECTUS'] as const) {
    await runAgent({ engagementId: e.id, orgId, agent, forceRules: true });
  }
}, 60_000);

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('generated PDFs', () => {
  for (const kind of ['LEGAL', 'FINANCIAL', 'COMBINED'] as const) {
    it(`the ${kind.toLowerCase()} due diligence report runs to at least 30 pages`, async () => {
      const snap = repo.snapshot(orgId, engagementId)!;
      const { bytes, pages } = await renderPdf(buildDDReport(snap, kind, { firmName: 'Test Advisors', preparedBy: 'Tester' }));
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pages).toBeGreaterThanOrEqual(30);
    }, 30_000);
  }

  it('the prospectus renders every section and runs to at least 25 pages', async () => {
    const snap = repo.snapshot(orgId, engagementId)!;
    const { pages } = await renderPdf(buildProspectus(snap, { firmName: 'Test Advisors' }));
    expect(snap.prospectus.every((s) => s.body.length > 200)).toBe(true);
    expect(pages).toBeGreaterThanOrEqual(25);
  }, 30_000);

  it('the drafted prospectus never states a figure absent from the data room', () => {
    const snap = repo.snapshot(orgId, engagementId)!;
    const corpus = ABYSSINIA_DATAROOM.map((d) => d.body).join('\n');
    const mdna = snap.prospectus.find((s) => s.code === 'P-10')!.body;
    // Every seven-digit-plus figure in the financial section must be in the documents,
    // or be the sum of two figures that are (totals such as current + non-current borrowings).
    const toN = (s: string) => Number(s.replace(/,/g, ''));
    const known = new Set((corpus.match(/\d{1,3}(,\d{3})+/g) ?? []).map(toN));
    const list = [...known];
    for (const fig of mdna.match(/\d{1,3}(,\d{3}){2,}/g) ?? []) {
      const v = toN(fig);
      const derived = known.has(v) || list.some((a) => known.has(v - a));
      expect(derived, `${fig} is neither in the data room nor a sum of two figures in it`).toBe(true);
    }
  });
});

describe('PDF round trip', () => {
  it('a data room rendered to PDF and extracted again yields the same findings and flags', async () => {
    const reqs = ABYSSINIA_DATAROOM.filter((d) => d.code).map((d) => ({ id: `r-${d.code}`, code: d.code!, mandatory: 1, weight: 3, status: 'SUBMITTED' })) as never[];
    const fromText = ABYSSINIA_DATAROOM.map((d, i) => ({ id: `t${i}`, requirementId: d.code ? `r-${d.code}` : null, title: d.title, extractedText: d.body, version: 1 })) as never[];
    const fromPdf = [] as never[];
    for (const [i, d] of ABYSSINIA_DATAROOM.entries()) {
      const { bytes } = await renderPdf(dataRoomPdf(d.title, d.body, COMPANY.name));
      const { text } = await extractText(`${i}.pdf`, 'application/pdf', bytes);
      (fromPdf as { id: string }[]).push({ id: `t${i}`, requirementId: d.code ? `r-${d.code}` : null, title: d.title, extractedText: text, version: 1 } as never);
    }
    const asOf = new Date('2026-09-21');
    for (const agent of ['LEGAL', 'FINANCIAL', 'PROSPECTUS']) {
      const a = evaluateRules({ pack: ecmaEquityPack, agent, documents: fromText, requirements: reqs, asOf, raiseMissing: false }).map((h) => h.dedupeKey).sort();
      const b = evaluateRules({ pack: ecmaEquityPack, agent, documents: fromPdf, requirements: reqs, asOf, raiseMissing: false }).map((h) => h.dedupeKey).sort();
      expect(b).toEqual(a);
    }
    const flags = (docs: never[]) => {
      const f = extractFinancials(docs, reqs)!;
      return analyticalFindings(f, computeRatios(f), extractCovenants(docs, reqs)).map((x) => x.title);
    };
    expect(flags(fromPdf)).toEqual(flags(fromText));
  }, 60_000);
});
