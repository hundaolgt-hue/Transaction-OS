import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-os-ai-'));
process.env.DATA_DIR = tmp;
process.env.ANTHROPIC_API_KEY = '';

const { db, insert, id, now } = await import('../src/lib/db');
const repo = await import('../src/lib/repo/core');
const { runAgent } = await import('../src/lib/agents/runner');
const { answerQuestion } = await import('../src/lib/assistant/server');
const { search, buildCorpus } = await import('../src/lib/assistant/knowledge');
const { buildGraph } = await import('../src/lib/knowledge/graph');
const { ABYSSINIA_DATAROOM, COMPANY } = await import('../src/lib/dataroom/abyssinia');
const { toTelegramHtml, toSlackMrkdwn } = await import('../src/lib/integrations/format');
const { verifySlack, saveIntegration, publicView, config } = await import('../src/lib/integrations');

let orgId = '', ipo = '', otherClient = '';

beforeAll(async () => {
  db();
  orgId = id('org');
  insert('orgs', { id: orgId, name: 'Test Advisors', city: 'Addis Ababa', country: 'Ethiopia', createdAt: now() });
  const c = repo.createClient(orgId, { name: COMPANY.name });
  const c2 = repo.createClient(orgId, { name: 'Other Holdings S.C.' });
  otherClient = c2.id;
  const e = repo.createEngagement(orgId, { clientId: c.id, name: 'IPO', transactionType: 'IPO', stage: 'DUE_DILIGENCE' });
  repo.createEngagement(orgId, { clientId: c2.id, name: 'Bond', transactionType: 'BOND' });
  ipo = e.id;
  const reqs = repo.listRequirements(e.id);
  for (const d of ABYSSINIA_DATAROOM.slice(0, 20)) {
    const req = reqs.find((r) => r.code === d.code);
    repo.createDocument({ engagementId: e.id, requirementId: req?.id ?? null, title: d.title, fileName: d.fileName, storageKey: 'k', mimeType: 'text/plain', sizeBytes: 1, version: 1, supersedesId: null, extractedText: d.body, pageCount: null, status: 'SUBMITTED', reviewNote: null, uploadedById: null, uploadedByRole: 'CLIENT' });
    if (req) repo.updateRequirement(req.id, { status: 'SUBMITTED' });
  }
  for (const agent of ['LEGAL', 'FINANCIAL', 'RISK'] as const) await runAgent({ engagementId: e.id, orgId, agent, forceRules: true });
}, 60_000);

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('assistant', () => {
  it('answers missing-document questions from the checklist', async () => {
    const a = await answerQuestion(orgId, 'What documents are still missing for Abyssinia?');
    expect(a.intent).toBe('missing');
    expect(a.text).toContain('EQ-');
    expect(a.text).toMatch(/Litigation|Material Contracts|Title Deeds/);
  });

  it('answers covenant questions with the covenant and the headroom', async () => {
    const a = await answerQuestion(orgId, 'What is the gearing covenant on the IPO?');
    expect(a.text).toContain('1.25x');
    expect(a.text).toMatch(/headroom/i);
  });

  it('retrieves document content for open questions', () => {
    const snaps = [repo.snapshot(orgId, ipo)!];
    const hits = search(buildCorpus(snaps), 'distributor change of control Gihon');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('a client sees only its own engagement and never internal findings', async () => {
    const a = await answerQuestion(orgId, 'Summarise all projects', { clientId: otherClient });
    expect(a.text).not.toContain(COMPANY.name);
    const b = await answerQuestion(orgId, 'What are the findings?', { clientId: otherClient });
    expect(b.text).not.toMatch(/director|covenant|beneficial/i);
  });
});

describe('knowledge graph', () => {
  it('connects firm, clients, engagements, documents, findings and risks', () => {
    const snaps = repo.listEngagements(orgId).map((e) => repo.snapshot(orgId, e.id)!);
    const g = buildGraph(repo.getOrg(orgId)!, repo.listStaff(orgId), snaps);
    expect(g.counts.CLIENT).toBe(2);
    expect(g.counts.ENGAGEMENT).toBe(2);
    expect(g.counts.DOCUMENT).toBe(20);
    expect(g.counts.FINDING).toBeGreaterThan(0);
    expect(g.counts.GAP).toBeGreaterThan(0);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) { expect(ids.has(e.source)).toBe(true); expect(ids.has(e.target)).toBe(true); }
  });
});

describe('chat integrations', () => {
  it('converts assistant markdown for Telegram and escapes HTML', () => {
    const html = toTelegramHtml('**Bold** <script> and _it_\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<b>Bold</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('1  ·  2');
    expect(html).not.toContain('---');
  });

  it('converts assistant markdown for Slack', () => {
    expect(toSlackMrkdwn('**Bold** text\n## Head')).toBe('*Bold* text\n*Head*');
  });

  it('verifies Slack signatures and rejects stale or forged ones', () => {
    const secret = 'shh', body = 'text=hello', ts = String(Math.floor(Date.now() / 1000));
    const sig = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`;
    expect(verifySlack(secret, ts, sig, body)).toBe(true);
    expect(verifySlack(secret, ts, sig, 'text=tampered')).toBe(false);
    expect(verifySlack(secret, String(Number(ts) - 900), sig, body)).toBe(false);
    expect(verifySlack('wrong', ts, sig, body)).toBe(false);
  });

  it('stores secrets but never returns them unmasked, and keeps them when a masked value is saved back', () => {
    saveIntegration(orgId, 'TELEGRAM', { enabled: true, config: { botToken: '123456:ABCDEFGHIJKLMNOP', chatId: '-100200' } });
    const view = publicView(orgId).TELEGRAM as { config: { botToken: string } };
    expect(view.config.botToken).not.toContain('ABCDEFGHIJKLMNOP');
    const row = saveIntegration(orgId, 'TELEGRAM', { config: { botToken: view.config.botToken } });
    expect(config<{ botToken: string; webhookSecret: string }>(row).botToken).toBe('123456:ABCDEFGHIJKLMNOP');
    expect(config<{ webhookSecret: string }>(row).webhookSecret.length).toBeGreaterThan(20);
  });
});
