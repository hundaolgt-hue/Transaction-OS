import { describe, it, expect } from 'vitest';
import { RULE_PACKS, getRulePack, packForTransaction } from '../src/lib/rulepacks';
import { TRANSACTION_TYPES } from '../src/lib/domain';

describe('the rule pack library', () => {
  it('ships a pack for every transaction type the product offers', () => {
    for (const t of TRANSACTION_TYPES) {
      expect(packForTransaction(t), `no pack covers ${t}`).toBeDefined();
    }
  });

  it('falls back to the equity pack for an unknown key', () => {
    expect(getRulePack('nonsense').key).toBe('ECMA-EQUITY');
    expect(getRulePack(null).key).toBe('ECMA-EQUITY');
  });

  it('keys are unique across packs', () => {
    const keys = RULE_PACKS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const pack of RULE_PACKS) {
    describe(pack.key, () => {
      it('has unique requirement codes', () => {
        const codes = pack.requirements.map((r) => r.code);
        expect(new Set(codes).size, `duplicate codes in ${pack.key}`).toBe(codes.length);
      });

      it('has unique rule ids and section codes', () => {
        const ids = pack.rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        const codes = pack.prospectus.map((s) => s.code);
        expect(new Set(codes).size).toBe(codes.length);
      });

      it('every rule targets a real requirement code or the wildcard', () => {
        const codes = new Set(pack.requirements.map((r) => r.code));
        for (const rule of pack.rules) {
          for (const target of rule.appliesTo) {
            expect(target === '*' || codes.has(target), `${pack.key} rule ${rule.id} targets unknown ${target}`).toBe(true);
          }
        }
      });

      it('every requirement carries an authority reference and a weight', () => {
        for (const r of pack.requirements) {
          expect(r.authorityRef.length, `${r.code} has no authority`).toBeGreaterThan(3);
          expect(r.weight).toBeGreaterThanOrEqual(1);
          expect(r.matchHints.length, `${r.code} has no match hints`).toBeGreaterThan(0);
        }
      });

      it('phrase-based rules actually carry phrases', () => {
        const needsPhrases = ['MUST_CONTAIN', 'MUST_CONTAIN_ANY', 'MUST_NOT_CONTAIN', 'EDITORIAL'];
        for (const r of pack.rules) {
          if (needsPhrases.includes(r.kind)) {
            expect(r.phrases?.length, `${pack.key} rule ${r.id} has no phrases`).toBeGreaterThan(0);
          }
        }
      });

      it('milestone fee shares sum to the whole fee', () => {
        expect(pack.milestones.reduce((a, m) => a + m.feeShare, 0)).toBeCloseTo(1, 5);
      });

      it('sections are ordered and named', () => {
        const seqs = pack.prospectus.map((s) => s.sequence);
        expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
        for (const s of pack.prospectus) {
          expect(s.heading.length).toBeGreaterThan(3);
          expect(s.minWords).toBeGreaterThan(50);
        }
      });

      it('names what its drafted output is called', () => {
        expect(pack.outputLabel.length).toBeGreaterThan(3);
      });

      it('carries a verification disclaimer', () => {
        expect(pack.disclaimer.toLowerCase()).toContain('confirm');
      });
    });
  }
});
