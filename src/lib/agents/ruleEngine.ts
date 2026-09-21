import type { RuleSpec, RulePack } from '../rulepacks';
import type { Document, Requirement } from '../types';

export interface RuleHit {
  ruleId: string;
  agent: string;
  gapType: string;
  severity: string;
  title: string;
  detail: string;
  citation: string;
  recommendation: string;
  excerpt: string | null;
  confidence: number;
  documentId: string | null;
  requirementId: string | null;
  dedupeKey: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');

function excerptAround(text: string, phrase: string, radius = 140): string | null {
  const i = norm(text).indexOf(norm(phrase));
  if (i < 0) return null;
  const from = Math.max(0, i - radius);
  const to = Math.min(text.length, i + phrase.length + radius);
  return `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < text.length ? '…' : ''}`;
}

/** Latest ISO-ish or written date mentioned in the text. Parsed in UTC so the
 *  result does not shift with the server's timezone. */
export function latestDateIn(text: string): Date | null {
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  const found: Date[] = [];

  for (const m of text.match(/\b(19|20)\d{2}-\d{2}-\d{2}\b/g) ?? []) {
    const [y, mo, d] = m.split('-').map(Number);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) found.push(utc(y, mo - 1, d));
  }

  const re = new RegExp(`\\b(\\d{1,2})?\\s*(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const monthIndex = MONTHS.indexOf(m[2].toLowerCase());
    const day = m[1] ? Number(m[1]) : 1;
    const year = Number(m[3]);
    if (monthIndex >= 0 && day >= 1 && day <= 31) found.push(utc(year, monthIndex, day));
  }

  // dd/mm/yyyy — the convention used in Ethiopian and UK-style documents.
  for (const s of text.match(/\b\d{1,2}\/\d{1,2}\/(19|20)\d{2}\b/g) ?? []) {
    const [d, mo, y] = s.split('/').map(Number);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) found.push(utc(y, mo - 1, d));
  }

  if (!found.length) return null;
  return found.sort((x, y) => y.getTime() - x.getTime())[0];
}

function applies(rule: RuleSpec, req: Requirement | null): boolean {
  if (rule.appliesTo.includes('*')) return true;
  return req ? rule.appliesTo.includes(req.code) : false;
}

/**
 * Evaluate a rule pack against the documents of an engagement.
 * Every hit carries a stable dedupeKey so repeated runs do not duplicate findings.
 */
export function evaluateRules(opts: {
  pack: RulePack;
  agent: string;
  documents: Document[];
  requirements: Requirement[];
  asOf?: Date;
  /** Raise a finding for a mandatory requirement with nothing filed against it.
   *  Off during document collection, where the checklist is the right surface. */
  raiseMissing?: boolean;
}): RuleHit[] {
  const { pack, agent, documents, requirements } = opts;
  const raiseMissing = opts.raiseMissing ?? true;
  const asOf = opts.asOf ?? new Date();
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const reqByCode = new Map(requirements.map((r) => [r.code, r]));
  const hits: RuleHit[] = [];
  const rules = pack.rules.filter((r) => r.agent === agent);

  for (const rule of rules) {
    // Rules bound to specific requirement codes fire even when no document exists —
    // a missing mandatory document is itself a regulatory gap.
    const targets = rule.appliesTo.includes('*')
      ? documents
      : documents.filter((d) => {
          const req = d.requirementId ? reqById.get(d.requirementId) : null;
          return applies(rule, req ?? null);
        });

    if (!rule.appliesTo.includes('*') && targets.length === 0) {
      if (!raiseMissing) continue;
      for (const code of rule.appliesTo) {
        const req = reqByCode.get(code);
        if (!req || !req.mandatory) continue;
        if (['ACCEPTED', 'WAIVED'].includes(req.status)) continue;
        hits.push({
          ruleId: rule.id,
          agent: rule.agent,
          gapType: 'REGULATORY',
          severity: req.weight >= 4 ? 'CRITICAL' : 'HIGH',
          title: `${req.title} not on file`,
          detail: `Rule ${rule.id} could not be tested because no document has been accepted against ${req.code} — ${req.title}. ${req.description ?? ''}`.trim(),
          citation: req.authorityRef ?? rule.citation,
          recommendation: `Request "${req.title}" from the client and re-run the ${rule.agent.toLowerCase()} review.`,
          excerpt: null,
          confidence: 1,
          documentId: null,
          requirementId: req.id,
          dedupeKey: `missing:${req.code}`,
        });
      }
      continue;
    }

    for (const doc of targets) {
      const text = doc.extractedText ?? '';
      if (!text.trim() && rule.kind !== 'DATE_FRESHNESS') continue;
      const hit = evaluateOne(rule, doc, text, asOf);
      if (hit) hits.push(hit);
    }
  }

  // Deduplicate within the run.
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(h.dedupeKey) ? false : (seen.add(h.dedupeKey), true)));
}

function evaluateOne(rule: RuleSpec, doc: Document, text: string, asOf: Date): RuleHit | null {
  const base = {
    ruleId: rule.id,
    agent: rule.agent,
    gapType: rule.gapType,
    severity: rule.severity,
    title: rule.title,
    citation: rule.citation,
    recommendation: rule.recommendation,
    documentId: doc.id,
    requirementId: doc.requirementId,
    dedupeKey: `${rule.id}:${doc.id}`,
  };
  const hay = norm(text);

  switch (rule.kind) {
    case 'MUST_CONTAIN_ANY': {
      const phrases = rule.phrases ?? [];
      const found = phrases.some((p) => hay.includes(norm(p)));
      if (found) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\nTested "${doc.title}" for any of: ${phrases.map((p) => `“${p}”`).join(', ')}. None was present.`,
        excerpt: null,
        confidence: 0.82,
      };
    }
    case 'MUST_CONTAIN': {
      const phrases = rule.phrases ?? [];
      const missing = phrases.filter((p) => !hay.includes(norm(p)));
      if (!missing.length) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\nAbsent from "${doc.title}": ${missing.map((p) => `“${p}”`).join(', ')}.`,
        excerpt: null,
        confidence: 0.88,
      };
    }
    case 'MUST_NOT_CONTAIN': {
      const phrases = rule.phrases ?? [];
      const found = phrases.find((p) => hay.includes(norm(p)));
      if (!found) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\nDetected “${found}” in "${doc.title}".`,
        excerpt: excerptAround(text, found),
        confidence: 0.9,
      };
    }
    case 'NUMERIC_PRESENT': {
      const re = new RegExp(rule.pattern ?? '\\d+', 'g');
      const matches = text.match(re) ?? [];
      if (matches.length >= 2) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\n"${doc.title}" contains ${matches.length} quantified figure(s); a schedule of amounts was expected.`,
        excerpt: null,
        confidence: 0.75,
      };
    }
    case 'DATE_FRESHNESS': {
      const latest = latestDateIn(text);
      const maxAge = rule.maxAgeMonths ?? 12;
      if (!latest) {
        return {
          ...base,
          severity: 'MEDIUM',
          detail: `${rule.detail}\n\nNo readable date was found in "${doc.title}", so its currency could not be confirmed.`,
          excerpt: null,
          confidence: 0.6,
        };
      }
      const ageMonths = (asOf.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (ageMonths <= maxAge) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\nThe most recent date in "${doc.title}" is ${latest.toISOString().slice(0, 10)} — ${Math.round(ageMonths)} months old against a ${maxAge}-month window.`,
        excerpt: null,
        confidence: 0.85,
      };
    }
    case 'EDITORIAL': {
      const phrases = rule.phrases ?? [];
      const found = phrases.find((p) => hay.includes(norm(p)));
      if (!found) return null;
      return {
        ...base,
        detail: `${rule.detail}\n\nFound “${found}” in "${doc.title}".`,
        excerpt: excerptAround(text, found),
        confidence: 0.95,
      };
    }
    case 'CROSS_DOC':
    default:
      return null;
  }
}

/** Score a document's match against the requirement catalogue, for auto-filing uploads. */
export function suggestRequirement(
  fileName: string,
  title: string,
  text: string,
  pack: RulePack,
): { code: string; score: number } | null {
  const hay = norm(`${fileName} ${title} ${text.slice(0, 4000)}`);
  let best: { code: string; score: number } | null = null;
  for (const req of pack.requirements) {
    let score = 0;
    for (const hint of req.matchHints) {
      const n = norm(hint);
      if (norm(`${fileName} ${title}`).includes(n)) score += 4;
      else if (hay.includes(n)) score += 1.5;
    }
    if (norm(title).includes(norm(req.title))) score += 6;
    if (score > (best?.score ?? 0)) best = { code: req.code, score };
  }
  return best && best.score >= 3 ? best : null;
}
