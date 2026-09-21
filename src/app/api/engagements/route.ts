import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { createEngagement, createContract, getClient, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';
import { notify, audienceFor } from '@/lib/notify';

export const runtime = 'nodejs';

const schema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(3),
  transactionType: z.string().min(1),
  targetRaise: z.number().nullable().optional(),
  currency: z.string().default('ETB'),
  targetFilingDate: z.string().optional(),
  leadAdvisorId: z.string().optional(),
  documentThreshold: z.number().min(0).max(100).default(80),
  description: z.string().optional(),
  rulePackKey: z.string().optional(),
  createContract: z.boolean().default(false),
  contractTitle: z.string().optional(),
  totalFee: z.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireCapability('manageEngagement');
    const body = schema.parse(await req.json());

    const client = getClient(session.orgId, body.clientId);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const engagement = createEngagement(session.orgId, {
      clientId: body.clientId,
      name: body.name,
      transactionType: body.transactionType,
      targetRaise: body.targetRaise ?? null,
      currency: body.currency,
      targetFilingDate: body.targetFilingDate ? new Date(body.targetFilingDate).toISOString() : null,
      leadAdvisorId: body.leadAdvisorId || null,
      documentThreshold: body.documentThreshold,
      description: body.description || null,
      rulePackKey: body.rulePackKey,
    });

    if (body.createContract) {
      createContract(engagement.id, {
        title: body.contractTitle || `Transaction advisory services agreement — ${client.name}`,
        totalFee: body.totalFee,
        currency: body.currency,
        status: 'DRAFT',
        scopeSummary: body.description || null,
      });
    }

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'engagement.create', entityType: 'Engagement', entityId: engagement.id,
      engagementId: engagement.id, metadata: { reference: engagement.reference, client: client.name },
    });

    await notify({
      userIds: audienceFor(engagement.id),
      engagementId: engagement.id, kind: 'INFO',
      title: `Engagement ${engagement.reference} opened`,
      body: `${client.name} — ${engagement.name}. The document checklist and prospectus skeleton have been created.`,
      link: `/engagements/${engagement.id}`,
    });

    return NextResponse.json({ engagement }, { status: 201 });
  } catch (e) { return apiError(e); }
}
