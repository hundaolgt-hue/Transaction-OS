import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { listNotifications, unreadCount, markRead } from '@/lib/notify';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    if (req.nextUrl.searchParams.get('countOnly')) {
      return NextResponse.json({ unread: unreadCount(s.userId) });
    }
    return NextResponse.json({ notifications: listNotifications(s.userId), unread: unreadCount(s.userId) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    const body = await req.json().catch(() => ({}));
    markRead(s.userId, body.all ? undefined : body.id);
    return NextResponse.json({ ok: true, unread: unreadCount(s.userId) });
  } catch (e) { return apiError(e); }
}
