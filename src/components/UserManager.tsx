'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, Avatar, Empty } from '@/components/ui';
import { ROLE_LABEL, ROLES, relTime, type Role } from '@/lib/domain';

export default function UserManager({ users, clients, canManage }: {
  users: { id: string; name: string; email: string; role: string; title: string | null; clientId: string | null; lastLoginAt: string | null; avatarColor: string }[];
  clients: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', email: '', role: 'ANALYST', title: '', password: '', clientId: '' });

  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, clientId: f.role === 'CLIENT' ? f.clientId : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create the user');
      setDone(`Account created for ${f.email}. Share the password securely.`);
      setAdding(false);
      setF({ name: '', email: '', role: 'ANALYST', title: '', password: '', clientId: '' });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unexpected error'); }
    finally { setBusy(false); }
  }

  return (
    <Panel>
      <PanelHead title="People" sub={`${users.length} account${users.length === 1 ? '' : 's'}`}
        actions={canManage ? <button className="btn btn-sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'Add person'}</button> : undefined} />

      {done ? <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--good)', background: 'var(--good-soft)', borderBottom: '1px solid var(--hairline)' }}>{done}</div> : null}

      {adding ? (
        <form onSubmit={submit} className="panel-body" style={{ display: 'grid', gap: 12, borderBottom: '1px solid var(--hairline)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px,100%), 1fr))' }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Role</label>
            <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r as Role]}</option>)}
            </select>
          </div>
          {f.role === 'CLIENT' ? (
            <div className="field">
              <label className="label">Client company</label>
              <select className="select" required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
                <option value="">Choose…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="field">
              <label className="label">Title</label>
              <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </div>
          )}
          <div className="field">
            <label className="label">Initial password</label>
            <input className="input" type="text" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {error ? <div style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 8 }}>{error}</div> : null}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
      ) : null}

      {users.length === 0 ? <Empty title="No people yet" /> : (
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Person</th><th>Role</th><th>Attached to</th><th>Last sign-in</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <Avatar name={u.name} color={u.avatarColor} size={26} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{u.email}{u.title ? ` · ${u.title}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td><Chip tone={u.role === 'OWNER' ? 'good' : u.role === 'CLIENT' ? 'info' : 'neutral'}>{ROLE_LABEL[u.role as Role] ?? u.role}</Chip></td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{u.clientId ? clientName.get(u.clientId) ?? '—' : 'The firm'}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{u.lastLoginAt ? relTime(u.lastLoginAt) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
