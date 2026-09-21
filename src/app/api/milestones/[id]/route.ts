import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { updateMilestone, audit } from '@/lib/repo/core';
import { one } from '@/lib/db';
import { apiError } from '@/lib/api';
import type { Milestone, Contract } from '@/lib/types';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']).optional(),
  paymentStatus: z.enum(['UNBILLED', 'INVOICED', 'PAID', 'WAIVED']).optional(),
  paymentAmount: z.number().min(0).optional(),
  dueDate: z.string().nullable().optional(),
  invoiceNo: z.string().max(60).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const milestone = one<Milestone>('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const contract = one<Contract>('SELECT * FROM contracts WHERE id = ?', [milestone.contractId]);
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const eng = one<{ id: string; orgId: string }>('SELECT id, orgId FROM engagements WHERE id = ?', [contract.engagementId]);
    if (!eng || eng.orgId !== session.orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    updateMilestone(id, {
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : body.dueDate,
      completedAt: body.status === 'COMPLETED' ? new Date().toISOString() : body.status ? null : undefined,
      paidAt: body.paymentStatus === 'PAID' ? new Date().toISOString() : body.paymentStatus ? null : undefined,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'milestone.update', entityType: 'Milestone', entityId: id,
      engagementId: contract.engagementId, metadata: body,
    });
    return NextResponse.json({ milestone: one<Milestone>('SELECT * FROM milestones WHERE id = ?', [id]) });
  } catch (e) { return apiError(e); }
}
