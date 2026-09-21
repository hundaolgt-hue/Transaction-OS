'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead, Chip, StatusChip, Empty } from '@/components/ui';
import { renderMarkdown } from '@/lib/markdown';
import { fmtDateTime, fmtDate, titleCase, AGENT_META, type AgentKey } from '@/lib/domain';
import type { Meeting, Task } from '@/lib/types';

export default function MeetingsTasks({ engagementId, meetings, tasks, staff }: {
  engagementId: string; meetings: Meeting[]; tasks: Task[]; staff: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMeeting, setOpenMeeting] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [newMeeting, setNewMeeting] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [mForm, setMForm] = useState({ title: '', scheduledAt: '', durationMin: 60, location: '', agenda: '' });
  const [tForm, setTForm] = useState({ title: '', detail: '', assigneeId: '', dueDate: '', priority: 'NORMAL' });

  const staffById = new Map(staff.map((s) => [s.id, s.name]));

  async function call(path: string, method: string, body: unknown, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');
      router.refresh();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      return null;
    } finally { setBusy(null); }
  }

  async function runSecretary(meetingId: string) {
    setBusy(meetingId);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/agents`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: 'SECRETARY', payload: { meetingId } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'The Secretary Agent failed');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'The Secretary Agent failed'); }
    finally { setBusy(null); }
  }

  const openTasks = tasks.filter((t) => t.status !== 'DONE');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', alignItems: 'start' }}>
      {error ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: 'var(--critical)', padding: '9px 12px', background: 'var(--critical-soft)', borderRadius: 'var(--radius-md)' }}>{error}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 16 }}>
        <Panel>
          <PanelHead title="Meetings" sub={`${meetings.length} recorded`}
            actions={<button className="btn btn-sm" onClick={() => setNewMeeting((v) => !v)}>{newMeeting ? 'Cancel' : 'Schedule'}</button>} />
          {newMeeting ? (
            <form className="panel-body" style={{ display: 'grid', gap: 11, borderBottom: '1px solid var(--hairline)' }}
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await call(`/api/engagements/${engagementId}/meetings`, 'POST', {
                  ...mForm, durationMin: Number(mForm.durationMin),
                  scheduledAt: new Date(mForm.scheduledAt).toISOString(), attendees: [],
                }, 'new-meeting');
                if (ok) { setNewMeeting(false); setMForm({ title: '', scheduledAt: '', durationMin: 60, location: '', agenda: '' }); }
              }}>
              <div className="field">
                <label className="label">Title</label>
                <input className="input" required value={mForm.title} onChange={(e) => setMForm({ ...mForm, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <div className="field">
                  <label className="label">When</label>
                  <input className="input" type="datetime-local" required value={mForm.scheduledAt} onChange={(e) => setMForm({ ...mForm, scheduledAt: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label">Minutes long</label>
                  <input className="input" type="number" min="5" value={mForm.durationMin} onChange={(e) => setMForm({ ...mForm, durationMin: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label">Location</label>
                  <input className="input" value={mForm.location} onChange={(e) => setMForm({ ...mForm, location: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label className="label">Agenda</label>
                <textarea className="textarea" style={{ minHeight: 70 }} value={mForm.agenda} onChange={(e) => setMForm({ ...mForm, agenda: e.target.value })} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy === 'new-meeting'}>Schedule meeting</button>
            </form>
          ) : null}

          {meetings.length === 0 ? <Empty title="No meetings" body="Schedule one, then let the Secretary Agent turn the notes into minutes and action items." /> : (
            <div>
              {meetings.map((m, i) => {
                const isOpen = openMeeting === m.id;
                const actions = safeArray(m.actionItems);
                return (
                  <div key={m.id} style={{ borderBottom: i === meetings.length - 1 ? 'none' : '1px solid var(--hairline)' }}>
                    <button onClick={() => { setOpenMeeting(isOpen ? null : m.id); setMinutes(m.minutes ?? ''); }}
                      aria-expanded={isOpen}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '11px 16px', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                        {m.distributed ? <Chip tone="good" dot>Minutes circulated</Chip> : <Chip tone="medium" dot>Not circulated</Chip>}
                        {actions.length ? <Chip tone="neutral">{actions.length} actions</Chip> : null}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                        {fmtDateTime(m.scheduledAt)} · {m.durationMin} min{m.location ? ` · ${m.location}` : ''}
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="fade-up" style={{ padding: '0 16px 14px', display: 'grid', gap: 11 }}>
                        {m.agenda ? (
                          <div><div className="eyebrow" style={{ marginBottom: 4 }}>Agenda</div>
                            <div className="prose" style={{ fontSize: 12.5 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.agenda) }} /></div>
                        ) : null}
                        <div className="field">
                          <label className="label">Notes / minutes</label>
                          <textarea className="textarea" value={minutes} onChange={(e) => setMinutes(e.target.value)}
                            placeholder="Paste the raw notes here; the Secretary Agent will clean them up and extract the action items." />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm" disabled={busy === m.id}
                            onClick={() => call(`/api/engagements/${engagementId}/meetings`, 'PATCH', { meetingId: m.id, minutes }, m.id)}>
                            Save notes
                          </button>
                          <button className="btn btn-sm btn-primary" disabled={busy === m.id} onClick={() => runSecretary(m.id)}>
                            {busy === m.id ? 'Running…' : 'Run Secretary Agent'}
                          </button>
                        </div>
                        {m.decisions ? (
                          <div><div className="eyebrow" style={{ marginBottom: 4 }}>Decisions</div>
                            <div className="prose" style={{ fontSize: 12.5 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.decisions) }} /></div>
                        ) : null}
                        {actions.length ? (
                          <div><div className="eyebrow" style={{ marginBottom: 4 }}>Action items</div>
                            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.7 }}>
                              {actions.map((a, j) => <li key={j}>{a.title}{a.owner ? ` — ${a.owner}` : ''}{a.due ? ` (due ${fmtDate(a.due)})` : ''}</li>)}
                            </ul></div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Tasks" sub={`${openTasks.length} open · ${doneTasks.length} done`}
          actions={<button className="btn btn-sm" onClick={() => setNewTask((v) => !v)}>{newTask ? 'Cancel' : 'New task'}</button>} />
        {newTask ? (
          <form className="panel-body" style={{ display: 'grid', gap: 11, borderBottom: '1px solid var(--hairline)' }}
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await call(`/api/engagements/${engagementId}/tasks`, 'POST', {
                ...tForm, assigneeId: tForm.assigneeId || null, dueDate: tForm.dueDate || null,
              }, 'new-task');
              if (ok) { setNewTask(false); setTForm({ title: '', detail: '', assigneeId: '', dueDate: '', priority: 'NORMAL' }); }
            }}>
            <div className="field">
              <label className="label">Title</label>
              <input className="input" required value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div className="field">
                <label className="label">Assignee</label>
                <select className="select" value={tForm.assigneeId} onChange={(e) => setTForm({ ...tForm, assigneeId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Due</label>
                <input className="input" type="date" value={tForm.dueDate} onChange={(e) => setTForm({ ...tForm, dueDate: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Priority</label>
                <select className="select" value={tForm.priority} onChange={(e) => setTForm({ ...tForm, priority: e.target.value })}>
                  {['URGENT', 'HIGH', 'NORMAL', 'LOW'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy === 'new-task'}>Add task</button>
          </form>
        ) : null}

        {tasks.length === 0 ? <Empty title="No tasks" body="The Project Management and Secretary agents create tasks automatically; you can add your own too." /> : (
          <div>
            {[...openTasks, ...doneTasks].map((t, i) => {
              const overdue = t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date();
              return (
                <div key={t.id} style={{ padding: '10px 16px', borderBottom: i === tasks.length - 1 ? 'none' : '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={t.status === 'DONE'} disabled={busy === t.id}
                    style={{ marginTop: 3, flex: 'none' }}
                    aria-label={`Mark "${t.title}" done`}
                    onChange={(e) => call(`/api/tasks/${t.id}`, 'PATCH', { status: e.target.checked ? 'DONE' : 'TODO' }, t.id)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textDecoration: t.status === 'DONE' ? 'line-through' : 'none', color: t.status === 'DONE' ? 'var(--ink-faint)' : 'var(--ink)' }}>
                      {t.title}
                    </div>
                    {t.detail ? <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div> : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip tone={t.priority === 'URGENT' ? 'critical' : t.priority === 'HIGH' ? 'high' : 'neutral'}>{titleCase(t.priority)}</Chip>
                      {t.agentOwner ? <Chip tone="info">{AGENT_META[t.agentOwner as AgentKey]?.short ?? t.agentOwner} agent</Chip> : null}
                      {t.assigneeId ? <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{staffById.get(t.assigneeId) ?? '—'}</span> : null}
                      {t.dueDate ? <span style={{ fontSize: 11, color: overdue ? 'var(--critical)' : 'var(--ink-faint)' }}>{overdue ? 'Overdue ' : 'Due '}{fmtDate(t.dueDate)}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function safeArray(s: string): { title: string; owner?: string; due?: string }[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
