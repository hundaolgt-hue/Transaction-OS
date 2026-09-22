import 'server-only';
import nodemailer from 'nodemailer';
import { env } from './env';
import { all, one, insert, update, id, now } from './db';
import type { Notification, User, Engagement } from './types';

type Kind = 'INFO' | 'DOC_MISSING' | 'THRESHOLD' | 'FINDING' | 'MILESTONE' | 'AGENT' | 'MEETING';
type Sev = 'INFO' | 'WARNING' | 'CRITICAL';

let transport: nodemailer.Transporter | null = null;
/** Outbox used when SMTP is not configured, so the flow stays testable. */
const outbox: { to: string; subject: string; text: string; at: string }[] = [];

function getTransport(): nodemailer.Transporter | null {
  if (!env.mailEnabled) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    });
  }
  return transport;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<'sent' | 'queued'> {
  const t = getTransport();
  if (!t) {
    outbox.push({ to, subject, text, at: now() });
    if (outbox.length > 200) outbox.shift();
    console.info(`[mail:outbox] → ${to} :: ${subject}`);
    return 'queued';
  }
  try {
    await t.sendMail({ from: env.mailFrom, to, subject, text, html: html ?? `<pre>${text}</pre>` });
    return 'sent';
  } catch (e) {
    // A mis-configured SMTP server must never break the action that triggered the email.
    console.error(`[mail] delivery to ${to} failed: ${(e as Error).message}`);
    outbox.push({ to, subject, text, at: now() });
    if (outbox.length > 200) outbox.shift();
    return 'queued';
  }
}

export const readOutbox = () => [...outbox].reverse();

export interface NotifyInput {
  userIds: string[];
  engagementId?: string | null;
  kind: Kind;
  severity?: Sev;
  title: string;
  body: string;
  link?: string | null;
  email?: boolean;
}

/** Create in-app notifications and optionally email them. */
export async function notify(input: NotifyInput): Promise<Notification[]> {
  const created: Notification[] = [];
  for (const userId of [...new Set(input.userIds)]) {
    const user = one<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || !user.active) continue;
    const nid = id('ntf');
    insert('notifications', {
      id: nid, userId, engagementId: input.engagementId ?? null,
      kind: input.kind, severity: input.severity ?? 'INFO',
      title: input.title, body: input.body, link: input.link ?? null, createdAt: now(),
    });
    const n = one<Notification>('SELECT * FROM notifications WHERE id = ?', [nid])!;
    if (input.email) {
      const link = input.link ? `\n\nOpen: ${env.appUrl}${input.link}` : '';
      await sendEmail(user.email, input.title, `${input.body}${link}\n\n— Advisor OS`);
      update('notifications', nid, { emailedAt: now() });
    }
    created.push(n);
  }
  // Fan out once per event (not per recipient) to the firm's chat channels.
  if (created.length && input.engagementId) {
    const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [input.engagementId]);
    if (eng) {
      import('./integrations')
        .then(({ broadcast }) => broadcast(eng.orgId, { title: input.title, body: input.body, severity: input.severity, link: input.link }))
        .catch((e) => console.warn('[integrations]', e));
    }
  }
  return created;
}

export const listNotifications = (userId: string, limit = 50) =>
  all<Notification>('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', [userId, limit]);

export const unreadCount = (userId: string) =>
  (one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE userId = ? AND readAt IS NULL', [userId])?.n ?? 0);

export const markRead = (userId: string, notificationId?: string) =>
  notificationId
    ? update('notifications', notificationId, { readAt: now() })
    : all<Notification>('SELECT id FROM notifications WHERE userId = ? AND readAt IS NULL', [userId])
        .forEach((n) => update('notifications', n.id, { readAt: now() }));

/** Everyone who should hear about an engagement: the deal team plus the client's portal users. */
export function audienceFor(engagementId: string, opts: { includeClient?: boolean } = {}): string[] {
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  if (!eng) return [];
  const staff = all<{ id: string }>("SELECT id FROM users WHERE orgId = ? AND role != 'CLIENT' AND active = 1", [eng.orgId]);
  const ids = staff.map((s) => s.id);
  if (opts.includeClient) {
    const portal = all<{ id: string }>("SELECT id FROM users WHERE clientId = ? AND role = 'CLIENT' AND active = 1", [eng.clientId]);
    ids.push(...portal.map((p) => p.id));
  }
  return ids;
}

export function clientUsersFor(engagementId: string): string[] {
  const eng = one<Engagement>('SELECT * FROM engagements WHERE id = ?', [engagementId]);
  if (!eng) return [];
  return all<{ id: string }>("SELECT id FROM users WHERE clientId = ? AND role = 'CLIENT' AND active = 1", [eng.clientId]).map((u) => u.id);
}
