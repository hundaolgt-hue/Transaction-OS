import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { id } from './db';

/** Text-extractable types we handle without external binaries. */
const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html', 'application/xml', 'text/xml'];

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  extractedText: string;
  pageCount: number | null;
}

export async function storeFile(engagementId: string, fileName: string, mimeType: string, bytes: Buffer): Promise<StoredFile> {
  const dir = path.join(env.uploadDir, engagementId);
  fs.mkdirSync(dir, { recursive: true });
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const key = `${engagementId}/${id('f')}_${safe}`;
  fs.writeFileSync(path.join(env.uploadDir, key), bytes);
  const { text, pages } = await extractText(fileName, mimeType, bytes);
  return { storageKey: key, sizeBytes: bytes.length, extractedText: text, pageCount: pages };
}

export function readFile(storageKey: string): Buffer {
  return fs.readFileSync(path.join(env.uploadDir, storageKey));
}

export function fileExists(storageKey: string): boolean {
  return fs.existsSync(path.join(env.uploadDir, storageKey));
}

export function removeFile(storageKey: string) {
  const p = path.join(env.uploadDir, storageKey);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * Best-effort text extraction. Plain formats are read directly; PDF and DOCX are
 * mined for their embedded text so the agents have something to reason over.
 */
export async function extractText(fileName: string, mimeType: string, bytes: Buffer): Promise<{ text: string; pages: number | null }> {
  const ext = path.extname(fileName).toLowerCase();

  if (TEXT_TYPES.includes(mimeType) || ['.txt', '.md', '.csv', '.json', '.html', '.xml'].includes(ext)) {
    return { text: bytes.toString('utf8').slice(0, 400_000), pages: null };
  }
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return await extractPdf(bytes);
  }
  if (ext === '.docx' || mimeType.includes('officedocument.wordprocessingml')) {
    return { text: await extractDocx(bytes), pages: null };
  }
  return { text: '', pages: null };
}

/**
 * PDF text via pdf.js, which resolves font encodings properly. Lines are
 * rebuilt from glyph positions; wide horizontal gaps become column breaks, so
 * tables survive as pipe rows the extractors can read.
 */
async function extractPdf(bytes: Buffer): Promise<{ text: string; pages: number | null }> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(layoutText(tc.items as { str: string; transform: number[]; width: number }[]));
    }
    return { text: pages.join('\n\n').slice(0, 400_000), pages: doc.numPages };
  } catch {
    return extractPdfFallback(bytes);
  }
}

export function layoutText(items: { str: string; transform: number[]; width: number }[]): string {
  const rows = new Map<number, { x: number; w: number; s: string }[]>();
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] / 2) * 2;
    const r = rows.get(y) ?? [];
    r.push({ x: it.transform[4], w: it.width, s: it.str });
    rows.set(y, r);
  }
  const lines: { cells: string[]; table: boolean }[] = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const r = rows.get(y)!.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let cur = '';
    let end = -1;
    for (const it of r) {
      // Whitespace glyphs are often stretched across a column gap; they carry no position.
      if (!it.s.trim()) { if (cur && !cur.endsWith(' ')) cur += ' '; continue; }
      const gap = end < 0 ? 0 : it.x - end;
      if (end >= 0 && gap > 14) { cells.push(cur.trim()); cur = ''; }
      else if (end >= 0 && gap > 0.8 && !cur.endsWith(' ') && !it.s.startsWith(' ')) cur += ' ';
      cur += it.s;
      end = it.x + it.w;
    }
    cells.push(cur.trim());
    lines.push({ cells: cells.filter(Boolean), table: cells.filter(Boolean).length >= 3 });
  }
  const out: string[] = [];
  let cols = 0; // column count of the table being emitted, 0 when outside one
  let lastRow: string[] | null = null;
  const flushRow = () => { if (lastRow) { out.push(`| ${lastRow.join(' | ')} |`); lastRow = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.table) {
      if (cols && l.cells.length === cols) { flushRow(); lastRow = [...l.cells]; continue; }
      flushRow();
      cols = l.cells.length;
      out.push(`| ${l.cells.join(' | ')} |`, `|${l.cells.map(() => '---').join('|')}|`);
      continue;
    }
    // A short line between two rows of the same table is a wrapped cell.
    const next = lines[i + 1];
    if (cols && lastRow && l.cells.join(' ').length < 48 && next?.table && next.cells.length === cols) {
      lastRow[0] = `${lastRow[0]} ${l.cells.join(' ')}`.trim();
      continue;
    }
    if (cols && lastRow && l.cells.join(' ').length < 48 && l.cells.length === 1 && (!next || !next.table)) {
      // Wrapped cell on the table's last row.
      lastRow[0] = `${lastRow[0]} ${l.cells[0]}`.trim();
      flushRow();
      cols = 0;
      continue;
    }
    flushRow();
    cols = 0;
    out.push(l.cells.join(' '));
  }
  flushRow();
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Legacy fallback: literal text strings in uncompressed or Flate streams. */
function extractPdfFallback(bytes: Buffer): { text: string; pages: number | null } {

  const zlib = require('node:zlib') as typeof import('node:zlib');
  const raw = bytes.toString('latin1');
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length || null;
  const chunks: string[] = [];

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw))) {
    const buf = Buffer.from(m[1], 'latin1');
    let content = '';
    try {
      content = zlib.inflateSync(buf).toString('latin1');
    } catch {
      content = m[1];
    }
    chunks.push(content);
    if (chunks.length > 400) break;
  }

  const text = chunks
    .join('\n')
    // Text-showing operators: (literal) Tj / TJ arrays.
    .replace(/\\(\d{3})/g, (_s, o) => String.fromCharCode(parseInt(o, 8)))
    .match(/\((?:\\.|[^\\)])*\)/g)
    ?.map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
    .join(' ') ?? '';

  return { text: text.replace(/\s+/g, ' ').trim().slice(0, 400_000), pages };
}

/** DOCX is a zip; read word/document.xml out of it without a zip library. */
async function extractDocx(bytes: Buffer): Promise<string> {
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const entries = readZipEntries(bytes);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) return '';
  let xml: string;
  try {
    xml = doc.method === 8 ? zlib.inflateRawSync(doc.data).toString('utf8') : doc.data.toString('utf8');
  } catch {
    return '';
  }
  return xml
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 400_000);
}

interface ZipEntry { name: string; method: number; data: Buffer }

/** Minimal local-file-header zip reader, sufficient for .docx/.xlsx. */
function readZipEntries(buf: Buffer): ZipEntry[] {
  const out: ZipEntry[] = [];
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) {
      i++;
      continue;
    }
    const method = buf.readUInt16LE(i + 8);
    let compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8');
    const dataStart = i + 30 + nameLen + extraLen;
    if (compSize === 0) {
      // Streamed entry: scan forward to the next signature.
      const next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      compSize = (next < 0 ? buf.length : next) - dataStart;
    }
    out.push({ name, method, data: buf.subarray(dataStart, dataStart + compSize) });
    i = dataStart + compSize;
    if (out.length > 200) break;
  }
  return out;
}
