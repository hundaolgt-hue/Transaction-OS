import 'server-only';
import { env } from '../env';
import { getRulePack } from '../rulepacks';
import { AGENT_META, type AgentKey, fmtDate, fmtMoney, titleCase, stageIndex } from '../domain';
import * as repo from '../repo/core';
import { notify, audienceFor, clientUsersFor } from '../notify';
import { complete, extractJson, LlmUnavailable } from './anthropic';
import { systemPrompt, FINDINGS_SCHEMA, RISK_SCHEMA, REPORT_SCHEMA } from './prompts';
import { evaluateRules, type RuleHit } from './ruleEngine';
import { draftSection, buildDraftContext } from '../drafting/prospectus';
import { extractFinancials, computeRatios, extractCovenants, analyticalFindings } from '../finance/analyze';
import type { AgentRun, Document, Finding, ReportSection, Requirement } from '../types';
import type { EngagementSnapshot } from '../repo/core';

export interface RunOptions {
  engagementId: string;
  orgId: string;
  agent: AgentKey;
  task?: string;
  triggeredById?: string | null;
  actorName?: string;
  /** Force the deterministic engine even when a key is present (used by tests). */
  forceRules?: boolean;
  payload?: Record<string, unknown>;
}

export interface RunResult {
  run: AgentRun;
  findingsCreated: number;
  summary: string;
  artifacts: Record<string, unknown>;
}

const MAX_DOC_CHARS = 6000;

function docDigest(docs: Document[], reqs: Requirement[], limit = 14): string {
  const byId = new Map(reqs.map((r) => [r.id, r]));
  return docs
    .slice(0, limit)
    .map((d) => {
      const req = d.requirementId ? byId.get(d.requirementId) : null;
      const text = (d.extractedText ?? '').slice(0, MAX_DOC_CHARS);
      return `### ${d.title}\nRequirement: ${req ? `${req.code} — ${req.title}` : 'unfiled'}\nStatus: ${d.status}\nUploaded: ${fmtDate(d.createdAt)}\n\n${text || '(no extractable text)'}\n`;
    })
    .join('\n---\n');
}

function checklistDigest(reqs: Requirement[]): string {
  return reqs
    .map((r) => `- [${r.status}] ${r.code} ${r.title}${r.mandatory ? ' (mandatory)' : ''} — ${r.authorityRef ?? ''}`)
    .join('\n');
}

function contextHeader(s: EngagementSnapshot): string {
  return `Engagement: ${s.engagement.reference} — ${s.engagement.name}
Client: ${s.client.name} (${titleCase(s.client.legalForm)}, ${titleCase(s.client.sector)}), ${s.client.city}
Transaction: ${titleCase(s.engagement.transactionType)}${s.engagement.targetRaise ? `, target ${fmtMoney(s.engagement.targetRaise, s.engagement.currency)}` : ''}
Stage: ${titleCase(s.engagement.stage)} · Document completeness ${s.completeness.percent}% · Open findings ${s.compliance.open}
Target filing date: ${fmtDate(s.engagement.targetFilingDate)}`;
}

// --------------------------------------------------------------- the runner

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const snap = repo.snapshot(opts.orgId, opts.engagementId);
  if (!snap) throw new Error('Engagement not found');
  const pack = getRulePack(snap.engagement.rulePackKey);
  const useLlm = env.aiEnabled && !opts.forceRules;

  const run = repo.createAgentRun({
    engagementId: opts.engagementId,
    agent: opts.agent,
    task: opts.task ?? 'ANALYZE',
    engine: useLlm ? 'ANTHROPIC' : 'RULES',
    model: useLlm ? env.anthropicModel : null,
    input: JSON.stringify({ stage: snap.engagement.stage, documents: snap.documents.length, payload: opts.payload ?? {} }),
    triggeredById: opts.triggeredById ?? null,
  });

  const started = Date.now();
  repo.updateAgentRun(run.id, { status: 'RUNNING', startedAt: new Date().toISOString(), progress: 5 });
  repo.logAgent(run.id, `${AGENT_META[opts.agent].name} started on ${snap.engagement.reference} using the ${useLlm ? 'Anthropic' : 'deterministic rule'} engine.`);

  let result: RunResult;
  try {
    result = await dispatch(opts, snap, pack, run, useLlm);
    repo.updateAgentRun(run.id, {
      status: 'SUCCEEDED',
      progress: 100,
      summary: result.summary,
      output: JSON.stringify(result.artifacts).slice(0, 200_000),
      findingsCount: result.findingsCreated,
      durationMs: Date.now() - started,
      finishedAt: new Date().toISOString(),
    });
    repo.logAgent(run.id, `Completed in ${Date.now() - started}ms. ${result.summary}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    repo.updateAgentRun(run.id, {
      status: 'FAILED', error: message, durationMs: Date.now() - started, finishedAt: new Date().toISOString(),
    });
    repo.logAgent(run.id, `Failed: ${message}`, 'ERROR');
    throw err;
  }

  repo.audit({
    orgId: opts.orgId, actorId: opts.triggeredById, actorName: opts.actorName ?? 'system',
    action: 'agent.run', entityType: 'AgentRun', entityId: run.id, engagementId: opts.engagementId,
    metadata: { agent: opts.agent, findings: result.findingsCreated, engine: useLlm ? 'ANTHROPIC' : 'RULES' },
  });

  await notify({
    userIds: audienceFor(opts.engagementId),
    engagementId: opts.engagementId,
    kind: 'AGENT',
    severity: result.findingsCreated > 0 ? 'WARNING' : 'INFO',
    title: `${AGENT_META[opts.agent].name} finished on ${snap.engagement.reference}`,
    body: result.summary,
    link: `/engagements/${opts.engagementId}/agents`,
  });

  return { ...result, run: repo.getAgentRun(run.id)! };
}

async function dispatch(
  opts: RunOptions, snap: EngagementSnapshot, pack: ReturnType<typeof getRulePack>,
  run: AgentRun, useLlm: boolean,
): Promise<RunResult> {
  switch (opts.agent) {
    case 'FINANCIAL':
    case 'LEGAL':
      return analysisAgent(opts, snap, pack, run, useLlm);
    case 'RISK':
      return riskAgent(opts, snap, pack, run, useLlm);
    case 'PROSPECTUS':
      return prospectusAgent(opts, snap, pack, run, useLlm);
    case 'SECRETARY':
      return secretaryAgent(opts, snap, run, useLlm);
    case 'PROJECT':
      return projectAgent(opts, snap, run);
    default:
      throw new Error(`Unknown agent ${opts.agent}`);
  }
}

// ------------------------------------------------- financial & legal agents

async function analysisAgent(
  opts: RunOptions, snap: EngagementSnapshot, pack: ReturnType<typeof getRulePack>,
  run: AgentRun, useLlm: boolean,
): Promise<RunResult> {
  const agent = opts.agent as 'FINANCIAL' | 'LEGAL';

  // 1. Deterministic pass always runs — it is the audit-defensible baseline.
  repo.updateAgentRun(run.id, { progress: 20 });
  const collecting = stageIndex(snap.engagement.stage) < stageIndex('DUE_DILIGENCE');
  const hits = evaluateRules({
    pack, agent, documents: snap.documents, requirements: snap.requirements,
    raiseMissing: !collecting,
  });
  repo.logAgent(run.id, `Rule engine evaluated ${pack.rules.filter((r) => r.agent === agent).length} rules across ${snap.documents.length} documents and raised ${hits.length} candidate finding(s).${collecting ? ' Missing-document gaps were not raised as findings: the engagement is still in document collection, where the checklist is the record.' : ''}`);

  let created = persistHits(hits, snap.engagement.id, run.id, agent);

  // Financial Agent: analytical review of the extracted statements.
  if (agent === 'FINANCIAL') {
    const fin = extractFinancials(snap.documents, snap.requirements);
    if (fin) {
      const ratios = computeRatios(fin);
      const cov = extractCovenants(snap.documents, snap.requirements);
      const flags = analyticalFindings(fin, ratios, cov);
      const statementDoc = snap.documents.find((d) => d.title === fin.source) ?? null;
      for (const a of flags) {
        const f = repo.createFinding({
          engagementId: snap.engagement.id, documentId: statementDoc?.id ?? null,
          requirementId: statementDoc?.requirementId ?? null, agentRunId: run.id, agent,
          gapType: 'FINANCIAL', severity: a.severity, title: a.title, detail: a.detail,
          citation: a.citation, recommendation: a.recommendation, confidence: 0.9, dedupeKey: a.key,
        });
        if (f) created++;
      }
      repo.logAgent(run.id, `Extracted ${fin.years.length} years of statements from "${fin.source}", computed ${Object.keys(ratios[0]).length - 1} ratios per year and raised ${flags.length} analytical flag(s).`);
    } else {
      repo.logAgent(run.id, 'No parseable statement tables were found; analytical review skipped.', 'WARN');
    }
  }

  // 2. LLM pass adds judgement-based findings the rules cannot express.
  let llmNotes = '';
  if (useLlm) {
    repo.updateAgentRun(run.id, { progress: 50 });
    try {
      const res = await complete({
        system: systemPrompt(agent, pack),
        maxTokens: 6000,
        messages: [{
          role: 'user',
          content: `${contextHeader(snap)}

## Document checklist
${checklistDigest(snap.requirements)}

## Documents on file
${docDigest(snap.documents, snap.requirements)}

## Gaps the deterministic rule engine already raised (do not repeat these)
${hits.map((h) => `- ${h.title}`).join('\n') || '(none)'}

Perform a ${agent.toLowerCase()} review. Identify gaps the rule engine could not — inconsistencies between documents, substantive weaknesses, and matters requiring a human judgement call.

${FINDINGS_SCHEMA}`,
        }],
      });
      repo.updateAgentRun(run.id, { tokensIn: res.tokensIn, tokensOut: res.tokensOut, model: res.model });
      const parsed = extractJson<LlmFinding[]>(res.text) ?? [];
      created += persistLlmFindings(parsed, snap, run.id, agent);
      llmNotes = ` The reasoning pass added ${parsed.length} judgement-based finding(s).`;
      repo.logAgent(run.id, `Anthropic pass returned ${parsed.length} finding(s) using ${res.tokensIn + res.tokensOut} tokens.`);
    } catch (e) {
      const msg = e instanceof LlmUnavailable ? e.message : String(e);
      repo.logAgent(run.id, `Reasoning pass unavailable (${msg}); deterministic results stand.`, 'WARN');
      repo.updateAgentRun(run.id, { engine: 'RULES' });
    }
  }

  // 3. Draft the due diligence report.
  repo.updateAgentRun(run.id, { progress: 75 });
  const findings = repo.listFindings(snap.engagement.id).filter((f) => f.agent === agent);
  const report = await draftReport(agent, snap, pack, findings, useLlm, run.id);

  const summary = `${AGENT_META[agent].name}: ${created} new finding(s) from ${snap.documents.length} document(s); ${agent === 'LEGAL' ? 'legal' : 'financial'} due diligence report v${report.version} drafted for expert review.${llmNotes}`;
  return { run, findingsCreated: created, summary, artifacts: { reportId: report.id, ruleHits: hits.length } };
}

interface LlmFinding {
  title: string; detail: string; gapType?: string; severity?: string;
  citation?: string; recommendation?: string; documentRef?: string | null; confidence?: number;
}

function persistHits(hits: RuleHit[], engagementId: string, runId: string, agent: string): number {
  let n = 0;
  for (const h of hits) {
    const f = repo.createFinding({
      engagementId, documentId: h.documentId, requirementId: h.requirementId, agentRunId: runId,
      agent, gapType: h.gapType, severity: h.severity, title: h.title, detail: h.detail,
      citation: h.citation, recommendation: h.recommendation, excerpt: h.excerpt,
      confidence: h.confidence, dedupeKey: h.dedupeKey,
    });
    if (f) n++;
  }
  return n;
}

function persistLlmFindings(items: LlmFinding[], snap: EngagementSnapshot, runId: string, agent: string): number {
  let n = 0;
  for (const [i, item] of items.entries()) {
    if (!item?.title || !item?.detail) continue;
    const doc = item.documentRef
      ? snap.documents.find((d) => d.title.toLowerCase().includes(String(item.documentRef).toLowerCase().slice(0, 25)))
      : undefined;
    const f = repo.createFinding({
      engagementId: snap.engagement.id,
      documentId: doc?.id ?? null,
      requirementId: doc?.requirementId ?? null,
      agentRunId: runId,
      agent,
      gapType: normEnum(item.gapType, ['REGULATORY', 'COMPLIANCE', 'EDITORIAL', 'FINANCIAL', 'DISCLOSURE'], 'COMPLIANCE'),
      severity: normEnum(item.severity, ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'], 'MEDIUM'),
      title: String(item.title).slice(0, 220),
      detail: String(item.detail).slice(0, 4000),
      citation: item.citation ? String(item.citation).slice(0, 300) : 'citation to be confirmed',
      recommendation: item.recommendation ? String(item.recommendation).slice(0, 1200) : null,
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.65,
      dedupeKey: `llm:${agent}:${slug(item.title)}`,
    });
    if (f) n++;
    if (i > 40) break;
  }
  return n;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
const normEnum = (v: unknown, allowed: string[], fallback: string) =>
  allowed.includes(String(v).toUpperCase()) ? String(v).toUpperCase() : fallback;

async function draftReport(
  agent: 'FINANCIAL' | 'LEGAL', snap: EngagementSnapshot, pack: ReturnType<typeof getRulePack>,
  findings: Finding[], useLlm: boolean, runId: string,
) {
  const kind = agent;
  const title = `${agent === 'LEGAL' ? 'Legal' : 'Financial'} Due Diligence Report — ${snap.client.name}`;
  let sections: ReportSection[] = deterministicReportSections(agent, snap, findings);
  let exec = deterministicExecSummary(agent, snap, findings);
  let generatedBy = 'RULES';

  if (useLlm) {
    try {
      const res = await complete({
        system: systemPrompt(agent, pack),
        maxTokens: 8000,
        messages: [{
          role: 'user',
          content: `${contextHeader(snap)}

## Findings raised in this review
${findings.map((f) => `- [${f.severity}/${f.gapType}] ${f.title}\n  ${f.detail.slice(0, 500)}\n  Authority: ${f.citation ?? 'n/a'}\n  Recommendation: ${f.recommendation ?? 'n/a'}`).join('\n')}

## Document checklist
${checklistDigest(snap.requirements)}

Draft the ${agent === 'LEGAL' ? 'legal' : 'financial'} due diligence report for human expert review. Structure it as an Ethiopian transaction adviser would for an ECMA filing: scope and limitations, methodology, the substantive sections, the findings by severity, and the recommended actions before filing.

${REPORT_SCHEMA}`,
        }],
      });
      const parsed = extractJson<{ executiveSummary?: string; sections?: { heading: string; body: string }[] }>(res.text);
      if (parsed?.sections?.length) {
        sections = parsed.sections.map((s, i) => ({
          id: `s${i}`, heading: String(s.heading).slice(0, 200), body: String(s.body),
          source: 'anthropic', agentGenerated: true, edited: false,
        }));
        exec = parsed.executiveSummary ?? exec;
        generatedBy = 'ANTHROPIC';
        repo.logAgent(runId, `Report drafted by the reasoning engine in ${sections.length} sections.`);
      }
    } catch (e) {
      repo.logAgent(runId, `Report reasoning pass unavailable; deterministic draft used. ${String(e).slice(0, 160)}`, 'WARN');
    }
  }

  return repo.createReport({
    engagementId: snap.engagement.id, kind, title,
    sections: JSON.stringify(sections), executiveSummary: exec, generatedBy,
  });
}

function bySeverity(findings: Finding[], sev: string) {
  return findings.filter((f) => f.severity === sev && !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
}

function renderFindingList(findings: Finding[]): string {
  if (!findings.length) return '_No matters identified in this category._';
  return findings
    .map((f, i) => `**${i + 1}. ${f.title}**\n\n${f.detail}\n\n*Authority:* ${f.citation ?? 'To be confirmed'}\n\n*Recommended action:* ${f.recommendation ?? 'To be determined by the reviewing expert.'}`)
    .join('\n\n');
}

function deterministicReportSections(agent: 'FINANCIAL' | 'LEGAL', snap: EngagementSnapshot, findings: Finding[]): ReportSection[] {
  const live = findings.filter((f) => !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
  const scopeWord = agent === 'LEGAL' ? 'legal, corporate and regulatory' : 'financial, accounting and tax';
  const cats = agent === 'LEGAL' ? ['CORPORATE', 'GOVERNANCE', 'LEGAL', 'REGULATORY'] : ['FINANCIAL', 'TAX'];
  const relevant = snap.requirements.filter((r) => cats.includes(r.category));
  const onFile = relevant.filter((r) => ['ACCEPTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(r.status));
  const outstanding = relevant.filter((r) => ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status));

  return [
    {
      id: 's0', heading: '1. Scope and Limitations', agentGenerated: true, source: 'rules',
      body: `This report sets out the ${scopeWord} due diligence performed on ${snap.client.name} in connection with ${snap.engagement.name} (engagement reference ${snap.engagement.reference}).

The review was performed against the ${getRulePack(snap.engagement.rulePackKey).name} rule pack and covers the documents listed in Section 2. It is limited to the documents made available as at ${fmtDate(new Date().toISOString())}. No independent verification of the underlying records has been performed beyond the documents supplied, and no site visits or management interviews are reflected in this draft.

This is a machine-assisted draft prepared for review by the responsible ${agent === 'LEGAL' ? 'legal' : 'financial'} expert. It must not be issued, relied upon or shared with the client or any third party until that review is complete and the expert has signed it.`,
    },
    {
      id: 's1', heading: '2. Documents Reviewed', agentGenerated: true, source: 'rules',
      body: `${onFile.length} of ${relevant.length} ${scopeWord} requirements have documents on file.

| Code | Requirement | Status | Authority |
|---|---|---|---|
${relevant.map((r) => `| ${r.code} | ${r.title} | ${titleCase(r.status)} | ${r.authorityRef ?? '—'} |`).join('\n')}

${outstanding.length ? `\n**Outstanding at the date of this draft:** ${outstanding.map((r) => `${r.code} ${r.title}`).join('; ')}.` : '\nAll requirements in scope have documents on file.'}`,
    },
    {
      id: 's2', heading: '3. Methodology', agentGenerated: true, source: 'rules',
      body: `Each document was tested against the rule set for the ${agent === 'LEGAL' ? 'Legal' : 'Financial'} Agent in the active rule pack. The tests comprise presence checks for provisions the applicable law or directive requires, prohibition checks for provisions that create regulatory exposure, currency checks against the staleness windows, and quantification checks where a directive requires amounts to be stated.

Each finding below records the document tested, the provision expected, the authority relied upon and the action recommended. Confidence scores reflect the strength of the textual evidence, not the legal merit of the position; the reviewing expert determines the latter.`,
    },
    {
      id: 's3', heading: '4. Critical and High Findings', agentGenerated: true, source: 'rules',
      body: renderFindingList([...bySeverity(live, 'CRITICAL'), ...bySeverity(live, 'HIGH')]),
    },
    {
      id: 's4', heading: '5. Medium and Low Findings', agentGenerated: true, source: 'rules',
      body: renderFindingList([...bySeverity(live, 'MEDIUM'), ...bySeverity(live, 'LOW'), ...bySeverity(live, 'INFO')]),
    },
    {
      id: 's5', heading: '6. Recommended Actions Before Filing', agentGenerated: true, source: 'rules',
      body: live.length
        ? live
            .slice()
            .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
            .map((f, i) => `${i + 1}. **[${f.severity}]** ${f.recommendation ?? f.title}`)
            .join('\n')
        : 'No outstanding actions arise from this review.',
    },
    {
      id: 's6', heading: '7. Expert Review Record', agentGenerated: false, source: 'human',
      body: `_To be completed by the reviewing expert._\n\n- Reviewer:\n- Date of review:\n- Findings confirmed:\n- Findings amended or rejected (with reasons):\n- Additional matters identified:\n- Conclusion:`,
    },
  ];
}

const sevRank = (s: string) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }[s] ?? 5);

function deterministicExecSummary(agent: 'FINANCIAL' | 'LEGAL', snap: EngagementSnapshot, findings: Finding[]): string {
  const live = findings.filter((f) => ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status));
  const crit = bySeverity(live, 'CRITICAL').length;
  const high = bySeverity(live, 'HIGH').length;
  const label = agent === 'LEGAL' ? 'legal and regulatory' : 'financial and tax';
  const missing = snap.completeness.mandatoryMissing;
  const thin = snap.completeness.percent < 60 || missing > 0;

  // A clean finding count on a thin file is not a clean opinion. Say so, so the
  // summary cannot be read as comfort the review does not support.
  const scopeWarning = thin
    ? `\n\n**The document set is materially incomplete.** Completeness stands at ${snap.completeness.percent}% with ${missing} mandatory item${missing === 1 ? '' : 's'} outstanding, so the absence of findings in any area reflects the absence of documents to test rather than a clean result. No conclusion should be drawn on the outstanding areas until those documents are received and re-reviewed.`
    : '';

  const opinion = crit > 0
    ? 'The critical matters must be resolved before the engagement can proceed to filing.'
    : thin
      ? 'No conclusion on impediments to filing can be reached on the documents reviewed to date.'
      : 'No critical impediment to filing has been identified on the documents reviewed.';

  return `This draft records the ${label} due diligence on ${snap.client.name} for ${snap.engagement.name}. ${live.length} matter${live.length === 1 ? '' : 's'} remain${live.length === 1 ? 's' : ''} open, of which ${crit} ${crit === 1 ? 'is' : 'are'} critical and ${high} high.${scopeWarning}

${opinion}

This summary is a machine-assisted draft and requires confirmation by the responsible expert before it is relied upon.`;
}

// ----------------------------------------------------------------- risk agent

async function riskAgent(
  opts: RunOptions, snap: EngagementSnapshot, pack: ReturnType<typeof getRulePack>,
  run: AgentRun, useLlm: boolean,
): Promise<RunResult> {
  const findings = snap.findings.filter((f) => !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
  repo.updateAgentRun(run.id, { progress: 30 });

  const existing = new Set(repo.listRisks(snap.engagement.id).map((r) => r.title.toLowerCase()));
  let created = 0;
  let engine = 'RULES';

  if (useLlm && findings.length) {
    try {
      const res = await complete({
        system: systemPrompt('RISK', pack),
        maxTokens: 6000,
        messages: [{
          role: 'user',
          content: `${contextHeader(snap)}

## Findings from the legal and financial reviews
${findings.map((f) => `- [${f.agent}/${f.severity}/${f.gapType}] ${f.title}: ${f.detail.slice(0, 400)}`).join('\n')}

## Risks already on the register (do not duplicate)
${[...existing].join('; ') || '(none)'}

Consolidate these into a scored risk register and set the disclosure strategy for each risk.

${RISK_SCHEMA}`,
        }],
      });
      repo.updateAgentRun(run.id, { tokensIn: res.tokensIn, tokensOut: res.tokensOut, model: res.model });
      const parsed = extractJson<LlmRisk[]>(res.text) ?? [];
      for (const [i, r] of parsed.entries()) {
        if (!r?.title || existing.has(String(r.title).toLowerCase())) continue;
        repo.createRisk({
          engagementId: snap.engagement.id,
          code: r.code || `RSK-${String(repo.listRisks(snap.engagement.id).length + 1).padStart(2, '0')}`,
          title: String(r.title).slice(0, 200),
          category: normEnum(r.category, ['LEGAL', 'FINANCIAL', 'OPERATIONAL', 'MARKET', 'REGULATORY', 'GOVERNANCE', 'ESG'], 'LEGAL'),
          description: String(r.description ?? r.title).slice(0, 3000),
          likelihood: clamp(r.likelihood, 1, 5, 3),
          impact: clamp(r.impact, 1, 5, 3),
          mitigation: r.mitigation ? String(r.mitigation).slice(0, 1500) : null,
          residualLikelihood: clamp(r.residualLikelihood, 1, 5, 2),
          residualImpact: clamp(r.residualImpact, 1, 5, 2),
          disclosureStrategy: r.disclosureStrategy ? String(r.disclosureStrategy).slice(0, 1200) : null,
          prospectusPlacement: r.prospectusPlacement ? String(r.prospectusPlacement).slice(0, 200) : 'Risk Factors',
        });
        existing.add(String(r.title).toLowerCase());
        created++;
        if (i > 30) break;
      }
      engine = 'ANTHROPIC';
      repo.logAgent(run.id, `Reasoning engine proposed ${parsed.length} risk(s); ${created} added to the register.`);
    } catch (e) {
      repo.logAgent(run.id, `Reasoning pass unavailable; deterministic mapping used. ${String(e).slice(0, 160)}`, 'WARN');
      repo.updateAgentRun(run.id, { engine: 'RULES' });
    }
  }

  if (engine === 'RULES') {
    created += deterministicRisks(snap, findings, existing);
  }

  repo.updateAgentRun(run.id, { progress: 80 });
  const risks = repo.listRisks(snap.engagement.id);
  const top = risks.slice(0, 5);
  repo.createReport({
    engagementId: snap.engagement.id, kind: 'RISK',
    title: `Risk Assessment Report — ${snap.client.name}`,
    generatedBy: engine,
    executiveSummary: `The register carries ${risks.length} risk${risks.length === 1 ? '' : 's'}. ${risks.filter((r) => r.inherentScore >= 15).length} score 15 or above on an inherent basis and require an explicit disclosure strategy in the offering document. Residual scores assume the stated mitigations are implemented before filing.`,
    sections: JSON.stringify([
      {
        id: 'r0', heading: '1. Risk Register', agentGenerated: true, source: engine.toLowerCase(),
        body: `| Code | Risk | Category | L | I | Inherent | Residual | Status |\n|---|---|---|---|---|---|---|---|\n${risks.map((r) => `| ${r.code} | ${r.title} | ${titleCase(r.category)} | ${r.likelihood} | ${r.impact} | ${r.inherentScore} | ${r.residualScore} | ${titleCase(r.status)} |`).join('\n')}`,
      },
      {
        id: 'r1', heading: '2. Principal Risks and Disclosure Strategy', agentGenerated: true, source: engine.toLowerCase(),
        body: top.map((r) => `**${r.code} — ${r.title}** (inherent ${r.inherentScore}, residual ${r.residualScore})\n\n${r.description}\n\n*Mitigation:* ${r.mitigation ?? 'To be determined.'}\n\n*Disclosure:* ${r.disclosureStrategy ?? 'To be determined.'} → ${r.prospectusPlacement ?? 'Risk Factors'}`).join('\n\n') || '_No risks on the register._',
      },
      {
        id: 'r2', heading: '3. Expert Review Record', agentGenerated: false, source: 'human',
        body: '_To be completed by the reviewing expert._\n\n- Reviewer:\n- Date:\n- Scoring confirmed / amended:\n- Additional risks:\n- Conclusion:',
      },
    ]),
  });

  const summary = `Risk Agent: ${created} new risk(s) added; register now holds ${risks.length}, ${risks.filter((r) => r.inherentScore >= 15).length} of which are high-inherent and need an explicit disclosure strategy.`;
  return { run, findingsCreated: 0, summary, artifacts: { risks: risks.length, created } };
}

interface LlmRisk {
  code?: string; title?: string; category?: string; description?: string;
  likelihood?: number; impact?: number; mitigation?: string;
  residualLikelihood?: number; residualImpact?: number;
  disclosureStrategy?: string; prospectusPlacement?: string;
}

const clamp = (v: unknown, lo: number, hi: number, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
};

const SEV_TO_SCORE: Record<string, { l: number; i: number }> = {
  CRITICAL: { l: 4, i: 5 }, HIGH: { l: 4, i: 4 }, MEDIUM: { l: 3, i: 3 }, LOW: { l: 2, i: 2 }, INFO: { l: 1, i: 1 },
};

const GAP_TO_CATEGORY: Record<string, string> = {
  REGULATORY: 'REGULATORY', COMPLIANCE: 'LEGAL', FINANCIAL: 'FINANCIAL', DISCLOSURE: 'REGULATORY', EDITORIAL: 'OPERATIONAL',
};

function deterministicRisks(snap: EngagementSnapshot, findings: Finding[], existing: Set<string>): number {
  let created = 0;
  const material = findings.filter((f) => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.severity));
  let n = repo.listRisks(snap.engagement.id).length;
  for (const f of material) {
    const title = f.title.slice(0, 180);
    if (existing.has(title.toLowerCase())) continue;
    const s = SEV_TO_SCORE[f.severity] ?? { l: 3, i: 3 };
    n++;
    repo.createRisk({
      engagementId: snap.engagement.id,
      findingId: f.id,
      code: `RSK-${String(n).padStart(2, '0')}`,
      title,
      category: GAP_TO_CATEGORY[f.gapType] ?? 'LEGAL',
      description: `${f.detail}\n\nDerived from ${f.agent.toLowerCase()} finding raised on ${fmtDate(f.createdAt)}. Authority: ${f.citation ?? 'to be confirmed'}.`,
      likelihood: s.l,
      impact: s.i,
      mitigation: f.recommendation,
      residualLikelihood: Math.max(1, s.l - 2),
      residualImpact: Math.max(1, s.i - 1),
      disclosureStrategy:
        f.severity === 'CRITICAL'
          ? 'Disclose prominently as a principal risk factor with the remediation status stated; resolve before filing if possible.'
          : f.severity === 'HIGH'
            ? 'Disclose as a risk factor with the mitigation described.'
            : 'Monitor; disclose only if unresolved at the filing date.',
      prospectusPlacement: f.gapType === 'FINANCIAL' ? 'Financial Information / Risk Factors' : 'Risk Factors',
    });
    existing.add(title.toLowerCase());
    created++;
  }
  return created;
}

// ----------------------------------------------------------- prospectus agent

async function prospectusAgent(
  opts: RunOptions, snap: EngagementSnapshot, pack: ReturnType<typeof getRulePack>,
  run: AgentRun, useLlm: boolean,
): Promise<RunResult> {
  const targetCode = opts.payload?.sectionCode as string | undefined;
  const specs = pack.prospectus.filter((s) => (targetCode ? s.code === targetCode : true));
  const sections = repo.listProspectus(snap.engagement.id);
  const candidates = specs
    .map((spec) => ({ spec, row: sections.find((s) => s.code === spec.code) }))
    .filter((x) => x.row);
  // Batch mode: untouched sections first, then rule-engine skeletons that a
  // reasoning pass could improve. Never re-pick a section a human has edited.
  const untouched = candidates.filter((x) => x.row!.status === 'NOT_STARTED');
  const skeletons = candidates.filter((x) => x.row!.status === 'DRAFTING' && x.row!.generatedBy === 'RULES');
  const todo = (targetCode ? candidates : [...untouched, ...(useLlm ? skeletons : [])])
    .slice(0, targetCode ? 1 : useLlm ? 4 : 100); // the reasoning pass is slow, so it works in batches

  if (!todo.length) {
    return { run, findingsCreated: 0, summary: `Prospectus Agent: every ${pack.outputLabel.toLowerCase()} section already has a draft. Nothing to do.`, artifacts: {} };
  }

  // Editorial review of the data room before drafting from it.
  const editorial = evaluateRules({ pack, agent: 'PROSPECTUS', documents: snap.documents, requirements: snap.requirements, raiseMissing: false });
  const editorialCreated = persistHits(editorial, snap.engagement.id, run.id, 'PROSPECTUS');
  repo.logAgent(run.id, `Editorial review of ${snap.documents.length} documents raised ${editorial.length} candidate issue(s), ${editorialCreated} new.`);

  const ctx = buildDraftContext(snap);
  const docsFor = (codes: string[]) =>
    snap.documents.filter((d) => {
      const req = snap.requirements.find((r) => r.id === d.requirementId);
      return req ? codes.includes(req.code) : false;
    });

  let drafted = 0;
  let engine = 'RULES';

  for (const [i, { spec, row }] of todo.entries()) {
    repo.updateAgentRun(run.id, { progress: 10 + Math.round((i / todo.length) * 80) });
    const base = draftSection(snap, spec, ctx);
    let body = base.body;
    let by = 'RULES';

    if (useLlm) {
      try {
        const sourceDocs = docsFor(spec.sourceRequirements);
        const res = await complete({
          system: systemPrompt('PROSPECTUS', pack),
          maxTokens: 5000,
          messages: [{
            role: 'user',
            content: `${contextHeader(snap)}

Draft ${pack.outputLabel.toLowerCase()} section "${spec.heading}" (${spec.code}).

Required by: ${spec.requiredBy}
Drafting guidance: ${spec.guidance}
Minimum length: ${spec.minWords} words.

## Structured first draft (built from the data room by the drafting engine — improve it, keep every figure)
${base.body.slice(0, 12000)}

## Source documents for this section
${sourceDocs.length ? docDigest(sourceDocs, snap.requirements, 6) : '(none on file)'}

Rewrite the draft into polished offering-document prose. Keep every table and figure exactly. Keep [INFORMATION REQUIRED: …] markers where the documents are silent. Do not invent facts. Return the section body in markdown only.`,
          }],
        });
        if (res.text.trim().length > base.body.length * 0.5) {
          body = res.text.trim();
          by = 'ANTHROPIC';
          engine = 'ANTHROPIC';
        }
        repo.updateAgentRun(run.id, {
          tokensIn: (repo.getAgentRun(run.id)?.tokensIn ?? 0) + res.tokensIn,
          tokensOut: (repo.getAgentRun(run.id)?.tokensOut ?? 0) + res.tokensOut,
          model: res.model,
        });
      } catch (e) {
        repo.logAgent(run.id, `Reasoning pass unavailable for ${spec.code}; structured draft used. ${String(e).slice(0, 140)}`, 'WARN');
      }
    }

    const w = body.trim().split(/\s+/).length;
    const gaps = (body.match(/\[INFORMATION REQUIRED/g) ?? []).length;
    repo.updateProspectusSection(row!.id, {
      body,
      status: gaps === 0 && w >= spec.minWords * 0.8 ? 'DRAFTED' : 'DRAFTING',
      generatedBy: by,
      completeness: by === 'ANTHROPIC' ? Math.min(100, Math.round((w / spec.minWords) * 100) - gaps * 3) : base.completeness,
    });
    repo.logAgent(run.id, `Drafted ${spec.code} — ${spec.heading} (${w} words, ${gaps} open item${gaps === 1 ? '' : 's'}, ${by}).`);
    drafted++;
  }

  const progress = repo.listProspectus(snap.engagement.id);
  const pct = Math.round(progress.reduce((a, s) => a + s.completeness, 0) / (progress.length || 1));
  const summary = `Prospectus Agent: ${drafted} section(s) drafted and ${editorialCreated} editorial issue(s) raised. The ${pack.outputLabel.toLowerCase()} is ${pct}% complete across ${progress.length} sections and awaits expert review.`;
  return { run, findingsCreated: editorialCreated, summary, artifacts: { drafted, engine, percent: pct } };
}

// ------------------------------------------------------------ secretary agent

async function secretaryAgent(
  opts: RunOptions, snap: EngagementSnapshot, run: AgentRun, useLlm: boolean,
): Promise<RunResult> {
  const meetingId = opts.payload?.meetingId as string | undefined;
  const meeting = meetingId ? repo.getMeeting(meetingId) : repo.listMeetings(snap.engagement.id)[0];

  if (!meeting) {
    // No meeting: issue a status briefing instead.
    const body = statusBriefing(snap);
    await notify({
      userIds: audienceFor(snap.engagement.id, { includeClient: true }),
      engagementId: snap.engagement.id, kind: 'INFO', severity: 'INFO',
      title: `Status briefing — ${snap.engagement.reference}`, body,
      link: `/engagements/${snap.engagement.id}`, email: true,
    });
    repo.logAgent(run.id, 'No meeting supplied; a status briefing was distributed to the deal team and the client.');
    return { run, findingsCreated: 0, summary: 'Secretary Agent: status briefing distributed to the deal team and the client.', artifacts: { briefing: true } };
  }

  repo.updateAgentRun(run.id, { progress: 40 });
  let actionItems: { title: string; owner?: string; due?: string }[] = [];
  let minutes = meeting.minutes ?? '';
  let decisions = meeting.decisions ?? '';

  if (useLlm && (meeting.minutes || meeting.agenda)) {
    try {
      const res = await complete({
        system: systemPrompt('SECRETARY', getRulePack(snap.engagement.rulePackKey)),
        maxTokens: 3000,
        messages: [{
          role: 'user',
          content: `${contextHeader(snap)}

Meeting: ${meeting.title} on ${fmtDate(meeting.scheduledAt)}
Attendees: ${JSON.parse(meeting.attendees || '[]').join(', ') || 'not recorded'}
Agenda:
${meeting.agenda ?? '(none)'}

Raw notes:
${meeting.minutes ?? '(none)'}

Produce ONLY this JSON:
{ "minutes": "clean minutes in markdown", "decisions": "the decisions taken, as a markdown list", "actionItems": [ { "title": "...", "owner": "name or role", "due": "YYYY-MM-DD or null" } ] }`,
        }],
      });
      repo.updateAgentRun(run.id, { tokensIn: res.tokensIn, tokensOut: res.tokensOut, model: res.model });
      const parsed = extractJson<{ minutes?: string; decisions?: string; actionItems?: typeof actionItems }>(res.text);
      if (parsed) {
        minutes = parsed.minutes ?? minutes;
        decisions = parsed.decisions ?? decisions;
        actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
      }
    } catch (e) {
      repo.logAgent(run.id, `Reasoning pass unavailable; raw notes retained. ${String(e).slice(0, 140)}`, 'WARN');
    }
  }

  if (!actionItems.length) {
    actionItems = extractActionsHeuristically(meeting.minutes ?? meeting.agenda ?? '');
  }

  for (const a of actionItems.slice(0, 25)) {
    if (!a?.title) continue;
    repo.createTask({
      engagementId: snap.engagement.id,
      title: String(a.title).slice(0, 220),
      detail: `Raised at "${meeting.title}" on ${fmtDate(meeting.scheduledAt)}${a.owner ? `. Owner: ${a.owner}` : ''}.`,
      dueDate: a.due && !Number.isNaN(Date.parse(a.due)) ? new Date(a.due).toISOString() : null,
      source: 'AGENT',
      agentOwner: 'SECRETARY',
      priority: 'NORMAL',
    });
  }

  repo.updateMeeting(meeting.id, {
    minutes, decisions, actionItems: JSON.stringify(actionItems), distributed: 1,
  });

  const body = `Minutes of "${meeting.title}" (${fmtDate(meeting.scheduledAt)}) have been circulated. ${actionItems.length} action item${actionItems.length === 1 ? '' : 's'} ${actionItems.length === 1 ? 'was' : 'were'} raised and added to the engagement task list.`;
  await notify({
    userIds: audienceFor(snap.engagement.id, { includeClient: true }),
    engagementId: snap.engagement.id, kind: 'MEETING', severity: 'INFO',
    title: `Minutes circulated — ${meeting.title}`, body,
    link: `/engagements/${snap.engagement.id}/meetings`, email: true,
  });

  return { run, findingsCreated: 0, summary: `Secretary Agent: minutes finalised and circulated; ${actionItems.length} action item(s) created.`, artifacts: { meetingId: meeting.id, actionItems: actionItems.length } };
}

function extractActionsHeuristically(text: string): { title: string; owner?: string }[] {
  const out: { title: string; owner?: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim().replace(/^[-*•]\s*/, '');
    if (!line) continue;
    if (/^(action|todo|to do|follow[- ]?up|next step)s?\b[:\-]?/i.test(line) || /\b(will|to)\s+(prepare|send|obtain|draft|confirm|review|circulate|request|collect|file)\b/i.test(line)) {
      const cleaned = line.replace(/^(action|todo|to do|follow[- ]?up|next step)s?\b[:\-]?\s*/i, '');
      if (cleaned.length > 6) out.push({ title: cleaned.slice(0, 200) });
    }
  }
  return out;
}

function statusBriefing(snap: EngagementSnapshot): string {
  const missing = snap.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED'].includes(r.status));
  return `${snap.engagement.reference} — ${snap.engagement.name}

Stage: ${titleCase(snap.engagement.stage)}
Document completeness: ${snap.completeness.percent}% (${snap.completeness.accepted} accepted, ${snap.completeness.submitted} in review, ${snap.completeness.missing} outstanding)
Open findings: ${snap.compliance.open} (${snap.compliance.critical} critical, ${snap.compliance.high} high)
Prospectus: ${snap.prospectusProgress.percent}% drafted
Overall health: ${snap.health.label} (${snap.health.score}/100)

${missing.length ? `Outstanding mandatory documents:\n${missing.slice(0, 12).map((r) => `• ${r.code} — ${r.title}`).join('\n')}` : 'All mandatory documents are on file.'}`;
}

// ------------------------------------------------------- project management

async function projectAgent(opts: RunOptions, snap: EngagementSnapshot, run: AgentRun): Promise<RunResult> {
  repo.updateAgentRun(run.id, { progress: 30 });
  const today = Date.now();
  const alerts: string[] = [];
  let tasksCreated = 0;

  // 1. Milestone slippage.
  const overdue = snap.milestones.filter((m) => m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate).getTime() < today);
  for (const m of overdue) {
    const days = Math.round((today - new Date(m.dueDate!).getTime()) / 86400000);
    alerts.push(`Milestone "${m.name}" is ${days} day${days === 1 ? '' : 's'} overdue.`);
    repo.updateMilestone(m.id, { status: 'BLOCKED' });
  }

  // 2. Payments outstanding.
  const unpaid = snap.milestones.filter((m) => m.paymentStatus === 'INVOICED');
  if (unpaid.length) {
    alerts.push(`${unpaid.length} invoice(s) outstanding totalling ${fmtMoney(unpaid.reduce((a, m) => a + m.paymentAmount, 0), snap.engagement.currency)}.`);
  }

  // 3. Document threshold against the stage gate.
  if (!snap.gate.canAdvance && snap.gate.nextStage) {
    alerts.push(`Cannot advance to ${titleCase(snap.gate.nextStage)}: ${snap.gate.blockers.join(' ')}`);
  }

  // 4. Filing date pressure.
  if (snap.engagement.targetFilingDate) {
    const daysLeft = Math.round((new Date(snap.engagement.targetFilingDate).getTime() - today) / 86400000);
    if (daysLeft < 45 && snap.prospectusProgress.percent < 70) {
      alerts.push(`${daysLeft} day(s) to the target filing date with the prospectus only ${snap.prospectusProgress.percent}% drafted.`);
      repo.createTask({
        engagementId: snap.engagement.id,
        title: 'Escalate prospectus drafting — filing date at risk',
        detail: `Target filing ${fmtDate(snap.engagement.targetFilingDate)}; prospectus at ${snap.prospectusProgress.percent}%.`,
        priority: 'URGENT', source: 'AGENT', agentOwner: 'PROJECT',
        dueDate: new Date(today + 3 * 86400000).toISOString(),
      });
      tasksCreated++;
    }
  }

  // 5. Deadlines for the other agents.
  const stage = snap.engagement.stage;
  const queue: { agent: AgentKey; why: string; days: number }[] = [];
  if (['DOCUMENT_COLLECTION', 'DUE_DILIGENCE'].includes(stage) && snap.completeness.percent >= 60) {
    if (!snap.runs.some((r) => r.agent === 'LEGAL' && r.status === 'SUCCEEDED')) queue.push({ agent: 'LEGAL', why: 'documents are past 60% — legal review can begin', days: 5 });
    if (!snap.runs.some((r) => r.agent === 'FINANCIAL' && r.status === 'SUCCEEDED')) queue.push({ agent: 'FINANCIAL', why: 'documents are past 60% — financial review can begin', days: 5 });
  }
  if (stage === 'RISK_ASSESSMENT' && !snap.risks.length) queue.push({ agent: 'RISK', why: 'the risk register is empty at the risk-assessment stage', days: 3 });
  if (['PROSPECTUS_DRAFTING', 'INTERNAL_REVIEW'].includes(stage) && snap.prospectusProgress.percent < 100) {
    queue.push({ agent: 'PROSPECTUS', why: `the prospectus is ${snap.prospectusProgress.percent}% drafted`, days: 7 });
  }
  for (const q of queue) {
    repo.createTask({
      engagementId: snap.engagement.id,
      title: `Run the ${AGENT_META[q.agent].name}`,
      detail: `Scheduled by the Project Management Agent because ${q.why}.`,
      priority: 'HIGH', source: 'AGENT', agentOwner: q.agent,
      dueDate: new Date(today + q.days * 86400000).toISOString(),
    });
    tasksCreated++;
  }

  // 6. Chase the client for missing mandatory documents.
  const missing = snap.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED'].includes(r.status));
  if (missing.length) {
    const clientIds = clientUsersFor(snap.engagement.id);
    if (clientIds.length) {
      await notify({
        userIds: clientIds, engagementId: snap.engagement.id, kind: 'DOC_MISSING',
        severity: missing.length > 5 ? 'WARNING' : 'INFO',
        title: `${missing.length} document(s) still required — ${snap.engagement.reference}`,
        body: `The following mandatory documents are outstanding:\n\n${missing.slice(0, 15).map((r) => `• ${r.title}`).join('\n')}\n\nDocument completeness is ${snap.completeness.percent}%; ${snap.engagement.documentThreshold}% is required to progress.`,
        link: `/portal/${snap.engagement.id}`, email: true,
      });
    }
    alerts.push(`${missing.length} mandatory document(s) outstanding; the client has been notified.`);
  }

  repo.updateAgentRun(run.id, { progress: 85 });
  if (alerts.length) {
    await notify({
      userIds: audienceFor(snap.engagement.id), engagementId: snap.engagement.id,
      kind: 'THRESHOLD', severity: overdue.length ? 'WARNING' : 'INFO',
      title: `Project review — ${snap.engagement.reference}`,
      body: alerts.join('\n'),
      link: `/engagements/${snap.engagement.id}`,
    });
  }
  alerts.forEach((a) => repo.logAgent(run.id, a));

  const summary = `Project Agent: ${alerts.length} alert(s), ${tasksCreated} task(s) scheduled, ${overdue.length} milestone(s) overdue. Fees ${snap.fees.percentPaid}% collected.`;
  return { run, findingsCreated: 0, summary, artifacts: { alerts, tasksCreated, overdue: overdue.length } };
}
