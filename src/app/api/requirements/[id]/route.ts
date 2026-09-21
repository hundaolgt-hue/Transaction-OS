import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getRequirement, updateRequirement, getEngagement, audit } from '@/lib/repo/core';
import { notify, clientUsersFor } from '@/lib/notify';
import { REQUIREMENT_STATUSES } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  waivedReason: z.string().max(2000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  weight: z.number().min(1).max(10).optional(),
  mandatory: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const requirement = getRequirement(id);
    if (!requirement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const eng = getEngagement(session.orgId, requirement.engagementId);
    if (!eng) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    if (body.status === 'WAIVED' && !body.waivedReason) {
      return NextResponse.json({ error: 'A waiver must record a reason.' }, { status: 400 });
    }
    updateRequirement(id, {
      ...body,
      mandatory: body.mandatory === undefined ? undefined : (body.mandatory ? 1 : 0),
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : body.dueDate,
    });

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'requirement.update', entityType: 'Requirement', entityId: id,
      engagementId: requirement.engagementId, metadata: body,
    });

    if (body.status === 'REQUESTED') {
      await notify({
        userIds: clientUsersFor(requirement.engagementId),
        engagementId: requirement.engagementId, kind: 'DOC_MISSING', severity: 'WARNING',
        title: `Document requested — ${requirement.title}`,
        body: `${session.name} has requested "${requirement.title}" (${requirement.code}). ${requirement.description ?? ''}`,
        link: `/portal/${requirement.engagementId}`, email: true,
      });
    }

    return NextResponse.json({ requirement: getRequirement(id) });
  } catch (e) { return apiError(e); }
}
