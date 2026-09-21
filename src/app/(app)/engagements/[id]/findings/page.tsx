import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listStaff } from '@/lib/repo/core';
import FindingsTriage from '@/components/FindingsTriage';

export const dynamic = 'force-dynamic';

export default async function FindingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  const docTitles = Object.fromEntries(s.documents.map((d) => [d.id, d.title]));
  const reqTitles = Object.fromEntries(s.requirements.map((r) => [r.id, `${r.code} — ${r.title}`]));

  return (
    <FindingsTriage
      engagementId={id}
      findings={s.findings}
      compliance={s.compliance}
      staff={listStaff(session.orgId).map((u) => ({ id: u.id, name: u.name }))}
      docTitles={docTitles}
      reqTitles={reqTitles}
      canReview={['OWNER', 'ADVISOR', 'ANALYST'].includes(session.role)}
    />
  );
}
