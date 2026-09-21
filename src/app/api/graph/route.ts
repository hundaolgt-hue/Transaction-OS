import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { getOrg, listEngagements, listStaff, snapshot } from '@/lib/repo/core';
import { buildGraph } from '@/lib/knowledge/graph';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const s = await requireStaff();
    const snaps = listEngagements(s.orgId).map((e) => snapshot(s.orgId, e.id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    return NextResponse.json(buildGraph(getOrg(s.orgId)!, listStaff(s.orgId), snaps));
  } catch (e) { return apiError(e); }
}
