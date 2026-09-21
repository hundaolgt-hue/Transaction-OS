import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listStaff } from '@/lib/repo/core';
import MeetingsTasks from '@/components/MeetingsTasks';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();

  return (
    <MeetingsTasks
      engagementId={id}
      meetings={s.meetings}
      tasks={s.tasks}
      staff={listStaff(session.orgId).map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}
