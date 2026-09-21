import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getRisk, updateRisk, getEngagement, audit } from '@/lib/repo/core';
import { RISK_CATEGORIES } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  title: z.string().min(3).max(220).optional(),
  category: z.enum(RISK_CATEGORIES).optional(),
  description: z.string().max(6000).optional(),
  likelihood: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
  residualLikelihood: z.number().min(1).max(5).optional(),
  residualImpact: z.number().min(1).max(5).optional(),
  mitigation: z.string().max(4000).nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
  status: z.enum(['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED']).optional(),
  disclosureStrategy: z.string().max(4000).nullable().optional(),
  prospectusPlacement: z.string().max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const risk = getRisk(id);
    if (!risk || !getEngagement(session.orgId, risk.engagementId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const body = schema.parse(await req.json());
    updateRisk(id, body);
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'risk.update', entityType: 'Risk', entityId: id, engagementId: risk.engagementId, metadata: body,
    });
    return NextResponse.json({ risk: getRisk(id) });
  } catch (e) { return apiError(e); }
}
