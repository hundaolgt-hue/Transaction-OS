import { all, one, insert, update, id, now } from './db';
import type { Notification, User, Engagement } from '../../src/lib/types';

const outbox: { to: string; subject: string; text: string; at: string }[] = [];
export const readOutbox = () => [...outbox].reverse();

export async function sendEmail(to: string, subject: string, text: string) {
  outbox.push({ to, subject, text, at: now() });
  return 'queued' as const;
}

export async function notify(input: {
  userIds: string[]; engagementId?: string | null; kind: string; severity?: string;
  title: string; body: string; link?: string | null; email?: boolean;
}): Promise<Notification[]> {
  const created: Notification[] = [];
  for (const userId of [...new Set(input.userIds)]) {
    const user = one<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || !user.active) continue;
    const nid = id('ntf');
    insert('notifications', {
      id: nid, userId, engagementId: input.engagementId ?? null, kind: input.kind,
      severity: input.severity ?? 'INFO', title: input.title, body: input.body,
      link: input.link ?? null, createdAt: now(),
    });
    if (input.email) {
      await sendEmail(user.email, input.title, input.body);
      update('notifications', nid, { emailedAt: now() });
    }
    created.push(one<Notification>('SELECT * FROM notifications WHERE id = ?', [nid])!);
  }
  return created;
}

export const listNotifications = (userId: string, limit = 50) =>
  all<Notification>('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit]);
export const unreadCount = (userId: string) =>
  one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE userId = ? AND readAt IS NULL', [userId])?.n ?? 0;
export const markRead = (userId: string) =>
  all<{ id: string }>('SELECT id FROM notifications WHERE userId = ? AND readAt IS NULL', [userId])
    .forEach((n) => update('notifications', n.id, { readAt: now() }));

export function audienceFor(engagementId: string, opts: { includeClient?: boolean } = {}): string[] {
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  if (!eng) return [];
  const ids = all<{ id: string }>("SELECT id FROM users WHERE orgId = ? AND role != 'CLIENT' AND active = 1", [eng.orgId]).map((s) => s.id);
  if (opts.includeClient) ids.push(...clientUsersFor(engagementId));
  return ids;
}
export function clientUsersFor(engagementId: string): string[] {
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  if (!eng) return [];
  return all<{ id: string }>("SELECT id FROM users WHERE clientId = ? AND role = 'CLIENT' AND active = 1", [eng.clientId]).map((u) => u.id);
}
