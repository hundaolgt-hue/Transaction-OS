/**
 * End-to-end exercise of the engagement lifecycle through the real data layer:
 * open an engagement, upload documents, run the agents, triage a finding and
 * pass the stage gate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-os-wf-'));
process.env.DATA_DIR = tmp;
process.env.ANTHROPIC_API_KEY = '';

const { db, insert, id, now } = await import('../src/lib/db');
const repo = await import('../src/lib/repo/core');
const { createUser } = await import('../src/lib/auth');
const { storeFile } = await import('../src/lib/documents');
const { runAgent } = await import('../src/lib/agents/runner');
const { listNotifications } = await import('../src/lib/notify');

let orgId: string;
let userId: string;
let clientId: string;
let engagementId: string;

beforeAll(async () => {
  db();
  orgId = id('org');
  insert('orgs', { id: orgId, name: 'Test Advisors', city: 'Addis Ababa', country: 'Ethiopia', createdAt: now() });
  const u = await createUser({ orgId, email: 'wf@test.et', name: 'Workflow Tester', password: 'password123', role: 'OWNER' });
  userId = u.id;
  const c = repo.createClient(orgId, { name: 'Test Issuer S.C.', legalForm: 'SHARE_COMPANY', sector: 'MANUFACTURING' });
  clientId = c.id;
});

afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('opening an engagement', () => {
  it('materialises the checklist, prospectus skeleton and stage history from the pack', () => {
    const e = repo.createEngagement(orgId, {
      clientId, name: 'IPO of 1,000,000 shares', transactionType: 'IPO',
      targetRaise: 300_000_000, documentThreshold: 80, leadAdvisorId: userId,
    });
    engagementId = e.id;
    expect(e.reference).toMatch(/^EQ-\d{4}-\d{3}$/);
    expect(e.rulePackKey).toBe('ECMA-EQUITY');
    expect(repo.listRequirements(e.id).length).toBeGreaterThan(20);
    expect(repo.listProspectus(e.id).length).toBeGreaterThan(10);
    expect(repo.listStageEvents(e.id)).toHaveLength(1);
    expect(repo.snapshot(orgId, e.id)!.completeness.percent).toBe(0);
  });

  it('creates a contract with the pack milestone plan and the fee split', () => {
    const contract = repo.createContract(engagementId, { title: 'Advisory agreement', totalFee: 1_000_000 });
    const ms = repo.listMilestones(contract.id);
    expect(ms.length).toBeGreaterThan(3);
    // Fee shares should distribute the whole fee (rounding aside).
    expect(ms.reduce((a, m) => a + m.paymentAmount, 0)).toBeCloseTo(1_000_000, -1);
  });
});

describe('document intake', () => {
  it('raises completeness as documents are accepted', async () => {
    const reqs = repo.listRequirements(engagementId);
    const before = repo.snapshot(orgId, engagementId)!.completeness.percent;

    const articles = reqs.find((r) => r.code === 'ECMA-C-002')!;
    const stored = await storeFile(engagementId, 'aoa.txt', 'text/plain', Buffer.from(
      'ARTICLES OF ASSOCIATION. Article 9 governs the transfer of shares. Article 20 establishes an audit committee.',
    ));
    repo.createDocument({
      engagementId, requirementId: articles.id, title: 'Articles of Association',
      fileName: 'aoa.txt', storageKey: stored.storageKey, mimeType: 'text/plain',
      sizeBytes: stored.sizeBytes, version: 1, supersedesId: null,
      extractedText: stored.extractedText, pageCount: null, status: 'SUBMITTED',
      reviewNote: null, uploadedById: userId, uploadedByRole: 'OWNER',
    });
    repo.updateRequirement(articles.id, { status: 'SUBMITTED' });
    const mid = repo.snapshot(orgId, engagementId)!.completeness.percent;
    expect(mid).toBeGreaterThan(before);

    repo.updateRequirement(articles.id, { status: 'ACCEPTED' });
    expect(repo.snapshot(orgId, engagementId)!.completeness.percent).toBeGreaterThan(mid);
  });

  it('extracts text so the agents have something to test', async () => {
    const stored = await storeFile(engagementId, 'x.txt', 'text/plain', Buffer.from('Some readable text.'));
    expect(stored.extractedText).toContain('readable');
  });
});

describe('agent runs', () => {
  it('the legal agent runs on the rule engine and drafts a report', async () => {
    const res = await runAgent({ engagementId, orgId, agent: 'LEGAL', triggeredById: userId, forceRules: true });
    expect(res.run.status).toBe('SUCCEEDED');
    expect(res.run.engine).toBe('RULES');
    const reports = repo.listReports(engagementId).filter((r) => r.kind === 'LEGAL');
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe('DRAFT');
    // Every report must carry the human-review section.
    const sections = JSON.parse(reports[0].sections) as { heading: string }[];
    expect(sections.some((s) => s.heading.toLowerCase().includes('expert review'))).toBe(true);
  });

  it('is idempotent — a second run raises no duplicate findings', async () => {
    const first = repo.listFindings(engagementId).length;
    const res = await runAgent({ engagementId, orgId, agent: 'LEGAL', triggeredById: userId, forceRules: true });
    expect(res.findingsCreated).toBe(0);
    expect(repo.listFindings(engagementId)).toHaveLength(first);
  });

  it('supersedes the previous report version rather than overwriting it', () => {
    const reports = repo.listReports(engagementId).filter((r) => r.kind === 'LEGAL');
    expect(reports).toHaveLength(2);
    expect(reports.filter((r) => r.status === 'SUPERSEDED')).toHaveLength(1);
    expect(reports.find((r) => r.status === 'DRAFT')!.version).toBe(2);
  });

  it('the risk agent turns findings into a scored register', async () => {
    // Move to a stage where missing documents are raised, so there is something to score.
    repo.setStage(engagementId, 'DUE_DILIGENCE', 'test', 'test');
    await runAgent({ engagementId, orgId, agent: 'FINANCIAL', triggeredById: userId, forceRules: true });
    await runAgent({ engagementId, orgId, agent: 'RISK', triggeredById: userId, forceRules: true });
    const risks = repo.listRisks(engagementId);
    expect(risks.length).toBeGreaterThan(0);
    for (const r of risks) {
      expect(r.inherentScore).toBe(r.likelihood * r.impact);
      expect(r.residualScore).toBeLessThanOrEqual(r.inherentScore);
      expect(r.disclosureStrategy).toBeTruthy();
    }
  });

  it('the prospectus agent drafts sections and records the engine that wrote them', async () => {
    await runAgent({ engagementId, orgId, agent: 'PROSPECTUS', triggeredById: userId, forceRules: true });
    const drafted = repo.listProspectus(engagementId).filter((s) => s.status !== 'NOT_STARTED');
    expect(drafted.length).toBeGreaterThan(0);
    expect(drafted[0].generatedBy).toBe('RULES');
    expect(drafted[0].wordCount).toBeGreaterThan(20);
  });

  it('the project agent notifies the team and logs its reasoning', async () => {
    const before = listNotifications(userId).length;
    const res = await runAgent({ engagementId, orgId, agent: 'PROJECT', triggeredById: userId, forceRules: true });
    expect(res.run.status).toBe('SUCCEEDED');
    expect(listNotifications(userId).length).toBeGreaterThan(before);
    expect(repo.listAgentLogs(res.run.id).length).toBeGreaterThan(0);
  });

  it('records an audit event for every run', () => {
    const events = repo.listAudit(orgId, { engagementId });
    expect(events.filter((e) => e.action === 'agent.run').length).toBeGreaterThanOrEqual(5);
  });
});

describe('triage and the stage gate', () => {
  it('blocks the stage gate while a critical finding is open', () => {
    const snap = repo.snapshot(orgId, engagementId)!;
    if (snap.compliance.critical > 0) {
      expect(snap.gate.canAdvance).toBe(false);
      expect(snap.gate.blockers.some((b) => b.toLowerCase().includes('critical'))).toBe(true);
    }
  });

  it('clears the gate once the documents are in and the criticals are resolved', () => {
    for (const r of repo.listRequirements(engagementId)) {
      repo.updateRequirement(r.id, { status: 'ACCEPTED' });
    }
    for (const f of repo.listFindings(engagementId)) {
      if (f.severity === 'CRITICAL') {
        repo.updateFinding(f.id, { status: 'RESOLVED', humanVerdict: 'CONFIRMED', resolvedById: userId, resolutionNote: 'Cleared in test.' });
      }
    }
    const snap = repo.snapshot(orgId, engagementId)!;
    expect(snap.completeness.percent).toBe(100);
    expect(snap.gate.canAdvance).toBe(true);
    expect(snap.gate.nextStage).toBe('RISK_ASSESSMENT');
  });

  it('records the stage change in the history', () => {
    repo.setStage(engagementId, 'RISK_ASSESSMENT', 'Gate satisfied', 'Workflow Tester');
    const events = repo.listStageEvents(engagementId);
    expect(events[0].toStage).toBe('RISK_ASSESSMENT');
    expect(events[0].fromStage).toBe('DUE_DILIGENCE');
  });
});

describe('tenant isolation', () => {
  it('will not return another org\'s engagement', () => {
    const otherOrg = id('org');
    insert('orgs', { id: otherOrg, name: 'Other Firm', city: 'Addis Ababa', country: 'Ethiopia', createdAt: now() });
    expect(repo.getEngagement(otherOrg, engagementId)).toBeNull();
    expect(repo.snapshot(otherOrg, engagementId)).toBeNull();
    expect(repo.getClient(otherOrg, clientId)).toBeNull();
  });
});

describe('report honesty', () => {
  it('a draft on a thin document set says so rather than reading as a clean opinion', async () => {
    // A fresh engagement with nothing filed against it.
    const e = repo.createEngagement(orgId, { clientId, name: 'Thin file test', transactionType: 'IPO' });
    repo.setStage(e.id, 'DUE_DILIGENCE', 'test', 'test');
    await runAgent({ engagementId: e.id, orgId, agent: 'LEGAL', triggeredById: userId, forceRules: true });
    const report = repo.listReports(e.id).find((r) => r.status === 'DRAFT')!;
    expect(report.executiveSummary).toContain('materially incomplete');
    expect(report.executiveSummary).not.toContain('No critical impediment to filing has been identified');
  });

  it('a complete, clean file gets the plain opinion', async () => {
    const e = repo.createEngagement(orgId, { clientId, name: 'Full file test', transactionType: 'IPO' });
    for (const r of repo.listRequirements(e.id)) repo.updateRequirement(r.id, { status: 'ACCEPTED' });
    repo.setStage(e.id, 'DUE_DILIGENCE', 'test', 'test');
    await runAgent({ engagementId: e.id, orgId, agent: 'LEGAL', triggeredById: userId, forceRules: true });
    const report = repo.listReports(e.id).find((r) => r.status === 'DRAFT')!;
    expect(report.executiveSummary).not.toContain('materially incomplete');
  });
});

describe('prospectus batching', () => {
  it('the rule engine drafts every section in one run, and a second run leaves human work alone', async () => {
    const e = repo.createEngagement(orgId, { clientId, name: 'Batch test', transactionType: 'IPO' });
    await runAgent({ engagementId: e.id, orgId, agent: 'PROSPECTUS', triggeredById: userId, forceRules: true });
    const sections = repo.listProspectus(e.id);
    expect(sections.every((s) => s.status !== 'NOT_STARTED')).toBe(true);
    const edited = sections[3];
    repo.updateProspectusSection(edited.id, { body: 'Edited by a reviewer.', generatedBy: 'HUMAN', status: 'IN_REVIEW' });
    const second = await runAgent({ engagementId: e.id, orgId, agent: 'PROSPECTUS', triggeredById: userId, forceRules: true });
    expect(second.summary).toMatch(/already has a draft/);
    expect(repo.getProspectusSection(edited.id)!.body).toBe('Edited by a reviewer.');
  });
});
