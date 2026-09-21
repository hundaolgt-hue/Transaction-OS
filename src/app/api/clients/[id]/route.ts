import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { getClient, updateClient, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(220).optional(),
  status: z.enum(['PROSPECT', 'ACTIVE', 'ON_HOLD', 'CLOSED']).optional(),
  riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNRATED']).optional(),
  notes: z.string().max(8000).nullable().optional(),
  primaryContactName: z.string().max(220).nullable().optional(),
  primaryContactEmail: z.string().max(220).nullable().optional(),
  primaryContactPhone: z.string().max(60).nullable().optional(),
  addressLine: z.string().max(300).nullable().optional(),
  website: z.string().max(220).nullable().optional(),
  paidUpCapital: z.number().min(0).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('manageClients');
    if (!getClient(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = schema.parse(await req.json());
    const client = updateClient(session.orgId, id, body);
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'client.update', entityType: 'Client', entityId: id, metadata: body,
    });
    return NextResponse.json({ client });
  } catch (e) { return apiError(e); }
}
