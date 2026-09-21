import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { getEngagement, getContract, createContract, updateContract, listMilestones, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().min(3),
  totalFee: z.number().min(0),
  currency: z.string().default('ETB'),
  feeModel: z.enum(['FIXED', 'RETAINER', 'SUCCESS', 'HYBRID']).default('FIXED'),
  scopeSummary: z.string().max(6000).optional(),
  signedDate: z.string().optional(),
});

const patchSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'SIGNED', 'COMPLETED', 'TERMINATED']).optional(),
  signedDate: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  totalFee: z.number().min(0).optional(),
  scopeSummary: z.string().max(6000).nullable().optional(),
  vatPercent: z.number().min(0).max(100).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('manageEngagement');
    const eng = getEngagement(session.orgId, id);
    if (!eng) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (getContract(id)) return NextResponse.json({ error: 'This engagement already has a contract.' }, { status: 409 });

    const body = createSchema.parse(await req.json());
    const contract = createContract(id, {
      ...body,
      signedDate: body.signedDate ? new Date(body.signedDate).toISOString() : null,
      status: body.signedDate ? 'SIGNED' : 'DRAFT',
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'contract.create', entityType: 'Contract', entityId: contract.id, engagementId: id,
      metadata: { totalFee: body.totalFee },
    });
    return NextResponse.json({ contract, milestones: listMilestones(contract.id) }, { status: 201 });
  } catch (e) { return apiError(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('manageEngagement');
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const contract = getContract(id);
    if (!contract) return NextResponse.json({ error: 'No contract on this engagement.' }, { status: 404 });

    const body = patchSchema.parse(await req.json());
    updateContract(contract.id, {
      ...body,
      signedDate: body.signedDate ? new Date(body.signedDate).toISOString() : body.signedDate,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate).toISOString() : body.effectiveDate,
      endDate: body.endDate ? new Date(body.endDate).toISOString() : body.endDate,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'contract.update', entityType: 'Contract', entityId: contract.id, engagementId: id, metadata: body,
    });
    return NextResponse.json({ contract: getContract(id) });
  } catch (e) { return apiError(e); }
}
