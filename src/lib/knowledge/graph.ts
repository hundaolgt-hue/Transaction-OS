/**
 * The operation as a graph: the firm, its people, clients, engagements, the
 * documents and gaps in each data room, findings, risks, agents and rule
 * packs, and how they connect. Pure — built from snapshots.
 */
import type { EngagementSnapshot } from '../repo/core';
import type { SafeUser, Org, AgentRun } from '../types';
import { AGENT_META, STAGE_META, titleCase, type AgentKey, type Stage } from '../domain';
import { getRulePack } from '../rulepacks';

export type NodeType = 'FIRM' | 'PERSON' | 'CLIENT' | 'ENGAGEMENT' | 'DOCUMENT' | 'GAP' | 'FINDING' | 'RISK' | 'AGENT' | 'RULEPACK';

export interface GNode {
  id: string; type: NodeType; label: string; sub: string; size: number;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'good' | 'neutral';
  link?: string; engagementId?: string; detail: [string, string][];
}
export interface GEdge { source: string; target: string; kind: string }
export interface Graph { nodes: GNode[]; edges: GEdge[]; counts: Record<NodeType, number> }

export const NODE_META: Record<NodeType, { label: string; color: string }> = {
  FIRM: { label: 'Firm', color: '#F4941C' },
  PERSON: { label: 'People', color: '#3f8fa8' },
  CLIENT: { label: 'Clients', color: '#5b8fd4' },
  ENGAGEMENT: { label: 'Engagements', color: '#8a5fc0' },
  DOCUMENT: { label: 'Documents', color: '#7d8a86' },
  GAP: { label: 'Missing documents', color: '#e08a3c' },
  FINDING: { label: 'Findings', color: '#e05663' },
  RISK: { label: 'Risks', color: '#cfae4a' },
  AGENT: { label: 'Agents', color: '#45bd99' },
  RULEPACK: { label: 'Rule packs', color: '#b3607a' },
};

const SEV_TONE: Record<string, GNode['tone']> = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'neutral' };

export function buildGraph(org: Org, staff: SafeUser[], snaps: EngagementSnapshot[]): Graph {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const seen = new Set<string>();
  const add = (n: GNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };
  const link = (source: string, target: string, kind: string) => edges.push({ source, target, kind });

  add({ id: `firm`, type: 'FIRM', label: org.name, sub: 'Investment bank · transaction adviser', size: 22, detail: [['Licence', org.licenseNo ?? '—'], ['City', org.city], ['Engagements', String(snaps.length)]] });

  for (const u of staff) {
    add({ id: `p:${u.id}`, type: 'PERSON', label: u.name, sub: u.title ?? titleCase(u.role), size: 9, detail: [['Role', titleCase(u.role)], ['Email', u.email]] });
    link('firm', `p:${u.id}`, 'employs');
  }

  for (const a of Object.keys(AGENT_META) as AgentKey[]) {
    add({ id: `a:${a}`, type: 'AGENT', label: AGENT_META[a].name, sub: 'Specialised agent', size: 10, detail: [['Expertise', AGENT_META[a].expertise.slice(0, 3).join('; ')]] });
    link('firm', `a:${a}`, 'operates');
  }

  const runsByAgent = new Map<string, AgentRun[]>();
  for (const s of snaps) {
    const e = s.engagement;
    const pack = getRulePack(e.rulePackKey);
    const cid = `c:${s.client.id}`;
    add({ id: cid, type: 'CLIENT', label: s.client.name, sub: titleCase(s.client.sector), size: 14, link: `/clients/${s.client.id}`, detail: [['Legal form', titleCase(s.client.legalForm)], ['Risk rating', titleCase(s.client.riskRating)], ['City', s.client.city]] });
    link('firm', cid, 'advises');

    const eid = `e:${e.id}`;
    add({
      id: eid, type: 'ENGAGEMENT', label: e.reference, sub: e.name, size: 16, link: `/engagements/${e.id}`, engagementId: e.id,
      tone: s.health.tone === 'good' ? 'good' : s.health.tone === 'watch' ? 'medium' : 'critical',
      detail: [['Stage', STAGE_META[e.stage as Stage]?.label ?? e.stage], ['Documents', `${s.completeness.percent}% complete`], ['Open findings', String(s.compliance.open)], ['Health', `${s.health.score} — ${s.health.label}`], ['Drafting', `${s.prospectusProgress.percent}%`]],
    });
    link(cid, eid, 'mandate');
    if (e.leadAdvisorId) link(`p:${e.leadAdvisorId}`, eid, 'leads');

    const rp = `rp:${pack.key}`;
    add({ id: rp, type: 'RULEPACK', label: pack.key, sub: pack.name, size: 11, link: '/rules', detail: [['Version', pack.version], ['Requirements', String(pack.requirements.length)], ['Rules', String(pack.rules.length)]] });
    link(eid, rp, 'governed by');

    for (const d of s.documents) {
      const req = s.requirements.find((r) => r.id === d.requirementId);
      add({ id: `d:${d.id}`, type: 'DOCUMENT', label: d.title, sub: req ? `${req.code} · ${titleCase(d.status)}` : 'Unfiled', size: 5, engagementId: e.id, link: `/engagements/${e.id}/documents`,
        tone: d.status === 'ACCEPTED' ? 'good' : d.status === 'REJECTED' ? 'critical' : 'neutral',
        detail: [['Requirement', req ? `${req.code} — ${req.title}` : 'Unfiled'], ['Status', titleCase(d.status)], ['Version', `v${d.version}`]] });
      link(eid, `d:${d.id}`, 'data room');
    }
    for (const r of s.requirements.filter((q) => q.mandatory && ['MISSING', 'REQUESTED', 'REJECTED'].includes(q.status))) {
      add({ id: `g:${r.id}`, type: 'GAP', label: r.title, sub: `${r.code} · ${titleCase(r.status)}`, size: 5.5, tone: 'high', engagementId: e.id, link: `/engagements/${e.id}/documents`,
        detail: [['Requirement', r.code], ['Authority', r.authorityRef ?? '—'], ['Status', titleCase(r.status)]] });
      link(eid, `g:${r.id}`, 'missing');
    }
    for (const f of s.findings.filter((x) => !['DISMISSED', 'FALSE_POSITIVE'].includes(x.status))) {
      add({ id: `f:${f.id}`, type: 'FINDING', label: f.title, sub: `${titleCase(f.severity)} · ${titleCase(f.status)}`, size: f.severity === 'CRITICAL' ? 9 : f.severity === 'HIGH' ? 7.5 : 6, tone: SEV_TONE[f.severity], engagementId: e.id, link: `/engagements/${e.id}/findings`,
        detail: [['Severity', titleCase(f.severity)], ['Status', titleCase(f.status)], ['Authority', f.citation ?? '—'], ['Recommendation', (f.recommendation ?? '').slice(0, 180)]] });
      link(f.documentId ? `d:${f.documentId}` : eid, `f:${f.id}`, 'finding');
      if (f.documentId && !seen.has(`d:${f.documentId}`)) link(eid, `f:${f.id}`, 'finding');
      link(`a:${f.agent}`, `f:${f.id}`, 'raised');
    }
    for (const k of s.risks) {
      add({ id: `r:${k.id}`, type: 'RISK', label: k.title, sub: `${k.code} · inherent ${k.inherentScore}`, size: 5 + k.inherentScore / 5, tone: k.inherentScore >= 20 ? 'critical' : k.inherentScore >= 12 ? 'high' : k.inherentScore >= 6 ? 'medium' : 'good', engagementId: e.id, link: `/engagements/${e.id}/risks`,
        detail: [['Category', titleCase(k.category)], ['Inherent', `${k.likelihood} × ${k.impact} = ${k.inherentScore}`], ['Residual', String(k.residualScore)], ['Disclosure', (k.disclosureStrategy ?? '').slice(0, 160)]] });
      link(k.findingId && seen.has(`f:${k.findingId}`) ? `f:${k.findingId}` : eid, `r:${k.id}`, 'risk');
    }
    for (const run of s.runs) runsByAgent.set(run.agent, [...(runsByAgent.get(run.agent) ?? []), run]);
    for (const a of new Set(s.runs.map((r) => r.agent))) link(`a:${a}`, eid, 'works on');
  }

  for (const n of nodes) if (n.type === 'AGENT') {
    const key = n.id.slice(2);
    n.detail.push(['Runs', String(runsByAgent.get(key)?.length ?? 0)]);
  }

  const counts = Object.fromEntries(Object.keys(NODE_META).map((t) => [t, nodes.filter((n) => n.type === t).length])) as Record<NodeType, number>;
  // Drop edges whose ends were never added.
  return { nodes, edges: edges.filter((e) => seen.has(e.source) && seen.has(e.target)), counts };
}
