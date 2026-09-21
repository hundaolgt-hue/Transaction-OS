import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { getEngagement, createMeeting, updateMeeting, getMeeting, listMeetings, audit } from '@/lib/repo/core';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().min(3).max(220),
  scheduledAt: z.string(),
  durationMin: z.number().min(5).max(600).default(60),
  location: z.string().max(220).optional(),
  attendees: z.array(z.string()).default([]),
  agenda: z.string().max(8000).optional(),
});

const patchSchema = z.object({
  meetingId: z.string(),
  minutes: z.string().max(40_000).optional(),
  decisions: z.string().max(20_000).optional(),
  agenda: z.string().max(8000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ meetings: listMeetings(id) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = createSchema.parse(await req.json());
    const meeting = createMeeting({
      engagementId: id, title: body.title,
      scheduledAt: new Date(body.scheduledAt).toISOString(),
      durationMin: body.durationMin, location: body.location ?? null,
      attendees: JSON.stringify(body.attendees), agenda: body.agenda ?? null,
      organiserId: session.userId,
    });
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'meeting.create', entityType: 'Meeting', entityId: meeting.id, engagementId: id,
      metadata: { title: body.title },
    });
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (e) { return apiError(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    if (!getEngagement(session.orgId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { meetingId, ...rest } = patchSchema.parse(await req.json());
    const meeting = getMeeting(meetingId);
    if (!meeting || meeting.engagementId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    updateMeeting(meetingId, rest);
    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'meeting.update', entityType: 'Meeting', entityId: meetingId, engagementId: id, metadata: {},
    });
    return NextResponse.json({ meeting: getMeeting(meetingId) });
  } catch (e) { return apiError(e); }
}
