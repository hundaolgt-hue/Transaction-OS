import { REQUIREMENT_CREDIT, SEVERITY_WEIGHT, STAGE_META, stageIndex, STAGES } from './domain';
import type { Severity, RequirementStatus, Stage } from './domain';
import type { Requirement, Finding, ProspectusSection, Milestone } from './types';

export interface CompletenessResult {
  percent: number;
  weightedTotal: number;
  weightedEarned: number;
  total: number;
  accepted: number;
  submitted: number;
  missing: number;
  rejected: number;
  waived: number;
  mandatoryMissing: number;
  byCategory: { category: string; total: number; done: number; percent: number }[];
}

/** Weighted document completeness for an engagement. */
export function computeCompleteness(reqs: Requirement[]): CompletenessResult {
  let weightedTotal = 0;
  let weightedEarned = 0;
  const counts = { accepted: 0, submitted: 0, missing: 0, rejected: 0, waived: 0, mandatoryMissing: 0 };
  const cats = new Map<string, { total: number; done: number }>();

  for (const r of reqs) {
    const w = Math.max(1, r.weight);
    const credit = REQUIREMENT_CREDIT[r.status as RequirementStatus] ?? 0;
    weightedTotal += w;
    weightedEarned += w * credit;

    if (r.status === 'ACCEPTED') counts.accepted++;
    else if (r.status === 'WAIVED') counts.waived++;
    else if (r.status === 'REJECTED') counts.rejected++;
    else if (r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW') counts.submitted++;
    else counts.missing++;

    if (r.mandatory && credit < 1) counts.mandatoryMissing++;

    const c = cats.get(r.category) ?? { total: 0, done: 0 };
    c.total += w;
    c.done += w * credit;
    cats.set(r.category, c);
  }

  return {
    percent: weightedTotal === 0 ? 0 : Math.round((weightedEarned / weightedTotal) * 100),
    weightedTotal,
    weightedEarned: Math.round(weightedEarned * 100) / 100,
    total: reqs.length,
    ...counts,
    byCategory: [...cats.entries()]
      .map(([category, v]) => ({
        category,
        total: v.total,
        done: Math.round(v.done * 10) / 10,
        percent: v.total === 0 ? 0 : Math.round((v.done / v.total) * 100),
      }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  };
}

export interface ComplianceResult {
  score: number;          // 0..100, higher is cleaner
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  penalty: number;
}

/** Compliance health from open findings. */
export function computeCompliance(findings: Finding[]): ComplianceResult {
  const live = findings.filter((f) => ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status));
  const tally = { critical: 0, high: 0, medium: 0, low: 0 };
  let penalty = 0;
  for (const f of live) {
    const sev = f.severity as Severity;
    penalty += SEVERITY_WEIGHT[sev] ?? 1;
    if (sev === 'CRITICAL') tally.critical++;
    else if (sev === 'HIGH') tally.high++;
    else if (sev === 'MEDIUM') tally.medium++;
    else tally.low++;
  }
  // Diminishing-returns curve so one critical does not zero the score outright.
  const score = Math.max(0, Math.round(100 * Math.exp(-penalty / 180)));
  return {
    score,
    open: live.length,
    ...tally,
    resolved: findings.filter((f) => ['RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'].includes(f.status)).length,
    penalty,
  };
}

export function computeProspectusProgress(sections: ProspectusSection[]): { percent: number; drafted: number; approved: number; total: number } {
  if (!sections.length) return { percent: 0, drafted: 0, approved: 0, total: 0 };
  const sum = sections.reduce((a, s) => a + s.completeness, 0);
  return {
    percent: Math.round(sum / sections.length),
    drafted: sections.filter((s) => ['DRAFTED', 'IN_REVIEW', 'APPROVED'].includes(s.status)).length,
    approved: sections.filter((s) => s.status === 'APPROVED').length,
    total: sections.length,
  };
}

export interface GateResult {
  canAdvance: boolean;
  nextStage: string | null;
  threshold: number;
  completeness: number;
  blockers: string[];
}

/** Whether the engagement may move to the next stage. */
export function evaluateStageGate(
  stage: string,
  completeness: number,
  findings: Finding[],
  engagementThreshold: number,
): GateResult {
  const i = stageIndex(stage);
  const next = i >= STAGES.length - 1 ? null : STAGES[i + 1];
  const stageThreshold = STAGE_META[(next ?? stage) as Stage]?.gateThreshold ?? 0;
  const threshold = Math.max(stageThreshold, next ? engagementThreshold * (stageThreshold / 100) : 0);
  const blockers: string[] = [];

  if (!next) blockers.push('Engagement is at the final stage.');
  if (completeness < stageThreshold) {
    const label = STAGE_META[(next ?? stage) as Stage]?.label ?? (next ?? stage);
    blockers.push(`Document completeness is ${completeness}% — ${stageThreshold}% required to enter ${label}.`);
  }

  const openCritical = findings.filter(
    (f) => f.severity === 'CRITICAL' && ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status),
  );
  if (openCritical.length) {
    blockers.push(`${openCritical.length} critical finding${openCritical.length > 1 ? 's' : ''} must be resolved or dismissed first.`);
  }

  return { canAdvance: blockers.length === 0, nextStage: next, threshold: stageThreshold, completeness, blockers };
}

export function computeFeeProgress(milestones: Milestone[], totalFee: number) {
  const billed = milestones.filter((m) => m.paymentStatus !== 'UNBILLED').reduce((a, m) => a + m.paymentAmount, 0);
  const paid = milestones.filter((m) => m.paymentStatus === 'PAID').reduce((a, m) => a + m.paymentAmount, 0);
  const done = milestones.filter((m) => m.status === 'COMPLETED').length;
  return {
    billed,
    paid,
    outstanding: Math.max(0, billed - paid),
    unbilled: Math.max(0, totalFee - billed),
    milestonesDone: done,
    milestonesTotal: milestones.length,
    percentComplete: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
    percentPaid: totalFee > 0 ? Math.round((paid / totalFee) * 100) : 0,
  };
}

/** Overall engagement health: a blend of documents, compliance, prospectus and schedule. */
export function overallHealth(o: {
  completeness: number; compliance: number; prospectus: number; overdueCount: number;
}): { score: number; label: string; tone: 'good' | 'watch' | 'risk' } {
  const raw = o.completeness * 0.35 + o.compliance * 0.35 + o.prospectus * 0.2 + Math.max(0, 100 - o.overdueCount * 15) * 0.1;
  const score = Math.round(Math.min(100, Math.max(0, raw)));
  if (score >= 75) return { score, label: 'On track', tone: 'good' };
  if (score >= 50) return { score, label: 'Needs attention', tone: 'watch' };
  return { score, label: 'At risk', tone: 'risk' };
}
