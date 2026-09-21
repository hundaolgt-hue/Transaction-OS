'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Empty, Avatar } from '@/components/ui';
import { relTime } from '@/lib/domain';

export default function ClientPortalUsers({ clientId, clientName, users, canManage, defaultEmail, defaultName }: {
  clientId: string; clientName: string;
  users: { id: string; name: string; email: string; lastLoginAt: string | null }[];
  canManage: boolean; defaultEmail: string; defaultName: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({ name: defaultName, email: defaultEmail, title: '', password: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, role: 'CLIENT', clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create the login');
      setDone(`Portal login created for ${f.email}. Share the password securely — they should change it on first use.`);
      setAdding(false);
      setF({ name: '', email: '', title: '', password: '' });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unexpected error'); }
    finally { setBusy(false); }
  }

  return (
    <Panel>
      <PanelHead title="Client portal access" sub={`Logins for ${clientName}`}
        actions={canManage ? <button className="btn btn-sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'Add login'}</button> : undefined} />

      {done ? <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--good)', background: 'var(--good-soft)', borderBottom: '1px solid var(--hairline)', lineHeight: 1.5 }}>{done}</div> : null}

      {adding ? (
        <form onSubmit={submit} className="panel-body" style={{ display: 'grid', gap: 11, borderBottom: '1px solid var(--hairline)' }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Role at the company</label>
            <input className="input" placeholder="e.g. Chief Finance Officer" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Initial password</label>
            <input className="input" type="text" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <span className="hint">At least 8 characters. Share it through a channel other than email.</span>
          </div>
          {error ? <div style={{ fontSize: 12.5, color: 'var(--critical)' }}>{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create portal login'}</button>
        </form>
      ) : null}

      {users.length === 0 ? (
        <Empty title="No portal access yet"
          body="A portal login lets the client see progress, upload documents and see what is still missing — without seeing internal findings." />
      ) : (
        <div>
          {users.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: i === users.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
              <Avatar name={u.name} color="var(--accent)" size={28} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{u.email}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', flex: 'none' }}>
                {u.lastLoginAt ? `Last in ${relTime(u.lastLoginAt)}` : 'Never signed in'}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
