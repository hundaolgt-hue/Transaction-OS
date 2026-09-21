import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot } from '@/lib/repo/core';
import { getRulePack } from '@/lib/rulepacks';
import ProspectusBuilder from '@/components/ProspectusBuilder';

export const dynamic = 'force-dynamic';

export default async function ProspectusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  const pack = getRulePack(s.engagement.rulePackKey);
  const guidance = Object.fromEntries(pack.prospectus.map((p) => [p.code, { guidance: p.guidance, minWords: p.minWords }]));

  return (
    <ProspectusBuilder
      engagementId={id}
      sections={s.prospectus}
      progress={s.prospectusProgress}
      guidance={guidance}
      packName={`${pack.name} (${pack.key} v${pack.version})`}
      outputLabel={pack.outputLabel}
    />
  );
}
