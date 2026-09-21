import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import DocumentRoom from '@/components/DocumentRoom';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  return (
    <DocumentRoom
      engagementId={id}
      role={session.role}
      threshold={s.engagement.documentThreshold}
      completeness={s.completeness}
      requirements={s.requirements}
      documents={s.documents.map((d) => ({ ...d, extractedText: null }))}
    />
  );
}
