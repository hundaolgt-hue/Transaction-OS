/**
 * Structure extraction from document text: key/value lines, pipe tables and
 * financial statement lines. Deterministic and forgiving — it reads the house
 * data-room format exactly and degrades gracefully on anything else.
 */

export interface Table { title: string | null; header: string[]; rows: string[][] }

/** "1,234", "-1,234", "(1,234)", "12.5%", "1.25x" → number; anything else → null. */
export function num(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const m = s.replace(/[(),\s]/g, '').replace(/^-/, '').match(/^([0-9]*\.?[0-9]+)(%|x)?$/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

export function parseTables(text: string): Table[] {
  const lines = (text ?? '').split(/\r?\n/);
  const out: Table[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const next = (lines[i + 1] ?? '').trim();
    if (!l.startsWith('|') || !/^\|[\s:|-]+\|?$/.test(next)) continue;
    const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    let title: string | null = null;
    for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
      const t = lines[k].trim();
      if (t) { title = t; break; }
    }
    const header = cells(l);
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) rows.push(cells(lines[j++]));
    out.push({ title, header, rows });
    i = j - 1;
  }
  return out;
}

/** "Key: Value" lines, keys normalised to lower case. */
export function keyValues(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of (text ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9 '’()/.,-]{1,60}):\s+(.+)$/);
    if (match && !line.trim().startsWith('|')) m.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return m;
}

export const kv = (text: string, ...keys: string[]): string | null => {
  const m = keyValues(text);
  for (const k of keys) {
    const v = m.get(k.toLowerCase());
    if (v) return v;
  }
  return null;
};

export interface Statement { years: string[]; lines: Map<string, number[]> }

/** Every numeric table in the text whose header carries year columns, merged. */
export function parseStatements(text: string): Statement | null {
  const years: string[] = [];
  const lines = new Map<string, number[]>();
  for (const t of parseTables(text)) {
    const yearCols = t.header.slice(1).filter((h) => /(FY)?(19|20)\d{2}/.test(h));
    if (yearCols.length < 2 || yearCols.length !== t.header.length - 1) continue;
    if (!years.length) years.push(...yearCols);
    if (yearCols.join() !== years.join()) continue;
    for (const r of t.rows) {
      const vals = r.slice(1).map(num);
      if (vals.every((v) => v !== null)) lines.set(r[0].toLowerCase(), vals as number[]);
    }
  }
  return years.length ? { years, lines } : null;
}

export function line(stmt: Statement | null, ...patterns: (string | RegExp)[]): number[] | null {
  if (!stmt) return null;
  for (const p of patterns) {
    for (const [label, vals] of stmt.lines) {
      if (typeof p === 'string' ? label === p.toLowerCase() || label.startsWith(p.toLowerCase()) : p.test(label)) return vals;
    }
  }
  return null;
}

/** First sentence-ish fragment of text that matches, for quoting. */
export function sentenceWith(text: string, re: RegExp): string | null {
  const flat = (text ?? '').replace(/\s+/g, ' ');
  const m = flat.match(new RegExp(`[^.]*${re.source}[^.]*\\.`, re.flags.replace('g', '')));
  return m ? m[0].trim() : null;
}

/** Body text without the synthetic banner, the title and the key/value header. */
export function bodyParagraphs(text: string): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('SYNTHETIC') && !p.startsWith('|') && !/^[A-Z0-9 ,.'’()–—-]{12,}$/.test(p) && !/^([A-Za-z][^:\n]{1,60}: .+\n?)+$/.test(p));
}
