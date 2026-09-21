import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { listClients, createClient, audit } from '@/lib/repo/core';
import { LEGAL_FORMS, SECTORS } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(220),
  legalForm: z.enum(LEGAL_FORMS).default('SHARE_COMPANY'),
  sector: z.enum(SECTORS).default('OTHER'),
  tin: z.string().max(40).optional(),
  businessLicenseNo: z.string().max(60).optional(),
  registrationDate: z.string().optional(),
  paidUpCapital: z.number().min(0).nullable().optional(),
  currency: z.string().default('ETB'),
  addressLine: z.string().max(300).optional(),
  city: z.string().max(120).default('Addis Ababa'),
  region: z.string().max(120).optional(),
  website: z.string().max(220).optional(),
  primaryContactName: z.string().max(220).optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  primaryContactPhone: z.string().max(60).optional(),
  notes: z.string().max(8000).optional(),
});

export async function GET() {
  try {
    const session = await requireCapability('manageClients');
    return NextResponse.json({ clients: listClients(session.orgId) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireCapability('manageClients');
    const body = schema.parse(await req.json());
    const client = createClient(session.orgId, {
      ...body,
      primaryContactEmail: body.primaryContactEmail || null,
      registrationDate: body.registrationDate ? new Date(body.registrationDate).toISOString() : null,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'client.create', entityType: 'Client', entityId: client.id, metadata: { name: client.name },
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) { return apiError(e); }
}
