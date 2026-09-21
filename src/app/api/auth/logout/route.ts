import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/repo/core';

export const runtime = 'nodejs';

export async function POST() {
  const s = await getSession();
  if (s) audit({ orgId: s.orgId, actorId: s.userId, actorName: s.name, action: 'auth.logout', entityType: 'User', entityId: s.userId });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
