import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import {
  getEngagement, listDocuments, createDocument, listRequirements,
  updateRequirement, getRequirement, audit, snapshot,
} from '@/lib/repo/core';
import { storeFile } from '@/lib/documents';
import { getRulePack } from '@/lib/rulepacks';
import { suggestRequirement } from '@/lib/agents/ruleEngine';
import { notify, audienceFor } from '@/lib/notify';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_BYTES = 30 * 1024 * 1024;

async function assertAccess(orgId: string, engagementId: string, session: { role: string; clientId: string | null }) {
  const eng = getEngagement(orgId, engagementId);
  if (!eng) return null;
  if (session.role === 'CLIENT' && eng.clientId !== session.clientId) return null;
  return eng;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const eng = await assertAccess(session.orgId, id, session);
    if (!eng) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    return NextResponse.json({ documents: listDocuments(id), requirements: listRequirements(id) });
  } catch (e) { return apiError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const eng = await assertAccess(session.orgId, id, session);
    if (!eng) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file was supplied.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files are limited to 30 MB.' }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const title = String(form.get('title') || file.name);
    let requirementId = String(form.get('requirementId') || '') || null;

    const stored = await storeFile(id, file.name, file.type || 'application/octet-stream', bytes);

    // Auto-file against the checklist when the uploader did not choose.
    const requirements = listRequirements(id);
    if (!requirementId) {
      const pack = getRulePack(eng.rulePackKey);
      const guess = suggestRequirement(file.name, title, stored.extractedText, pack);
      if (guess) requirementId = requirements.find((r) => r.code === guess.code)?.id ?? null;
    }
    if (requirementId && !requirements.some((r) => r.id === requirementId)) requirementId = null;

    const priorVersions = requirementId
      ? listDocuments(id).filter((d) => d.requirementId === requirementId)
      : [];

    const doc = createDocument({
      engagementId: id,
      requirementId,
      title,
      fileName: file.name,
      storageKey: stored.storageKey,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: stored.sizeBytes,
      version: priorVersions.length + 1,
      supersedesId: priorVersions[0]?.id ?? null,
      extractedText: stored.extractedText,
      pageCount: stored.pageCount,
      status: 'SUBMITTED',
      reviewNote: null,
      uploadedById: session.userId,
      uploadedByRole: session.role,
    });

    if (requirementId) {
      const req = getRequirement(requirementId);
      if (req && !['ACCEPTED', 'WAIVED'].includes(req.status)) {
        updateRequirement(requirementId, { status: 'SUBMITTED' });
      }
    }

    audit({
      orgId: session.orgId, actorId: session.userId, actorName: session.name,
      action: 'document.upload', entityType: 'Document', entityId: doc.id, engagementId: id,
      metadata: { title, requirementId, bytes: stored.sizeBytes, extracted: stored.extractedText.length },
    });

    const snap = snapshot(session.orgId, id);
    const matched = requirementId ? requirements.find((r) => r.id === requirementId) : null;

    await notify({
      userIds: audienceFor(id),
      engagementId: id, kind: 'INFO',
      title: `Document uploaded — ${eng.reference}`,
      body: `${session.name} uploaded "${title}"${matched ? ` against ${matched.code} — ${matched.title}` : ' (unfiled — needs to be matched to a requirement)'}. Completeness is now ${snap?.completeness.percent ?? 0}%.`,
      link: `/engagements/${id}/documents`,
    });

    // Threshold alert once the engagement crosses its configured gate.
    if (snap && snap.completeness.percent >= eng.documentThreshold) {
      await notify({
        userIds: audienceFor(id),
        engagementId: id, kind: 'THRESHOLD', severity: 'INFO',
        title: `${eng.reference} reached its document threshold`,
        body: `Completeness is ${snap.completeness.percent}% against a ${eng.documentThreshold}% threshold. Due diligence can proceed.`,
        link: `/engagements/${id}`, email: true,
      });
    }

    return NextResponse.json({
      document: { ...doc, extractedText: undefined },
      matchedRequirement: matched ? { id: matched.id, code: matched.code, title: matched.title } : null,
      extractedChars: stored.extractedText.length,
      completeness: snap?.completeness.percent ?? 0,
    }, { status: 201 });
  } catch (e) { return apiError(e); }
}
