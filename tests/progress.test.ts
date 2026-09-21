import { describe, it, expect } from 'vitest';
import {
  computeCompleteness, computeCompliance, computeProspectusProgress,
  computeFeeProgress, evaluateStageGate, overallHealth,
} from '../src/lib/progress';
import type { Requirement, Finding, ProspectusSection, Milestone } from '../src/lib/types';

const req = (o: Partial<Requirement>): Requirement => ({
  id: 'r', engagementId: 'e', code: 'C', title: 'T', category: 'CORPORATE',
  description: null, authorityRef: null, mandatory: 1, weight: 1,
  appliesToStage: 'DUE_DILIGENCE', dueDate: null, status: 'MISSING',
  waivedReason: null, sequence: 0, createdAt: '', updatedAt: '', ...o,
});

const finding = (o: Partial<Finding>): Finding => ({
  id: 'f', engagementId: 'e', documentId: null, requirementId: null, agentRunId: null,
  agent: 'LEGAL', gapType: 'COMPLIANCE', severity: 'MEDIUM', title: 't', detail: 'd',
  citation: null, recommendation: null, excerpt: null, confidence: 0.8, status: 'OPEN',
  humanVerdict: null, assigneeId: null, resolvedById: null, resolvedAt: null,
  resolutionNote: null, visibleToClient: 0, dedupeKey: null, createdAt: '', updatedAt: '', ...o,
});

describe('computeCompleteness', () => {
  it('returns zero for an empty checklist', () => {
    expect(computeCompleteness([]).percent).toBe(0);
  });

  it('weights requirements rather than counting them', () => {
    // One heavy accepted item outweighs two light missing ones.
    const r = computeCompleteness([
      req({ id: '1', weight: 5, status: 'ACCEPTED' }),
      req({ id: '2', weight: 1, status: 'MISSING' }),
      req({ id: '3', weight: 1, status: 'MISSING' }),
    ]);
    expect(r.percent).toBe(71); // 5 / 7
    expect(r.accepted).toBe(1);
    expect(r.missing).toBe(2);
  });

  it('gives partial credit for submitted and full credit for waived', () => {
    expect(computeCompleteness([req({ status: 'SUBMITTED' })]).percent).toBe(60);
    expect(computeCompleteness([req({ status: 'UNDER_REVIEW' })]).percent).toBe(75);
    expect(computeCompleteness([req({ status: 'WAIVED' })]).percent).toBe(100);
    expect(computeCompleteness([req({ status: 'REJECTED' })]).percent).toBe(0);
  });

  it('counts mandatory items that are not fully credited', () => {
    const r = computeCompleteness([
      req({ id: '1', mandatory: 1, status: 'SUBMITTED' }),
      req({ id: '2', mandatory: 1, status: 'ACCEPTED' }),
      req({ id: '3', mandatory: 0, status: 'MISSING' }),
    ]);
    expect(r.mandatoryMissing).toBe(1);
  });

  it('breaks completeness down by category', () => {
    const r = computeCompleteness([
      req({ id: '1', category: 'FINANCIAL', status: 'ACCEPTED' }),
      req({ id: '2', category: 'FINANCIAL', status: 'MISSING' }),
      req({ id: '3', category: 'LEGAL', status: 'ACCEPTED' }),
    ]);
    expect(r.byCategory).toEqual([
      { category: 'FINANCIAL', total: 2, done: 1, percent: 50 },
      { category: 'LEGAL', total: 1, done: 1, percent: 100 },
    ]);
  });
});

describe('computeCompliance', () => {
  it('scores a clean file at 100', () => {
    expect(computeCompliance([]).score).toBe(100);
  });

  it('penalises by severity, not by count', () => {
    const oneCritical = computeCompliance([finding({ severity: 'CRITICAL' })]).score;
    const fiveLow = computeCompliance(
      Array.from({ length: 5 }, (_, i) => finding({ id: String(i), severity: 'LOW' })),
    ).score;
    expect(oneCritical).toBeLessThan(fiveLow);
  });

  it('ignores closed findings when scoring', () => {
    const r = computeCompliance([
      finding({ id: '1', severity: 'CRITICAL', status: 'RESOLVED' }),
      finding({ id: '2', severity: 'CRITICAL', status: 'FALSE_POSITIVE' }),
    ]);
    expect(r.score).toBe(100);
    expect(r.open).toBe(0);
    expect(r.resolved).toBe(2);
  });

  it('never returns a negative score', () => {
    const many = Array.from({ length: 60 }, (_, i) => finding({ id: String(i), severity: 'CRITICAL' }));
    expect(computeCompliance(many).score).toBeGreaterThanOrEqual(0);
  });
});

describe('evaluateStageGate', () => {
  it('blocks on completeness below the stage threshold', () => {
    const g = evaluateStageGate('DOCUMENT_COLLECTION', 40, [], 80);
    expect(g.canAdvance).toBe(false);
    expect(g.nextStage).toBe('DUE_DILIGENCE');
    expect(g.blockers[0]).toContain('40%');
  });

  it('blocks on an open critical finding even at full completeness', () => {
    const g = evaluateStageGate('DOCUMENT_COLLECTION', 100, [finding({ severity: 'CRITICAL' })], 80);
    expect(g.canAdvance).toBe(false);
    expect(g.blockers.some((b) => b.includes('critical'))).toBe(true);
  });

  it('allows the move when the threshold is met and nothing is critical', () => {
    const g = evaluateStageGate('DOCUMENT_COLLECTION', 90, [finding({ severity: 'HIGH' })], 80);
    expect(g.canAdvance).toBe(true);
  });

  it('treats a dismissed critical finding as cleared', () => {
    const g = evaluateStageGate('DOCUMENT_COLLECTION', 90, [finding({ severity: 'CRITICAL', status: 'DISMISSED' })], 80);
    expect(g.canAdvance).toBe(true);
  });

  it('cannot advance past the final stage', () => {
    const g = evaluateStageGate('CLOSING', 100, [], 80);
    expect(g.nextStage).toBeNull();
    expect(g.canAdvance).toBe(false);
  });
});

describe('computeFeeProgress', () => {
  const ms = (o: Partial<Milestone>): Milestone => ({
    id: 'm', contractId: 'c', name: 'n', description: null, sequence: 0,
    dueDate: null, completedAt: null, status: 'PENDING', paymentAmount: 0,
    paymentStatus: 'UNBILLED', invoiceNo: null, paidAt: null, ...o,
  });

  it('separates paid, invoiced and unbilled', () => {
    const r = computeFeeProgress([
      ms({ id: '1', paymentAmount: 400, paymentStatus: 'PAID', status: 'COMPLETED' }),
      ms({ id: '2', paymentAmount: 300, paymentStatus: 'INVOICED' }),
      ms({ id: '3', paymentAmount: 300, paymentStatus: 'UNBILLED' }),
    ], 1000);
    expect(r.paid).toBe(400);
    expect(r.billed).toBe(700);
    expect(r.outstanding).toBe(300);
    expect(r.unbilled).toBe(300);
    expect(r.percentPaid).toBe(40);
    expect(r.percentComplete).toBe(33);
  });

  it('handles a contract with no fee', () => {
    expect(computeFeeProgress([], 0).percentPaid).toBe(0);
  });
});

describe('computeProspectusProgress', () => {
  const sec = (o: Partial<ProspectusSection>): ProspectusSection => ({
    id: 's', engagementId: 'e', code: 'P', sequence: 0, heading: 'h', requiredBy: null,
    body: '', wordCount: 0, status: 'NOT_STARTED', generatedBy: null, reviewNote: null,
    completeness: 0, createdAt: '', updatedAt: '', ...o,
  });

  it('averages section completeness and counts states', () => {
    const r = computeProspectusProgress([
      sec({ id: '1', completeness: 100, status: 'APPROVED' }),
      sec({ id: '2', completeness: 50, status: 'DRAFTED' }),
      sec({ id: '3', completeness: 0, status: 'NOT_STARTED' }),
    ]);
    expect(r.percent).toBe(50);
    expect(r.drafted).toBe(2);
    expect(r.approved).toBe(1);
  });
});

describe('overallHealth', () => {
  it('labels a strong file as on track', () => {
    expect(overallHealth({ completeness: 95, compliance: 90, prospectus: 80, overdueCount: 0 }).tone).toBe('good');
  });
  it('labels a weak file as at risk', () => {
    expect(overallHealth({ completeness: 20, compliance: 20, prospectus: 0, overdueCount: 4 }).tone).toBe('risk');
  });
  it('clamps to the 0–100 range', () => {
    const h = overallHealth({ completeness: 100, compliance: 100, prospectus: 100, overdueCount: 99 });
    expect(h.score).toBeLessThanOrEqual(100);
    expect(h.score).toBeGreaterThanOrEqual(0);
  });
});
