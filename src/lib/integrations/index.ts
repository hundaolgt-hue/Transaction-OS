import 'server-only';
import crypto from 'node:crypto';
import { all, one, insert, update, id, now } from '../db';
import { env } from '../env';
import { toTelegramHtml, toSlackMrkdwn, alertText } from './format';

export type Kind = 'TELEGRAM' | 'SLACK';

export interface TelegramConfig { botToken?: string; chatId?: string; webhookSecret?: string; botUsername?: string }
export interface SlackConfig { webhookUrl?: string; signingSecret?: string; channel?: string }

export interface IntegrationRow {
  id: string; orgId: string; kind: Kind; enabled: number; config: string; minSeverity: string;
  lastDeliveryAt: string | null; lastError: string | null; deliveries: number; createdAt: string; updatedAt: string;
}

const RANK: Record<string, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

export function getIntegration(orgId: string, kind: Kind): IntegrationRow | null {
  return one<IntegrationRow>('SELECT * FROM integrations WHERE orgId = ? AND kind = ?', [orgId, kind]);
}

export function listIntegrations(orgId: string): IntegrationRow[] {
  return all<IntegrationRow>('SELECT * FROM integrations WHERE orgId = ?', [orgId]);
}

export function config<T>(row: IntegrationRow | null): T {
  try { return JSON.parse(row?.config ?? '{}') as T; } catch { return {} as T; }
}

const mask = (v?: string) => (!v ? '' : v.length <= 8 ? '••••' : `${v.slice(0, 4)}••••${v.slice(-4)}`);

/** Safe for the browser: secrets masked. */
export function publicView(orgId: string) {
  const out: Record<Kind, unknown> = { TELEGRAM: null, SLACK: null };
  for (const r of listIntegrations(orgId)) {
    const c = config<Record<string, string>>(r);
    out[r.kind] = {
      enabled: Boolean(r.enabled), minSeverity: r.minSeverity, lastDeliveryAt: r.lastDeliveryAt, lastError: r.lastError, deliveries: r.deliveries,
      config: r.kind === 'TELEGRAM'
        ? { botToken: mask(c.botToken), chatId: c.chatId ?? '', botUsername: c.botUsername ?? '', hasSecret: Boolean(c.webhookSecret) }
        : { webhookUrl: mask(c.webhookUrl), signingSecret: mask(c.signingSecret), channel: c.channel ?? '' },
      webhook: r.kind === 'TELEGRAM' ? `${env.appUrl}/api/integrations/telegram/webhook?org=${orgId}` : `${env.appUrl}/api/integrations/slack/command?org=${orgId}`,
    };
  }
  return out;
}

/** Merge a config patch; blank values leave stored secrets untouched. */
export function saveIntegration(orgId: string, kind: Kind, patch: { enabled?: boolean; minSeverity?: string; config?: Record<string, string> }) {
  const cur = getIntegration(orgId, kind);
  const merged = { ...config<Record<string, string>>(cur) };
  for (const [k, v] of Object.entries(patch.config ?? {})) if (v && !v.includes('••••')) merged[k] = v.trim();
  if (kind === 'TELEGRAM' && !merged.webhookSecret) merged.webhookSecret = crypto.randomBytes(18).toString('hex');
  if (cur) {
    update('integrations', cur.id, {
      enabled: patch.enabled ?? Boolean(cur.enabled), minSeverity: patch.minSeverity ?? cur.minSeverity,
      config: JSON.stringify(merged), updatedAt: now(),
    });
  } else {
    insert('integrations', {
      id: id('int'), orgId, kind, enabled: patch.enabled ?? false, minSeverity: patch.minSeverity ?? 'WARNING',
      config: JSON.stringify(merged), createdAt: now(), updatedAt: now(),
    });
  }
  return getIntegration(orgId, kind)!;
}

// ------------------------------------------------------------- transports

export async function telegramSend(token: string, chatId: string, html: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !j.ok) throw new Error(`Telegram: ${j.description ?? res.status}`);
}

export async function telegramSetWebhook(token: string, url: string, secret: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] }),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!j.ok) throw new Error(`Telegram: ${j.description ?? res.status}`);
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch(() => null) as { result?: { username?: string } } | null;
  return me?.result?.username ?? null;
}

export async function slackSend(webhookUrl: string, mrkdwn: string) {
  const res = await fetch(webhookUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: mrkdwn, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: mrkdwn } }] }),
  });
  if (!res.ok) throw new Error(`Slack: ${res.status} ${await res.text().catch(() => '')}`);
}

function record(row: IntegrationRow, error: string | null) {
  update('integrations', row.id, error
    ? { lastError: error.slice(0, 300), updatedAt: now() }
    : { lastDeliveryAt: now(), lastError: null, deliveries: row.deliveries + 1, updatedAt: now() });
}

/** Send a markdown message to every enabled channel at or above its severity floor. */
export async function broadcast(orgId: string, msg: { title: string; body: string; severity?: string; link?: string | null }, opts: { force?: Kind } = {}) {
  const { md } = alertText(msg, env.appUrl);
  const results: { kind: Kind; ok: boolean; error?: string }[] = [];
  for (const row of listIntegrations(orgId)) {
    if (opts.force ? row.kind !== opts.force : !row.enabled) continue;
    if (!opts.force && (RANK[msg.severity ?? 'INFO'] ?? 0) < (RANK[row.minSeverity] ?? 1)) continue;
    try {
      if (row.kind === 'TELEGRAM') {
        const c = config<TelegramConfig>(row);
        if (!c.botToken || !c.chatId) throw new Error('Bot token and chat ID are required');
        await telegramSend(c.botToken, c.chatId, toTelegramHtml(md));
      } else {
        const c = config<SlackConfig>(row);
        if (!c.webhookUrl) throw new Error('Incoming webhook URL is required');
        await slackSend(c.webhookUrl, toSlackMrkdwn(md));
      }
      record(row, null);
      results.push({ kind: row.kind, ok: true });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      record(row, err);
      results.push({ kind: row.kind, ok: false, error: err });
    }
  }
  return results;
}

/** Slack request signing: v0=HMAC_SHA256(secret, "v0:{ts}:{body}"), rejected if older than five minutes. */
export function verifySlack(secret: string, ts: string | null, sig: string | null, body: string): boolean {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mine = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`;
  const a = Buffer.from(mine), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
