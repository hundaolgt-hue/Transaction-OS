import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getClient, listEngagementsForClient, snapshot } from '@/lib/repo/core';
import { listOrgUsers } from '@/lib/auth';
import { Panel, PanelHead, Chip, StatusChip, Meter, Empty, Defs, Grid, Stat } from '@/components/ui';
import { LEGAL_FORM_LABEL, STAGE_META, TRANSACTION_LABEL, fmtMoney, fmtDate, titleCase, type Stage, type TransactionType } from '@/lib/domain';
import ClientPortalUsers from '@/components/ClientPortalUsers';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const client = getClient(session.orgId, id);
  if (!client) notFound();

  const engagements = listEngagementsForClient(id);
  const snaps = engagements.map((e) => snapshot(session.orgId, e.id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const portalUsers = listOrgUsers(session.orgId).filter((u) => u.clientId === id);

  const totalRaise = snaps.reduce((a, s) => a + (s.engagement.targetRaise ?? 0), 0);
  const openFindings = snaps.reduce((a, s) => a + s.compliance.open, 0);
  const totalFees = snaps.reduce((a, s) => a + (s.contract?.totalFee ?? 0), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow"><Link href="/clients" style={{ color: 'inherit' }}>Clients</Link> / {client.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 4 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>{client.name}</h1>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Chip tone="neutral">{LEGAL_FORM_LABEL[client.legalForm] ?? client.legalForm}</Chip>
              <Chip tone="neutral">{titleCase(client.sector)}</Chip>
              <StatusChip status={client.status} />
              <Chip tone={client.riskRating === 'CRITICAL' ? 'critical' : client.riskRating === 'HIGH' ? 'high' : client.riskRating === 'MEDIUM' ? 'medium' : client.riskRating === 'LOW' ? 'good' : 'neutral'}>
                {titleCase(client.riskRating)} risk
              </Chip>
            </div>
          </div>
          <Link className="btn btn-primary" href="/engagements/new">New engagement</Link>
        </div>
      </header>

      <Grid min={180}>
        <Stat label="Engagements" value={engagements.length} sub={`${snaps.filter((s) => s.engagement.status === 'ACTIVE').length} active`} />
        <Stat label="Total target raise" value={fmtMoney(totalRaise, client.currency)} />
        <Stat label="Fees contracted" value={fmtMoney(totalFees, client.currency)} />
        <Stat label="Open findings" value={openFindings} tone={openFindings ? 'medium' : 'good'} />
        <Stat label="Portal users" value={portalUsers.length} sub="Client-side logins" />
      </Grid>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
        <Panel>
          <PanelHead title="Company record" />
          <div className="panel-body">
            <Defs items={[
              ['TIN', client.tin ?? '—'],
              ['Business licence', client.businessLicenseNo ?? '—'],
              ['Registered', fmtDate(client.registrationDate)],
              ['Paid-up capital', fmtMoney(client.paidUpCapital, client.currency)],
              ['Address', [client.addressLine, client.city, client.region].filter(Boolean).join(', ') || '—'],
              ['Website', client.website ? <a key="w" href={client.website.startsWith('http') ? client.website : `https://${client.website}`} rel="noopener noreferrer" target="_blank" style={{ color: 'var(--accent)' }}>{client.website}</a> : '—'],
              ['Contact', client.primaryContactName ?? '—'],
              ['Contact email', client.primaryContactEmail ?? '—'],
              ['Contact phone', client.primaryContactPhone ?? '—'],
            ]} />
            {client.notes ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-subtle)', margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--hairline)', lineHeight: 1.6 }}>{client.notes}</p>
            ) : null}
          </div>
        </Panel>

        <ClientPortalUsers clientId={id} clientName={client.name}
          users={portalUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, lastLoginAt: u.lastLoginAt }))}
          canManage={session.role === 'OWNER'}
          defaultEmail={client.primaryContactEmail ?? ''}
          defaultName={client.primaryContactName ?? ''} />
      </div>

      <Panel>
        <PanelHead title="Engagements" />
        {snaps.length === 0 ? (
          <Empty title="No engagements" body="Open one to start tracking documents for this client."
            action={<Link className="btn btn-primary btn-sm" href="/engagements/new">New engagement</Link>} />
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Reference</th><th>Transaction</th><th>Stage</th><th style={{ width: 130 }}>Documents</th><th className="num">Findings</th><th>Filing</th></tr></thead>
              <tbody>
                {snaps.map((s) => (
                  <tr key={s.engagement.id}>
                    <td>
                      <Link href={`/engagements/${s.engagement.id}`}>
                        <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.engagement.reference}</span>
                      </Link>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{s.engagement.name}</div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}</td>
                    <td><Chip tone="neutral">{STAGE_META[s.engagement.stage as Stage]?.label ?? s.engagement.stage}</Chip></td>
                    <td><Meter value={s.completeness.percent} /></td>
                    <td className="num">{s.compliance.open}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{fmtDate(s.engagement.targetFilingDate)}</td>
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
