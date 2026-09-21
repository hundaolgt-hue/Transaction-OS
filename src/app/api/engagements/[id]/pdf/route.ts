import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { snapshot, getOrg, listAudit, listStaff, audit, listReports } from '@/lib/repo/core';
import { buildDDReport, type ReportKind } from '@/lib/reports/ddReport';
import { buildProspectus } from '@/lib/reports/prospectusPdf';
import { renderPdf } from '@/lib/reports/render';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** GET ?doc=LEGAL|FINANCIAL|COMBINED|PROSPECTUS — the rendered PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const snap = snapshot(session.orgId, id);
    if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const which = (req.nextUrl.searchParams.get('doc') ?? 'COMBINED').toUpperCase();
    const org = getOrg(session.orgId);
    const staff = listStaff(session.orgId);
    const lead = staff.find((u) => u.id === snap.engagement.leadAdvisorId);

    let definition;
    if (which === 'PROSPECTUS') {
      definition = buildProspectus(snap, { firmName: org?.name ?? 'Advisor OS' });
    } else if (['LEGAL', 'FINANCIAL', 'COMBINED'].includes(which)) {
      const report = listReports(id).find((r) => r.kind === which && r.status !== 'SUPERSEDED');
      definition = buildDDReport(snap, which as ReportKind, {
        firmName: org?.name ?? 'Advisor OS',
        preparedBy: lead?.name ?? session.name,
        reviewer: report?.reviewerId ? staff.find((u) => u.id === report.reviewerId)?.name : null,
        approved: report?.status === 'APPROVED',
        auditLog: listAudit(session.orgId, { engagementId: id, limit: 40 }).map((a) => ({ at: a.createdAt, actor: a.actorName, action: a.action })),
        agentRuns: snap.runs.map((r) => ({ agent: r.agent, at: r.createdAt, summary: r.summary, engine: r.engine })),
      });
    } else {
      return NextResponse.json({ error: 'Unknown document' }, { status: 400 });
    }

    const { bytes, pages } = await renderPdf(definition);
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'report.export', entityType: 'Pdf', engagementId: id, metadata: { doc: which, pages },
    });
    const name = `${snap.engagement.reference}_${which === 'PROSPECTUS' ? 'Prospectus' : `DD-Report-${which}`}.pdf`;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${req.nextUrl.searchParams.get('inline') ? 'inline' : 'attachment'}; filename="${name}"`,
        'x-page-count': String(pages),
      },
    });
  } catch (e) { return apiError(e); }
}
