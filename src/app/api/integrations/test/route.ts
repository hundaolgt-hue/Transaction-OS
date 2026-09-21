import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { broadcast, publicView } from '@/lib/integrations';
import { getOrg } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const s = await requireCapability('manageOrg');
    const { kind } = z.object({ kind: z.enum(['TELEGRAM', 'SLACK']) }).parse(await req.json());
    const org = getOrg(s.orgId);
    const [r] = await broadcast(s.orgId, {
      title: `Advisor OS connected — ${org?.name ?? ''}`,
      body: `${s.name} sent this test. Alerts at or above the configured severity will arrive here, and you can ask questions about any engagement.`,
      severity: 'INFO', link: '/dashboard',
    }, { force: kind });
    return NextResponse.json({ ok: r?.ok ?? false, error: r?.error ?? (r ? null : 'Not configured'), ...publicView(s.orgId) }, { status: r?.ok ? 200 : 400 });
  } catch (e) { return apiError(e); }
}
