import { describe, it, expect } from 'vitest';
import { evaluateRules, suggestRequirement, latestDateIn } from '../src/lib/agents/ruleEngine';
import { ecmaEquityPack } from '../src/lib/rulepacks/ecma-equity';
import type { RulePack, RuleSpec } from '../src/lib/rulepacks/types';
import type { Document, Requirement } from '../src/lib/types';

const doc = (o: Partial<Document>): Document => ({
  id: 'd1', engagementId: 'e', requirementId: 'r1', title: 'Doc', fileName: 'doc.txt',
  storageKey: 'k', mimeType: 'text/plain', sizeBytes: 1, version: 1, supersedesId: null,
  extractedText: '', pageCount: null, status: 'SUBMITTED', reviewNote: null,
  uploadedById: null, uploadedByRole: 'ADVISOR', createdAt: '', updatedAt: '', ...o,
});

const req = (o: Partial<Requirement>): Requirement => ({
  id: 'r1', engagementId: 'e', code: 'ECMA-C-002', title: 'Articles of Association',
  category: 'CORPORATE', description: null, authorityRef: 'ref', mandatory: 1, weight: 3,
  appliesToStage: 'DOCUMENT_COLLECTION', dueDate: null, status: 'SUBMITTED',
  waivedReason: null, sequence: 0, createdAt: '', updatedAt: '', ...o,
});

function packWith(rules: RuleSpec[]): RulePack {
  return { ...ecmaEquityPack, rules };
}

const baseRule: RuleSpec = {
  id: 'X-1', agent: 'LEGAL', appliesTo: ['ECMA-C-002'], kind: 'MUST_CONTAIN_ANY',
  gapType: 'COMPLIANCE', severity: 'HIGH', title: 'Missing transfer clause',
  detail: 'detail', citation: 'cite', recommendation: 'fix it', phrases: ['transfer of shares'],
};

describe('MUST_CONTAIN_ANY', () => {
  it('raises a finding when no phrase is present', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'Article 3. Shares carry one vote each.' })],
      requirements: [req({})],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe('HIGH');
    expect(hits[0].dedupeKey).toBe('X-1:d1');
  });

  it('stays silent when a phrase is present, ignoring case and spacing', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'The  TRANSFER   OF SHARES is governed by Article 9.' })],
      requirements: [req({})],
    });
    expect(hits).toHaveLength(0);
  });
});

describe('MUST_NOT_CONTAIN', () => {
  const rule: RuleSpec = { ...baseRule, id: 'X-2', kind: 'MUST_NOT_CONTAIN', phrases: ['change of control'] };

  it('raises a finding and captures an excerpt around the match', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'Clause 18.2 provides that upon a change of control the distributor may terminate.' })],
      requirements: [req({})],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].excerpt).toContain('change of control');
  });

  it('stays silent when the prohibited phrase is absent', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'An ordinary supply agreement.' })],
      requirements: [req({})],
    });
    expect(hits).toHaveLength(0);
  });
});

describe('MUST_CONTAIN', () => {
  const rule: RuleSpec = { ...baseRule, id: 'X-3', kind: 'MUST_CONTAIN', phrases: ['statement of cash flows', 'changes in equity'] };

  it('names only the phrases that are missing', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'Includes a statement of cash flows only.' })],
      requirements: [req({})],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].detail).toContain('changes in equity');
    expect(hits[0].detail).not.toContain('“statement of cash flows”');
  });
});

describe('DATE_FRESHNESS', () => {
  const rule: RuleSpec = { ...baseRule, id: 'X-4', kind: 'DATE_FRESHNESS', maxAgeMonths: 12, phrases: [] };
  const asOf = new Date('2026-09-19');

  it('raises a finding when the newest date is outside the window', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'Date of issue: 11 February 2025. Valid six months.' })],
      requirements: [req({})], asOf,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].detail).toContain('2025-02-11');
  });

  it('stays silent when the document is current', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'Date of issue: 3 June 2026.' })],
      requirements: [req({})], asOf,
    });
    expect(hits).toHaveLength(0);
  });

  it('flags a document with no readable date at reduced severity', () => {
    const hits = evaluateRules({
      pack: packWith([rule]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'No date appears anywhere in this text.' })],
      requirements: [req({})], asOf,
    });
    expect(hits[0].severity).toBe('MEDIUM');
  });
});

describe('missing mandatory documents', () => {
  it('raises a regulatory gap when nothing is filed against a mandatory requirement', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule]), agent: 'LEGAL',
      documents: [], requirements: [req({ status: 'MISSING' })],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].gapType).toBe('REGULATORY');
    expect(hits[0].dedupeKey).toBe('missing:ECMA-C-002');
    expect(hits[0].documentId).toBeNull();
  });

  it('does not raise one when the requirement is accepted or waived', () => {
    for (const status of ['ACCEPTED', 'WAIVED']) {
      const hits = evaluateRules({
        pack: packWith([baseRule]), agent: 'LEGAL',
        documents: [], requirements: [req({ status })],
      });
      expect(hits).toHaveLength(0);
    }
  });
});

describe('agent scoping and deduplication', () => {
  it('only runs the rules belonging to the requested agent', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule]), agent: 'FINANCIAL',
      documents: [doc({ extractedText: 'nothing relevant' })], requirements: [req({})],
    });
    expect(hits).toHaveLength(0);
  });

  it('emits one hit per rule and document, never duplicates', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule, { ...baseRule }]), agent: 'LEGAL',
      documents: [doc({ extractedText: 'nothing relevant' })], requirements: [req({})],
    });
    expect(hits).toHaveLength(1);
  });

  it('skips documents with no extracted text', () => {
    const hits = evaluateRules({
      pack: packWith([baseRule]), agent: 'LEGAL',
      documents: [doc({ extractedText: '' })], requirements: [req({ status: 'ACCEPTED' })],
    });
    expect(hits).toHaveLength(0);
  });
});

describe('the shipped ECMA equity pack', () => {
  it('flags a modified audit opinion as critical', () => {
    const financialReq = req({ id: 'rf', code: 'ECMA-F-003', title: 'Auditor Report', status: 'SUBMITTED' });
    const hits = evaluateRules({
      pack: ecmaEquityPack, agent: 'FINANCIAL',
      documents: [doc({ id: 'df', requirementId: 'rf', extractedText: 'Qualified opinion. Except for the effects of the matter described, the statements present fairly.' })],
      requirements: [financialReq],
    });
    const modified = hits.find((h) => h.ruleId === 'F-003');
    expect(modified).toBeDefined();
    expect(modified!.severity).toBe('CRITICAL');
  });

  it('flags a going-concern material uncertainty', () => {
    const r = req({ id: 'rf', code: 'ECMA-F-001', title: 'Audited Financials', status: 'SUBMITTED' });
    const hits = evaluateRules({
      pack: ecmaEquityPack, agent: 'FINANCIAL',
      documents: [doc({ id: 'df', requirementId: 'rf', extractedText: 'A material uncertainty exists that may cast significant doubt on the ability to continue as a going concern. Prepared under International Financial Reporting Standards. Statement of financial position, statement of cash flows, changes in equity, related party note.' })],
      requirements: [r],
    });
    expect(hits.some((h) => h.ruleId === 'F-004' && h.severity === 'CRITICAL')).toBe(true);
  });

  it('does not flag a clean IFRS statement set', () => {
    const r = req({ id: 'rf', code: 'ECMA-F-001', title: 'Audited Financials', status: 'SUBMITTED' });
    const hits = evaluateRules({
      pack: ecmaEquityPack, agent: 'FINANCIAL',
      documents: [doc({ id: 'df', requirementId: 'rf', extractedText: 'Prepared in accordance with International Financial Reporting Standards. Statement of financial position. Statement of cash flows. Changes in equity. Related party transactions are disclosed in note 24. Key management personnel compensation.' })],
      requirements: [r],
    });
    expect(hits.filter((h) => h.documentId === 'df')).toHaveLength(0);
  });

  it('catches placeholder text as an editorial gap', () => {
    const hits = evaluateRules({
      pack: ecmaEquityPack, agent: 'PROSPECTUS',
      documents: [doc({ extractedText: 'The trustee is [TBD] pending counsel review.' })],
      requirements: [req({})],
    });
    expect(hits.some((h) => h.gapType === 'EDITORIAL')).toBe(true);
  });

  it('every rule cites an authority and gives a recommendation', () => {
    for (const r of ecmaEquityPack.rules) {
      expect(r.citation.length, `rule ${r.id} has no citation`).toBeGreaterThan(5);
      expect(r.recommendation.length, `rule ${r.id} has no recommendation`).toBeGreaterThan(10);
    }
  });

  it('every prospectus source requirement exists in the checklist', () => {
    const codes = new Set(ecmaEquityPack.requirements.map((r) => r.code));
    for (const s of ecmaEquityPack.prospectus) {
      for (const c of s.sourceRequirements) {
        expect(codes.has(c), `section ${s.code} points at unknown requirement ${c}`).toBe(true);
      }
    }
  });

  it('milestone fee shares add up to the whole fee', () => {
    const total = ecmaEquityPack.milestones.reduce((a, m) => a + m.feeShare, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('suggestRequirement', () => {
  it('matches a document to the right checklist item from its title', () => {
    const m = suggestRequirement('articles-of-association.pdf', 'Articles of Association', '', ecmaEquityPack);
    expect(m?.code).toBe('ECMA-C-002');
  });

  it('matches from body text when the filename is opaque', () => {
    const m = suggestRequirement('scan_0042.pdf', 'Scan 0042',
      'MINISTRY OF REVENUE tax clearance certificate for the taxpayer named below', ecmaEquityPack);
    expect(m?.code).toBe('ECMA-T-001');
  });

  it('returns null rather than guessing on unrelated content', () => {
    expect(suggestRequirement('photo.jpg', 'Holiday photo', 'beach sand sun', ecmaEquityPack)).toBeNull();
  });
});

describe('latestDateIn', () => {
  it('picks the most recent of several date formats', () => {
    const d = latestDateIn('Signed 12 November 2024, amended 2025-06-30, filed 03/02/2023');
    expect(d?.toISOString().slice(0, 10)).toBe('2025-06-30');
  });
  it('returns null when there is no date', () => {
    expect(latestDateIn('no dates here')).toBeNull();
  });
});
