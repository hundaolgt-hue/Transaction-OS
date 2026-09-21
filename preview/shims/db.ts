/**
 * Browser implementation of src/lib/db.ts on top of sql.js, so the real
 * repository layer, scoring engine and agents run unmodified in the page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlDb = any;

let _db: SqlDb | null = null;
let _listeners: (() => void)[] = [];

export function attach(database: SqlDb) {
  _db = database;
  _db.exec('PRAGMA foreign_keys = ON;');
}

export function onWrite(fn: () => void) { _listeners.push(fn); }

export function db(): SqlDb {
  if (!_db) throw new Error('Database not attached');
  return _db;
}

export function id(prefix = ''): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return prefix ? `${prefix}_${raw}` : raw;
}

export function now(): string { return new Date().toISOString(); }

let depth = 0;
export function tx<T>(fn: () => T): T {
  const outer = depth === 0;
  if (outer) db().exec('BEGIN');
  depth++;
  try {
    const r = fn();
    depth--;
    if (outer) db().exec('COMMIT');
    return r;
  } catch (e) {
    depth--;
    if (outer) db().exec('ROLLBACK');
    throw e;
  }
}

type Row = Record<string, unknown>;

function bind(params: unknown[]) {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  const stmt = db().prepare(sql);
  try {
    stmt.bind(bind(params));
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as T);
    return out;
  } finally { stmt.free(); }
}

export function one<T = Row>(sql: string, params: unknown[] = []): T | null {
  return all<T>(sql, params)[0] ?? null;
}

export function run(sql: string, params: unknown[] = []) {
  db().run(sql, bind(params));
  const changes = db().getRowsModified();
  _listeners.forEach((l) => l());
  return { changes };
}

export function count(sql: string, params: unknown[] = []): number {
  const r = one<{ n: number }>(sql, params);
  return r ? Number(r.n) : 0;
}

function normalise(key: string, v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v === '' && /Id$/.test(key)) return null;
  return v ?? null;
}

export function insert(table: string, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => `"${k}"`).join(', ');
  const ph = entries.map(() => '?').join(', ');
  return run(`INSERT INTO ${table} (${cols}) VALUES (${ph})`, entries.map(([k, v]) => normalise(k, v)));
}

export function update(table: string, rowId: string, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k]) => `"${k}" = ?`).join(', ');
  return run(`UPDATE ${table} SET ${sets} WHERE id = ?`, [...entries.map(([k, v]) => normalise(k, v)), rowId]);
}

export const bool = (v: unknown): boolean => v === 1 || v === true;
