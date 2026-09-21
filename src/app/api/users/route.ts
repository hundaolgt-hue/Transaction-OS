import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability, createUser, findUserByEmail, listOrgUsers } from '@/lib/auth';
import { getClient, audit } from '@/lib/repo/core';
import { ROLES } from '@/lib/domain';
import { notify } from '@/lib/notify';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  role: z.enum(ROLES),
  title: z.string().max(160).optional(),
  phone: z.string().max(60).optional(),
  clientId: z.string().nullable().optional(),
  password: z.string().min(8).max(200),
});

export async function GET() {
  try {
    const session = await requireCapability('manageUsers');
    return NextResponse.json({ users: listOrgUsers(session.orgId) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireCapability('manageUsers');
    const body = schema.parse(await req.json());
    if (findUserByEmail(body.email)) {
      return NextResponse.json({ error: 'That email address is already registered.' }, { status: 409 });
    }
    if (body.role === 'CLIENT') {
      if (!body.clientId || !getClient(session.orgId, body.clientId)) {
        return NextResponse.json({ error: 'A portal user must be attached to a client.' }, { status: 400 });
      }
    }
    const user = await createUser({
      orgId: session.orgId, ...body,
      clientId: body.role === 'CLIENT' ? body.clientId ?? null : null,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'user.create', entityType: 'User', entityId: user.id, metadata: { email: body.email, role: body.role },
    });
    await notify({
      userIds: [user.id], kind: 'INFO',
      title: 'Welcome to Advisor OS',
      body: `${session.name} created an account for you as ${body.role.toLowerCase()}. Sign in with your email address and the password you were given.`,
      link: body.role === 'CLIENT' ? '/portal' : '/dashboard', email: true,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) { return apiError(e); }
}
