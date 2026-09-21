import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findUserByEmail, verifyPassword, createSessionToken, setSessionCookie, touchLogin } from '@/lib/auth';
import { audit } from '@/lib/repo/core';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });

  const user = findUserByEmail(parsed.data.email);
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    // Uniform message — do not disclose whether the account exists.
    return NextResponse.json({ error: 'Those credentials were not recognised.' }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id, orgId: user.orgId, role: user.role,
    email: user.email, name: user.name, clientId: user.clientId,
  });
  await setSessionCookie(token);
  touchLogin(user.id);
  audit({
    orgId: user.orgId, actorId: user.id, actorName: user.name,
    action: 'auth.login', entityType: 'User', entityId: user.id,
  });

  return NextResponse.json({
    ok: true,
    redirect: user.role === 'CLIENT' ? '/portal' : '/dashboard',
    user: { id: user.id, name: user.name, role: user.role },
  });
}
