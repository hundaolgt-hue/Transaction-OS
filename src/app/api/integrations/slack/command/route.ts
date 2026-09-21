import { NextRequest, NextResponse } from 'next/server';
import { getIntegration, config, verifySlack, type SlackConfig } from '@/lib/integrations';
import { toSlackMrkdwn } from '@/lib/integrations/format';
import { answerQuestion } from '@/lib/assistant/server';
import { audit } from '@/lib/repo/core';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Slack slash command, e.g. `/advisor what is missing for the IPO?`. Requests must be signed. */
export async function POST(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') ?? '';
  const row = getIntegration(orgId, 'SLACK');
  const c = config<SlackConfig>(row);
  const raw = await req.text();
  if (!row || !row.enabled || !c.signingSecret || !verifySlack(c.signingSecret, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'), raw)) {
    return NextResponse.json({ text: 'This request could not be verified.' }, { status: 401 });
  }
  const form = new URLSearchParams(raw);
  const question = (form.get('text') ?? '').trim();
  if (!question || question === 'help') {
    return NextResponse.json({ response_type: 'ephemeral', text: 'Ask about any engagement — for example `/advisor what documents are missing for Abyssinia?` or `/advisor fees outstanding`.' });
  }
  const answer = await answerQuestion(orgId, question);
  audit({ orgId, actorName: `Slack: ${form.get('user_name') ?? 'user'}`, action: 'assistant.ask', entityType: 'Slack', metadata: { intent: answer.intent } });
  const links = answer.sources.slice(0, 3).map((s) => `<${env.appUrl}${s.link}|${s.title}>`).join('  ·  ');
  return NextResponse.json({ response_type: 'ephemeral', text: `${toSlackMrkdwn(answer.text)}${links ? `\n\n${links}` : ''}` });
}
