import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listEngagements, listAgentRuns, listClients } from '@/lib/repo/core';
import { env } from '@/lib/env';
import { Panel, PanelHead, Chip, StatusChip, Stat, Grid, Empty } from '@/components/ui';
import { AGENT_META, AGENTS, fmtDateTime, relTime, type AgentKey } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function AgentsOverview() {
  const session = await requireStaff();
  const engagements = listEngagements(session.orgId);
  const clients = new Map(listClients(session.orgId).map((c) => [c.id, c.name]));
  const runs = engagements.flatMap((e) =>
    listAgentRuns(e.id, 25).map((r) => ({ ...r, engagement: e, clientName: clients.get(e.clientId) ?? '—' })),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const succeeded = runs.filter((r) => r.status === 'SUCCEEDED').length;
  const failed = runs.filter((r) => r.status === 'FAILED').length;
  const findings = runs.reduce((a, r) => a + r.findingsCount, 0);
  const tokens = runs.reduce((a, r) => a + r.tokensIn + r.tokensOut, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Specialised agents</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Agent operations</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '4px 0 0', maxWidth: '72ch' }}>
          Every agent runs the engagement&apos;s versioned rule pack first — that pass is deterministic and reproducible.
          When a key is configured a reasoning pass follows for judgement-based gaps. Both are logged separately, and
          nothing an agent produces leaves the firm until a human expert has approved it.
        </p>
      </header>

      <Grid min={180}>
        <Stat label="Engine" value={env.aiEnabled ? 'Rules + reasoning' : 'Rules only'}
          tone={env.aiEnabled ? 'good' : 'medium'} sub={env.aiEnabled ? env.anthropicModel : 'Set ANTHROPIC_API_KEY to enable the reasoning pass'} />
        <Stat label="Runs recorded" value={runs.length} sub={`${succeeded} succeeded · ${failed} failed`} />
        <Stat label="Findings raised" value={findings} />
        <Stat label="Tokens used" value={tokens ? tokens.toLocaleString() : '—'} sub="Across reasoning passes" />
      </Grid>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
        {AGENTS.map((key) => {
          const meta = AGENT_META[key];
          const agentRuns = runs.filter((r) => r.agent === key);
          return (
            <Panel key={key}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: `${meta.accent}22`, border: `1px solid ${meta.accent}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.accent }} />
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{meta.name}</div>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '0 0 10px', lineHeight: 1.55 }}>{meta.blurb}</p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {meta.expertise.map((e) => <Chip key={e} tone="neutral">{e}</Chip>)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', paddingTop: 9, borderTop: '1px solid var(--hairline)' }}>
                  {agentRuns.length
                    ? `${agentRuns.length} run${agentRuns.length === 1 ? '' : 's'} · last ${relTime(agentRuns[0].createdAt)} on ${agentRuns[0].engagement.reference}`
                    : 'Never run'}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelHead title="Recent runs across the practice" />
        {runs.length === 0 ? <Empty title="No agent runs yet" body="Open an engagement and run an agent from its Agents tab." /> : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>Agent</th><th>Engagement</th><th>Status</th><th>Engine</th><th className="num">Findings</th><th>Summary</th><th>When</th></tr>
              </thead>
              <tbody>
                {runs.slice(0, 40).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{AGENT_META[r.agent as AgentKey]?.short ?? r.agent}</td>
                    <td>
                      <Link href={`/engagements/${r.engagement.id}/agents`}>
                        <span className="mono" style={{ color: 'var(--accent)' }}>{r.engagement.reference}</span>
                      </Link>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{r.clientName}</div>
                    </td>
                    <td><StatusChip status={r.status} /></td>
                    <td><Chip tone={r.engine === 'ANTHROPIC' ? 'good' : 'neutral'}>{r.engine === 'ANTHROPIC' ? 'Reasoning' : 'Rules'}</Chip></td>
                    <td className="num">{r.findingsCount}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-muted)', maxWidth: 380 }}>{r.summary ?? r.error ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
