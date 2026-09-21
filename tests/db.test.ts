import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Point the data layer at a scratch directory before anything imports it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-os-test-'));
process.env.DATA_DIR = tmp;

const { db, insert, update, all, one, id, tx } = await import('../src/lib/db');

describe('the data layer', () => {
  beforeAll(() => { db(); });
  afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('creates the schema on first use', () => {
    const tables = all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables.map((t) => t.name);
    for (const t of ['orgs', 'users', 'clients', 'engagements', 'requirements', 'documents', 'findings', 'risks']) {
      expect(names, `missing table ${t}`).toContain(t);
    }
  });

  it('round-trips an insert and an update, coercing booleans to integers', () => {
    const orgId = id('org');
    insert('orgs', { id: orgId, name: 'Test Firm', city: 'Addis Ababa', country: 'Ethiopia', createdAt: new Date().toISOString() });
    insert('users', {
      id: 'u1', orgId, email: 'a@b.et', name: 'A', passwordHash: 'x',
      role: 'OWNER', active: true, createdAt: new Date().toISOString(),
    });
    expect(one<{ active: number }>('SELECT active FROM users WHERE id = ?', ['u1'])?.active).toBe(1);
    update('users', 'u1', { active: false, title: 'Partner' });
    const u = one<{ active: number; title: string }>('SELECT active, title FROM users WHERE id = ?', ['u1']);
    expect(u?.active).toBe(0);
    expect(u?.title).toBe('Partner');
  });

  it('ignores undefined fields rather than nulling them', () => {
    update('users', 'u1', { title: undefined });
    expect(one<{ title: string }>('SELECT title FROM users WHERE id = ?', ['u1'])?.title).toBe('Partner');
  });

  it('enforces foreign keys', () => {
    expect(() => insert('users', {
      id: 'u2', orgId: 'does-not-exist', email: 'c@d.et', name: 'C',
      passwordHash: 'x', role: 'ANALYST', createdAt: new Date().toISOString(),
    })).toThrow();
  });

  it('rolls a failed transaction back completely', () => {
    const before = all('SELECT id FROM users').length;
    expect(() => tx(() => {
      insert('users', { id: 'u3', orgId: all<{ id: string }>('SELECT id FROM orgs')[0].id, email: 'e@f.et', name: 'E', passwordHash: 'x', role: 'ANALYST', createdAt: new Date().toISOString() });
      throw new Error('boom');
    })).toThrow('boom');
    expect(all('SELECT id FROM users')).toHaveLength(before);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => id('x')));
    expect(ids.size).toBe(2000);
  });
});

describe('empty-string handling', () => {
  it('treats an empty string on a reference column as null, so a cleared form select cannot break a foreign key', () => {
    update('users', 'u1', { clientId: '' });
    expect(one<{ clientId: string | null }>('SELECT clientId FROM users WHERE id = ?', ['u1'])?.clientId).toBeNull();
  });

  it('leaves an empty string alone on an ordinary text column', () => {
    update('users', 'u1', { title: '' });
    expect(one<{ title: string | null }>('SELECT title FROM users WHERE id = ?', ['u1'])?.title).toBe('');
  });
});
