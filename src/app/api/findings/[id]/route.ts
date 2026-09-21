import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { getFinding, updateFinding, getEngagement, audit, createComment, listComments } from '@/lib/repo/core';
import { FINDING_STATUSES, SEVERITIES } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  humanVerdict: z.enum(['CONFIRMED', 'REJECTED', 'AMENDED']).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  resolutionNote: z.string().max(4000).nullable().optional(),
  visibleToClient: z.boolean().optional(),
  comment: z.string().max(4000).optional(),
  recommendation: z.string().max(4000).optional(),
  detail: z.string().max(8000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('reviewFindings');
    const finding = getFinding(id);
    if (!finding || !getEngagement(session.orgId, finding.engagementId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ finding, comments: listComments({ findingId: id }) });
  } catch (e) { return apiError(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('reviewFindings');
    const finding = getFinding(id);
    if (!finding || !getEngagement(session.orgId, finding.engagementId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { comment, visibleToClient, ...rest } = schema.parse(await req.json());
    const resolving = rest.status && ['RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'].includes(rest.status);

    updateFinding(id, {
      ...rest,
      visibleToClient: visibleToClient === undefined ? undefined : (visibleToClient ? 1 : 0),
      resolvedById: resolving ? session.userId : undefined,
      resolvedAt: resolving ? new Date().toISOString() : undefined,
    });

    if (comment?.trim()) {
      createComment({
        findingId: id, body: comment.trim(),
        authorId: session.userId, authorName: session.name, visibleToClient: 0,
      });
    }

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'finding.update', entityType: 'Finding', entityId: id,
      engagementId: finding.engagementId, metadata: rest,
    });

    return NextResponse.json({ finding: getFinding(id), comments: listComments({ findingId: id }) });
  } catch (e) { return apiError(e); }
}
