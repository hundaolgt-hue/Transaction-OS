import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { updateTask, audit } from '@/lib/repo/core';
import { one } from '@/lib/db';
import { apiError } from '@/lib/api';
import type { Task } from '@/lib/types';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(['TODO', 'DOING', 'BLOCKED', 'DONE']).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
  title: z.string().min(3).max(220).optional(),
  detail: z.string().max(4000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const task = one<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const eng = one<{ orgId: string }>('SELECT orgId FROM engagements WHERE id = ?', [task.engagementId]);
    if (!eng || eng.orgId !== session.orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    updateTask(id, {
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : body.dueDate,
      completedAt: body.status === 'DONE' ? new Date().toISOString() : body.status ? null : undefined,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'task.update', entityType: 'Task', entityId: id, engagementId: task.engagementId, metadata: body,
    });
    return NextResponse.json({ task: one<Task>('SELECT * FROM tasks WHERE id = ?', [id]) });
  } catch (e) { return apiError(e); }
}
