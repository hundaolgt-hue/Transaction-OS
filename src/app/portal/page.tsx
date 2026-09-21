import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { listEngagementsForClient, snapshot, getClient } from '@/lib/repo/core';
import { Panel, PanelHead, Meter, Chip, Empty, Stat, Grid } from '@/components/ui';
import { STAGE_META, TRANSACTION_LABEL, fmtDate, titleCase, type Stage, type TransactionType } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const session = await requireSession();
  if (session.role !== 'CLIENT') redirect('/dashboard');
  if (!session.clientId) {
    return <Panel><Empty title="No client attached to this account" body="Contact your advisor — your login is not linked to a company record." /></Panel>;
  }

  const client = getClient(session.orgId, session.clientId);
  const engagements = listEngagementsForClient(session.clientId);
  const snaps = engagements.map((e) => snapshot(session.orgId, e.id)).filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (snaps.length === 1) redirect(`/portal/${snaps[0].engagement.id}`);

  const missing = snaps.reduce((a, s) => a + s.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED'].includes(r.status)).length, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow">Client portal</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '3px 0 0' }}>{client?.name ?? 'Your transactions'}</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '4px 0 0' }}>
          {snaps.length} transaction{snaps.length === 1 ? '' : 's'} in progress with your advisory team.
        </p>
      </header>

      <Grid min={190}>
        <Stat label="Transactions" value={snaps.length} />
        <Stat label="Documents still needed" value={missing} tone={missing ? 'high' : 'good'} sub="Across all transactions" />
        <Stat label="Average progress" value={`${snaps.length ? Math.round(snaps.reduce((a, s) => a + s.completeness.percent, 0) / snaps.length) : 0}%`} />
      </Grid>

      {snaps.length === 0 ? (
        <Panel><Empty title="No transactions yet" body="Your advisor will open one here when the engagement begins." /></Panel>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
          {snaps.map((s) => (
            <Link key={s.engagement.id} href={`/portal/${s.engagement.id}`} className="panel" style={{ display: 'block', padding: 16 }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
                <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.engagement.reference}</span>
                <Chip tone="neutral">{STAGE_META[s.engagement.stage as Stage]?.label ?? s.engagement.stage}</Chip>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{s.engagement.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '3px 0 12px' }}>
                {TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}
                {s.engagement.targetFilingDate ? ` · target filing ${fmtDate(s.engagement.targetFilingDate)}` : ''}
              </div>
              <Meter value={s.completeness.percent} label="Document completeness" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
