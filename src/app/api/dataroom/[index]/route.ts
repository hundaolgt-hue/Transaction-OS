import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { ABYSSINIA_DATAROOM, COMPANY } from '@/lib/dataroom/abyssinia';
import { dataRoomPdf } from '@/lib/reports/dataRoomPdf';
import { renderPdf } from '@/lib/reports/render';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** The synthetic sample data room as PDFs — for demos and upload testing. `index` is 1-based; `list` returns the catalogue. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ index: string }> }) {
  try {
    await requireStaff();
    const { index } = await params;
    if (index === 'list') {
      return NextResponse.json({ company: COMPANY.name, documents: ABYSSINIA_DATAROOM.map((d, i) => ({ index: i + 1, code: d.code, title: d.title })) });
    }
    const d = ABYSSINIA_DATAROOM[Number(index) - 1];
    if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { bytes } = await renderPdf(dataRoomPdf(d.title, d.body, COMPANY.name));
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${d.code ?? 'OTHER'}_${d.fileName.replace(/\.txt$/, '.pdf')}"` },
    });
  } catch (e) { return apiError(e); }
}
