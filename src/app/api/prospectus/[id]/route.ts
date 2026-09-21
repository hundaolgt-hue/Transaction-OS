import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getProspectusSection, updateProspectusSection, getEngagement, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  body: z.string().max(200_000).optional(),
  status: z.enum(['NOT_STARTED', 'DRAFTING', 'DRAFTED', 'IN_REVIEW', 'APPROVED']).optional(),
  reviewNote: z.string().max(4000).nullable().optional(),
  heading: z.string().min(1).max(220).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const section = getProspectusSection(id);
    if (!section || !getEngagement(session.orgId, section.engagementId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const body = schema.parse(await req.json());
    const words = (body.body ?? section.body).trim().split(/\s+/).filter(Boolean).length;
    updateProspectusSection(id, {
      ...body,
      generatedBy: body.body !== undefined ? 'HUMAN' : undefined,
      completeness: body.status === 'APPROVED' ? 100 : Math.min(100, Math.round((words / 350) * 100)),
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'prospectus.update', entityType: 'ProspectusSection', entityId: id,
      engagementId: section.engagementId, metadata: { status: body.status, words },
    });
    return NextResponse.json({ section: getProspectusSection(id) });
  } catch (e) { return apiError(e); }
}
