import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import DocumentRoom from '@/components/DocumentRoom';
import SampleDataRoom from '@/components/SampleDataRoom';
import { ABYSSINIA_DATAROOM, COMPANY } from '@/lib/dataroom/abyssinia';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  const isSample = s.client.name === COMPANY.name;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
    <DocumentRoom
      engagementId={id}
      role={session.role}
      threshold={s.engagement.documentThreshold}
      completeness={s.completeness}
      requirements={s.requirements}
      documents={s.documents.map((d) => ({ ...d, extractedText: null }))}
    />
    {isSample ? <SampleDataRoom company={COMPANY.name} docs={ABYSSINIA_DATAROOM.map((d, i) => ({ index: i + 1, code: d.code ?? null, title: d.title }))} /> : null}
    </div>
  );
}
