import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCapability } from '@/lib/auth';
import { getEngagement, listAgentRuns } from '@/lib/repo/core';
import { runAgent } from '@/lib/agents/runner';
import { AGENTS, type AgentKey } from '@/lib/domain';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 300;

const schema = z.object({
  agent: z.enum(AGENTS),
  task: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('runAgents');
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    return NextResponse.json({ runs: listAgentRuns(id) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireCapability('runAgents');
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    const result = await runAgent({
      engagementId: id, orgId: session.orgId, agent: body.agent as AgentKey,
      task: body.task, triggeredById: session.userId, actorName: session.name,
      payload: body.payload,
    });

    return NextResponse.json({ run: result.run, summary: result.summary, findingsCreated: result.findingsCreated });
  } catch (e) { return apiError(e); }
}
