import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getEngagement, createTask, listTasks, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  title: z.string().min(3).max(220),
  detail: z.string().max(4000).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ tasks: listTasks(id) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = schema.parse(await req.json());
    const task = createTask({
      engagementId: id, ...body,
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
      source: 'HUMAN',
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'task.create', entityType: 'Task', entityId: task.id, engagementId: id, metadata: { title: body.title },
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) { return apiError(e); }
}
