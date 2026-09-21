import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { snapshot, listReports, listStaff } from '@/lib/repo/core';
import ReportWorkspace from '@/components/ReportWorkspace';
import PdfDownloads from '@/components/PdfDownloads';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const s = snapshot(session.orgId, id);
  if (!s) notFound();
  const staff = listStaff(session.orgId);

  const slug = s.client.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '');
  const base = `/api/engagements/${id}/pdf?doc=`;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
    <PdfDownloads
      title="Due diligence reports (PDF)"
      sub="Typeset from the live engagement — findings, ratios, covenants, charts and the review trail. Draft watermark until approved."
      items={[
        { key: 'LEGAL', title: 'Legal due diligence', sub: '30+ pages · corporate, licences, contracts, litigation', href: `${base}LEGAL`, fileName: `${slug}_Legal_DD.pdf` },
        { key: 'FINANCIAL', title: 'Financial due diligence', sub: '30+ pages · QoE, ratios, working capital, IFRS', href: `${base}FINANCIAL`, fileName: `${slug}_Financial_DD.pdf` },
        { key: 'COMBINED', title: 'Combined DD & risk report', sub: '50+ pages · legal, financial and risk register', href: `${base}COMBINED`, fileName: `${slug}_Combined_DD.pdf` },
      ]}
    />
    <ReportWorkspace
      reports={listReports(id).map((r) => ({
        ...r,
        reviewerName: staff.find((u) => u.id === r.reviewerId)?.name ?? null,
      }))}
      canApprove={['OWNER', 'ADVISOR'].includes(session.role)}
    />
    </div>
  );
}
