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
    return extractPdf(bytes);
  }
  if (ext === '.docx' || mimeType.includes('officedocument.wordprocessingml')) {
    return { text: await extractDocx(bytes), pages: null };
  }
  return { text: '', pages: null };
}

/** Pull uncompressed and Flate-compressed text streams out of a PDF. */
function extractPdf(bytes: Buffer): { text: string; pages: number | null } {
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
