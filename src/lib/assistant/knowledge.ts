/**
 * The assistant's knowledge of the whole operation. Pure — built from
 * snapshots, so the server, the Telegram/Slack bots and the browser preview
 * all answer from the same logic.
 */
import type { EngagementSnapshot } from '../repo/core';
import type { SafeUser } from '../types';
import { STAGE_META, TRANSACTION_LABEL, fmtDate, fmtMoney, titleCase, AGENT_META, type Stage, type TransactionType, type AgentKey } from '../domain';
import { extractFinancials, computeRatios, financialNarrative, extractCovenants } from '../finance/analyze';

export interface Chunk { id: string; kind: string; title: string; text: string; link: string; ref: string }
export interface Source { title: string; link: string; ref: string }
export interface Answer { text: string; sources: Source[]; intent: string; engine: 'local' | 'anthropic' }

const LIVE = ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'];

// ----------------------------------------------------------------- corpus

export function buildCorpus(snaps: EngagementSnapshot[]): Chunk[] {
  const out: Chunk[] = [];
  for (const s of snaps) {
    const e = s.engagement, ref = e.reference, base = `/engagements/${e.id}`;
    out.push({ id: `eng:${e.id}`, kind: 'engagement', ref, link: base, title: `${ref} — ${s.client.name}`, text: `${s.client.name} ${e.name} ${titleCase(e.transactionType)} stage ${STAGE_META[e.stage as Stage]?.label} completeness ${s.completeness.percent}% findings ${s.compliance.open} health ${s.health.label} ${e.description ?? ''}` });
    for (const d of s.documents) {
      const text = (d.extractedText ?? '').replace(/SYNTHETIC SAMPLE DOCUMENT[^\n]*\n/, '');
      for (let i = 0; i < Math.min(text.length, 12000); i += 900) {
        out.push({ id: `doc:${d.id}:${i}`, kind: 'document', ref, link: `${base}/documents`, title: `${d.title} (${ref})`, text: text.slice(i, i + 1100) });
      }
    }
    for (const f of s.findings) out.push({ id: `f:${f.id}`, kind: 'finding', ref, link: `${base}/findings`, title: `${titleCase(f.severity)} finding: ${f.title} (${ref})`, text: `${f.title}. ${f.detail} ${f.recommendation ?? ''} ${f.citation ?? ''} status ${f.status}` });
    for (const k of s.risks) out.push({ id: `r:${k.id}`, kind: 'risk', ref, link: `${base}/risks`, title: `Risk ${k.code}: ${k.title} (${ref})`, text: `${k.title}. ${k.description} ${k.mitigation ?? ''} ${k.disclosureStrategy ?? ''}` });
    for (const p of s.prospectus) if (p.body) out.push({ id: `p:${p.id}`, kind: 'prospectus', ref, link: `${base}/prospectus`, title: `${p.code} ${p.heading} (${ref})`, text: p.body.slice(0, 1500) });
    for (const m of s.milestones) out.push({ id: `m:${m.id}`, kind: 'milestone', ref, link: `${base}/contract`, title: `Milestone: ${m.name} (${ref})`, text: `${m.name} due ${fmtDate(m.dueDate)} status ${m.status} payment ${m.paymentStatus} ${m.paymentAmount}` });
    for (const mt of s.meetings) out.push({ id: `mt:${mt.id}`, kind: 'meeting', ref, link: `${base}/meetings`, title: `Meeting: ${mt.title} (${ref})`, text: `${mt.title} ${fmtDate(mt.scheduledAt)} ${mt.minutes ?? ''} ${mt.decisions ?? ''}`.slice(0, 1500) });
  }
  return out;
}

// ---------------------------------------------------------------- search

const STOP = new Set('a an the of to in on for and or is are was were be what which who whom how when where why do does did any all with by from at as this that these those it its me my our we us you your there their has have had not no'.split(' '));
const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9ሀ-፿]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t));

export function search(corpus: Chunk[], q: string, k = 8): Chunk[] {
  const qt = [...new Set(tok(q))];
  if (!qt.length) return [];
  const docs = corpus.map((c) => tok(`${c.title} ${c.text}`));
  const N = docs.length, avg = docs.reduce((a, d) => a + d.length, 0) / (N || 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const scored = docs.map((d, i) => {
    let s = 0;
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of qt) {
      const f = tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.length / avg))));
    }
    return { i, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const out: Chunk[] = [];
  const seenTitle = new Set<string>();
  for (const { i } of scored) {
    if (seenTitle.has(corpus[i].title)) continue;
    seenTitle.add(corpus[i].title);
    out.push(corpus[i]);
    if (out.length >= k) break;
  }
  return out;
}

// --------------------------------------------------------------- briefs

export function engagementBrief(s: EngagementSnapshot, staff: SafeUser[] = []): string {
  const e = s.engagement;
  const lead = staff.find((u) => u.id === e.leadAdvisorId)?.name ?? 'unassigned';
  const live = s.findings.filter((f) => LIVE.includes(f.status));
  const missing = s.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status));
  const next = s.milestones.find((m) => m.status !== 'COMPLETED');
  return [
    `${e.reference} — ${s.client.name}: ${e.name} (${TRANSACTION_LABEL[e.transactionType as TransactionType] ?? e.transactionType}, target ${fmtMoney(e.targetRaise, e.currency)}, filing ${fmtDate(e.targetFilingDate)}). Lead: ${lead}.`,
    `Stage ${STAGE_META[e.stage as Stage]?.label}; documents ${s.completeness.percent}% (${s.completeness.accepted} accepted, ${s.completeness.submitted} in review, ${missing.length} mandatory outstanding); compliance score ${s.compliance.score}; ${live.length} open findings (${s.compliance.critical} critical, ${s.compliance.high} high); ${s.risks.length} risks; drafting ${s.prospectusProgress.percent}%; health ${s.health.score} (${s.health.label}).`,
    s.gate.canAdvance ? `Can advance to ${s.gate.nextStage ? STAGE_META[s.gate.nextStage as Stage]?.label : '—'}.` : `Gate blocked: ${s.gate.blockers.join(' ')}`,
    `Fees: ${fmtMoney(s.fees.paid, e.currency)} received, ${fmtMoney(s.fees.outstanding, e.currency)} invoiced and unpaid, ${fmtMoney(s.fees.unbilled, e.currency)} unbilled.${next ? ` Next milestone: ${next.name}, due ${fmtDate(next.dueDate)}.` : ''}`,
  ].join(' ');
}

export function portfolioBrief(snaps: EngagementSnapshot[], staff: SafeUser[] = []): string {
  return snaps.map((s) => `- ${engagementBrief(s, staff)}`).join('\n');
}

// ---------------------------------------------------------------- intents

function whichEngagements(q: string, snaps: EngagementSnapshot[]): EngagementSnapshot[] {
  const ql = q.toLowerCase();
  const hits = snaps.filter((s) => {
    const ref = s.engagement.reference.toLowerCase();
    const words = s.client.name.toLowerCase().replace(/[^a-z ]/g, ' ').split(' ').filter((w) => w.length > 3 && !['share', 'company', 'group', 'industries', 'manufacturing'].includes(w));
    return ql.includes(ref) || ql.includes(ref.replace(/-/g, ' ')) || words.some((w) => ql.includes(w)) ||
      (/\bipo\b|equity|listing/.test(ql) && s.engagement.transactionType === 'IPO') ||
      (/\bbond|debt/.test(ql) && s.engagement.transactionType === 'BOND') ||
      (/acquisition|merger|m&a/.test(ql) && s.engagement.transactionType === 'MA');
  });
  return hits;
}

const src = (s: EngagementSnapshot, tab = '', title?: string): Source => ({ title: title ?? `${s.engagement.reference} — ${s.client.name}`, link: `/engagements/${s.engagement.id}${tab ? '/' + tab : ''}`, ref: s.engagement.reference });

export function answerLocally(question: string, snaps: EngagementSnapshot[], staff: SafeUser[] = [], corpus?: Chunk[]): Answer {
  const q = question.toLowerCase();
  const scoped = whichEngagements(question, snaps);
  const targets = scoped.length ? scoped : snaps;
  const scopeNote = scoped.length ? '' : snaps.length > 1 ? '_Across all engagements._\n\n' : '';
  const sources: Source[] = [];
  const has = (...re: RegExp[]) => re.some((r) => r.test(q));

  // Missing documents
  if (has(/missing|outstanding doc|still need|documents? (do we|are) (need|missing)|what.*(need|required).*(client|from)|gap/)) {
    const lines = targets.map((s) => {
      const m = s.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status));
      const rev = s.requirements.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status));
      sources.push(src(s, 'documents', `${s.engagement.reference} document room`));
      return `**${s.engagement.reference} — ${s.client.name}** (${s.completeness.percent}% complete)\n${m.length ? m.map((r) => `- ${r.title} — ${titleCase(r.status)} (${r.code})`).join('\n') : '- No mandatory document outstanding.'}${rev.length ? `\n- ${rev.length} more submitted and awaiting review.` : ''}`;
    });
    return { text: `${scopeNote}${lines.join('\n\n')}`, sources, intent: 'missing', engine: 'local' };
  }

  // Findings / red flags
  if (has(/finding|red flag|issue|problem|compliance|critical|concern|flag/)) {
    const lines = targets.map((s) => {
      const live = s.findings.filter((f) => LIVE.includes(f.status));
      const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      const top = [...live].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).slice(0, 6);
      sources.push(src(s, 'findings', `${s.engagement.reference} findings`));
      return `**${s.engagement.reference} — ${s.client.name}**: ${live.length} open (${s.compliance.critical} critical, ${s.compliance.high} high), compliance score ${s.compliance.score}.\n${top.map((f) => `- **${titleCase(f.severity)}** — ${f.title}. _${f.recommendation ?? ''}_`).join('\n') || '- None open.'}`;
    });
    return { text: `${scopeNote}${lines.join('\n\n')}`, sources, intent: 'findings', engine: 'local' };
  }

  // Risks
  if (has(/\brisks?\b|heat ?map|exposure/)) {
    const lines = targets.map((s) => {
      sources.push(src(s, 'risks', `${s.engagement.reference} risk register`));
      const top = [...s.risks].sort((a, b) => b.inherentScore - a.inherentScore).slice(0, 5);
      return `**${s.engagement.reference}** — ${s.risks.length} risks on the register.\n${top.map((r) => `- ${r.code} ${r.title} — inherent ${r.inherentScore}, residual ${r.residualScore}. ${r.disclosureStrategy ?? ''}`).join('\n') || '- Register is empty; run the Risk Agent.'}`;
    });
    return { text: `${scopeNote}${lines.join('\n\n')}`, sources, intent: 'risks', engine: 'local' };
  }

  // Fees and payments
  if (has(/fee|invoice|paid|payment|money|cash we|owed|collect|revenue for (us|the firm)|billing/)) {
    const tot = targets.reduce((a, s) => ({ paid: a.paid + s.fees.paid, out: a.out + s.fees.outstanding, unb: a.unb + s.fees.unbilled }), { paid: 0, out: 0, unb: 0 });
    const rows = targets.map((s) => {
      sources.push(src(s, 'contract', `${s.engagement.reference} contract`));
      return `| ${s.engagement.reference} | ${fmtMoney(s.contract?.totalFee ?? 0)} | ${fmtMoney(s.fees.paid)} | ${fmtMoney(s.fees.outstanding)} | ${fmtMoney(s.fees.unbilled)} |`;
    });
    return { text: `${scopeNote}| Engagement | Total fee | Received | Invoiced, unpaid | Unbilled |\n|---|---|---|---|---|\n${rows.join('\n')}\n\nIn total ${fmtMoney(tot.paid)} received and **${fmtMoney(tot.out)} outstanding** on issued invoices.`, sources, intent: 'fees', engine: 'local' };
  }

  // Milestones, deadlines
  if (has(/deadline|due|milestone|when|timeline|schedule|filing date|overdue/)) {
    const lines = targets.map((s) => {
      sources.push(src(s, 'contract', `${s.engagement.reference} milestones`));
      const open = s.milestones.filter((m) => m.status !== 'COMPLETED');
      const od = open.filter((m) => m.dueDate && new Date(m.dueDate) < new Date());
      return `**${s.engagement.reference}** — target filing ${fmtDate(s.engagement.targetFilingDate)}.${od.length ? ` **${od.length} overdue.**` : ''}\n${open.slice(0, 4).map((m) => `- ${m.name} — due ${fmtDate(m.dueDate)} (${titleCase(m.status)})`).join('\n') || '- All milestones complete.'}`;
    });
    return { text: `${scopeNote}${lines.join('\n\n')}`, sources, intent: 'milestones', engine: 'local' };
  }

  // Financials
  if (has(/revenue|profit|margin|financial|ratio|gearing|debt|ebitda|cash flow|balance sheet|receivable|interest cover|covenant/)) {
    const lines = targets.map((s) => {
      const f = extractFinancials(s.documents, s.requirements);
      sources.push(src(s, 'reports', `${s.engagement.reference} financial review`));
      if (!f) return `**${s.engagement.reference}** — no parseable financial statements on file yet.`;
      const r = computeRatios(f);
      const last = r[r.length - 1];
      const cov = extractCovenants(s.documents, s.requirements);
      const covLine = cov.maxGearing
        ? `\n\n**Covenants** (${cov.source}): borrowings/equity ≤ ${cov.maxGearing}x${cov.minDscr ? `, DSCR ≥ ${cov.minDscr}x` : ''}. At ${last.year} gearing was ${last.gearing.toFixed(2)}x — headroom ${(((cov.maxGearing - last.gearing) / cov.maxGearing) * 100).toFixed(1)}%.`
        : '';
      return /covenant|gearing|headroom/.test(q)
        ? `**${s.engagement.reference} — ${s.client.name}**${covLine || '\n\nNo covenant terms found in the facility documents.'}\n\n${financialNarrative(f, r)}`
        : `**${s.engagement.reference} — ${s.client.name}**\n${financialNarrative(f, r)}${covLine}`;
    });
    return { text: `${scopeNote}${lines.join('\n\n')}`, sources, intent: 'financials', engine: 'local' };
  }

  // Drafting progress
  if (has(/prospectus|draft|offering document|section/)) {
    const lines = targets.map((s) => {
      sources.push(src(s, 'prospectus', `${s.engagement.reference} drafting`));
      const open = s.prospectus.reduce((a, p) => a + (p.body.match(/\[INFORMATION REQUIRED/g) ?? []).length, 0);
      return `**${s.engagement.reference}** — ${s.prospectusProgress.percent}% complete, ${s.prospectusProgress.drafted}/${s.prospectusProgress.total} sections drafted, ${s.prospectusProgress.approved} approved, ${open} information items outstanding.`;
    });
    return { text: `${scopeNote}${lines.join('\n')}`, sources, intent: 'drafting', engine: 'local' };
  }

  // Team / agents
  if (has(/who (leads|is leading|is the lead|runs the|is on the team)|\bteam\b|lead advisor|which agents|agents (have )?run|staff/)) {
    const lines = targets.map((s) => {
      const lead = staff.find((u) => u.id === s.engagement.leadAdvisorId);
      const agents = [...new Set(s.runs.map((r) => r.agent))].map((a) => AGENT_META[a as AgentKey]?.short ?? a);
      sources.push(src(s));
      return `- **${s.engagement.reference}** — led by ${lead?.name ?? 'nobody yet'}; agents run: ${agents.join(', ') || 'none'}.`;
    });
    return { text: `${scopeNote}${lines.join('\n')}`, sources, intent: 'team', engine: 'local' };
  }

  // Status / summary (default for scoped questions)
  if (scoped.length || has(/status|summary|summar|overview|how (is|are)|progress|where|health|portfolio|all (projects|engagements)|update/)) {
    targets.forEach((s) => sources.push(src(s)));
    return { text: `${scopeNote}${targets.map((s) => `- ${engagementBrief(s, staff)}`).join('\n\n')}`, sources, intent: 'status', engine: 'local' };
  }

  // Fall back to retrieval.
  const hits = search(corpus ?? buildCorpus(snaps), question, 5);
  if (!hits.length) {
    return { text: 'I could not find anything on that in the engagement records. Try naming a client or a reference (for example EQ-2026-001), or ask about missing documents, findings, risks, fees, milestones, financials or drafting progress.', sources: [], intent: 'none', engine: 'local' };
  }
  return {
    text: `Here is what the records say:\n\n${hits.map((h) => `**${h.title}**\n> ${h.text.replace(/\s+/g, ' ').slice(0, 320)}…`).join('\n\n')}`,
    sources: hits.map((h) => ({ title: h.title, link: h.link, ref: h.ref })),
    intent: 'search', engine: 'local',
  };
}

/** Prompt for a model that answers over the records (server or the preview's Claude). */
export function assistantPrompt(question: string, snaps: EngagementSnapshot[], staff: SafeUser[], corpus: Chunk[]): string {
  const hits = search(corpus, question, 10);
  return `You are the Advisor OS assistant for an Ethiopian transaction-advisory firm. Answer the question using ONLY the records below. Be specific: name engagement references, figures and dates. If the records do not answer it, say so plainly. Keep it short — a few sentences or a short list. Use markdown.

## Portfolio
${portfolioBrief(snaps, staff)}

## Relevant records
${hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.text.replace(/\s+/g, ' ').slice(0, 900)}`).join('\n\n')}

## Question
${question}`;
}
