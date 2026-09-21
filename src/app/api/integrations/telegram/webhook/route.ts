import { NextRequest, NextResponse } from 'next/server';
import { getIntegration, config, telegramSend, type TelegramConfig } from '@/lib/integrations';
import { toTelegramHtml } from '@/lib/integrations/format';
import { answerQuestion } from '@/lib/assistant/server';
import { audit } from '@/lib/repo/core';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HELP = `Ask me anything about the firm's engagements, for example:
• What documents are still missing for Abyssinia?
• Any critical findings on the bond?
• How much is outstanding in fees?
Commands: /status, /missing, /findings, /fees, /help`;

const COMMANDS: Record<string, string> = {
  '/status': 'Summarise all projects', '/missing': 'What documents are missing?',
  '/findings': 'What are the open findings?', '/fees': 'How much is outstanding in fees?', '/risks': 'What are the top risks?',
};

/** Telegram bot webhook. Only the configured chat is answered; the secret header is required. */
export async function POST(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') ?? '';
  const row = getIntegration(orgId, 'TELEGRAM');
  const c = config<TelegramConfig>(row);
  if (!row || !row.enabled || !c.botToken || req.headers.get('x-telegram-bot-api-secret-token') !== c.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await req.json().catch(() => null) as { message?: { chat?: { id?: number }; text?: string; from?: { username?: string; first_name?: string } } } | null;
  const msg = update?.message;
  const chatId = String(msg?.chat?.id ?? '');
  const text = (msg?.text ?? '').trim();
  if (!chatId || !text) return NextResponse.json({ ok: true });
  if (c.chatId && chatId !== c.chatId) {
    await telegramSend(c.botToken, chatId, 'This chat is not linked to the firm. Ask an administrator to add its chat ID in Advisor OS settings.').catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const cmd = text.split(/\s+/)[0].replace(/@.*$/, '').toLowerCase();
  if (cmd === '/start' || cmd === '/help') {
    await telegramSend(c.botToken, chatId, toTelegramHtml(HELP)).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const question = COMMANDS[cmd] ? `${COMMANDS[cmd]} ${text.slice(cmd.length)}`.trim() : text;
  const answer = await answerQuestion(orgId, question);
  const links = answer.sources.slice(0, 3).map((s) => `\n→ ${s.title}`).join('');
  await telegramSend(c.botToken, chatId, toTelegramHtml(`${answer.text}${links}`)).catch((e) => console.warn('[telegram]', e));
  audit({ orgId, actorName: `Telegram: ${msg?.from?.username ?? msg?.from?.first_name ?? chatId}`, action: 'assistant.ask', entityType: 'Telegram', metadata: { intent: answer.intent } });
  return NextResponse.json({ ok: true });
}
