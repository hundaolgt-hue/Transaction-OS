import { NextResponse } from 'next/server';
import { AuthError } from './auth';

/** Consistent error envelope; never leaks a stack trace to the client. */
export function apiError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : 'Unexpected error';
  console.error('[api]', e);
  return NextResponse.json({ error: message }, { status: 400 });
}

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
