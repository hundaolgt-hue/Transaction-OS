import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listAgentLogs } from '@/lib/repo/core';
import { env } from '@/lib/env';
import AgentConsole from '@/components/AgentConsole';

export const dynamic = 'force-dynamic';

export default async function AgentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  const runs = s.runs.map((r) => ({ ...r, logs: listAgentLogs(r.id) }));

  return (
    <AgentConsole
      engagementId={id}
      runs={runs}
      aiEnabled={env.aiEnabled}
      model={env.anthropicModel}
      canRun={['OWNER', 'ADVISOR', 'ANALYST'].includes(session.role)}
      context={{
        documents: s.documents.length,
        completeness: s.completeness.percent,
        findings: s.compliance.open,
        risks: s.risks.length,
        prospectus: s.prospectusProgress.percent,
        meetings: s.meetings.length,
        stage: s.engagement.stage,
      }}
      meetings={s.meetings.map((m) => ({ id: m.id, title: m.title, scheduledAt: m.scheduledAt, distributed: Boolean(m.distributed) }))}
      sections={s.prospectus.map((p) => ({ code: p.code, heading: p.heading, status: p.status }))}
    />
  );
}
