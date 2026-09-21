import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import { getRulePack } from '@/lib/rulepacks';
import ProspectusBuilder from '@/components/ProspectusBuilder';
import PdfDownloads from '@/components/PdfDownloads';

export const dynamic = 'force-dynamic';

export default async function ProspectusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  const pack = getRulePack(s.engagement.rulePackKey);
  const guidance = Object.fromEntries(pack.prospectus.map((p) => [p.code, { guidance: p.guidance, minWords: p.minWords }]));

  const slug = s.client.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
    <PdfDownloads
      title="Prospectus (PDF)"
      sub="Cover, offer summary, table of contents, every drafted section, financial tables and charts. Unfinished sections are flagged, not invented."
      items={[{ key: 'P', title: `${s.client.name} — draft prospectus`, sub: '30 pages · ECMA section order', href: `/api/engagements/${id}/pdf?doc=PROSPECTUS`, fileName: `${slug}_Prospectus.pdf` }]}
    />
    <ProspectusBuilder
      engagementId={id}
      sections={s.prospectus}
      progress={s.prospectusProgress}
      guidance={guidance}
      packName={`${pack.name} (${pack.key} v${pack.version})`}
      outputLabel={pack.outputLabel}
    />
    </div>
  );
}
