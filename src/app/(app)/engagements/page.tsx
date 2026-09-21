import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listEngagements, listClients, snapshot } from '@/lib/repo/core';
import { Panel, PanelHead, Meter, Chip, Empty } from '@/components/ui';
import { STAGE_META, TRANSACTION_LABEL, fmtMoney, fmtDate, titleCase, type Stage, type TransactionType } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function EngagementsPage() {
  const session = await requireStaff();
  const clients = listClients(session.orgId);
  const byId = new Map(clients.map((c) => [c.id, c]));
  const snaps = listEngagements(session.orgId)
    .map((e) => snapshot(session.orgId, e.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Mandates</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Engagements</h1>
        </div>
        <Link className="btn btn-primary" href="/engagements/new">New engagement</Link>
      </header>

      <Panel>
        {snaps.length === 0 ? (
          <Empty title="No engagements yet"
            body="An engagement materialises the ECMA document checklist, the prospectus skeleton and the milestone plan from a rule pack."
            action={<Link className="btn btn-primary btn-sm" href="/engagements/new">Open the first engagement</Link>} />
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Reference</th><th>Client</th><th>Transaction</th><th>Stage</th>
                  <th style={{ width: 130 }}>Documents</th><th className="num">Findings</th>
                  <th className="num">Target raise</th><th>Filing</th><th className="num">Health</th>
                </tr>
              </thead>
              <tbody>
                {snaps.map((s) => (
                  <tr key={s.engagement.id}>
                    <td>
                      <Link href={`/engagements/${s.engagement.id}`}>
                        <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.engagement.reference}</span>
                      </Link>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{s.engagement.name}</div>
                    </td>
                    <td>
                      <Link href={`/clients/${s.engagement.clientId}`}>{byId.get(s.engagement.clientId)?.name ?? '—'}</Link>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                      {TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}
                    </td>
                    <td><Chip tone={s.engagement.status === 'ACTIVE' ? 'neutral' : 'info'}>{STAGE_META[s.engagement.stage as Stage]?.label ?? titleCase(s.engagement.stage)}</Chip></td>
                    <td><Meter value={s.completeness.percent} /></td>
                    <td className="num">
                      {s.compliance.open === 0 ? <Chip tone="good">Clear</Chip>
                        : <Chip tone={s.compliance.critical ? 'critical' : s.compliance.high ? 'high' : 'medium'}>{s.compliance.open}</Chip>}
                    </td>
                    <td className="num mono">{fmtMoney(s.engagement.targetRaise, s.engagement.currency)}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{fmtDate(s.engagement.targetFilingDate)}</td>
                    <td className="num">
                      <span style={{ fontWeight: 600, color: s.health.tone === 'good' ? 'var(--good)' : s.health.tone === 'watch' ? 'var(--high)' : 'var(--critical)' }}>
                        {s.health.score}
                      </span>
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
