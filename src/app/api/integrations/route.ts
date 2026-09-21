import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability, requireStaff } from '@/lib/auth';
import { publicView, saveIntegration, config, telegramSetWebhook, type TelegramConfig } from '@/lib/integrations';
import { audit } from '@/lib/repo/core';
import { env } from '@/lib/env';
import { update } from '@/lib/db';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  kind: z.enum(['TELEGRAM', 'SLACK']),
  enabled: z.boolean().optional(),
  minSeverity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  config: z.record(z.string(), z.string().max(500)).optional(),
  registerWebhook: z.boolean().optional(),
});

export async function GET() {
  try {
    const s = await requireStaff();
    return NextResponse.json(publicView(s.orgId));
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireCapability('manageOrg');
    const body = schema.parse(await req.json());
    const row = saveIntegration(s.orgId, body.kind, body);
    audit({ orgId: s.orgId, actorId: s.userId, actorName: s.name, action: 'integration.update', entityType: 'Integration', entityId: row.id, metadata: { kind: body.kind, enabled: body.enabled } });

    let webhook: string | null = null;
    if (body.kind === 'TELEGRAM' && body.registerWebhook) {
      const c = config<TelegramConfig>(row);
      if (!c.botToken) return NextResponse.json({ error: 'Add the bot token first.' }, { status: 400 });
      const url = `${env.appUrl}/api/integrations/telegram/webhook?org=${s.orgId}`;
      const username = await telegramSetWebhook(c.botToken, url, c.webhookSecret!);
      if (username) update('integrations', row.id, { config: JSON.stringify({ ...c, botUsername: username }) });
      webhook = url;
    }
    return NextResponse.json({ ...publicView(s.orgId), registered: webhook });
  } catch (e) { return apiError(e); }
}

