import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listReports, listStaff } from '@/lib/repo/core';
import ReportWorkspace from '@/components/ReportWorkspace';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  const staff = listStaff(session.orgId);

  return (
    <ReportWorkspace
      reports={listReports(id).map((r) => ({
        ...r,
        reviewerName: staff.find((u) => u.id === r.reviewerId)?.name ?? null,
      }))}
      canApprove={['OWNER', 'ADVISOR'].includes(session.role)}
    />
  );
}
