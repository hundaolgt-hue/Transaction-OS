import 'server-only';
import { snapshot, listEngagements, listStaff, type EngagementSnapshot } from '../repo/core';
import { complete } from '../agents/anthropic';
import { env } from '../env';
import { answerLocally, assistantPrompt, buildCorpus, search, type Answer } from './knowledge';

/** What a client-portal user may see: their own engagements, shared findings only, nothing internal. */
export function clientView(s: EngagementSnapshot): EngagementSnapshot {
  return {
    ...s,
    findings: s.findings.filter((f) => f.visibleToClient),
    risks: [], runs: [], tasks: [], meetings: [],
    prospectus: s.prospectus.map((p) => ({ ...p, body: '' })),
    documents: s.documents.map((d) => ({ ...d, extractedText: null })),
  };
}

export async function answerQuestion(orgId: string, question: string, opts: { clientId?: string | null } = {}): Promise<Answer> {
  const snaps = listEngagements(orgId)
    .filter((e) => !opts.clientId || e.clientId === opts.clientId)
    .map((e) => snapshot(orgId, e.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => (opts.clientId ? clientView(s) : s));
  const staff = opts.clientId ? [] : listStaff(orgId);
  const corpus = buildCorpus(snaps);
  const local = answerLocally(question, snaps, staff, corpus);
  if (!env.aiEnabled) return local;
  try {
    const res = await complete({
      system: 'You answer questions about a transaction-advisory firm\'s engagements from the records provided. Never invent facts.',
      messages: [{ role: 'user', content: assistantPrompt(question, snaps, staff, corpus) }],
      maxTokens: 1200,
    });
    const hits = search(corpus, question, 5);
    return { text: res.text.trim(), sources: [...local.sources, ...hits.map((h) => ({ title: h.title, link: h.link, ref: h.ref }))].slice(0, 6), intent: local.intent, engine: 'anthropic' };
  } catch {
    return local;
  }
}
