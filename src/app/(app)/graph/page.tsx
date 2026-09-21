import { requireStaff } from '@/lib/auth';
import { listEngagements, snapshot, listStaff, getOrg } from '@/lib/repo/core';
import { buildGraph, NODE_META } from '@/lib/knowledge/graph';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import { CountUp } from '@/components/Motion';

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const session = await requireStaff();
  const staff = listStaff(session.orgId);
  const snaps = listEngagements(session.orgId)
    .map((e) => snapshot(session.orgId, e.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const graph = buildGraph(getOrg(session.orgId)!, staff, snaps);
  const counts = Object.entries(graph.counts).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header className="reveal">
        <div className="eyebrow">Operation map</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 4px' }}>Knowledge graph</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: 0, maxWidth: '72ch' }}>
          Every client, engagement, document, finding, risk, milestone, agent and team member — and how they connect.
          Drag to pan, scroll to zoom, click a node to focus its neighbourhood, and filter by type with the legend.
        </p>
      </header>
      <div className="reveal" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="chip chip-neutral"><b><CountUp value={graph.nodes.length} /></b>&nbsp;nodes</span>
        <span className="chip chip-neutral"><b><CountUp value={graph.edges.length} /></b>&nbsp;links</span>
        {counts.map(([k, n]) => (
          <span key={k} className="chip chip-neutral" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: NODE_META[k as keyof typeof NODE_META]?.color }} />
            {NODE_META[k as keyof typeof NODE_META]?.label ?? k} · {n}
          </span>
        ))}
      </div>
      <div className="panel reveal" style={{ overflow: 'hidden' }}>
        <KnowledgeGraph graph={graph} height={680} />
      </div>
    </div>
  );
}
