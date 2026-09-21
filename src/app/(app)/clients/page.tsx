import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listClients, listEngagements } from '@/lib/repo/core';
import { Panel, PanelHead, Chip, StatusChip, Empty } from '@/components/ui';
import { LEGAL_FORM_LABEL, fmtMoney, fmtDate, titleCase } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const session = await requireStaff();
  const clients = listClients(session.orgId);
  const engagements = listEngagements(session.orgId);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Client book</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>Clients</h1>
        </div>
        <Link className="btn btn-primary" href="/clients/new">Add a client</Link>
      </header>

      <Panel>
        {clients.length === 0 ? (
          <Empty title="No clients yet" body="Add the client company; engagements, document checklists and the portal all hang off it."
            action={<Link className="btn btn-primary btn-sm" href="/clients/new">Add the first client</Link>} />
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>Client</th><th>Legal form</th><th>Sector</th><th className="num">Paid-up capital</th>
                  <th className="num">Engagements</th><th>Risk</th><th>Status</th><th>Added</th></tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const n = engagements.filter((e) => e.clientId === c.id).length;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/clients/${c.id}`} style={{ fontWeight: 500 }}>{c.name}</Link>
                        {c.primaryContactName ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{c.primaryContactName}</div> : null}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{LEGAL_FORM_LABEL[c.legalForm] ?? c.legalForm}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{titleCase(c.sector)}</td>
                      <td className="num mono">{fmtMoney(c.paidUpCapital, c.currency)}</td>
                      <td className="num">{n}</td>
                      <td><Chip tone={c.riskRating === 'CRITICAL' ? 'critical' : c.riskRating === 'HIGH' ? 'high' : c.riskRating === 'MEDIUM' ? 'medium' : c.riskRating === 'LOW' ? 'good' : 'neutral'}>{titleCase(c.riskRating)}</Chip></td>
                      <td><StatusChip status={c.status} /></td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{fmtDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
