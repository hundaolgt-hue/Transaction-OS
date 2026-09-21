import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import ContractPanel from '@/components/ContractPanel';

export const dynamic = 'force-dynamic';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  return (
    <ContractPanel
      engagementId={id}
      clientName={s.client.name}
      currency={s.engagement.currency}
      contract={s.contract}
      milestones={s.milestones}
      fees={s.fees}
      canManage={['OWNER', 'ADVISOR'].includes(session.role)}
    />
  );
}
