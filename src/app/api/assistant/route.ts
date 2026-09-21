import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { answerQuestion } from '@/lib/assistant/server';
import { audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({ question: z.string().min(2).max(2000) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { question } = schema.parse(await req.json());
    const answer = await answerQuestion(session.orgId, question, {
      clientId: session.role === 'CLIENT' ? session.clientId ?? '__none__' : null,
    });
    audit({ orgId: session.orgId, actorId: session.userId, actorName: session.name, action: 'assistant.ask', entityType: 'Assistant', metadata: { intent: answer.intent, engine: answer.engine } });
    return NextResponse.json(answer);
  } catch (e) { return apiError(e); }
}
