import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getEngagement, createRisk, listRisks, audit } from '@/lib/repo/core';
import { RISK_CATEGORIES } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  title: z.string().min(3).max(220),
  category: z.enum(RISK_CATEGORIES).default('LEGAL'),
  description: z.string().min(3).max(6000),
  likelihood: z.number().min(1).max(5).default(3),
  impact: z.number().min(1).max(5).default(3),
  mitigation: z.string().max(4000).optional(),
  disclosureStrategy: z.string().max(4000).optional(),
  prospectusPlacement: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = schema.parse(await req.json());
    const n = listRisks(id).length + 1;
    const risk = createRisk({ engagementId: id, code: `RSK-${String(n).padStart(2, '0')}`, ...body });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'risk.create', entityType: 'Risk', entityId: risk.id, engagementId: id, metadata: { title: body.title },
    });
    return NextResponse.json({ risk }, { status: 201 });
  } catch (e) { return apiError(e); }
}
