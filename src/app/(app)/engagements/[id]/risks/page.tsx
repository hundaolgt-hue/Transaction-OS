import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import RiskRegister from '@/components/RiskRegister';

export const dynamic = 'force-dynamic';

export default async function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  return <RiskRegister engagementId={id} risks={s.risks} />;
}
