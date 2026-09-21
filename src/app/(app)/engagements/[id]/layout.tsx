import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import { getRulePack } from '@/lib/rulepacks';
import { STAGE_META, TRANSACTION_LABEL, fmtMoney, fmtDate, titleCase, type Stage, type TransactionType } from '@/lib/domain';
import { Chip } from '@/components/ui';
import EngagementTabs from '@/components/EngagementTabs';
import StageControl from '@/components/StageControl';

export const dynamic = 'force-dynamic';

export default async function EngagementLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  const pack = getRulePack(s.engagement.rulePackKey);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          <Link href="/engagements" style={{ color: 'inherit' }}>Engagements</Link>
          {' / '}
          <span className="mono">{s.engagement.reference}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.25 }}>
              {s.client.name}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-subtle)', margin: '3px 0 0' }}>{s.engagement.name}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
              <Chip tone="neutral">{TRANSACTION_LABEL[s.engagement.transactionType as TransactionType] ?? s.engagement.transactionType}</Chip>
              <Chip tone="neutral">{STAGE_META[s.engagement.stage as Stage]?.label ?? titleCase(s.engagement.stage)}</Chip>
              <Chip tone={s.engagement.status === 'ACTIVE' ? 'good' : 'info'} dot>{titleCase(s.engagement.status)}</Chip>
              {s.engagement.targetRaise ? <Chip tone="neutral">{fmtMoney(s.engagement.targetRaise, s.engagement.currency)}</Chip> : null}
              {s.engagement.targetFilingDate ? <Chip tone="neutral">Filing {fmtDate(s.engagement.targetFilingDate)}</Chip> : null}
            </div>
          </div>
          <StageControl
            engagementId={s.engagement.id}
            stage={s.engagement.stage}
            gate={s.gate}
            canAdvance={session.role === 'OWNER' || session.role === 'ADVISOR'}
          />
        </div>
      </header>

      <EngagementTabs engagementId={id} outputLabel={pack.outputLabel} counts={{
        documents: s.documents.length,
        findings: s.compliance.open,
        risks: s.risks.length,
        reports: 0,
        tasks: s.tasks.filter((t) => t.status !== 'DONE').length,
      }} />

      {children}
    </div>
  );
}
