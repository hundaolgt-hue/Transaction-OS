import 'server-only';
import { all, one, insert, update, run, id, now } from '../db';
import type {
  Org, Client, Engagement, Contract, Milestone, Requirement, Document, Finding,
  AgentRun, AgentLog, DDReport, Risk, ProspectusSection, Meeting, Task, Comment,
  Notification, AuditEvent, SafeUser, User,
} from '../types';
import { getRulePack, packForTransaction } from '../rulepacks';
import { computeCompleteness, computeCompliance, computeProspectusProgress, computeFeeProgress, evaluateStageGate, overallHealth } from '../progress';

// ------------------------------------------------------------------- orgs

export const getOrg = (orgId: string) => one<Org>('SELECT * FROM orgs WHERE id = ?', [orgId]);

// ---------------------------------------------------------------- clients

export const listClients = (orgId: string) =>
  all<Client>('SELECT * FROM clients WHERE orgId = ? ORDER BY name', [orgId]);

export const getClient = (orgId: string, clientId: string) =>
  one<Client>('SELECT * FROM clients WHERE orgId = ? AND id = ?', [orgId, clientId]);

export function createClient(orgId: string, data: Partial<Client> & { name: string }): Client {
  const cid = id('cli');
  insert('clients', {
    id: cid, orgId, name: data.name,
    legalForm: data.legalForm ?? 'SHARE_COMPANY',
    sector: data.sector ?? 'OTHER',
    tin: data.tin ?? null,
    businessLicenseNo: data.businessLicenseNo ?? null,
    registrationDate: data.registrationDate ?? null,
    paidUpCapital: data.paidUpCapital ?? null,
    currency: data.currency ?? 'ETB',
    addressLine: data.addressLine ?? null,
    city: data.city ?? 'Addis Ababa',
    region: data.region ?? null,
    website: data.website ?? null,
    primaryContactName: data.primaryContactName ?? null,
    primaryContactEmail: data.primaryContactEmail ?? null,
    primaryContactPhone: data.primaryContactPhone ?? null,
    riskRating: data.riskRating ?? 'UNRATED',
    status: data.status ?? 'ACTIVE',
    notes: data.notes ?? null,
    createdAt: now(), updatedAt: now(),
  });
  return getClient(orgId, cid)!;
}

export function updateClient(orgId: string, clientId: string, data: Partial<Client>) {
  const { id: _i, orgId: _o, createdAt: _c, ...rest } = data;
  update('clients', clientId, { ...rest, updatedAt: now() });
  return getClient(orgId, clientId);
}

// ------------------------------------------------------------ engagements

export const listEngagements = (orgId: string) =>
  all<Engagement>('SELECT * FROM engagements WHERE orgId = ? ORDER BY createdAt DESC', [orgId]);

export const listEngagementsForClient = (clientId: string) =>
  all<Engagement>('SELECT * FROM engagements WHERE clientId = ? ORDER BY createdAt DESC', [clientId]);

export const getEngagement = (orgId: string, engagementId: string) =>
  one<Engagement>('SELECT * FROM engagements WHERE orgId = ? AND id = ?', [orgId, engagementId]);

export function nextReference(orgId: string, transactionType: string): string {
  const year = new Date().getFullYear();
  const n = all<{ reference: string }>('SELECT reference FROM engagements WHERE orgId = ?', [orgId]).length + 1;
  const prefix = transactionType === 'MA' ? 'MA' : transactionType === 'BOND' ? 'BD' : 'EQ';
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`;
}

export function createEngagement(
  orgId: string,
  data: Partial<Engagement> & { clientId: string; name: string },
): Engagement {
  const eid = id('eng');
  const txType = data.transactionType ?? 'IPO';
  const pack = data.rulePackKey ? getRulePack(data.rulePackKey) : packForTransaction(txType);
  const ts = now();

  insert('engagements', {
    id: eid, orgId, clientId: data.clientId,
    reference: data.reference ?? nextReference(orgId, txType),
    name: data.name,
    transactionType: txType,
    stage: data.stage ?? 'ONBOARDING',
    status: data.status ?? 'ACTIVE',
    targetRaise: data.targetRaise ?? null,
    currency: data.currency ?? 'ETB',
    startDate: data.startDate ?? ts,
    targetFilingDate: data.targetFilingDate ?? null,
    leadAdvisorId: data.leadAdvisorId ?? null,
    rulePackKey: pack.key,
    documentThreshold: data.documentThreshold ?? 80,
    description: data.description ?? null,
    createdAt: ts, updatedAt: ts,
  });

  // Materialise the checklist and the prospectus skeleton from the rule pack.
  pack.requirements.forEach((r, i) => {
    insert('requirements', {
      id: id('req'), engagementId: eid, code: r.code, title: r.title, category: r.category,
      description: r.description, authorityRef: r.authorityRef, mandatory: r.mandatory ? 1 : 0,
      weight: r.weight, appliesToStage: r.appliesToStage, status: 'MISSING', sequence: i,
      createdAt: ts, updatedAt: ts,
    });
  });
  pack.prospectus.forEach((s) => {
    insert('prospectus_sections', {
      id: id('pss'), engagementId: eid, code: s.code, sequence: s.sequence, heading: s.heading,
      requiredBy: s.requiredBy, body: '', wordCount: 0, status: 'NOT_STARTED', completeness: 0,
      createdAt: ts, updatedAt: ts,
    });
  });
  insert('stage_events', {
    id: id('stg'), engagementId: eid, fromStage: null, toStage: data.stage ?? 'ONBOARDING',
    note: 'Engagement opened', actorName: 'System', createdAt: ts,
  });

  return getEngagement(orgId, eid)!;
}

export function updateEngagement(orgId: string, engagementId: string, data: Partial<Engagement>) {
  const { id: _i, orgId: _o, createdAt: _c, ...rest } = data;
  update('engagements', engagementId, { ...rest, updatedAt: now() });
  return getEngagement(orgId, engagementId);
}

export function setStage(engagementId: string, toStage: string, note: string, actorName: string) {
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  if (!eng) return null;
  insert('stage_events', {
    id: id('stg'), engagementId, fromStage: eng.stage, toStage, note, actorName, createdAt: now(),
  });
  update('engagements', engagementId, { stage: toStage, updatedAt: now() });
  return one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
}

export const listStageEvents = (engagementId: string) =>
  all<{ id: string; fromStage: string | null; toStage: string; note: string | null; actorName: string | null; createdAt: string }>(
    'SELECT * FROM stage_events WHERE engagementId = ? ORDER BY createdAt DESC', [engagementId]);

// ------------------------------------------------------------- contracts

export const getContract = (engagementId: string) =>
  one<Contract>('SELECT * FROM contracts WHERE engagementId = ?', [engagementId]);

export const listMilestones = (contractId: string) =>
  all<Milestone>('SELECT * FROM milestones WHERE contractId = ? ORDER BY sequence', [contractId]);

export function createContract(engagementId: string, data: Partial<Contract> & { title: string; totalFee: number }): Contract {
  const cid = id('con');
  const ts = now();
  insert('contracts', {
    id: cid, engagementId, title: data.title,
    signedDate: data.signedDate ?? null, effectiveDate: data.effectiveDate ?? null, endDate: data.endDate ?? null,
    feeModel: data.feeModel ?? 'FIXED', totalFee: data.totalFee, currency: data.currency ?? 'ETB',
    vatPercent: data.vatPercent ?? 15, status: data.status ?? 'DRAFT',
    scopeSummary: data.scopeSummary ?? null, createdAt: ts, updatedAt: ts,
  });
  // Seed milestones from the rule pack.
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  const pack = getRulePack(eng?.rulePackKey);
  const start = new Date(eng?.startDate ?? ts).getTime();
  pack.milestones.forEach((m) => {
    insert('milestones', {
      id: id('mil'), contractId: cid, name: m.name, description: m.description, sequence: m.sequence,
      dueDate: new Date(start + m.offsetDays * 86400000).toISOString(),
      status: 'PENDING', paymentAmount: Math.round(data.totalFee * m.feeShare), paymentStatus: 'UNBILLED',
    });
  });
  return getContract(engagementId)!;
}

export const updateContract = (contractId: string, data: Partial<Contract>) =>
  update('contracts', contractId, { ...data, updatedAt: now() });

export const updateMilestone = (milestoneId: string, data: Partial<Milestone>) =>
  update('milestones', milestoneId, data);

// ----------------------------------------------------------- requirements

export const listRequirements = (engagementId: string) =>
  all<Requirement>('SELECT * FROM requirements WHERE engagementId = ? ORDER BY sequence', [engagementId]);

export const getRequirement = (requirementId: string) =>
  one<Requirement>('SELECT * FROM requirements WHERE id = ?', [requirementId]);

export const updateRequirement = (requirementId: string, data: Partial<Requirement>) =>
  update('requirements', requirementId, { ...data, updatedAt: now() });

// -------------------------------------------------------------- documents

export const listDocuments = (engagementId: string) =>
  all<Document>('SELECT * FROM documents WHERE engagementId = ? ORDER BY createdAt DESC', [engagementId]);

export const getDocument = (documentId: string) =>
  one<Document>('SELECT * FROM documents WHERE id = ?', [documentId]);

export const listDocumentsForRequirement = (requirementId: string) =>
  all<Document>('SELECT * FROM documents WHERE requirementId = ? ORDER BY version DESC', [requirementId]);

export function createDocument(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Document {
  const did = id('doc');
  const ts = now();
  insert('documents', { id: did, ...data, createdAt: ts, updatedAt: ts });
  return getDocument(did)!;
}

export const updateDocument = (documentId: string, data: Partial<Document>) =>
  update('documents', documentId, { ...data, updatedAt: now() });

export const deleteDocument = (documentId: string) =>
  run('DELETE FROM documents WHERE id = ?', [documentId]);

// --------------------------------------------------------------- findings

export const listFindings = (engagementId: string) =>
  all<Finding>('SELECT * FROM findings WHERE engagementId = ? ORDER BY CASE severity WHEN \'CRITICAL\' THEN 0 WHEN \'HIGH\' THEN 1 WHEN \'MEDIUM\' THEN 2 WHEN \'LOW\' THEN 3 ELSE 4 END, createdAt DESC', [engagementId]);

export const getFinding = (findingId: string) =>
  one<Finding>('SELECT * FROM findings WHERE id = ?', [findingId]);

export function createFinding(data: Partial<Finding> & { engagementId: string; title: string; detail: string }): Finding | null {
  const fid = id('fnd');
  const ts = now();
  try {
    insert('findings', {
      id: fid, engagementId: data.engagementId,
      documentId: data.documentId ?? null, requirementId: data.requirementId ?? null,
      agentRunId: data.agentRunId ?? null, agent: data.agent ?? 'LEGAL',
      gapType: data.gapType ?? 'COMPLIANCE', severity: data.severity ?? 'MEDIUM',
      title: data.title, detail: data.detail, citation: data.citation ?? null,
      recommendation: data.recommendation ?? null, excerpt: data.excerpt ?? null,
      confidence: data.confidence ?? 0.7, status: data.status ?? 'OPEN',
      visibleToClient: data.visibleToClient ?? 0, dedupeKey: data.dedupeKey ?? null,
      createdAt: ts, updatedAt: ts,
    });
    return getFinding(fid);
  } catch (e) {
    // UNIQUE(engagementId, dedupeKey) — the finding already exists, refresh its run link.
    if (data.dedupeKey) {
      const existing = one<Finding>('SELECT * FROM findings WHERE engagementId = ? AND dedupeKey = ?', [data.engagementId, data.dedupeKey]);
      if (existing && existing.status !== 'RESOLVED' && data.agentRunId) {
        update('findings', existing.id, { agentRunId: data.agentRunId, updatedAt: ts });
      }
      return null;
    }
    throw e;
  }
}

export const updateFinding = (findingId: string, data: Partial<Finding>) =>
  update('findings', findingId, { ...data, updatedAt: now() });

// ------------------------------------------------------------- agent runs

export const listAgentRuns = (engagementId: string, limit = 50) =>
  all<AgentRun>('SELECT * FROM agent_runs WHERE engagementId = ? ORDER BY createdAt DESC LIMIT ?', [engagementId, limit]);

export const getAgentRun = (runId: string) =>
  one<AgentRun>('SELECT * FROM agent_runs WHERE id = ?', [runId]);

export function createAgentRun(data: Partial<AgentRun> & { engagementId: string; agent: string }): AgentRun {
  const rid = id('run');
  insert('agent_runs', {
    id: rid, engagementId: data.engagementId, agent: data.agent, task: data.task ?? 'ANALYZE',
    status: 'QUEUED', engine: data.engine ?? 'RULES', model: data.model ?? null,
    input: data.input ?? null, triggeredById: data.triggeredById ?? null, createdAt: now(),
  });
  return getAgentRun(rid)!;
}

export const updateAgentRun = (runId: string, data: Partial<AgentRun>) => update('agent_runs', runId, data);

export const listAgentLogs = (runId: string) =>
  all<AgentLog>('SELECT * FROM agent_logs WHERE runId = ? ORDER BY createdAt', [runId]);

export const logAgent = (runId: string, message: string, level = 'INFO') =>
  insert('agent_logs', { id: id('log'), runId, level, message, createdAt: now() });

// ----------------------------------------------------------------- reports

export const listReports = (engagementId: string) =>
  all<DDReport>('SELECT * FROM dd_reports WHERE engagementId = ? ORDER BY createdAt DESC', [engagementId]);

export const getReport = (reportId: string) =>
  one<DDReport>('SELECT * FROM dd_reports WHERE id = ?', [reportId]);

export function createReport(data: Partial<DDReport> & { engagementId: string; kind: string; title: string }): DDReport {
  const rid = id('rep');
  const ts = now();
  const prior = all<DDReport>('SELECT * FROM dd_reports WHERE engagementId = ? AND kind = ?', [data.engagementId, data.kind]);
  prior.forEach((p) => update('dd_reports', p.id, { status: 'SUPERSEDED' }));
  insert('dd_reports', {
    id: rid, engagementId: data.engagementId, kind: data.kind, title: data.title,
    version: prior.length + 1, status: 'DRAFT', sections: data.sections ?? '[]',
    executiveSummary: data.executiveSummary ?? null, generatedBy: data.generatedBy ?? 'RULES',
    createdAt: ts, updatedAt: ts,
  });
  return getReport(rid)!;
}

export const updateReport = (reportId: string, data: Partial<DDReport>) =>
  update('dd_reports', reportId, { ...data, updatedAt: now() });

// ------------------------------------------------------------------ risks

export const listRisks = (engagementId: string) =>
  all<Risk>('SELECT * FROM risks WHERE engagementId = ? ORDER BY inherentScore DESC', [engagementId]);

export const getRisk = (riskId: string) => one<Risk>('SELECT * FROM risks WHERE id = ?', [riskId]);

export function createRisk(data: Partial<Risk> & { engagementId: string; code: string; title: string; description: string }): Risk {
  const rid = id('rsk');
  const ts = now();
  const l = data.likelihood ?? 3, i2 = data.impact ?? 3;
  const rl = data.residualLikelihood ?? Math.max(1, l - 1), ri = data.residualImpact ?? Math.max(1, i2 - 1);
  insert('risks', {
    id: rid, engagementId: data.engagementId, findingId: data.findingId ?? null,
    code: data.code, title: data.title, category: data.category ?? 'LEGAL', description: data.description,
    likelihood: l, impact: i2, inherentScore: l * i2,
    mitigation: data.mitigation ?? null,
    residualLikelihood: rl, residualImpact: ri, residualScore: rl * ri,
    owner: data.owner ?? null, status: data.status ?? 'OPEN',
    disclosureStrategy: data.disclosureStrategy ?? null,
    prospectusPlacement: data.prospectusPlacement ?? null,
    createdAt: ts, updatedAt: ts,
  });
  return getRisk(rid)!;
}

export function updateRisk(riskId: string, data: Partial<Risk>) {
  const cur = getRisk(riskId);
  if (!cur) return;
  const l = data.likelihood ?? cur.likelihood, i2 = data.impact ?? cur.impact;
  const rl = data.residualLikelihood ?? cur.residualLikelihood, ri = data.residualImpact ?? cur.residualImpact;
  update('risks', riskId, { ...data, inherentScore: l * i2, residualScore: rl * ri, updatedAt: now() });
}

// ------------------------------------------------------------- prospectus

export const listProspectus = (engagementId: string) =>
  all<ProspectusSection>('SELECT * FROM prospectus_sections WHERE engagementId = ? ORDER BY sequence', [engagementId]);

export const getProspectusSection = (sectionId: string) =>
  one<ProspectusSection>('SELECT * FROM prospectus_sections WHERE id = ?', [sectionId]);

export function updateProspectusSection(sectionId: string, data: Partial<ProspectusSection>) {
  const cur = getProspectusSection(sectionId);
  if (!cur) return;
  const body = data.body ?? cur.body;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  update('prospectus_sections', sectionId, { ...data, wordCount, updatedAt: now() });
}

// --------------------------------------------------------- meetings/tasks

export const listMeetings = (engagementId: string) =>
  all<Meeting>('SELECT * FROM meetings WHERE engagementId = ? ORDER BY scheduledAt DESC', [engagementId]);

export const getMeeting = (meetingId: string) => one<Meeting>('SELECT * FROM meetings WHERE id = ?', [meetingId]);

export function createMeeting(data: Partial<Meeting> & { engagementId: string; title: string; scheduledAt: string }): Meeting {
  const mid = id('mtg');
  insert('meetings', {
    id: mid, engagementId: data.engagementId, title: data.title, scheduledAt: data.scheduledAt,
    durationMin: data.durationMin ?? 60, location: data.location ?? null,
    attendees: data.attendees ?? '[]', agenda: data.agenda ?? null, minutes: data.minutes ?? null,
    decisions: data.decisions ?? null, actionItems: data.actionItems ?? '[]',
    distributed: 0, organiserId: data.organiserId ?? null, createdAt: now(),
  });
  return getMeeting(mid)!;
}

export const updateMeeting = (meetingId: string, data: Partial<Meeting>) => update('meetings', meetingId, data);

export const listTasks = (engagementId: string) =>
  all<Task>('SELECT * FROM tasks WHERE engagementId = ? ORDER BY CASE status WHEN \'DOING\' THEN 0 WHEN \'BLOCKED\' THEN 1 WHEN \'TODO\' THEN 2 ELSE 3 END, dueDate', [engagementId]);

export function createTask(data: Partial<Task> & { engagementId: string; title: string }): Task {
  const tid = id('tsk');
  insert('tasks', {
    id: tid, engagementId: data.engagementId, title: data.title, detail: data.detail ?? null,
    assigneeId: data.assigneeId ?? null, agentOwner: data.agentOwner ?? null,
    dueDate: data.dueDate ?? null, priority: data.priority ?? 'NORMAL',
    status: data.status ?? 'TODO', source: data.source ?? 'HUMAN', createdAt: now(),
  });
  return one<Task>('SELECT * FROM tasks WHERE id = ?', [tid])!;
}

export const updateTask = (taskId: string, data: Partial<Task>) => update('tasks', taskId, data);

// --------------------------------------------------------------- comments

export const listComments = (opts: { documentId?: string; findingId?: string }) =>
  opts.documentId
    ? all<Comment>('SELECT * FROM comments WHERE documentId = ? ORDER BY createdAt', [opts.documentId])
    : all<Comment>('SELECT * FROM comments WHERE findingId = ? ORDER BY createdAt', [opts.findingId]);

export function createComment(data: Partial<Comment> & { body: string; authorName: string }): Comment {
  const cid = id('cmt');
  insert('comments', {
    id: cid, authorId: data.authorId ?? null, authorName: data.authorName, body: data.body,
    documentId: data.documentId ?? null, findingId: data.findingId ?? null,
    visibleToClient: data.visibleToClient ?? 1, createdAt: now(),
  });
  return one<Comment>('SELECT * FROM comments WHERE id = ?', [cid])!;
}

// ------------------------------------------------------------------ audit

export function audit(e: {
  orgId: string; actorId?: string | null; actorName?: string; action: string;
  entityType: string; entityId?: string | null; engagementId?: string | null; metadata?: unknown;
}) {
  insert('audit_events', {
    id: id('aud'), orgId: e.orgId, actorId: e.actorId ?? null, actorName: e.actorName ?? 'system',
    action: e.action, entityType: e.entityType, entityId: e.entityId ?? null,
    engagementId: e.engagementId ?? null,
    metadata: e.metadata ? JSON.stringify(e.metadata) : null,
    createdAt: now(),
  });
}

export const listAudit = (orgId: string, opts: { engagementId?: string; limit?: number } = {}) =>
  opts.engagementId
    ? all<AuditEvent>('SELECT * FROM audit_events WHERE orgId = ? AND engagementId = ? ORDER BY createdAt DESC LIMIT ?', [orgId, opts.engagementId, opts.limit ?? 100])
    : all<AuditEvent>('SELECT * FROM audit_events WHERE orgId = ? ORDER BY createdAt DESC LIMIT ?', [orgId, opts.limit ?? 100]);

// --------------------------------------------------------- aggregate view

export interface EngagementSnapshot {
  engagement: Engagement;
  client: Client;
  requirements: Requirement[];
  documents: Document[];
  findings: Finding[];
  risks: Risk[];
  prospectus: ProspectusSection[];
  contract: Contract | null;
  milestones: Milestone[];
  runs: AgentRun[];
  tasks: Task[];
  meetings: Meeting[];
  completeness: ReturnType<typeof computeCompleteness>;
  compliance: ReturnType<typeof computeCompliance>;
  prospectusProgress: ReturnType<typeof computeProspectusProgress>;
  fees: ReturnType<typeof computeFeeProgress>;
  gate: ReturnType<typeof evaluateStageGate>;
  health: ReturnType<typeof overallHealth>;
}

export function snapshot(orgId: string, engagementId: string): EngagementSnapshot | null {
  const engagement = getEngagement(orgId, engagementId);
  if (!engagement) return null;
  const client = getClient(orgId, engagement.clientId)!;
  const requirements = listRequirements(engagementId);
  const documents = listDocuments(engagementId);
  const findings = listFindings(engagementId);
  const risks = listRisks(engagementId);
  const prospectus = listProspectus(engagementId);
  const contract = getContract(engagementId);
  const milestones = contract ? listMilestones(contract.id) : [];
  const runs = listAgentRuns(engagementId, 25);
  const tasks = listTasks(engagementId);
  const meetings = listMeetings(engagementId);

  const completeness = computeCompleteness(requirements);
  const compliance = computeCompliance(findings);
  const prospectusProgress = computeProspectusProgress(prospectus);
  const fees = computeFeeProgress(milestones, contract?.totalFee ?? 0);
  const gate = evaluateStageGate(engagement.stage, completeness.percent, findings, engagement.documentThreshold);
  const today = Date.now();
  const overdueCount =
    milestones.filter((m) => m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate).getTime() < today).length +
    tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate).getTime() < today).length;
  const health = overallHealth({
    completeness: completeness.percent, compliance: compliance.score,
    prospectus: prospectusProgress.percent, overdueCount,
  });

  return {
    engagement, client, requirements, documents, findings, risks, prospectus,
    contract, milestones, runs, tasks, meetings,
    completeness, compliance, prospectusProgress, fees, gate, health,
  };
}

export const listStaff = (orgId: string): SafeUser[] =>
  all<User>("SELECT * FROM users WHERE orgId = ? AND role != 'CLIENT' ORDER BY name", [orgId])
    .map(({ passwordHash: _p, ...u }) => u);
