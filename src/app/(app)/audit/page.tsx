import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listAudit, listEngagements } from '@/lib/repo/core';
import { Panel, PanelHead, Chip, Empty, Avatar } from '@/components/ui';
import { fmtDateTime } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ engagement?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const events = listAudit(session.orgId, { engagementId: sp.engagement, limit: 300 });
  const engagements = listEngagements(session.orgId);
  const refById = new Map(engagements.map((e) => [e.id, e.reference]));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Compliance record</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Audit trail</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '4px 0 0', maxWidth: '70ch' }}>
          Every material action is recorded: who did it, to what, and when. Agent runs, stage overrides and document
          decisions all land here, so the firm can evidence its process to ECMA or to a client.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Link className={`btn btn-sm ${!sp.engagement ? 'btn-primary' : ''}`} href="/audit">All activity</Link>
        {engagements.slice(0, 10).map((e) => (
          <Link key={e.id} className={`btn btn-sm ${sp.engagement === e.id ? 'btn-primary' : ''}`} href={`/audit?engagement=${e.id}`}>
            {e.reference}
          </Link>
        ))}
      </div>

      <Panel>
        <PanelHead title={`${events.length} event${events.length === 1 ? '' : 's'}`} sub="Newest first" />
        {events.length === 0 ? <Empty title="No events recorded" /> : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Engagement</th><th>Detail</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDateTime(e.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                        <Avatar name={e.actorName} color="var(--surface-3)" size={20} />
                        <span style={{ fontSize: 12.5 }}>{e.actorName}</span>
                      </div>
                    </td>
                    <td><Chip tone="neutral">{e.action}</Chip></td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{e.entityType}</td>
                    <td className="mono" style={{ color: 'var(--ink-faint)' }}>
                      {e.engagementId ? (
                        <Link href={`/engagements/${e.engagementId}`} style={{ color: 'var(--accent)' }}>{refById.get(e.engagementId) ?? '—'}</Link>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink-faint)', maxWidth: 380, wordBreak: 'break-word' }}>
                      {e.metadata ? prettyMeta(e.metadata) : '—'}
                    </td>
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

function prettyMeta(raw: string): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(o)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : String(v)}`)
      .join(' · ')
      .slice(0, 400);
  } catch { return raw.slice(0, 200); }
}
