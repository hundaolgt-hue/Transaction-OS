/* Advisor OS — in-browser preview. Runs the production repository layer,
   scoring engine, rule packs and agents (rule-engine mode) against the seeded
   database via sql.js. */
(function () {
  const { repo, progress, domain, RULE_PACKS, getRulePack, runAgent, suggestRequirement, renderMarkdown, notify } = AOS;
  const D = domain;
  const STORE_KEY = 'advisoros-preview-db-v1';
  let SQLDB, ORG, STAFF, CLIENT_USER, role = 'staff', sideOpen = false, busy = null;

  // ---------------------------------------------------------------- helpers
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TONE = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'info' };
  const STATUS = {
    ACCEPTED: 'good', WAIVED: 'good', APPROVED: 'good', RESOLVED: 'good', PAID: 'good', COMPLETED: 'good', SUCCEEDED: 'good', SIGNED: 'good', DONE: 'good', ACTIVE: 'good', DRAFTED: 'good',
    SUBMITTED: 'low', UNDER_REVIEW: 'low', IN_REVIEW: 'low', DOING: 'low', INVOICED: 'low', REQUESTED: 'low', ACKNOWLEDGED: 'low', DRAFTING: 'low', IN_PROGRESS: 'low',
    MISSING: 'high', REJECTED: 'critical', FAILED: 'critical', BLOCKED: 'critical', OPEN: 'high', IN_REMEDIATION: 'medium', MITIGATING: 'medium',
  };
  const tc = D.titleCase;
  const chip = (text, tone = '', dot = false) => `<span class="chip ${tone ? 't-' + tone : ''} ${dot ? 'dot' : ''}">${esc(text)}</span>`;
  const st = (s) => chip(tc(s), STATUS[s] || '', true);
  const sev = (s) => chip(tc(s), TONE[s] || '', true);
  const meter = (v, label) => {
    const p = Math.max(0, Math.min(100, Math.round(v)));
    const cls = p >= 75 ? '' : p >= 40 ? 'warn' : 'bad';
    return `<div>${label !== false ? `<div class="row" style="justify-content:space-between;margin-bottom:5px"><span class="small muted">${esc(label || '')}</span><span class="mono" style="font-weight:600">${p}%</span></div>` : ''}<div class="meter ${cls}"><i style="width:${p}%"></i></div></div>`;
  };
  const toneColor = (t) => (t ? `var(--${t})` : 'var(--ink)');
  const stat = (label, value, sub, tone) => `<div class="panel stat"><div class="eyebrow">${esc(label)}</div><div class="v" style="color:${toneColor(tone)}">${esc(value)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
  const empty = (t, b) => `<div class="empty"><b>${esc(t)}</b>${b ? `<span>${esc(b)}</span>` : ''}</div>`;
  const panel = (title, sub, body, actions = '') => `<section class="panel"><div class="ph"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>${body}</section>`;
  const healthColor = (h) => (h.tone === 'good' ? 'var(--good)' : h.tone === 'watch' ? 'var(--high)' : 'var(--critical)');
  const pct = (n) => `${n}%`;
  const stageLabel = (s) => D.STAGE_META[s]?.label ?? tc(s);
  const txLabel = (t) => D.TRANSACTION_LABEL[t] ?? t;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ------------------------------------------------------------ persistence
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const bytes = SQLDB.export();
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        localStorage.setItem(STORE_KEY, btoa(bin));
      } catch { /* storage full or blocked — the session still works in memory */ }
    }, 400);
  }
  function loadSaved() {
    try {
      const b64 = localStorage.getItem(STORE_KEY);
      if (!b64) return null;
      const bin = atob(b64); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    } catch { return null; }
  }
  function seedBytes() {
    const bin = atob(document.getElementById('seed-db').textContent.trim());
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  // ----------------------------------------------------------------- router
  const route = () => (location.hash.slice(1) || '/dashboard').split('/').filter(Boolean);
  const go = (h) => { location.hash = h; };
  window.addEventListener('hashchange', () => { sideOpen = false; render(); window.scrollTo(0, 0); });

  // ----------------------------------------------------------------- shells
  const ICON = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.9"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  };
  const icon = (n) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const mark = `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M9 22V10h5.2c2.6 0 4.3 1.5 4.3 3.8 0 1.7-.9 2.9-2.4 3.4L23 22h-3.4l-3.4-4.4h-2V22H9Zm5-6.8c1.2 0 1.9-.6 1.9-1.6s-.7-1.5-1.9-1.5h-1.8v3.1H14Z" fill="var(--accent-ink)"/></svg>`;

  function banner() {
    return `<div class="banner"><span><b>Interactive preview.</b> The production engine running in your browser — rule packs, scoring and agents in rule-engine mode. Changes stay in this browser.</span>
      <span class="row" style="margin-left:auto">
        <label class="small muted" for="role-switch">Viewing as</label>
        <select id="role-switch" class="select btn sm" style="height:26px;padding:0 8px">
          <option value="staff" ${role === 'staff' ? 'selected' : ''}>Hundaol Girma — Managing Partner</option>
          <option value="client" ${role === 'client' ? 'selected' : ''}>Tigist Alemu — Client (Abyssinia Agro)</option>
        </select>
        <button class="btn sm" data-act="reset">Reset demo</button>
      </span></div>`;
  }

  function staffShell(path, body) {
    const engs = repo.listEngagements(ORG.id);
    const clients = new Map(repo.listClients(ORG.id).map((c) => [c.id, c.name]));
    const unread = notify.unreadCount(STAFF.id);
    const nav = [['dashboard', 'Dashboard', 'grid'], ['engagements', 'Engagements', 'folder'], ['clients', 'Clients', 'users'], ['agents', 'Agents', 'cpu'], ['rules', 'Rule packs', 'book'], ['audit', 'Audit trail', 'shield']];
    return `<div class="root">
      <aside class="side" data-open="${sideOpen}">
        <div class="brand">${mark}<div><b>${esc(ORG.name)}</b><small>Advisor OS</small></div></div>
        <nav class="nav">${nav.map(([k, l, i]) => `<a href="#/${k}" ${path[0] === k || (k === 'engagements' && path[0] === 'e') ? 'aria-current="page"' : ''}>${icon(i)}${l}</a>`).join('')}</nav>
        <div class="side-eng"><div class="eyebrow" style="padding:8px 9px 6px">Active engagements</div>
          ${engs.map((e) => `<a href="#/e/${e.id}" ${path[1] === e.id ? 'aria-current="page"' : ''}><div class="mono xs" style="color:${path[1] === e.id ? 'var(--accent)' : 'var(--ink-faint)'}">${esc(e.reference)}</div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(clients.get(e.clientId))}</div></a>`).join('')}
        </div>
        <div style="padding:10px;border-top:1px solid var(--hairline);display:flex;gap:8px;align-items:center">
          <span style="width:26px;height:26px;border-radius:99px;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">HG</span>
          <div><div class="small" style="font-weight:500">${esc(STAFF.name)}</div><div class="xs faint">Managing Partner</div></div>
        </div>
      </aside>
      <button class="scrim" data-open="${sideOpen}" data-act="close-side" aria-label="Close navigation"></button>
      <div class="main">
        ${banner()}
        <header class="top"><button class="btn ghost sm menu-btn" data-act="toggle-side" aria-label="Open navigation">${icon('menu')}</button>
          <div style="flex:1"></div>
          <span class="small muted">${unread} unread notification${unread === 1 ? '' : 's'}</span>
          <button class="btn sm" data-act="mark-read" ${unread ? '' : 'disabled'}>Mark read</button>
        </header>
        <main class="content">${body}</main>
      </div></div>`;
  }

  // ---------------------------------------------------------------- views
  function dashboard() {
    const snaps = repo.listEngagements(ORG.id).map((e) => repo.snapshot(ORG.id, e.id)).filter(Boolean);
    const active = snaps.filter((s) => s.engagement.status === 'ACTIVE');
    const open = snaps.reduce((a, s) => a + s.compliance.open, 0);
    const crit = snaps.reduce((a, s) => a + s.compliance.critical, 0);
    const avg = active.length ? Math.round(active.reduce((a, s) => a + s.completeness.percent, 0) / active.length) : 0;
    const attention = snaps.flatMap((s) => [
      ...s.gate.blockers.map((b) => ({ s, k: 'Stage gate', t: b, tone: 'high' })),
      ...s.milestones.filter((m) => m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < new Date()).map((m) => ({ s, k: 'Overdue milestone', t: `${m.name} was due ${D.fmtDate(m.dueDate)}`, tone: 'high' })),
    ]).slice(0, 8);
    const audit = repo.listAudit(ORG.id, { limit: 10 });

    return `<div class="stack">
      <header><div class="eyebrow">Practice overview</div><h1 class="h1">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, Hundaol</h1>
      <p class="sub">${active.length} active engagements across ${repo.listClients(ORG.id).length} clients.</p></header>
      <div class="stats">
        ${stat('Active engagements', active.length)}
        ${stat('Pipeline value', D.fmtMoney(active.reduce((a, s) => a + (s.engagement.targetRaise || 0), 0)), 'Target raise across active mandates')}
        ${stat('Avg. document completeness', pct(avg), 'Weighted against the ECMA checklist', avg >= 75 ? 'good' : avg >= 40 ? 'medium' : 'high')}
        ${stat('Open findings', open, `${crit} critical`, crit ? 'critical' : 'medium')}
        ${stat('Fees outstanding', D.fmtMoney(snaps.reduce((a, s) => a + s.fees.outstanding, 0)), 'Invoiced, not yet received')}
      </div>
      <div class="cols">
        ${panel('Engagements', 'Health across the active book', `<div class="tw"><table style="min-width:540px"><thead><tr><th>Engagement</th><th>Stage</th><th style="width:130px">Documents</th><th class="num">Findings</th><th class="num">Health</th></tr></thead><tbody>
          ${active.map((s) => `<tr><td><a href="#/e/${s.engagement.id}"><div style="font-weight:500">${esc(s.client.name)}</div><div class="mono faint" style="white-space:nowrap">${esc(s.engagement.reference)} · ${esc(txLabel(s.engagement.transactionType))}</div></a></td>
            <td style="white-space:nowrap">${chip(stageLabel(s.engagement.stage))}</td><td>${meter(s.completeness.percent)}</td>
            <td class="num">${s.compliance.open ? chip(s.compliance.open, s.compliance.critical ? 'critical' : 'high') : chip('Clear', 'good')}</td>
            <td class="num" style="font-weight:600;color:${healthColor(s.health)}">${s.health.score}</td></tr>`).join('')}
          </tbody></table></div>`, `<a class="btn sm" href="#/engagements">View all</a>`)}
        ${panel('Needs attention', 'Blockers and overdue items', attention.length ? `<div class="list">${attention.map((a) => `<a href="#/e/${a.s.engagement.id}" style="display:block"><div class="row" style="margin-bottom:3px">${chip(a.k, a.tone, true)}<span class="mono faint">${esc(a.s.engagement.reference)}</span></div><div class="small muted">${esc(a.t)}</div></a>`).join('')}</div>` : empty('Nothing blocked'))}
      </div>
      ${panel('Recent activity', '', `<div class="list">${audit.map((a) => `<div><span style="font-weight:600">${esc(a.actorName)}</span> <span class="muted">${esc(a.action.replace('.', ' · '))}</span> <span class="xs faint">${D.relTime(a.createdAt)}</span></div>`).join('')}</div>`, `<a class="btn sm" href="#/audit">Full trail</a>`)}
    </div>`;
  }

  function engagementsList() {
    const snaps = repo.listEngagements(ORG.id).map((e) => repo.snapshot(ORG.id, e.id)).filter(Boolean);
    return `<div class="stack"><header><div class="eyebrow">Mandates</div><h1 class="h1">Engagements</h1></header>
      ${panel('All engagements', `${snaps.length} on the book`, `<div class="tw"><table style="min-width:760px"><thead><tr><th>Reference</th><th>Client</th><th>Transaction</th><th>Stage</th><th style="width:130px">Documents</th><th class="num">Findings</th><th class="num">Target raise</th><th>Filing</th></tr></thead><tbody>
      ${snaps.map((s) => `<tr><td><a href="#/e/${s.engagement.id}" class="mono" style="color:var(--accent);font-weight:600">${esc(s.engagement.reference)}</a><div class="xs faint">${esc(s.engagement.name)}</div></td><td>${esc(s.client.name)}</td><td class="small muted">${esc(txLabel(s.engagement.transactionType))}</td><td>${chip(stageLabel(s.engagement.stage))}</td><td>${meter(s.completeness.percent)}</td><td class="num">${s.compliance.open}</td><td class="num mono">${D.fmtMoney(s.engagement.targetRaise)}</td><td class="small muted">${D.fmtDate(s.engagement.targetFilingDate)}</td></tr>`).join('')}
      </tbody></table></div>`)}</div>`;
  }

  function clientsList() {
    const clients = repo.listClients(ORG.id), engs = repo.listEngagements(ORG.id);
    return `<div class="stack"><header><div class="eyebrow">Client book</div><h1 class="h1">Clients</h1></header>
      ${panel('Clients', `${clients.length} companies`, `<div class="tw"><table style="min-width:680px"><thead><tr><th>Client</th><th>Legal form</th><th>Sector</th><th class="num">Paid-up capital</th><th class="num">Engagements</th><th>Risk</th><th>Status</th></tr></thead><tbody>
      ${clients.map((c) => `<tr><td><div style="font-weight:500">${esc(c.name)}</div><div class="xs faint">${esc(c.primaryContactName || '')}</div></td><td class="small">${esc(D.LEGAL_FORM_LABEL[c.legalForm] || c.legalForm)}</td><td class="small">${esc(tc(c.sector))}</td><td class="num mono">${D.fmtMoney(c.paidUpCapital, c.currency)}</td><td class="num">${engs.filter((e) => e.clientId === c.id).length}</td><td>${chip(tc(c.riskRating), { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'good' }[c.riskRating] || '')}</td><td>${st(c.status)}</td></tr>`).join('')}
      </tbody></table></div>`)}</div>`;
  }

  function agentsOverview() {
    const engs = repo.listEngagements(ORG.id);
    const runs = engs.flatMap((e) => repo.listAgentRuns(e.id, 20).map((r) => ({ ...r, ref: e.reference, eid: e.id }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<div class="stack"><header><div class="eyebrow">Specialised agents</div><h1 class="h1">Agent operations</h1>
      <p class="sub" style="max-width:72ch">Every agent runs the engagement's versioned rule pack first — deterministic and citable. In the full deployment a reasoning pass follows when an Anthropic key is set; this preview runs the rule pass only.</p></header>
      <div class="cols">${D.AGENTS.map((k) => { const m = D.AGENT_META[k]; const n = runs.filter((r) => r.agent === k).length; return `<section class="panel pb"><div class="row" style="margin-bottom:8px"><span style="width:9px;height:9px;border-radius:9px;background:${m.accent}"></span><b style="font-size:13.5px">${esc(m.name)}</b><span class="xs faint" style="margin-left:auto">${n} run${n === 1 ? '' : 's'}</span></div><p class="small muted" style="margin:0 0 10px;line-height:1.55">${esc(m.blurb)}</p><div class="row" style="gap:4px">${m.expertise.map((e) => chip(e)).join('')}</div></section>`; }).join('')}</div>
      ${panel('Recent runs', '', `<div class="tw"><table style="min-width:640px"><thead><tr><th>Agent</th><th>Engagement</th><th>Status</th><th class="num">Findings</th><th>Summary</th><th>When</th></tr></thead><tbody>${runs.slice(0, 30).map((r) => `<tr><td style="font-weight:500">${esc(D.AGENT_META[r.agent]?.short)}</td><td><a class="mono" style="color:var(--accent)" href="#/e/${r.eid}/agents">${esc(r.ref)}</a></td><td>${st(r.status)}</td><td class="num">${r.findingsCount}</td><td class="small muted" style="max-width:420px">${esc(r.summary || '')}</td><td class="xs faint" style="white-space:nowrap">${D.fmtDateTime(r.createdAt)}</td></tr>`).join('')}</tbody></table></div>`)}
    </div>`;
  }

  let rulePackKey = 'ECMA-EQUITY', ruleTab = 'requirements';
  function rules() {
    const p = RULE_PACKS.find((x) => x.key === rulePackKey) || RULE_PACKS[0];
    const tabs = ['requirements', 'rules', 'prospectus', 'milestones'];
    let table = '';
    if (ruleTab === 'requirements') table = `<table style="min-width:720px"><thead><tr><th>Code</th><th>Requirement</th><th>Category</th><th class="num">Weight</th><th>Authority</th></tr></thead><tbody>${p.requirements.map((r) => `<tr><td class="mono faint">${r.code}</td><td><div style="font-weight:500">${esc(r.title)} ${r.mandatory ? '' : chip('Optional', 'info')}</div><div class="xs faint" style="line-height:1.5;margin-top:2px">${esc(r.description)}</div></td><td>${chip(tc(r.category))}</td><td class="num mono">${r.weight}</td><td class="xs faint">${esc(r.authorityRef)}</td></tr>`).join('')}</tbody></table>`;
    if (ruleTab === 'rules') table = `<table style="min-width:720px"><thead><tr><th>ID</th><th>Test</th><th>Agent</th><th>Severity</th><th>Applies to</th></tr></thead><tbody>${p.rules.map((r) => `<tr><td class="mono faint">${r.id}</td><td style="max-width:520px"><div style="font-weight:500">${esc(r.title)}</div><div class="xs faint" style="line-height:1.5;margin-top:2px">${esc(r.detail)}</div><div class="xs muted" style="margin-top:4px"><b>Authority:</b> ${esc(r.citation)}</div></td><td>${chip(tc(r.agent))}</td><td>${sev(r.severity)}</td><td class="mono xs faint">${r.appliesTo.join(', ')}</td></tr>`).join('')}</tbody></table>`;
    if (ruleTab === 'prospectus') table = `<table style="min-width:640px"><thead><tr><th>Code</th><th>Section</th><th class="num">Min words</th><th>Required by</th></tr></thead><tbody>${p.prospectus.map((s) => `<tr><td class="mono faint">${s.code}</td><td style="max-width:520px"><div style="font-weight:500">${esc(s.heading)}</div><div class="xs faint" style="line-height:1.5;margin-top:2px">${esc(s.guidance)}</div></td><td class="num mono">${s.minWords}</td><td class="xs faint">${esc(s.requiredBy)}</td></tr>`).join('')}</tbody></table>`;
    if (ruleTab === 'milestones') table = `<table><thead><tr><th class="num">#</th><th>Milestone</th><th class="num">Day</th><th class="num">Fee share</th></tr></thead><tbody>${p.milestones.map((m) => `<tr><td class="num mono">${m.sequence}</td><td><div style="font-weight:500">${esc(m.name)}</div><div class="xs faint">${esc(m.description)}</div></td><td class="num mono">+${m.offsetDays}</td><td class="num mono">${Math.round(m.feeShare * 100)}%</td></tr>`).join('')}</tbody></table>`;
    return `<div class="stack"><header><div class="eyebrow">Regulatory library</div><h1 class="h1">Rule packs</h1><p class="sub" style="max-width:76ch">The firm's codified view of what a transaction requires. Engagements are pinned to a pack version, so an amendment never silently changes a file already under review.</p></header>
      <div class="row">${RULE_PACKS.map((x) => `<button class="btn ${x.key === p.key ? 'primary' : ''}" data-act="pack" data-k="${x.key}">${esc(x.name)}</button>`).join('')}</div>
      <section class="panel"><div class="ph"><div><h2>${esc(p.name)}</h2><p>${p.key} · version ${p.version} · ${esc(p.authority)}</p></div></div>
        <div class="warn-note"><b>Verify before filing.</b> ${esc(p.disclaimer)}</div>
        <div class="pb"><div class="stats">${stat('Document requirements', p.requirements.length, `${p.requirements.filter((r) => r.mandatory).length} mandatory`)}${stat('Compliance rules', p.rules.length, `${p.rules.filter((r) => r.severity === 'CRITICAL').length} critical`)}${stat('Document sections', p.prospectus.length, p.outputLabel)}${stat('Milestones', p.milestones.length)}</div></div></section>
      <section class="panel"><div class="ph"><div class="row">${tabs.map((t) => `<button class="btn sm ${t === ruleTab ? 'primary' : 'ghost'}" data-act="ruletab" data-k="${t}">${tc(t)}</button>`).join('')}</div></div><div class="tw">${table}</div></section></div>`;
  }

  function auditView() {
    const ev = repo.listAudit(ORG.id, { limit: 200 });
    const refs = new Map(repo.listEngagements(ORG.id).map((e) => [e.id, e.reference]));
    return `<div class="stack"><header><div class="eyebrow">Compliance record</div><h1 class="h1">Audit trail</h1><p class="sub">Every material action — who, what, when.</p></header>
      ${panel(`${ev.length} events`, 'Newest first', `<div class="tw"><table style="min-width:640px"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Engagement</th></tr></thead><tbody>${ev.map((e) => `<tr><td class="xs faint" style="white-space:nowrap">${D.fmtDateTime(e.createdAt)}</td><td class="small">${esc(e.actorName)}</td><td>${chip(e.action)}</td><td class="small muted">${esc(e.entityType)}</td><td class="mono faint">${esc(refs.get(e.engagementId) || '—')}</td></tr>`).join('')}</tbody></table></div>`)}</div>`;
  }

  // ------------------------------------------------------- engagement views
  const TABS = [['', 'Overview'], ['documents', 'Documents'], ['findings', 'Findings'], ['agents', 'Agents'], ['reports', 'Reports'], ['risks', 'Risk register'], ['prospectus', 'Prospectus'], ['contract', 'Contract'], ['meetings', 'Meetings & tasks']];

  function engagement(id, tab) {
    const s = repo.snapshot(ORG.id, id);
    if (!s) return empty('Engagement not found');
    const pack = getRulePack(s.engagement.rulePackKey);
    const idx = D.stageIndex(s.engagement.stage);
    const counts = { documents: s.documents.length, findings: s.compliance.open, risks: s.risks.length, meetings: s.tasks.filter((t) => t.status !== 'DONE').length };
    const head = `<header>
      <div class="eyebrow" style="margin-bottom:4px"><a href="#/engagements">Engagements</a> / <span class="mono">${esc(s.engagement.reference)}</span></div>
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:14px">
        <div><h1 class="h1" style="margin:0">${esc(s.client.name)}</h1><p class="sub" style="margin-top:3px">${esc(s.engagement.name)}</p>
          <div class="row" style="gap:6px;margin-top:9px">${chip(txLabel(s.engagement.transactionType))}${chip(stageLabel(s.engagement.stage))}${chip(tc(s.engagement.status), 'good', true)}${s.engagement.targetRaise ? chip(D.fmtMoney(s.engagement.targetRaise, s.engagement.currency)) : ''}${s.engagement.targetFilingDate ? chip('Filing ' + D.fmtDate(s.engagement.targetFilingDate)) : ''}</div></div>
        <div style="flex:0 1 330px;min-width:240px">
          <div class="gate">${D.STAGES.map((x, i) => `<i class="${i < idx ? 'done' : i === idx ? 'cur' : ''}" title="${esc(D.STAGE_META[x].label)}"></i>`).join('')}</div>
          <div class="row" style="justify-content:space-between"><span class="xs faint">Stage ${idx + 1} of ${D.STAGES.length}${s.gate.nextStage ? ' · next: ' + stageLabel(s.gate.nextStage) : ''}</span>
          ${s.gate.nextStage ? `<button class="btn sm ${s.gate.canAdvance ? 'primary' : ''}" data-act="advance" data-id="${id}" data-force="${s.gate.canAdvance ? 0 : 1}">${s.gate.canAdvance ? 'Advance stage' : 'Blocked — override'}</button>` : ''}</div>
          ${!s.gate.canAdvance && s.gate.blockers.length ? `<ul class="xs muted" style="margin:7px 0 0;padding-left:16px;line-height:1.55">${s.gate.blockers.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        </div></div></header>
      <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/e/${id}${k ? '/' + k : ''}" ${(tab || '') === k ? 'aria-current="page"' : ''}>${k === 'prospectus' ? esc(pack.outputLabel) : l}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('')}</nav>`;

    const body = {
      '': overview, documents, findings, agents, reports, risks, prospectus, contract, meetings,
    }[tab || ''];
    return `<div class="stack">${head}${body ? body(s, pack) : empty('Unknown tab')}</div>`;
  }

  function overview(s) {
    const missing = s.requirements.filter((r) => r.mandatory && ['MISSING', 'REQUESTED'].includes(r.status));
    const live = s.findings.filter((f) => ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status)).slice(0, 6);
    return `<div class="stats">
        ${stat('Document completeness', pct(s.completeness.percent), `${s.completeness.accepted} accepted · ${s.completeness.submitted} in review · ${s.completeness.missing} outstanding`, s.completeness.percent >= 75 ? 'good' : s.completeness.percent >= 40 ? 'medium' : 'high')}
        ${stat('Compliance score', s.compliance.score, `${s.compliance.open} open · ${s.compliance.critical} critical · ${s.compliance.high} high`, s.compliance.score >= 75 ? 'good' : s.compliance.score >= 45 ? 'medium' : 'critical')}
        ${stat('Drafting', pct(s.prospectusProgress.percent), `${s.prospectusProgress.drafted} of ${s.prospectusProgress.total} sections drafted`)}
        ${stat('Engagement health', s.health.score, s.health.label, s.health.tone === 'good' ? 'good' : s.health.tone === 'watch' ? 'medium' : 'critical')}
        ${stat('Fees collected', pct(s.fees.percentPaid), `${D.fmtMoney(s.fees.paid)} received · ${D.fmtMoney(s.fees.outstanding)} outstanding`)}
      </div>
      <div class="cols">
        ${panel('Outstanding mandatory documents', `${missing.length} of ${s.requirements.filter((r) => r.mandatory).length} mandatory items`, missing.length ? `<div class="list">${missing.slice(0, 10).map((r) => `<div><div class="row" style="justify-content:space-between"><div><div style="font-weight:500">${esc(r.title)}</div><div class="mono faint xs">${r.code} · weight ${r.weight}</div></div>${st(r.status)}</div><div class="xs faint" style="margin-top:3px">${esc(r.authorityRef)}</div></div>`).join('')}</div>` : empty('All mandatory documents are on file'), `<a class="btn sm" href="#/e/${s.engagement.id}/documents">Document room</a>`)}
        ${panel('Open findings', 'Ranked by severity', live.length ? `<div class="list">${live.map((f) => `<a style="display:block" href="#/e/${s.engagement.id}/findings"><div class="row" style="gap:6px;margin-bottom:3px">${sev(f.severity)}${chip(D.AGENT_META[f.agent]?.short)}</div><div style="font-weight:500;line-height:1.4">${esc(f.title)}</div><div class="xs faint" style="margin-top:3px">${esc(f.citation || '')}</div></a>`).join('')}</div>` : empty('No open findings', 'Run the legal or financial agent to test the documents.'), `<a class="btn sm" href="#/e/${s.engagement.id}/findings">Triage</a>`)}
      </div>
      <div class="cols">
        ${panel('Completeness by category', '', `<div class="pb stack" style="gap:12px">${s.completeness.byCategory.map((c) => meter(c.percent, tc(c.category))).join('')}</div>`)}
        ${panel('Stage history', '', `<div class="list">${repo.listStageEvents(s.engagement.id).slice(0, 6).map((e) => `<div class="small">${e.fromStage ? `<span class="faint">${esc(stageLabel(e.fromStage))}</span> → ` : ''}<b>${esc(stageLabel(e.toStage))}</b><div class="xs muted">${esc(e.note || '')}</div><div class="xs faint">${esc(e.actorName || '')} · ${D.relTime(e.createdAt)}</div></div>`).join('')}</div>`)}
      </div>`;
  }

  let docFilter = 'ALL', openReq = null;
  function documents(s) {
    const docsBy = new Map();
    s.documents.forEach((d) => { const k = d.requirementId || '_'; docsBy.set(k, [...(docsBy.get(k) || []), d]); });
    const vis = s.requirements.filter((r) => docFilter === 'ALL' ? true : docFilter === 'OUTSTANDING' ? ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status) : docFilter === 'IN_REVIEW' ? ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status) : ['ACCEPTED', 'WAIVED'].includes(r.status));
    const c = s.completeness;
    return `<div class="stats">${stat('Completeness', pct(c.percent), `${s.engagement.documentThreshold}% threshold to advance`, c.percent >= s.engagement.documentThreshold ? 'good' : c.percent >= 40 ? 'medium' : 'high')}${stat('Accepted', c.accepted, `of ${c.total} requirements`, 'good')}${stat('Awaiting review', c.submitted, 'Submitted or under review', c.submitted ? 'low' : '')}${stat('Outstanding', c.missing, `${c.mandatoryMissing} mandatory`, c.missing ? 'high' : 'good')}</div>
    <section class="panel"><div class="ph"><div><h2>Document checklist</h2><p>${vis.length} of ${s.requirements.length} shown · uploads are auto-filed by matching title and text</p></div>
      <div class="row"><label class="btn sm" for="up-any">Upload &amp; auto-file</label><input id="up-any" type="file" accept=".txt,.md,.csv,.json" hidden data-up=""></div></div>
      <div class="row" style="padding:10px 16px;border-bottom:1px solid var(--hairline)">${['ALL', 'OUTSTANDING', 'IN_REVIEW', 'ACCEPTED'].map((f) => `<button class="btn sm ${f === docFilter ? 'primary' : 'ghost'}" data-act="docfilter" data-k="${f}">${tc(f)}</button>`).join('')}</div>
      <div class="list">${vis.map((r) => { const docs = docsBy.get(r.id) || []; const isOpen = openReq === r.id; return `<div style="padding:0">
        <div class="row" style="padding:11px 16px;align-items:flex-start;gap:12px">
          <button class="expander" style="padding:0;flex:1 1 320px" data-act="openreq" data-k="${r.id}" aria-expanded="${isOpen}">
            <div class="row" style="gap:6px;margin-bottom:3px"><span class="mono faint">${r.code}</span>${st(r.status)}${r.mandatory ? chip('Mandatory') : chip('Optional', 'info')}${chip(tc(r.category))}${docs.length ? `<span class="xs faint">${docs.length} file${docs.length === 1 ? '' : 's'}</span>` : ''}</div>
            <div style="font-weight:500;font-size:13.5px">${esc(r.title)}</div><div class="xs faint">${esc(r.authorityRef)}</div></button>
          <div class="row" style="flex:none"><label class="btn sm" for="up-${r.id}">Upload</label><input id="up-${r.id}" type="file" accept=".txt,.md,.csv,.json" hidden data-up="${r.id}">
            <select class="select btn sm" style="height:26px;padding:0 8px" data-act="reqstatus" data-id="${r.id}" aria-label="Status of ${esc(r.title)}">${D.REQUIREMENT_STATUSES.map((x) => `<option value="${x}" ${x === r.status ? 'selected' : ''}>${tc(x)}</option>`).join('')}</select></div>
        </div>
        ${isOpen ? `<div class="detail"><p class="small muted" style="margin:0;line-height:1.6">${esc(r.description)}</p>${r.waivedReason ? `<div class="small" style="background:var(--surface-2);padding:8px 10px;border-radius:8px"><b>Waived:</b> ${esc(r.waivedReason)}</div>` : ''}
          ${docs.length ? docs.map((d) => `<div class="row" style="background:var(--surface-2);padding:9px 12px;border-radius:8px;gap:10px"><div style="flex:1 1 220px"><div class="row" style="gap:6px"><b class="small">${esc(d.title)}</b>${chip('v' + d.version)}${st(d.status)}</div><div class="xs faint">${esc(d.fileName)} · ${(d.sizeBytes / 1024).toFixed(1)} KB · ${(d.extractedText || '').length.toLocaleString()} characters extracted · ${D.relTime(d.createdAt)}</div>${d.reviewNote ? `<div class="xs muted"><b>Note:</b> ${esc(d.reviewNote)}</div>` : ''}</div>
            <button class="btn sm" data-act="docview" data-id="${d.id}">Read</button><button class="btn sm" data-act="docaccept" data-id="${d.id}" ${d.status === 'ACCEPTED' ? 'disabled' : ''}>Accept</button><button class="btn sm danger" data-act="docreturn" data-id="${d.id}">Return</button></div>`).join('') : '<p class="small faint" style="margin:0">Nothing uploaded against this requirement yet.</p>'}</div>` : ''}
      </div>`; }).join('')}</div></section>`;
  }

  let findFilter = 'LIVE', openFinding = null;
  function findings(s) {
    const c = s.compliance;
    const vis = s.findings.filter((f) => findFilter === 'LIVE' ? ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status) : findFilter === 'CLOSED' ? ['RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'].includes(f.status) : true);
    const titles = new Map(s.documents.map((d) => [d.id, d.title]));
    return `<div class="stats">${stat('Compliance score', c.score, '100 is a clean file', c.score >= 75 ? 'good' : c.score >= 45 ? 'medium' : 'critical')}${stat('Critical', c.critical, 'Must clear before filing', c.critical ? 'critical' : 'good')}${stat('High', c.high, '', c.high ? 'high' : 'good')}${stat('Medium & low', c.medium + c.low, '', 'medium')}${stat('Closed', c.resolved, 'Resolved, dismissed or false positive', 'good')}</div>
    <section class="panel"><div class="ph"><div><h2>Findings</h2><p>${vis.length} shown of ${s.findings.length} · click one to review it</p></div><div class="row">${['LIVE', 'CLOSED', 'ALL'].map((f) => `<button class="btn sm ${f === findFilter ? 'primary' : 'ghost'}" data-act="findfilter" data-k="${f}">${tc(f)}</button>`).join('')}</div></div>
    ${vis.length ? `<div class="list">${vis.map((f) => { const isOpen = openFinding === f.id; return `<div style="padding:0">
      <button class="expander" data-act="openfinding" data-k="${f.id}" aria-expanded="${isOpen}"><div class="row" style="gap:6px;margin-bottom:4px">${sev(f.severity)}${chip(D.AGENT_META[f.agent]?.short)}${chip(D.GAP_LABEL[f.gapType] || f.gapType, 'info')}${st(f.status)}${f.humanVerdict ? chip(tc(f.humanVerdict), f.humanVerdict === 'CONFIRMED' ? 'good' : 'info') : ''}<span class="xs faint" style="margin-left:auto">${Math.round(f.confidence * 100)}% confidence</span></div>
        <div style="font-weight:500;font-size:13.5px;line-height:1.45">${esc(f.title)}</div><div class="xs faint" style="margin-top:3px">${esc(f.citation || '')}</div></button>
      ${isOpen ? `<div class="detail"><div class="small muted" style="white-space:pre-wrap;line-height:1.65">${esc(f.detail)}</div>
        ${f.excerpt ? `<div class="quote">${esc(f.excerpt)}</div>` : ''}
        ${f.recommendation ? `<div><div class="eyebrow" style="margin-bottom:4px">Recommended action</div><div class="small muted" style="line-height:1.6">${esc(f.recommendation)}</div></div>` : ''}
        <div class="xs faint">${f.documentId ? `Document: ${esc(titles.get(f.documentId) || '—')} · ` : ''}Visible to client: ${f.visibleToClient ? 'yes' : 'no'}</div>
        <div class="row" style="padding-top:10px;border-top:1px solid var(--hairline)">
          <button class="btn sm" data-act="fconfirm" data-id="${f.id}">Confirm finding</button>
          <button class="btn sm" data-act="ffalse" data-id="${f.id}">Mark false positive</button>
          <button class="btn sm primary" data-act="fresolve" data-id="${f.id}">Resolve</button>
          <button class="btn sm" data-act="fshare" data-id="${f.id}">${f.visibleToClient ? 'Hide from client' : 'Share with client'}</button>
        </div>${f.resolutionNote ? `<div class="small muted"><b>Resolution:</b> ${esc(f.resolutionNote)}</div>` : ''}</div>` : ''}
    </div>`; }).join('')}</div>` : empty('No findings match', s.findings.length ? 'Change the filter.' : 'Run the Legal or Financial agent from the Agents tab.')}</section>`;
  }

  function agents(s) {
    const last = new Map();
    s.runs.forEach((r) => { if (!last.has(r.agent)) last.set(r.agent, r); });
    return `<div class="panel pb row" style="gap:12px"><span style="width:7px;height:7px;border-radius:9px;background:var(--high)"></span><div style="flex:1 1 260px"><b class="small">Deterministic rule engine</b><div class="xs faint" style="line-height:1.5">In production, setting ANTHROPIC_API_KEY adds a reasoning pass after the rules. The rule pass below is the same code the server runs.</div></div>
      <span class="xs faint">${s.documents.length} documents · ${s.completeness.percent}% complete · ${s.compliance.open} open findings · ${s.risks.length} risks</span></div>
      <div class="cols">${D.AGENTS.map((k) => { const m = D.AGENT_META[k], r = last.get(k); return `<section class="panel" style="display:flex;flex-direction:column">
        <div class="pb" style="border-bottom:1px solid var(--hairline)"><div class="row" style="margin-bottom:7px"><span style="width:9px;height:9px;border-radius:9px;background:${m.accent}"></span><b style="font-size:13.5px">${esc(m.name)}</b><span style="margin-left:auto">${r ? st(r.status) : ''}</span></div>
          <div class="xs faint" style="margin-bottom:6px">${r ? `Last run ${D.relTime(r.createdAt)}` : 'Never run on this engagement'}</div>
          <p class="small muted" style="margin:0;line-height:1.55">${esc(m.blurb)}</p>${r?.summary ? `<p class="small" style="margin:10px 0 0;line-height:1.55;color:var(--ink-muted)">${esc(r.summary)}</p>` : ''}</div>
        <div class="pb" style="margin-top:auto"><button class="btn primary" style="width:100%" data-act="run" data-agent="${k}" data-id="${s.engagement.id}" ${busy ? 'disabled' : ''}>${busy === k ? 'Running…' : `Run ${esc(m.short)} Agent`}</button></div></section>`; }).join('')}</div>
      ${panel('Run history', 'Every run with its log', s.runs.length ? `<div class="list">${s.runs.map((r) => `<details><summary style="cursor:pointer" class="row"><b class="small">${esc(D.AGENT_META[r.agent]?.short)}</b>${st(r.status)}${chip(r.findingsCount + ' findings')}<span class="xs faint">${D.fmtDateTime(r.createdAt)} · ${r.durationMs}ms</span></summary><div class="mono xs muted" style="display:grid;gap:4px;margin-top:8px">${repo.listAgentLogs(r.id).map((l) => `<div><span class="faint">${new Date(l.createdAt).toLocaleTimeString('en-GB')}</span> ${esc(l.message)}</div>`).join('')}</div></details>`).join('')}</div>` : empty('No runs yet'))}`;
  }

  let reportId = null, editSection = null;
  function reports(s) {
    const list = repo.listReports(s.engagement.id);
    if (!list.length) return panel('Reports', '', empty('No reports yet', 'Run the Legal, Financial or Risk agent to produce a draft for expert review.'));
    const r = list.find((x) => x.id === reportId) || list[0];
    let sections = []; try { sections = JSON.parse(r.sections); } catch { /* ignore */ }
    return `<div class="split">
      <section class="panel"><div class="ph"><h2>Reports</h2></div><div class="idx">${list.map((x) => `<button data-act="report" data-k="${x.id}" ${x.id === r.id ? 'aria-current="true"' : ''}><div class="row" style="gap:6px;margin-bottom:3px">${chip(tc(x.kind))}<span class="mono faint">v${x.version}</span>${st(x.status)}</div><div class="small" style="font-weight:${x.id === r.id ? 600 : 450};line-height:1.4">${esc(x.title)}</div></button>`).join('')}</div></section>
      <div class="stack" style="gap:12px">
        <section class="panel"><div class="ph"><div><h2>${esc(r.title)}</h2><p>Version ${r.version} · ${tc(r.status)}</p></div><div class="row">${r.status === 'DRAFT' ? `<button class="btn sm" data-act="rstatus" data-id="${r.id}" data-k="IN_REVIEW">Take for review</button>` : ''}${!['APPROVED', 'SUPERSEDED'].includes(r.status) ? `<button class="btn sm primary" data-act="rstatus" data-id="${r.id}" data-k="APPROVED">Approve</button>` : ''}</div></div>
          <div class="warn-note"><b>Machine-assisted draft.</b> ${r.status === 'APPROVED' ? 'Approved by the reviewing expert.' : 'Not approved. It must not be issued to the client or any third party until a responsible expert has reviewed every section.'}</div>
          <div class="pb"><div class="eyebrow" style="margin-bottom:7px">Executive summary</div><div class="prose">${renderMarkdown(r.executiveSummary || '')}</div></div></section>
        ${sections.map((sec) => `<section class="panel"><div class="ph"><div><h2>${esc(sec.heading)}</h2><p>${sec.edited ? 'Edited by a reviewer' : sec.agentGenerated ? 'Agent draft' : 'Reviewer section'}</p></div>${r.status !== 'APPROVED' ? (editSection === sec.id ? `<div class="row"><button class="btn sm primary" data-act="savesec" data-id="${r.id}" data-k="${sec.id}">Save</button><button class="btn sm ghost" data-act="cancelsec">Cancel</button></div>` : `<button class="btn sm" data-act="editsec" data-k="${sec.id}">Edit</button>`) : ''}</div>
          <div class="pb">${editSection === sec.id ? `<textarea id="sec-edit" class="textarea" style="min-height:280px;font-family:var(--font-mono);font-size:12.5px">${esc(sec.body)}</textarea>` : `<div class="prose">${renderMarkdown(sec.body)}</div>`}</div></section>`).join('')}
      </div></div>`;
  }

  function risks(s) {
    const matrix = [5, 4, 3, 2, 1].map((imp) => [1, 2, 3, 4, 5].map((l) => s.risks.filter((r) => r.impact === imp && r.likelihood === l)));
    return `<div class="stats">${stat('Risks on register', s.risks.length)}${stat('High inherent', s.risks.filter((r) => r.inherentScore >= 15).length, 'Score 15 or above', 'critical')}${stat('Open', s.risks.filter((r) => r.status === 'OPEN').length, '', 'medium')}</div>
      <div class="cols">${panel('Inherent risk heat map', 'Impact (rows) against likelihood (columns)', `<div class="pb"><div class="heat">${matrix.map((row, i) => `<div class="ax">${5 - i}</div>${row.map((cell, j) => { const band = D.riskBand((5 - i) * (j + 1)); return `<div title="${esc(cell.map((c) => c.title).join('\n') || 'Score ' + (5 - i) * (j + 1))}" style="background:${cell.length ? `var(--${band.tone === 'low' ? 'good' : band.tone})` : 'var(--surface-2)'};color:${cell.length ? '#fff' : 'var(--ink-faint)'}">${cell.length || ''}</div>`; }).join('')}`).join('')}<div class="ax"></div>${[1, 2, 3, 4, 5].map((l) => `<div class="ax">${l}</div>`).join('')}</div></div>`)}</div>
      ${panel('Risk register', `${s.risks.length} risks`, s.risks.length ? `<div class="tw"><table style="min-width:680px"><thead><tr><th>Code</th><th>Risk</th><th>Category</th><th class="num">L × I</th><th class="num">Residual</th><th>Status</th></tr></thead><tbody>${s.risks.map((r) => { const b = D.riskBand(r.inherentScore); return `<tr><td class="mono faint">${r.code}</td><td style="max-width:440px"><div style="font-weight:500">${esc(r.title)}</div><div class="xs faint" style="line-height:1.5;margin-top:2px">${esc(r.disclosureStrategy || '')}</div></td><td>${chip(tc(r.category))}</td><td class="num">${chip(`${r.likelihood}×${r.impact} = ${r.inherentScore}`, b.tone === 'low' ? 'good' : b.tone)}</td><td class="num mono">${r.residualScore}</td><td><select class="select" style="font-size:12px" data-act="riskstatus" data-id="${r.id}" aria-label="Status">${['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED'].map((x) => `<option value="${x}" ${x === r.status ? 'selected' : ''}>${tc(x)}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>` : empty('The register is empty', 'Run the Risk agent after the legal and financial reviews.'))}`;
  }

  let sectionId = null;
  function prospectus(s, pack) {
    const secs = s.prospectus;
    const sec = secs.find((x) => x.id === sectionId) || secs[0];
    const spec = pack.prospectus.find((p) => p.code === sec.code);
    return `<div class="stats">${stat(pack.outputLabel + ' complete', pct(s.prospectusProgress.percent), pack.name)}${stat('Sections drafted', `${s.prospectusProgress.drafted}/${s.prospectusProgress.total}`)}${stat('Approved', s.prospectusProgress.approved)}</div>
      <div class="split">
        <section class="panel"><div class="ph"><div><h2>Contents</h2><p>${secs.length} prescribed sections</p></div></div><div class="idx" style="max-height:620px;overflow-y:auto">${secs.map((x) => `<button data-act="section" data-k="${x.id}" ${x.id === sec.id ? 'aria-current="true"' : ''}><div class="row" style="gap:6px;margin-bottom:3px"><span class="mono faint">${x.code}</span>${st(x.status)}</div><div class="small" style="margin-bottom:5px;line-height:1.4">${esc(x.heading)}</div>${meter(x.completeness, false)}</button>`).join('')}</div></section>
        <section class="panel"><div class="ph"><div><h2>${esc(sec.code)} — ${esc(sec.heading)}</h2><p>${sec.wordCount} words of ~${spec?.minWords ?? 350} target</p></div><div class="row"><button class="btn sm" data-act="draft" data-id="${s.engagement.id}" data-k="${sec.code}" ${busy ? 'disabled' : ''}>${busy ? 'Drafting…' : 'Draft with agent'}</button><select class="select btn sm" style="height:26px;padding:0 8px" data-act="secstatus" data-id="${sec.id}" aria-label="Section status">${['NOT_STARTED', 'DRAFTING', 'DRAFTED', 'IN_REVIEW', 'APPROVED'].map((x) => `<option value="${x}" ${x === sec.status ? 'selected' : ''}>${tc(x)}</option>`).join('')}</select></div></div>
          <div style="padding:9px 16px;border-bottom:1px solid var(--hairline)" class="xs faint">Required by: ${esc(sec.requiredBy || '')}</div>
          ${spec ? `<div style="padding:10px 16px;border-bottom:1px solid var(--hairline);background:var(--surface-2)" class="small muted"><b style="color:var(--ink)">Drafting guidance.</b> ${esc(spec.guidance)}</div>` : ''}
          <div class="pb">${sec.body.trim() ? `<div class="prose">${renderMarkdown(sec.body)}</div>` : empty('Not drafted', 'Use “Draft with agent” to build a structured draft from the documents on file.')}</div></section>
      </div>`;
  }

  function contract(s) {
    if (!s.contract) return panel('Contract', '', empty('No contract on this engagement'));
    const c = s.contract, f = s.fees;
    return `<div class="stats">${stat('Total fee', D.fmtMoney(c.totalFee, c.currency), `plus ${c.vatPercent}% VAT`)}${stat('Received', D.fmtMoney(f.paid, c.currency), `${f.percentPaid}% of the fee`, 'good')}${stat('Outstanding', D.fmtMoney(f.outstanding, c.currency), 'Invoiced, unpaid', f.outstanding ? 'high' : 'good')}${stat('Milestones complete', `${f.milestonesDone}/${f.milestonesTotal}`)}</div>
      ${panel(c.title, `${tc(c.feeModel)} fee · signed ${D.fmtDate(c.signedDate)}`, `<div class="tw"><table style="min-width:640px"><thead><tr><th>#</th><th>Milestone</th><th>Due</th><th>Status</th><th class="num">Fee</th><th>Payment</th></tr></thead><tbody>${s.milestones.map((m) => { const od = m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < new Date(); return `<tr><td class="mono faint">${m.sequence}</td><td><div style="font-weight:500">${esc(m.name)}</div><div class="xs faint">${esc(m.description || '')}</div></td><td class="small" style="white-space:nowrap;color:${od ? 'var(--critical)' : 'var(--ink-muted)'}">${D.fmtDate(m.dueDate)}${od ? ' · overdue' : ''}</td><td><select class="select" style="font-size:12px" data-act="msstatus" data-id="${m.id}" aria-label="Milestone status">${['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].map((x) => `<option value="${x}" ${x === m.status ? 'selected' : ''}>${tc(x)}</option>`).join('')}</select></td><td class="num mono">${D.fmtMoney(m.paymentAmount, c.currency)}</td><td><select class="select" style="font-size:12px" data-act="mspay" data-id="${m.id}" aria-label="Payment status">${['UNBILLED', 'INVOICED', 'PAID', 'WAIVED'].map((x) => `<option value="${x}" ${x === m.paymentStatus ? 'selected' : ''}>${tc(x)}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>`)}`;
  }

  function meetings(s) {
    return `<div class="cols">
      ${panel('Meetings', `${s.meetings.length} recorded`, s.meetings.length ? `<div class="list">${s.meetings.map((m) => { const acts = JSON.parse(m.actionItems || '[]'); return `<div><div class="row" style="gap:6px;margin-bottom:3px">${m.distributed ? chip('Minutes circulated', 'good', true) : chip('Not circulated', 'medium', true)}${acts.length ? chip(acts.length + ' actions') : ''}</div><div style="font-weight:500">${esc(m.title)}</div><div class="xs faint">${D.fmtDateTime(m.scheduledAt)} · ${m.durationMin} min</div>
        <details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--accent)">Notes and action items</summary><div class="prose" style="font-size:12.5px;margin-top:8px">${renderMarkdown(m.minutes || '')}</div>${acts.length ? `<ul class="small muted">${acts.map((a) => `<li>${esc(a.title)}</li>`).join('')}</ul>` : ''}</details>
        <button class="btn sm" style="margin-top:8px" data-act="secretary" data-id="${s.engagement.id}" data-k="${m.id}" ${busy ? 'disabled' : ''}>Run Secretary Agent</button></div>`; }).join('')}</div>` : empty('No meetings'))}
      ${panel('Tasks', `${s.tasks.filter((t) => t.status !== 'DONE').length} open`, s.tasks.length ? `<div class="list">${s.tasks.map((t) => { const od = t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date(); return `<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-act="task" data-id="${t.id}" ${t.status === 'DONE' ? 'checked' : ''} style="margin-top:3px"><span><span style="font-weight:500;${t.status === 'DONE' ? 'text-decoration:line-through;color:var(--ink-faint)' : ''}">${esc(t.title)}</span>${t.detail ? `<span class="xs faint" style="display:block;line-height:1.5">${esc(t.detail)}</span>` : ''}<span class="row" style="gap:6px;margin-top:4px">${chip(tc(t.priority), t.priority === 'URGENT' ? 'critical' : t.priority === 'HIGH' ? 'high' : '')}${t.agentOwner ? chip((D.AGENT_META[t.agentOwner]?.short || t.agentOwner) + ' agent', 'info') : ''}${t.dueDate ? `<span class="xs" style="color:${od ? 'var(--critical)' : 'var(--ink-faint)'}">${od ? 'Overdue ' : 'Due '}${D.fmtDate(t.dueDate)}</span>` : ''}</span></span></label>`; }).join('')}</div>` : empty('No tasks'))}
    </div>`;
  }

  // ----------------------------------------------------------------- portal
  function portal() {
    const eng = repo.listEngagementsForClient(CLIENT_USER.clientId)[0];
    const s = repo.snapshot(ORG.id, eng.id);
    const idx = D.stageIndex(s.engagement.stage);
    const outstanding = s.requirements.filter((r) => ['MISSING', 'REQUESTED', 'REJECTED'].includes(r.status));
    const inReview = s.requirements.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status));
    const accepted = s.requirements.filter((r) => ['ACCEPTED', 'WAIVED'].includes(r.status));
    const shared = s.findings.filter((f) => f.visibleToClient && !['DISMISSED', 'FALSE_POSITIVE'].includes(f.status));
    const body = `<div class="stack">
      <header><div class="eyebrow">Client portal · <span class="mono">${esc(s.engagement.reference)}</span></div><h1 class="h1">${esc(s.engagement.name)}</h1><p class="sub">${esc(txLabel(s.engagement.transactionType))} · ${D.fmtMoney(s.engagement.targetRaise)} · target filing ${D.fmtDate(s.engagement.targetFilingDate)}</p></header>
      <div class="stats">${stat('Overall progress', pct(s.completeness.percent), 'Of the documents your advisor needs', s.completeness.percent >= 75 ? 'good' : 'medium')}${stat('Still needed', outstanding.length, `${outstanding.filter((r) => r.mandatory).length} required by the regulator`, outstanding.length ? 'high' : 'good')}${stat('Being reviewed', inReview.length, '', 'low')}${stat('Accepted', accepted.length, `of ${s.requirements.length} items`, 'good')}</div>
      <div class="cols">
        ${panel('Where your transaction stands', D.STAGE_META[s.engagement.stage].blurb, `<div class="pb"><ol class="steps">${D.STAGES.map((x, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><span class="b">${i < idx ? '✓' : ''}</span><div><div class="small" style="font-weight:${i === idx ? 600 : 450};color:${i <= idx ? 'var(--ink)' : 'var(--ink-faint)'}">${esc(D.STAGE_META[x].label)}${i === idx ? ' <span class="xs" style="color:var(--accent);font-weight:700;margin-left:6px">IN PROGRESS</span>' : ''}</div><div class="xs faint">${esc(D.STAGE_META[x].blurb)}</div></div></li>`).join('')}</ol></div>`)}
        ${panel('Documents we still need from you', `${outstanding.length} outstanding`, `<div class="pb" style="border-bottom:1px solid var(--hairline)">${meter(s.completeness.percent, 'Document completeness')}</div>${outstanding.length ? `<div class="list">${outstanding.map((r) => `<div class="row" style="align-items:flex-start;gap:12px"><div style="flex:1 1 240px"><div class="row" style="gap:6px;margin-bottom:4px">${r.mandatory ? chip('Required', 'high', true) : chip('Optional', 'info')}${st(r.status)}</div><div style="font-weight:500">${esc(r.title)}</div><div class="small muted" style="line-height:1.55;margin-top:2px">${esc(r.description)}</div></div><label class="btn sm primary" for="pup-${r.id}">Upload</label><input id="pup-${r.id}" type="file" accept=".txt,.md,.csv,.json" hidden data-up="${r.id}" data-eid="${eng.id}"></div>`).join('')}</div>` : empty('Everything we asked for is in')}`)}
      </div>
      ${shared.length ? panel('Items your advisor has raised with you', 'Points that need your attention', `<div class="list">${shared.map((f) => `<div><div style="font-weight:500;margin-bottom:3px">${esc(f.title)}</div>${f.recommendation ? `<div class="small muted" style="padding-left:11px;border-left:2px solid var(--accent-line)"><b>What we need:</b> ${esc(f.recommendation)}</div>` : ''}</div>`).join('')}</div>`) : ''}
      ${panel('Milestones', 'The plan agreed in your engagement letter', `<div class="tw"><table><thead><tr><th>#</th><th>Milestone</th><th>Target date</th><th>Status</th></tr></thead><tbody>${s.milestones.map((m) => `<tr><td class="mono faint">${m.sequence}</td><td style="font-weight:500">${esc(m.name)}</td><td class="small muted">${D.fmtDate(m.dueDate)}</td><td class="small">${tc(m.status)}</td></tr>`).join('')}</tbody></table></div>`)}
      <p class="xs faint" style="text-align:center">Internal review notes and draft reports are not shown here until ${esc(ORG.name)} releases them.</p>
    </div>`;
    return `<div class="main">${banner()}<header class="top">${mark}<div><b class="small">${esc(ORG.name)}</b><div class="xs faint">Client portal — ${esc(CLIENT_USER.name)}</div></div><div style="flex:1"></div><span class="small muted">${notify.unreadCount(CLIENT_USER.id)} unread</span></header><main class="content" style="max-width:1180px">${body}</main></div>`;
  }

  // ----------------------------------------------------------------- render
  function render() {
    const app = document.getElementById('app');
    if (role === 'client') { app.innerHTML = portal(); return; }
    const p = route();
    let body;
    if (p[0] === 'e' && p[1]) body = engagement(p[1], p[2] || '');
    else body = ({ dashboard, engagements: engagementsList, clients: clientsList, agents: agentsOverview, rules, audit: auditView }[p[0]] || dashboard)();
    app.innerHTML = staffShell(p, body);
  }

  // ---------------------------------------------------------------- actions
  const actor = () => ({ actorId: STAFF.id, actorName: STAFF.name, orgId: ORG.id });
  const done = (msg) => { save(); render(); if (msg) toast(msg); };

  async function agentRun(agent, engagementId, payload) {
    busy = agent; render();
    try {
      const r = await runAgent({ engagementId, orgId: ORG.id, agent, triggeredById: STAFF.id, actorName: STAFF.name, forceRules: true, payload });
      busy = null; done(r.summary);
    } catch (e) { busy = null; render(); toast('The agent run failed: ' + e.message); }
  }

  function upload(file, requirementId, engagementId) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').slice(0, 400000);
      const eid = engagementId || route()[1];
      const eng = repo.getEngagement(ORG.id, eid);
      const reqs = repo.listRequirements(eid);
      let reqId = requirementId || null;
      if (!reqId) {
        const g = suggestRequirement(file.name, file.name.replace(/\.[^.]+$/, ''), text, getRulePack(eng.rulePackKey));
        if (g) reqId = reqs.find((r) => r.code === g.code)?.id || null;
      }
      const prior = reqId ? repo.listDocuments(eid).filter((d) => d.requirementId === reqId) : [];
      repo.createDocument({ engagementId: eid, requirementId: reqId, title: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, storageKey: 'preview/' + file.name, mimeType: file.type || 'text/plain', sizeBytes: file.size, version: prior.length + 1, supersedesId: prior[0]?.id || null, extractedText: text, pageCount: null, status: 'SUBMITTED', reviewNote: null, uploadedById: role === 'client' ? CLIENT_USER.id : STAFF.id, uploadedByRole: role === 'client' ? 'CLIENT' : 'OWNER' });
      const req = reqId ? repo.getRequirement(reqId) : null;
      if (req && !['ACCEPTED', 'WAIVED'].includes(req.status)) repo.updateRequirement(reqId, { status: 'SUBMITTED' });
      repo.audit({ ...actor(), action: 'document.upload', entityType: 'Document', engagementId: eid });
      const snap = repo.snapshot(ORG.id, eid);
      done(req ? `Filed against ${req.code} — ${req.title}. ${text.length.toLocaleString()} characters extracted. Completeness now ${snap.completeness.percent}%.` : 'Uploaded but not matched to a requirement.');
    };
    reader.readAsText(file);
  }

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'role-switch') { role = el.value; render(); return; }
    if (el.matches('input[type=file][data-up]')) { if (el.files[0]) upload(el.files[0], el.dataset.up, el.dataset.eid); return; }
    const a = el.dataset.act, id = el.dataset.id;
    if (a === 'reqstatus') {
      let reason = null;
      if (el.value === 'WAIVED') { reason = prompt('Record the reason for the waiver:'); if (!reason) { render(); return; } }
      repo.updateRequirement(id, { status: el.value, waivedReason: reason || undefined });
      repo.audit({ ...actor(), action: 'requirement.update', entityType: 'Requirement', engagementId: route()[1] });
      done('Requirement updated.');
    }
    if (a === 'riskstatus') { repo.updateRisk(id, { status: el.value }); done('Risk updated.'); }
    if (a === 'secstatus') { repo.updateProspectusSection(id, { status: el.value, completeness: el.value === 'APPROVED' ? 100 : undefined }); done('Section updated.'); }
    if (a === 'msstatus') { repo.updateMilestone(id, { status: el.value, completedAt: el.value === 'COMPLETED' ? new Date().toISOString() : null }); done('Milestone updated.'); }
    if (a === 'mspay') { repo.updateMilestone(id, { paymentStatus: el.value, paidAt: el.value === 'PAID' ? new Date().toISOString() : null }); done('Payment updated.'); }
    if (a === 'task') { repo.updateTask(id, { status: el.checked ? 'DONE' : 'TODO', completedAt: el.checked ? new Date().toISOString() : null }); done(); }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
    const a = el.dataset.act, id = el.dataset.id, k = el.dataset.k;
    switch (a) {
      case 'toggle-side': sideOpen = !sideOpen; render(); break;
      case 'close-side': sideOpen = false; render(); break;
      case 'reset':
        if (!confirm('Reset the demo to its original data?')) return;
        try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
        await boot(true); toast('Demo reset.'); break;
      case 'mark-read': notify.markRead(STAFF.id); done(); break;
      case 'pack': rulePackKey = k; render(); break;
      case 'ruletab': ruleTab = k; render(); break;
      case 'docfilter': docFilter = k; render(); break;
      case 'findfilter': findFilter = k; render(); break;
      case 'openreq': openReq = openReq === k ? null : k; render(); break;
      case 'openfinding': openFinding = openFinding === k ? null : k; render(); break;
      case 'report': reportId = k; editSection = null; render(); break;
      case 'section': sectionId = k; render(); break;
      case 'editsec': editSection = k; render(); break;
      case 'cancelsec': editSection = null; render(); break;
      case 'savesec': {
        const r = repo.getReport(id); const secs = JSON.parse(r.sections);
        const txt = document.getElementById('sec-edit').value;
        repo.updateReport(id, { sections: JSON.stringify(secs.map((x) => (x.id === k ? { ...x, body: txt, edited: true, agentGenerated: false } : x))) });
        editSection = null; done('Section saved.'); break;
      }
      case 'rstatus':
        repo.updateReport(id, { status: k, reviewerId: STAFF.id, approvedAt: k === 'APPROVED' ? new Date().toISOString() : undefined });
        repo.audit({ ...actor(), action: k === 'APPROVED' ? 'report.approve' : 'report.update', entityType: 'DueDiligenceReport', engagementId: route()[1] });
        done(k === 'APPROVED' ? 'Report approved.' : 'Report taken for review.'); break;
      case 'docaccept': {
        const d = repo.getDocument(id); repo.updateDocument(id, { status: 'ACCEPTED' });
        if (d.requirementId) repo.updateRequirement(d.requirementId, { status: 'ACCEPTED' });
        repo.audit({ ...actor(), action: 'document.review', entityType: 'Document', engagementId: d.engagementId });
        done(`Accepted. Completeness is now ${repo.snapshot(ORG.id, d.engagementId).completeness.percent}%.`); break;
      }
      case 'docreturn': {
        const note = prompt('Why is this document being returned? The client sees this note.'); if (note === null) return;
        const d = repo.getDocument(id); repo.updateDocument(id, { status: 'REJECTED', reviewNote: note });
        if (d.requirementId) repo.updateRequirement(d.requirementId, { status: 'REJECTED' });
        done('Returned to the client.'); break;
      }
      case 'docview': { const d = repo.getDocument(id); alert(`${d.title}\n\n${(d.extractedText || '(no text)').slice(0, 3000)}`); break; }
      case 'fconfirm': repo.updateFinding(id, { humanVerdict: 'CONFIRMED', status: 'ACKNOWLEDGED' }); done('Finding confirmed.'); break;
      case 'ffalse': repo.updateFinding(id, { humanVerdict: 'REJECTED', status: 'FALSE_POSITIVE', resolvedById: STAFF.id, resolvedAt: new Date().toISOString() }); done('Marked as a false positive.'); break;
      case 'fresolve': { const n = prompt('Resolution note (recorded against the finding):', 'Resolved on review.'); if (n === null) return; repo.updateFinding(id, { status: 'RESOLVED', resolutionNote: n, resolvedById: STAFF.id, resolvedAt: new Date().toISOString() }); done('Finding resolved.'); break; }
      case 'fshare': { const f = repo.getFinding(id); repo.updateFinding(id, { visibleToClient: f.visibleToClient ? 0 : 1 }); done(f.visibleToClient ? 'Hidden from the client.' : 'Now visible in the client portal.'); break; }
      case 'run': agentRun(el.dataset.agent, id); break;
      case 'draft': agentRun('PROSPECTUS', id, { sectionCode: k }); break;
      case 'secretary': agentRun('SECRETARY', id, { meetingId: k }); break;
      case 'advance': {
        const s = repo.snapshot(ORG.id, id);
        if (el.dataset.force === '1' && !confirm(`The stage gate is not satisfied:\n\n• ${s.gate.blockers.join('\n• ')}\n\nOverride and advance? The override is recorded in the audit trail.`)) return;
        repo.setStage(id, s.gate.nextStage, el.dataset.force === '1' ? 'Advanced with an override.' : 'Stage gate satisfied.', STAFF.name);
        repo.audit({ ...actor(), action: 'engagement.stage', entityType: 'Engagement', engagementId: id, metadata: { override: el.dataset.force === '1' } });
        done(`Moved to ${stageLabel(s.gate.nextStage)}.`); break;
      }
    }
  });

  // ------------------------------------------------------------------- boot
  async function boot(fresh) {
    const SQL = await initSqlJs();
    const bytes = (!fresh && loadSaved()) || seedBytes();
    try { SQLDB = new SQL.Database(bytes); SQLDB.exec('SELECT 1 FROM orgs LIMIT 1'); }
    catch { SQLDB = new SQL.Database(seedBytes()); }
    AOS.attach(SQLDB);
    ORG = AOS.one('SELECT * FROM orgs LIMIT 1');
    STAFF = AOS.one("SELECT * FROM users WHERE role = 'OWNER' LIMIT 1");
    CLIENT_USER = AOS.one("SELECT * FROM users WHERE role = 'CLIENT' AND email LIKE '%abyssinia%' LIMIT 1");
    render();
  }
  boot(false).catch((e) => { document.getElementById('app').innerHTML = `<div class="loading">Could not start the preview: ${esc(e.message)}</div>`; });
})();
