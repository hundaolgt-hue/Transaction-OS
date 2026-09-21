import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff, requireCapability } from '@/lib/auth';
import { getReport, updateReport, getEngagement, audit } from '@/lib/repo/core';
import { notify, audienceFor } from '@/lib/notify';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED']).optional(),
  executiveSummary: z.string().max(20_000).optional(),
  sections: z.array(z.object({
    id: z.string(), heading: z.string(), body: z.string(),
    source: z.string().optional(), agentGenerated: z.boolean().optional(), edited: z.boolean().optional(),
  })).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const report = getReport(id);
    if (!report || !getEngagement(session.orgId, report.engagementId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const body = schema.parse(await req.json());

    if (body.status === 'APPROVED') {
      await requireCapability('approveReports');
    }

    updateReport(id, {
      status: body.status,
      executiveSummary: body.executiveSummary,
      sections: body.sections ? JSON.stringify(body.sections) : undefined,
      reviewerId: body.status ? session.userId : undefined,
      reviewedAt: body.status === 'IN_REVIEW' ? new Date().toISOString() : undefined,
      approvedAt: body.status === 'APPROVED' ? new Date().toISOString() : undefined,
    });

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: body.status === 'APPROVED' ? 'report.approve' : 'report.update',
      entityType: 'DueDiligenceReport', entityId: id, engagementId: report.engagementId,
      metadata: { status: body.status, kind: report.kind, version: report.version },
    });

    if (body.status === 'APPROVED') {
      await notify({
        userIds: audienceFor(report.engagementId),
        engagementId: report.engagementId, kind: 'INFO',
        title: `${report.title} approved`,
        body: `${session.name} approved version ${report.version} of the ${report.kind.toLowerCase()} due diligence report.`,
        link: `/engagements/${report.engagementId}/reports`,
      });
    }

    return NextResponse.json({ report: getReport(id) });
  } catch (e) { return apiError(e); }
}
