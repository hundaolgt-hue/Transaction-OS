import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession, requireStaff } from '@/lib/auth';
import {
  getDocument, updateDocument, deleteDocument, getEngagement,
  updateRequirement, getRequirement, audit, listDocumentsForRequirement,
} from '@/lib/repo/core';
import { readFile, fileExists, removeFile } from '@/lib/documents';
import { notify, clientUsersFor } from '@/lib/notify';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED']).optional(),
  reviewNote: z.string().max(4000).optional(),
  requirementId: z.string().nullable().optional(),
  title: z.string().min(1).max(300).optional(),
});

/** Download — streams the stored file. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const doc = getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const eng = getEngagement(session.orgId, doc.engagementId);
    if (!eng) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role === 'CLIENT' && eng.clientId !== session.clientId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!fileExists(doc.storageKey)) return NextResponse.json({ error: 'The stored file is missing.' }, { status: 410 });

    const bytes = readFile(doc.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': doc.mimeType,
        'content-disposition': `attachment; filename="${doc.fileName.replace(/"/g, '')}"`,
        'content-length': String(bytes.length),
      },
    });
  } catch (e) { return apiError(e); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const doc = getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const eng = getEngagement(session.orgId, doc.engagementId);
    if (!eng) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = patchSchema.parse(await req.json());
    updateDocument(id, body);

    // Keep the requirement status in step with the review decision.
    const reqId = body.requirementId !== undefined ? body.requirementId : doc.requirementId;
    if (reqId && body.status) {
      const map: Record<string, string> = {
        ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED', UNDER_REVIEW: 'UNDER_REVIEW', SUBMITTED: 'SUBMITTED',
      };
      updateRequirement(reqId, { status: map[body.status] });
    }

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'document.review', entityType: 'Document', entityId: id, engagementId: doc.engagementId,
      metadata: body,
    });

    if (body.status === 'REJECTED' || body.status === 'ACCEPTED') {
      const req = reqId ? getRequirement(reqId) : null;
      await notify({
        userIds: clientUsersFor(doc.engagementId),
        engagementId: doc.engagementId,
        kind: 'INFO',
        severity: body.status === 'REJECTED' ? 'WARNING' : 'INFO',
        title: `Document ${body.status === 'ACCEPTED' ? 'accepted' : 'returned'} — ${doc.title}`,
        body: body.status === 'ACCEPTED'
          ? `"${doc.title}" has been accepted${req ? ` against ${req.title}` : ''}.`
          : `"${doc.title}" was returned. ${body.reviewNote ?? 'Please review the note in the portal and re-upload.'}`,
        link: `/portal/${doc.engagementId}`,
        email: body.status === 'REJECTED',
      });
    }

    return NextResponse.json({ document: getDocument(id) });
  } catch (e) { return apiError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireStaff();
    const doc = getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!getEngagement(session.orgId, doc.engagementId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    removeFile(doc.storageKey);
    deleteDocument(id);

    // If that was the last document for the requirement, reopen it.
    if (doc.requirementId && listDocumentsForRequirement(doc.requirementId).length === 0) {
      updateRequirement(doc.requirementId, { status: 'MISSING' });
    }

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'document.delete', entityType: 'Document', entityId: id, engagementId: doc.engagementId,
      metadata: { title: doc.title },
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
