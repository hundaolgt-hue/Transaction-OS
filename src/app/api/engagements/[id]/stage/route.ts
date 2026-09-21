import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { getEngagement, setStage, snapshot, audit } from '@/lib/repo/core';
import { notify, audienceFor } from '@/lib/notify';
import { STAGE_META, type Stage } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({ toStage: z.string(), force: z.boolean().default(false), note: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('advanceStage');
    const snap = snapshot(session.orgId, id);
    if (!snap) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    if (!(body.toStage in STAGE_META)) return NextResponse.json({ error: 'Unknown stage' }, { status: 400 });

    if (!snap.gate.canAdvance && !body.force) {
      return NextResponse.json({ error: `Stage gate not satisfied: ${snap.gate.blockers.join(' ')}` }, { status: 409 });
    }

    const note = body.note ?? (body.force ? 'Advanced with an override.' : 'Stage gate satisfied.');
    const engagement = setStage(id, body.toStage, note, session.name);

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'engagement.stage', entityType: 'Engagement', entityId: id, engagementId: id,
      metadata: { from: snap.engagement.stage, to: body.toStage, override: body.force, blockers: snap.gate.blockers },
    });

    await notify({
      userIds: audienceFor(id, { includeClient: true }),
      engagementId: id, kind: 'INFO', severity: body.force ? 'WARNING' : 'INFO',
      title: `${snap.engagement.reference} moved to ${STAGE_META[body.toStage as Stage].label}`,
      body: `${note}${body.force ? ` Override recorded against ${session.name}.` : ''}`,
      link: `/engagements/${id}`, email: true,
    });

    return NextResponse.json({ engagement });
  } catch (e) { return apiError(e); }
}
