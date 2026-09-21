import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { all, one, insert, update, id, now } from './db';
import type { User, SafeUser, Session } from './types';

const COOKIE = 'advisoros_session';
const secret = new TextEncoder().encode(env.authSecret);

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSessionToken(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function readSessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.userId) return null;
    return {
      userId: String(payload.userId),
      orgId: String(payload.orgId),
      role: String(payload.role),
      email: String(payload.email),
      name: String(payload.name),
      clientId: payload.clientId ? String(payload.clientId) : null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function toSafe(u: User): SafeUser {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

export function findUserByEmail(email: string): User | null {
  return one<User>('SELECT * FROM users WHERE lower(email) = lower(?)', [email.trim()]);
}

export function findUser(userId: string): User | null {
  return one<User>('SELECT * FROM users WHERE id = ?', [userId]);
}

export function listOrgUsers(orgId: string): SafeUser[] {
  return all<User>('SELECT * FROM users WHERE orgId = ? ORDER BY role, name', [orgId]).map(toSafe);
}

export async function createUser(input: {
  orgId: string; email: string; name: string; password: string; role: string;
  title?: string; phone?: string; clientId?: string | null;
}): Promise<SafeUser> {
  const palette = ['#2f6f5e', '#5b6fc9', '#c08a3e', '#8a5fc0', '#3f8fa8', '#b3607a', '#4f7f43'];
  const userId = id('usr');
  insert('users', {
    id: userId,
    orgId: input.orgId,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    role: input.role,
    title: input.title ?? null,
    phone: input.phone ?? null,
    avatarColor: palette[Math.floor(Math.random() * palette.length)],
    active: 1,
    clientId: input.clientId ?? null,
    createdAt: now(),
  });
  return toSafe(findUser(userId)!);
}

export function touchLogin(userId: string) {
  update('users', userId, { lastLoginAt: now() });
}

// ------------------------------------------------------------ authorisation

export const CAN = {
  manageOrg: (r: string) => r === 'OWNER',
  manageUsers: (r: string) => r === 'OWNER',
  manageClients: (r: string) => r === 'OWNER' || r === 'ADVISOR',
  manageEngagement: (r: string) => r === 'OWNER' || r === 'ADVISOR',
  runAgents: (r: string) => r === 'OWNER' || r === 'ADVISOR' || r === 'ANALYST',
  reviewFindings: (r: string) => r === 'OWNER' || r === 'ADVISOR' || r === 'ANALYST',
  approveReports: (r: string) => r === 'OWNER' || r === 'ADVISOR',
  advanceStage: (r: string) => r === 'OWNER' || r === 'ADVISOR',
  uploadDocuments: (_r: string) => true,
  viewInternal: (r: string) => r !== 'CLIENT',
} as const;

export class AuthError extends Error {
  constructor(message: string, readonly status = 403) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError('Not authenticated', 401);
  return s;
}

export async function requireStaff(): Promise<Session> {
  const s = await requireSession();
  if (s.role === 'CLIENT') throw new AuthError('Staff access required', 403);
  return s;
}

export async function requireCapability(cap: keyof typeof CAN): Promise<Session> {
  const s = await requireSession();
  if (!CAN[cap](s.role)) throw new AuthError(`Your role (${s.role}) cannot perform this action`, 403);
  return s;
}
