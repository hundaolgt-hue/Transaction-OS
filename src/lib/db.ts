import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './env';

let _db: Database.Database | null = null;

function schemaSql(): string {
  // Read from source at runtime; copied into the build output via next.config outputFileTracingIncludes.
  const candidates = [
    path.join(process.cwd(), 'src/lib/schema.sql'),
    path.join(process.cwd(), '.next/server/schema.sql'),
    path.join(__dirname, 'schema.sql'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  }
  throw new Error('schema.sql not found');
}

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.mkdirSync(env.uploadDir, { recursive: true });
  const d = new Database(env.dbPath);
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.exec(schemaSql());
  _db = d;
  return d;
}

export function id(prefix = ''): string {
  const raw = crypto.randomBytes(12).toString('base64url');
  return prefix ? `${prefix}_${raw}` : raw;
}

export function now(): string {
  return new Date().toISOString();
}

/** Run a set of writes inside a single transaction. */
export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}

type Row = Record<string, unknown>;

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[];
}

export function one<T = Row>(sql: string, params: unknown[] = []): T | null {
  const r = db().prepare(sql).get(...(params as never[]));
  return (r as T) ?? null;
}

export function run(sql: string, params: unknown[] = []) {
  return db().prepare(sql).run(...(params as never[]));
}

export function count(sql: string, params: unknown[] = []): number {
  const r = one<{ n: number }>(sql, params);
  return r ? Number(r.n) : 0;
}

/** Build an INSERT from an object; undefined values are dropped. */
export function insert(table: string, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => `"${k}"`).join(', ');
  const ph = entries.map(() => '?').join(', ');
  return run(
    `INSERT INTO ${table} (${cols}) VALUES (${ph})`,
    entries.map(([k, v]) => normalise(k, v)),
  );
}

/** Build an UPDATE ... WHERE id = ?; undefined values are dropped. */
export function update(table: string, rowId: string, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k]) => `"${k}" = ?`).join(', ');
  return run(
    `UPDATE ${table} SET ${sets} WHERE id = ?`,
    [...entries.map(([k, v]) => normalise(k, v)), rowId],
  );
}

function normalise(key: string, v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  // An empty string from a cleared form select means "unset" on a reference
  // column, not a foreign key of ''. Text columns keep their empty string.
  if (v === '' && /Id$/.test(key)) return null;
  return v ?? null;
}

export const bool = (v: unknown): boolean => v === 1 || v === true;
