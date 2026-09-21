/* Advisor OS — in-browser preview. Runs the production repository layer,
   scoring engine, rule packs and agents (rule-engine mode) against the seeded
   database via sql.js. */
(function () {
  const { repo, progress, domain, RULE_PACKS, getRulePack, runAgent, suggestRequirement, renderMarkdown, notify } = AOS;
  const D = domain;
  const STORE_KEY = 'advisoros-preview-db-v4';
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
  const stat = (label, value, sub, tone) => `<div class="panel stat lift"><div class="eyebrow">${esc(label)}</div><div class="v" style="color:${toneColor(tone)}">${/^\d+%?$/.test(String(value)) ? `<span data-count="${parseInt(value, 10)}" data-suffix="${String(value).endsWith('%') ? '%' : ''}">${esc(value)}</span>` : esc(value)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
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
    graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8.3 7.2l7.4.6M7 8.3l1.4 7.3M16.6 10l-5.7 6.4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  };
  const icon = (n) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const BI = window.BRAND_IMG || {};
  const mark = `<img src="${BI.mark}" alt="" aria-hidden="true" width="28" height="28" style="flex:none">`;
  const lockup = (h) => `<span class="brand-lockup"><img class="on-light" src="${BI.light}" alt="Siinqee Investment Bank — Make it count" style="height:${h}px;width:auto"><img class="on-dark" src="${BI.dark}" alt="Siinqee Investment Bank — Make it count" style="height:${h}px;width:auto"></span>`;

  function banner() {
    const who = role === 'client' ? CLIENT_USER : STAFF;
    return `<div class="banner"><span><b>Interactive preview.</b> The production engine running in your browser — rule packs, scoring, agents, knowledge graph, assistant and PDF typesetting. Company data is fictional; changes stay in this browser.</span>
      <span class="row" style="margin-left:auto"><span class="small muted">Signed in as <b>${esc(who.name)}</b> · ${role === 'client' ? 'client portal' : 'firm'}</span>
        <button class="btn sm" data-act="signout">Sign out</button>
        <button class="btn sm" data-act="reset">Reset demo</button>
      </span></div>`;
  }

  function staffShell(path, body) {
    const engs = repo.listEngagements(ORG.id);
    const clients = new Map(repo.listClients(ORG.id).map((c) => [c.id, c.name]));
    const unread = notify.unreadCount(STAFF.id);
    const nav = [['dashboard', 'Dashboard', 'grid'], ['graph', 'Knowledge graph', 'graph'], ['assistant', 'Ask the OS', 'chat'], ['engagements', 'Engagements', 'folder'], ['clients', 'Clients', 'users'], ['agents', 'Agents', 'cpu'], ['rules', 'Rule packs', 'book'], ['audit', 'Audit trail', 'shield'], ['integrations', 'Telegram & Slack', 'bell']];
    return `<div class="root">
      <aside class="side" data-open="${sideOpen}"><div class="brand-bar" aria-hidden="true"></div>
        <div class="brand">${mark}<div><b>${esc(ORG.name)}</b><small>Advisor OS · Investment Banking</small></div></div>
        <nav class="nav">${nav.map(([k, l, i]) => `<a href="#/${k}" ${path[0] === k || (k === 'engagements' && path[0] === 'e') ? 'aria-current="page"' : ''}>${icon(i)}${l}</a>`).join('')}</nav>
        <div class="side-eng"><div class="eyebrow" style="padding:8px 9px 6px">Active engagements</div>
          ${engs.map((e) => `<a href="#/e/${e.id}" ${path[1] === e.id ? 'aria-current="page"' : ''}><div class="mono xs" style="color:${path[1] === e.id ? 'var(--accent)' : 'var(--ink-faint)'}">${esc(e.reference)}</div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(clients.get(e.clientId))}</div></a>`).join('')}
        </div>
        <div style="padding:10px;border-top:1px solid var(--hairline);display:flex;gap:8px;align-items:center">
          <span style="width:26px;height:26px;border-radius:99px;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${esc(STAFF.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span>
          <div><div class="small" style="font-weight:500">${esc(STAFF.name)}</div><div class="xs faint">${esc(STAFF.title || STAFF.role)}</div></div>
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
      <header><div class="eyebrow">Practice overview</div><h1 class="h1">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, <span class="shine">${esc(STAFF.name.split(' ')[0])}</span></h1>
      <p class="sub">${active.length} active engagements across ${repo.listClients(ORG.id).length} clients, worth ${D.fmtMoney(active.reduce((a, s) => a + (s.engagement.targetRaise || 0), 0))} in target raises.${crit ? ` <b style="color:var(--critical)">${crit} critical finding${crit === 1 ? ' needs' : 's need'} attention.</b>` : ''} ${attention.length} items are blocking progress.</p></header>
      <div class="stats">
        ${stat('Active engagements', active.length)}
        ${stat('Pipeline value', D.fmtMoney(active.reduce((a, s) => a + (s.engagement.targetRaise || 0), 0)), 'Target raise across active mandates')}
        ${stat('Avg. document completeness', pct(avg), 'Weighted against the ECMA checklist', avg >= 75 ? 'good' : avg >= 40 ? 'medium' : 'high')}
        ${stat('Open findings', open, `${crit} critical`, crit ? 'critical' : 'medium')}
        ${stat('Fees outstanding', D.fmtMoney(snaps.reduce((a, s) => a + s.fees.outstanding, 0)), 'Invoiced, not yet received')}
      </div>
      ${panel('Knowledge graph', 'Every client, engagement, gap, finding, risk, person and agent — and how they connect', `<div class="pb">${graphBlock(440, 'dash')}</div>`, '<a class="btn sm" href="#/graph">Full screen</a>')}
      ${dashCharts(snaps)}
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
    const dataroom = tab === 'documents' && s.client.name === COMPANY.name
      ? panel(`Sample data room — ${COMPANY.name}`, `${ABYSSINIA_DATAROOM.length} fictional source documents the agents analysed, typeset as PDFs. Every page is marked fictional.`, `<div class="pb">${pdfCards(ABYSSINIA_DATAROOM.map((d, i) => ({ key: 'DR-' + i, title: d.title, sub: d.code || 'Supporting document' })))}</div>`)
      : '';
    return `<div class="stack">${head}${body ? body(s, pack) : empty('Unknown tab')}${dataroom}</div>`;
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
    if (!list.length) return panel('Reports', '', empty('No reports yet', 'Run the Legal, Financial or Risk agent to produce a draft for expert review.')) + `<div style="margin-top:16px">${panel('Due diligence reports (PDF)', 'Available even before the agents run — gaps are shown as gaps', `<div class="pb">${pdfCards([{ key: 'LEGAL', eid: s.engagement.id, title: 'Legal due diligence', sub: '30+ pages' }, { key: 'FINANCIAL', eid: s.engagement.id, title: 'Financial due diligence', sub: '30+ pages' }, { key: 'COMBINED', eid: s.engagement.id, title: 'Combined DD & risk report', sub: '50+ pages' }])}</div>`)}</div>`;
    const r = list.find((x) => x.id === reportId) || list[0];
    let sections = []; try { sections = JSON.parse(r.sections); } catch { /* ignore */ }
    const pdfs = panel('Due diligence reports (PDF)', 'Typeset in your browser from the live engagement — findings, ratios, covenants, charts and the review trail', `<div class="pb">${pdfCards([
      { key: 'LEGAL', eid: s.engagement.id, title: 'Legal due diligence', sub: '30+ pages · corporate, licences, contracts, litigation' },
      { key: 'FINANCIAL', eid: s.engagement.id, title: 'Financial due diligence', sub: '30+ pages · QoE, ratios, working capital, IFRS' },
      { key: 'COMBINED', eid: s.engagement.id, title: 'Combined DD & risk report', sub: '50+ pages · legal, financial and risk register' }])}</div>`);
    return `${pdfs}<div class="split" style="margin-top:16px">
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
    return `${panel(pack.outputLabel + ' (PDF)', 'Cover, offer summary, contents, every drafted section, financial tables and charts. Unfinished sections are flagged, not invented.', `<div class="pb">${pdfCards([{ key: 'PROSPECTUS', eid: s.engagement.id, title: `${s.client.name} — draft ${pack.outputLabel.toLowerCase()}`, sub: '30 pages · ECMA section order' }])}</div>`)}<div class="stats" style="margin-top:16px">${stat(pack.outputLabel + ' complete', pct(s.prospectusProgress.percent), pack.name)}${stat('Sections drafted', `${s.prospectusProgress.drafted}/${s.prospectusProgress.total}`)}${stat('Approved', s.prospectusProgress.approved)}</div>
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
        ${panel('Your document checklist', 'Status of every item your advisor has requested', `<div class="pb">${chartBox(donut({ theme: SCREEN_THEME, width: 420, height: 190, centre: s.completeness.percent + '%', sub: 'complete', items: [{ label: 'Accepted', value: accepted.length, color: 'var(--good)' }, { label: 'Being reviewed', value: inReview.length, color: 'var(--low)' }, { label: 'Still needed', value: outstanding.length, color: 'var(--high)' }] }), 'Donut of checklist status')}<p class="small muted" style="margin:10px 0 0;line-height:1.55">${outstanding.length ? `${outstanding.length} item${outstanding.length === 1 ? '' : 's'} still needed — upload below, or ask the assistant what each should contain.` : 'Nothing outstanding from you right now. Your advisor is reviewing what you submitted.'}${shared.length ? ` ${shared.length} point${shared.length === 1 ? '' : 's'} shared with you by your advisor.` : ''}</p></div>`)}
        ${panel('Where your transaction stands', D.STAGE_META[s.engagement.stage].blurb, `<div class="pb"><ol class="steps">${D.STAGES.map((x, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><span class="b">${i < idx ? '✓' : ''}</span><div><div class="small" style="font-weight:${i === idx ? 600 : 450};color:${i <= idx ? 'var(--ink)' : 'var(--ink-faint)'}">${esc(D.STAGE_META[x].label)}${i === idx ? ' <span class="xs" style="color:var(--accent);font-weight:700;margin-left:6px">IN PROGRESS</span>' : ''}</div><div class="xs faint">${esc(D.STAGE_META[x].blurb)}</div></div></li>`).join('')}</ol></div>`)}
        ${panel('Documents we still need from you', `${outstanding.length} outstanding`, `<div class="pb" style="border-bottom:1px solid var(--hairline)">${meter(s.completeness.percent, 'Document completeness')}</div>${outstanding.length ? `<div class="list">${outstanding.map((r) => `<div class="row" style="align-items:flex-start;gap:12px"><div style="flex:1 1 240px"><div class="row" style="gap:6px;margin-bottom:4px">${r.mandatory ? chip('Required', 'high', true) : chip('Optional', 'info')}${st(r.status)}</div><div style="font-weight:500">${esc(r.title)}</div><div class="small muted" style="line-height:1.55;margin-top:2px">${esc(r.description)}</div></div><label class="btn sm primary" for="pup-${r.id}">Upload</label><input id="pup-${r.id}" type="file" accept=".txt,.md,.csv,.json" hidden data-up="${r.id}" data-eid="${eng.id}"></div>`).join('')}</div>` : empty('Everything we asked for is in')}`)}
      </div>
      ${shared.length ? panel('Items your advisor has raised with you', 'Points that need your attention', `<div class="list">${shared.map((f) => `<div><div style="font-weight:500;margin-bottom:3px">${esc(f.title)}</div>${f.recommendation ? `<div class="small muted" style="padding-left:11px;border-left:2px solid var(--accent-line)"><b>What we need:</b> ${esc(f.recommendation)}</div>` : ''}</div>`).join('')}</div>`) : ''}
      ${panel('Milestones', 'The plan agreed in your engagement letter', `<div class="tw"><table><thead><tr><th>#</th><th>Milestone</th><th>Target date</th><th>Status</th></tr></thead><tbody>${s.milestones.map((m) => `<tr><td class="mono faint">${m.sequence}</td><td style="font-weight:500">${esc(m.name)}</td><td class="small muted">${D.fmtDate(m.dueDate)}</td><td class="small">${tc(m.status)}</td></tr>`).join('')}</tbody></table></div>`)}
      <p class="xs faint" style="text-align:center">Internal review notes and draft reports are not shown here until ${esc(ORG.name)} releases them.</p>
    </div>`;
    return `<div class="main">${banner()}<header class="top">${lockup(42)}<span class="portal-tag">Client portal · ${esc(CLIENT_USER.name)}</span><div style="flex:1"></div><span class="small muted">${notify.unreadCount(CLIENT_USER.id)} unread</span></header><main class="content" style="max-width:1180px">${body}</main></div>`;
  }

  // ============================================================ additions
  // Login sequence, knowledge graph, charts, assistant (built-in + Claude),
  // PDF outputs and messaging previews.
  const { buildGraph, NODE_META, GraphView, answerLocally, buildCorpus, search, engagementBrief, portfolioBrief, assistantPrompt,
    stackedBars, donut, hbar, SCREEN_THEME, compact: compactNum, buildDDReport, buildProspectus, dataRoomPdf, TABLE_LAYOUTS,
    toTelegramHtml, toSlackMrkdwn, alertText, ABYSSINIA_DATAROOM, COMPANY } = AOS;
  const SESSION_KEY = 'advisoros-preview-session';
  let session = null; // { side: 'firm'|'client', userId }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const capability = (name) => (window.claude && typeof window.claude.use === 'function' ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
  let SAMPLE = null, DOWNLOADS = null;
  capability('sample').then((s) => { SAMPLE = s; renderDock(); });
  capability('downloads').then((d) => { DOWNLOADS = d; });

  // ---------------------------------------------------------------- login
  const DEMO = {
    firm: [['hundaol@siinqee-ib.demo', 'Hundaol Girma', 'Managing Director'], ['meron@siinqee-ib.demo', 'Meron Tadesse', 'Transaction Advisor'], ['dawit@siinqee-ib.demo', 'Dawit Bekele', 'Analyst']],
    client: [['finance@abyssiniaagro.et', 'Tigist Alemu', 'Abyssinia Agro · CFO'], ['yohannes@lalibelacement.et', 'Yohannes Girma', 'Lalibela Cement · FD']],
  };
  const CHECKS = {
    firm: ['Credentials verified', 'Firm workspace & role loaded', 'Agent queue and review inbox synced', 'Opening dashboard'],
    client: ['Credentials verified', 'Engagement scope isolated to your company', 'Shared findings & document checklist loaded', 'Opening your portal'],
  };
  const L = { side: 'firm', step: 'email', email: '', password: '', err: null, errSwitch: false, done: 0, name: '' };

  function loginCard() {
    const si = ['email', 'password', 'verify', 'welcome'].indexOf(L.step);
    let inner = '';
    if (L.step === 'email') inner = `<form data-form="login-email" class="step-in" style="display:grid;gap:12px">
        <div><h2 style="font-size:18px;font-weight:600;letter-spacing:-.02em;margin:0 0 3px">${L.side === 'firm' ? 'Sign in — Siinqee Investment Bank' : 'Sign in to your client portal'}</h2>
        <p class="small faint" style="margin:0">${L.side === 'firm' ? 'Investment banking and transaction advisory staff.' : 'See your progress, missing documents and shared findings.'}</p></div>
        <div><label class="label" for="l-email">Work email</label><input id="l-email" class="input" type="email" autocomplete="username" required value="${esc(L.email)}" placeholder="${L.side === 'firm' ? 'you@siinqee-ib.demo' : 'you@company.et'}"></div>
        ${L.err ? `<div role="alert" class="shake small" style="color:var(--critical);background:var(--critical-soft);padding:8px 10px;border-radius:8px">${esc(L.err)}</div>` : ''}
        <button class="btn primary" style="height:40px" type="submit">Continue →</button>
        <div style="margin-top:6px;padding-top:14px;border-top:1px solid var(--hairline)"><div class="eyebrow" style="margin-bottom:8px">Demo accounts · password <span class="mono">demo1234</span></div>
          <div style="display:grid;gap:5px">${DEMO[L.side].map(([em, n, r]) => `<button type="button" class="btn sm lift" style="justify-content:space-between;width:100%;height:32px" data-act="l-demo" data-k="${em}"><span>${esc(n)}</span><span class="xs faint">${esc(r)}</span></button>`).join('')}</div></div>
      </form>`;
    else if (L.step === 'password') inner = `<form data-form="login-pw" class="step-in" style="display:grid;gap:12px">
        <button type="button" data-act="l-back" style="display:flex;align-items:center;gap:10px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:99px;padding:5px 12px 5px 5px;cursor:pointer;justify-self:start">
          <span style="width:26px;height:26px;border-radius:99px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-size:12px;font-weight:700">${esc(L.email.slice(0, 1).toUpperCase())}</span><span class="small">${esc(L.email)}</span><span class="xs faint">change</span></button>
        <div><label class="label" for="l-pw">Password</label><input id="l-pw" class="input" type="password" autocomplete="current-password" required value="${esc(L.password)}"></div>
        ${L.err ? `<div role="alert" class="shake small" style="color:var(--critical);background:var(--critical-soft);padding:8px 10px;border-radius:8px;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${esc(L.err)}</span>${L.errSwitch ? '<button type="button" class="btn sm" data-act="l-switch">Switch</button>' : ''}</div>` : ''}
        <button class="btn primary" style="height:40px" type="submit">Sign in</button></form>`;
    else inner = `<div class="step-in" style="display:grid;gap:14px" aria-live="polite">
        ${L.step === 'welcome' ? `<div style="text-align:center;padding:10px 0 4px"><div class="welcome-badge" aria-hidden="true">✓</div><h2 style="font-size:20px;font-weight:600;margin:12px 0 4px">Welcome, ${esc(L.name.split(' ')[0])}</h2><p class="small faint" style="margin:0">${L.side === 'firm' ? 'Taking you to the bank dashboard…' : 'Taking you to your portal…'}</p></div>` : '<h2 style="font-size:16px;font-weight:600;margin:0">Securing your session</h2>'}
        <ul class="verify" style="list-style:none;padding:0;margin:0">${CHECKS[L.side].map((c, i) => `<li class="${i < L.done ? 'done' : i === L.done ? 'run' : ''}"><span class="tick">${i < L.done ? '✓' : ''}</span>${esc(c)}</li>`).join('')}</ul></div>`;
    return `<div class="panel login-card" id="login-card">
      <div class="side-toggle" role="tablist" aria-label="Sign-in side" style="margin-bottom:20px"><span class="thumb" style="transform:${L.side === 'client' ? 'translateX(100%)' : 'none'}" aria-hidden="true"></span>
        <button role="tab" type="button" aria-selected="${L.side === 'firm'}" data-act="l-side" data-k="firm">Bank staff</button><button role="tab" type="button" aria-selected="${L.side === 'client'}" data-act="l-side" data-k="client">Client</button></div>
      <div class="row" style="justify-content:space-between;margin-bottom:14px"><div class="steps-dots" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i <= si ? 'on' : ''}"></i>`).join('')}</div><span class="xs faint">Step ${Math.min(si + 1, 4)} of 4</span></div>
      ${inner}</div>`;
  }
  function loginView() {
    return `<main class="login-stage"><section class="login-art"><canvas id="login-canvas" aria-hidden="true"></canvas>
      <div class="row" style="gap:10px"><img src="${BI.dark}" alt="Siinqee Investment Bank — Make it count" style="height:84px;width:auto"></div>
      <div style="max-width:480px"><h1 class="login-title" style="font-size:34px;font-weight:600;letter-spacing:-.035em;line-height:1.12;margin:0 0 14px">One workspace from mandate to ECMA filing.</h1>
        <p style="font-size:14px;opacity:.78;line-height:1.65;margin:0 0 22px">Advisors run six specialised agents over the data room and review every draft. Clients see live progress, missing documents and the findings their advisor chose to share.</p>
        <div class="login-feats">${[['Firm side', 'Engagements, agents, review inbox, 30+ page due diligence PDFs'], ['Client side', 'Checklist, uploads, milestones, shared findings only'], ['Connected', 'Email, Telegram and Slack alerts on compliance gaps']].map(([t, d], i) => `<div class="login-feat" style="animation-delay:${0.15 + i * 0.12}s"><div style="font-size:12.5px;font-weight:600">${t}</div><div class="xs" style="opacity:.7;line-height:1.5">${d}</div></div>`).join('')}</div></div>
      <div class="xs" style="opacity:.6"><span class="brand-chip" style="color:inherit"><i></i><i></i>Member of the Siinqee Financial Group</span> · Preview — client data is fictional; changes stay in this browser.</div></section>
      <section class="login-pane">${loginCard()}</section></main>`;
  }
  function paintLogin() { const c = document.getElementById('login-card'); if (c) c.outerHTML = loginCard(); focusLogin(); }
  function focusLogin() { setTimeout(() => document.getElementById(L.step === 'password' ? 'l-pw' : 'l-email')?.focus(), 30); }
  function findUser(email) { return AOS.one('SELECT * FROM users WHERE lower(email) = lower(?) AND active = 1', [email]); }
  async function loginSubmit() {
    L.err = null; L.errSwitch = false;
    const u = findUser(L.email);
    if (!u || L.password !== 'demo1234') { L.err = 'Those credentials were not recognised.'; paintLogin(); return; }
    const isClient = u.role === 'CLIENT';
    if (L.side === 'firm' && isClient) { L.err = 'This is a client-portal account. Switch to “Client” to continue.'; L.errSwitch = true; paintLogin(); return; }
    if (L.side === 'client' && !isClient) { L.err = 'This is a firm account. Switch to “Bank staff” to continue.'; L.errSwitch = true; paintLogin(); return; }
    L.name = u.name; L.step = 'verify'; L.done = 0; paintLogin();
    const gap = reduced() ? 60 : 420;
    for (let i = 1; i <= CHECKS[L.side].length; i++) { await new Promise((r) => setTimeout(r, gap)); L.done = i; paintLogin(); }
    L.step = 'welcome'; paintLogin();
    await new Promise((r) => setTimeout(r, reduced() ? 150 : 900));
    session = { side: L.side, userId: u.id };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
    applySession();
    repo.audit({ orgId: ORG.id, actorId: u.id, actorName: u.name, action: 'auth.login', entityType: 'User', entityId: u.id });
    save();
    location.hash = isClient ? '#/portal' : '#/dashboard';
    chat.msgs = []; render();
  }
  function applySession() {
    if (!session) return;
    const u = AOS.one('SELECT * FROM users WHERE id = ?', [session.userId]);
    if (!u) { session = null; return; }
    if (u.role === 'CLIENT') { CLIENT_USER = u; role = 'client'; } else { STAFF = u; role = 'staff'; }
  }
  function signOut() {
    session = null; try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    Object.assign(L, { step: 'email', email: '', password: '', err: null, done: 0 });
    chat.open = false; chat.msgs = []; location.hash = ''; render();
  }
  let artStop = null;
  function startLoginArt() {
    const canvas = document.getElementById('login-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); let w = 0, h = 0, raf = 0; const mouse = { x: -999, y: -999 };
    const pts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006, r: 1 + Math.random() * 2.2 }));
    const resize = () => { const d = Math.min(devicePixelRatio || 1, 2); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const draw = () => {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) if (!reduced()) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; }
      for (let i = 0; i < pts.length; i++) { const a = pts[i], ax = a.x * w, ay = a.y * h;
        for (let j = i + 1; j < pts.length; j++) { const b = pts[j], d = Math.hypot(ax - b.x * w, ay - b.y * h); if (d < 120) { ctx.strokeStyle = `rgba(112,137,255,${(1 - d / 120) * 0.38})`; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); } }
        const near = Math.hypot(ax - mouse.x, ay - mouse.y) < 90; ctx.fillStyle = near ? '#E9D001' : i % 6 === 0 ? 'rgba(233,208,1,.85)' : 'rgba(150,170,255,.85)'; ctx.beginPath(); ctx.arc(ax, ay, a.r + (near ? 1.5 : 0), 0, 7); ctx.fill(); }
      if (!reduced()) raf = requestAnimationFrame(draw);
    };
    const move = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; if (reduced()) draw(); };
    resize(); draw(); addEventListener('resize', resize); canvas.parentElement.addEventListener('pointermove', move);
    artStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }

  // ------------------------------------------------------ graph + charts
  let graphViews = [];
  const G = { hidden: new Set(['DOCUMENT']), q: '', sel: null };
  function allSnaps() { return repo.listEngagements(ORG.id).map((e) => repo.snapshot(ORG.id, e.id)).filter(Boolean); }
  function staffList() { return AOS.all("SELECT id, orgId, email, name, role, title, clientId, avatarColor, active FROM users WHERE orgId = ? AND role != 'CLIENT'", [ORG.id]); }
  function graphBlock(height, key) {
    const graph = buildGraph(ORG, staffList(), allSnaps());
    return `<div style="display:grid;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap"><div class="graph-legend" role="group" aria-label="Show or hide node types">${Object.keys(NODE_META).filter((t) => graph.counts[t]).map((t) => `<button type="button" data-act="g-toggle" data-k="${t}" aria-pressed="${!G.hidden.has(t)}"><i style="background:${NODE_META[t].color}"></i>${esc(NODE_META[t].label)} <span class="faint">${graph.counts[t]}</span></button>`).join('')}</div>
        <div style="flex:1"></div><input class="input" style="width:200px" placeholder="Find a node…" aria-label="Search the graph" data-gq="${key}" value="${esc(G.q)}"><button class="btn sm" data-act="g-reset">Reset view</button></div>
      <div class="graph-wrap" style="height:${height}px"><canvas data-graph="${key}" tabindex="0" aria-label="Knowledge graph of the operation. Drag to move, scroll to zoom, click a node for details."></canvas><div data-gcard="${key}"></div></div></div>`;
  }
  function graphCard(sel) {
    if (!sel) return `<div class="xs faint" style="position:absolute;left:12px;bottom:10px;pointer-events:none">Drag nodes · scroll to zoom · click for details · pulsing nodes are critical</div>`;
    const { node, nb } = sel;
    const link = node.link ? previewLink(node.link) : null;
    return `<div class="panel graph-card fade-up" style="box-shadow:var(--shadow-md)"><div style="padding:12px 14px;border-bottom:1px solid var(--hairline)">
      <div class="row" style="gap:7px;margin-bottom:4px"><i style="width:9px;height:9px;border-radius:99px;background:${NODE_META[node.type].color}"></i><span class="eyebrow">${esc(NODE_META[node.type].label)}</span><button class="btn ghost sm" style="margin-left:auto" data-act="g-close" aria-label="Close">✕</button></div>
      <div style="font-size:14px;font-weight:600;line-height:1.35">${esc(node.label)}</div><div class="xs faint">${esc(node.sub || '')}</div></div>
      <dl style="margin:0;padding:10px 14px;display:grid;grid-template-columns:auto 1fr;gap:6px 10px;font-size:12px">${node.detail.map(([k, v]) => `<dt class="faint">${esc(k)}</dt><dd style="margin:0">${esc(v)}</dd>`).join('')}</dl>
      <div style="padding:8px 14px 12px"><div class="eyebrow" style="margin-bottom:6px">Connected to ${nb.length}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${nb.slice(0, 14).map((n) => `<button class="chip" style="cursor:pointer;border:0" data-act="g-focus" data-k="${esc(n.id)}"><i style="width:6px;height:6px;border-radius:9px;background:${NODE_META[n.type].color}"></i>${esc(n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label)}</button>`).join('')}</div>
      ${link ? `<a class="btn primary sm" style="margin-top:10px;width:100%" href="${link}">Open</a>` : ''}</div></div>`;
  }
  // Map production routes onto the preview's hash routes.
  function previewLink(link) {
    const m = link.match(/^\/engagements\/([^/?#]+)(?:\/([a-z]+))?/);
    if (m) return `#/e/${m[1]}${m[2] ? '/' + m[2] : ''}`;
    if (link.startsWith('/clients')) return '#/clients';
    if (link.startsWith('/agents')) return '#/agents';
    if (link.startsWith('/rules')) return '#/rules';
    if (link.startsWith('/portal')) return '#/portal';
    return '#/dashboard';
  }
  function mountGraphs() {
    graphViews.forEach((v) => v.destroy()); graphViews = [];
    document.querySelectorAll('canvas[data-graph]').forEach((canvas) => {
      const key = canvas.dataset.graph;
      const graph = buildGraph(ORG, staffList(), allSnaps());
      const card = document.querySelector(`[data-gcard="${key}"]`);
      const v = new GraphView(canvas, graph, {
        onSelect: (node, nb) => { G.sel = node ? { node, nb } : null; card.innerHTML = graphCard(G.sel); },
        dark: () => document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches),
        reducedMotion: reduced(),
      });
      v.setHidden([...G.hidden]); if (G.q) v.setQuery(G.q);
      card.innerHTML = graphCard(null);
      graphViews.push(v);
    });
  }
  const chartBox = (svg, label) => `<div class="chart" role="img" aria-label="${esc(label)}">${svg}</div>`;
  function dashCharts(snaps) {
    const active = snaps.filter((s) => s.engagement.status === 'ACTIVE');
    const sevs = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const fees = snaps.reduce((a, x) => ({ paid: a.paid + x.fees.paid, out: a.out + x.fees.outstanding, unb: a.unb + x.fees.unbilled, tot: a.tot + (x.contract?.totalFee ?? 0) }), { paid: 0, out: 0, unb: 0, tot: 0 });
    const c1 = stackedBars({ theme: SCREEN_THEME, width: 520,
      rows: active.map((s) => ({ label: s.engagement.reference, parts: sevs.map((k) => ({ key: k, value: s.findings.filter((f) => f.severity === k && ['OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION'].includes(f.status)).length })) })),
      colors: { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' } });
    const c2 = donut({ theme: SCREEN_THEME, width: 440, height: 180, centre: compactNum(fees.tot), sub: 'ETB contracted',
      items: [{ label: 'Received', value: fees.paid, color: 'var(--good)' }, { label: 'Invoiced, unpaid', value: fees.out, color: 'var(--high)' }, { label: 'Not yet billed', value: fees.unb, color: 'var(--low)' }] });
    const c3 = hbar({ theme: SCREEN_THEME, width: 520, max: 100, format: (v) => `${v}%`,
      items: active.map((s) => ({ label: `${s.engagement.reference} ${s.client.name}`, value: s.completeness.percent, color: s.completeness.percent >= 75 ? 'var(--good)' : s.completeness.percent >= 40 ? 'var(--high)' : 'var(--critical)' })) });
    return `<div class="charts">${panel('Open findings by engagement', 'Severity mix', `<div class="pb">${chartBox(c1, 'Stacked bars of open findings by severity')}</div>`)}${panel('Fee position', 'Across all contracts', `<div class="pb">${chartBox(c2, 'Donut of fees')}</div>`)}${panel('Document completeness', 'Weighted against each rule pack', `<div class="pb">${chartBox(c3, 'Bars of completeness')}</div>`)}</div>`;
  }
  function graphPage() {
    return `<div class="stack"><header class="reveal"><div class="eyebrow">Operation map</div><h1 class="h1">Knowledge graph</h1><p class="sub">Every client, engagement, document, finding, risk, milestone, agent and team member — and how they connect. Click a node to focus its neighbourhood; filter by type with the legend.</p></header>
      <section class="panel reveal"><div class="pb">${graphBlock(640, 'full')}</div></section></div>`;
  }

  // -------------------------------------------------------------- motion
  let io = null;
  function motion() {
    if (io) io.disconnect();
    const els = [...document.querySelectorAll('.panel, .reveal')].filter((e) => !e.closest('.login-stage'));
    els.forEach((e) => e.classList.add('reveal'));
    if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.05 });
    els.forEach((e, i) => { if (!e.classList.contains('in')) { io.observe(e); setTimeout(() => e.classList.add('in'), 2000 + i * 10); } });
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count), suffix = el.dataset.suffix || '', t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / 900); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US') + suffix; if (k < 1) requestAnimationFrame(step); };
      step();
    });
  }
  document.addEventListener('pointerdown', (ev) => {
    if (reduced()) return;
    const btn = ev.target.closest('.btn'); if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span');
    s.className = 'ripple'; s.style.width = s.style.height = d + 'px'; s.style.left = ev.clientX - r.left - d / 2 + 'px'; s.style.top = ev.clientY - r.top - d / 2 + 'px';
    btn.appendChild(s); setTimeout(() => s.remove(), 600);
  });

  // ----------------------------------------------------------- assistant
  const chat = { open: false, msgs: [], busy: false, engine: 'local', abort: null };
  function clientView(s) { return { ...s, findings: s.findings.filter((f) => f.visibleToClient), risks: [], runs: [], tasks: [], meetings: [], prospectus: s.prospectus.map((p) => ({ ...p, body: '' })), documents: s.documents.map((d) => ({ ...d, extractedText: null })) }; }
  function scope() {
    if (role === 'client') { const snaps = repo.listEngagementsForClient(CLIENT_USER.clientId).map((e) => repo.snapshot(ORG.id, e.id)).filter(Boolean).map(clientView); return { snaps, staff: [] }; }
    return { snaps: allSnaps(), staff: staffList() };
  }
  const SUGGEST = {
    staff: ['What is blocking each engagement?', 'Which documents are still missing for Abyssinia?', 'Show critical findings', 'What is the covenant headroom?', 'Summarise fees outstanding', 'Who is on the Abyssinia team?'],
    client: ['What do you still need from us?', 'Where does our transaction stand?', 'What points has our advisor raised?', 'When is the next milestone?'],
  };
  function msgHtml(m) {
    if (m.role === 'me') return `<div class="msg me">${esc(m.text)}</div>`;
    if (m.pending && !m.text) return `<div class="msg ai"><span class="typing"><span></span><span></span><span></span></span>${m.status ? ` <span class="xs faint">${esc(m.status)}</span>` : ''}</div>`;
    return `<div class="msg ai"><div class="prose">${renderMarkdown(m.text)}</div>${(m.sources || []).length ? `<div>${m.sources.slice(0, 6).map((s) => `<a class="src-chip" href="${previewLink(s.link)}">↗ ${esc(s.title)}</a>`).join('')}</div>` : ''}<div class="xs faint" style="margin-top:6px">${m.engine === 'claude' ? 'Claude, from the records' : 'Answered from the records'}</div></div>`;
  }
  function chatPanel(inline) {
    const aud = role === 'client' ? 'client' : 'staff';
    return `<div class="dock ${inline ? 'inline' : ''}" role="dialog" aria-label="Assistant">
      <div class="dock-head"><span class="pulse-dot"></span><div style="flex:1"><div class="small" style="font-weight:600">${aud === 'client' ? 'Ask about your transaction' : 'Ask Advisor OS'}</div><div class="xs faint">${aud === 'client' ? 'Only what your advisor has shared with you' : 'Answers from every engagement, document and finding'}</div></div>
        ${SAMPLE ? `<div class="engine-toggle" role="group" aria-label="Answer engine"><button type="button" data-act="c-engine" data-k="local" aria-pressed="${chat.engine === 'local'}">Built-in</button><button type="button" data-act="c-engine" data-k="claude" aria-pressed="${chat.engine === 'claude'}">Claude</button></div>` : ''}
        ${inline ? '' : '<button class="btn ghost sm" data-act="c-close" aria-label="Close assistant">✕</button>'}</div>
      <div class="msgs" id="chat-msgs">${msgsInner()}</div>
      <form class="dock-form" data-form="chat"><label for="chat-in" style="position:absolute;left:-9999px">Question</label><input id="chat-in" class="input" autocomplete="off" placeholder="Ask about any client, document, finding or fee…" ${chat.busy ? 'disabled' : ''}><button class="btn primary" ${chat.busy ? 'disabled' : ''}>${chat.busy ? '…' : 'Ask'}</button></form></div>`;
  }
  function msgsInner() {
    const aud = role === 'client' ? 'client' : 'staff';
    return chat.msgs.length ? chat.msgs.map(msgHtml).join('') : `<div class="small muted" style="line-height:1.6">Ask about missing documents, findings, covenants, ratios, milestones, fees or people.${SAMPLE ? ' Switch to <b>Claude</b> for reasoning over the same records.' : ''}</div><div class="suggest">${SUGGEST[aud].map((q) => `<button type="button" data-act="c-ask" data-k="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  }
  function paintChat() {
    const box = document.getElementById('chat-msgs');
    if (!box) return;
    box.innerHTML = msgsInner();
    box.scrollTop = box.scrollHeight;
    document.querySelectorAll('[data-form=chat] input, [data-form=chat] button').forEach((e) => { e.disabled = chat.busy; });
  }
  function renderDock() {
    let host = document.getElementById('dock-root');
    if (!host) { host = document.createElement('div'); host.id = 'dock-root'; document.body.appendChild(host); }
    if (!session || route()[0] === 'assistant') { host.innerHTML = ''; return; }
    host.innerHTML = (chat.open ? chatPanel(false) : '') + `<button class="dock-btn" data-act="c-toggle" aria-expanded="${chat.open}">💬 ${chat.open ? 'Close' : 'Ask'}</button>`;
    if (chat.open) { paintChat(); setTimeout(() => document.getElementById('chat-in')?.focus(), 30); }
  }
  function assistantPage() {
    return `<div class="stack"><header class="reveal"><div class="eyebrow">Portfolio assistant</div><h1 class="h1">Ask the OS</h1><p class="sub">Questions across every engagement — missing documents, critical findings, covenant headroom, ratios, fees, milestones, who owns what. Answers cite the records they came from.${SAMPLE ? ' Toggle <b>Claude</b> to have Claude reason over the same records with search tools.' : ''}</p></header>
      <section class="panel" style="height:min(680px, calc(100vh - 230px));display:flex;flex-direction:column;overflow:hidden">${chatPanel(true)}</section></div>`;
  }
  async function ask(q) {
    q = q.trim(); if (!q || chat.busy) return;
    chat.msgs.push({ role: 'me', text: q });
    const { snaps, staff } = scope();
    const corpus = buildCorpus(snaps);
    const local = answerLocally(q, snaps, staff, corpus);
    if (chat.engine !== 'claude' || !SAMPLE) {
      chat.msgs.push({ role: 'ai', text: local.text, sources: local.sources, engine: 'local' });
      paintChat(); return;
    }
    const m = { role: 'ai', text: '', pending: true, status: 'Thinking…', sources: local.sources, engine: 'claude' };
    chat.msgs.push(m); chat.busy = true; paintChat();
    const byRef = (ref) => snaps.find((s) => s.engagement.reference.toLowerCase() === String(ref).toLowerCase() || s.client.name.toLowerCase().includes(String(ref).toLowerCase()));
    const tools = [
      { name: 'search_records', description: 'Full-text search over engagement records (documents, findings, requirements, risks, milestones, fees, people). Returns the best matching records with their text.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: ({ query }) => { m.status = `Searching “${query}”…`; paintChat(); return search(corpus, String(query), 6).map((c) => ({ title: c.title, ref: c.ref, text: c.text.slice(0, 900) })); } },
      { name: 'engagement_brief', description: 'Structured brief of one engagement by reference (e.g. EQ-2026-001) or client name: stage, completeness, missing documents, findings, milestones, fees.',
        inputSchema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] },
        execute: ({ reference }) => { const s = byRef(reference); if (!s) throw new Error('No engagement matches ' + reference); m.status = `Reading ${s.engagement.reference}…`; paintChat(); return { brief: engagementBrief(s, staff) }; } },
      { name: 'portfolio_brief', description: 'One-paragraph-per-engagement overview of the whole book.', inputSchema: { type: 'object', properties: {} },
        execute: () => ({ brief: portfolioBrief(snaps, staff) }) },
    ];
    const history = chat.msgs.slice(0, -2).filter((x) => x.text).slice(-6).map((x) => ({ role: x.role === 'me' ? 'user' : 'assistant', content: x.text }));
    const prompt = `${assistantPrompt(q, snaps, staff, corpus)}\n\n${role === 'client' ? 'You are answering the CLIENT. Only discuss what is in these records; never mention internal notes, risks or unreleased drafts.' : 'You are answering a member of the advisory firm.'}\nUse the tools when the records above are not enough. Reply in concise Markdown with the engagement references you relied on.`;
    try {
      chat.abort = new AbortController();
      const res = await SAMPLE([...history, { role: 'user', content: prompt }], { tools, cache: false, signal: chat.abort.signal, onText: ({ text }) => { m.text = text; m.pending = true; paintChat(); } });
      m.text = res.text || local.text; m.pending = false;
    } catch (e) {
      m.pending = false;
      if (e && e.code === 'not_granted') { SAMPLE = null; }
      m.text = (e && e.text) || `${local.text}\n\n_Claude was unavailable (${esc((e && e.code) || 'error')}); this is the built-in answer._`; m.engine = 'local';
    }
    chat.busy = false; paintChat();
  }

  // ------------------------------------------------------------ PDFs
  function pdfCards(items) {
    return `<div class="charts" style="grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))">${items.map((it) => `<button type="button" class="pdf-card lift" data-act="pdf" data-k="${it.key}" data-id="${it.eid || ''}"><span class="pdf-ico" aria-hidden="true">PDF</span><span style="display:grid;gap:2px;text-align:left"><span class="small" style="font-weight:600">${esc(it.title)}</span><span class="xs faint" data-pdfinfo="${it.key}">${esc(it.sub)}</span></span></button>`).join('')}</div>`;
  }
  const fileSlug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '');
  async function makePdf(key, eid, btn) {
    const info = document.querySelector(`[data-pdfinfo="${key}"]`);
    const ico = btn.querySelector('.pdf-ico');
    btn.disabled = true; ico.innerHTML = '<span class="spinner"></span>'; if (info) info.textContent = 'Typesetting…';
    await new Promise((r) => setTimeout(r, 30));
    try {
      let def, name;
      if (key.startsWith('DR-')) {
        const d = ABYSSINIA_DATAROOM[Number(key.slice(3))];
        def = dataRoomPdf(d.title, d.body, COMPANY.name); name = `${d.code || 'OTHER'}_${d.fileName.replace(/\.txt$/, '.pdf')}`;
      } else {
        const s = repo.snapshot(ORG.id, eid);
        const lead = AOS.one('SELECT name FROM users WHERE id = ?', [s.engagement.leadAdvisorId]);
        if (key === 'PROSPECTUS') { def = buildProspectus(s, { firmName: ORG.name }); name = `${fileSlug(s.client.name)}_Prospectus.pdf`; }
        else {
          const report = repo.listReports(eid).find((r) => r.kind === key && r.status !== 'SUPERSEDED');
          def = buildDDReport(s, key, { firmName: ORG.name, preparedBy: lead?.name || STAFF.name,
            reviewer: report?.reviewerId ? AOS.one('SELECT name FROM users WHERE id = ?', [report.reviewerId])?.name : null, approved: report?.status === 'APPROVED',
            auditLog: repo.listAudit(ORG.id, { engagementId: eid, limit: 40 }).map((a) => ({ at: a.createdAt, actor: a.actorName, action: a.action })),
            agentRuns: s.runs.map((r) => ({ agent: r.agent, at: r.createdAt, summary: r.summary, engine: r.engine })) });
          name = `${fileSlug(s.client.name)}_${{ LEGAL: 'Legal', FINANCIAL: 'Financial', COMBINED: 'Combined' }[key]}_DD.pdf`;
        }
      }
      if (!key.startsWith('DR-') && BI.dark && Array.isArray(def.content)) def.content.unshift({ image: BI.dark, fit: [150, 44], absolutePosition: { x: 397, y: 30 } });
      const bytes = await new Promise((resolve, reject) => { try { pdfMake.createPdf(def, TABLE_LAYOUTS).getBuffer((b) => resolve(b)); } catch (e) { reject(e); } });
      let latin = ''; for (let i = 0; i < bytes.length; i += 0x8000) latin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const pages = (latin.match(/\/Type\s*\/Page[^s]/g) || []).length;
      const label = `${pages} pages · ${(bytes.length / 1024).toFixed(0)} KB`;
      if (info) info.textContent = `${label} · saving…`;
      if (DOWNLOADS) {
        try { await DOWNLOADS.save({ filename: name, data: new Blob([bytes], { type: 'application/pdf' }) }); if (info) info.textContent = `${label} · saved`; }
        catch (e) { if (info) info.textContent = e && e.code === 'declined' ? `${label} · not saved` : `${label} · ${e && e.code || 'save failed'}`; }
      } else {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000); if (info) info.textContent = `${label} · downloaded`;
      }
    } catch (e) { if (info) info.textContent = 'Failed: ' + e.message; }
    btn.disabled = false; ico.textContent = 'PDF';
  }

  // -------------------------------------------------------- integrations
  function integrationsPage() {
    const recent = AOS.all('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 4', [STAFF.id]);
    const n = recent[0] || { title: 'Critical finding raised on EQ-2026-001', body: 'The share register does not identify beneficial owners.', severity: 'CRITICAL', link: '/engagements' };
    const sevOf = (x) => (x.severity === 'CRITICAL' ? 'CRITICAL' : x.severity === 'WARNING' || x.severity === 'HIGH' ? 'WARNING' : 'INFO');
    const { md } = alertText({ ...n, severity: sevOf(n) }, 'https://advisor.example.et');
    return `<div class="stack"><header class="reveal"><div class="eyebrow">Configuration</div><h1 class="h1">Telegram &amp; Slack</h1><p class="sub">In the deployed app, alerts on compliance gaps, missing documents and agent completions are pushed to a Telegram group and a Slack channel, and both answer questions (<span class="mono">/ask</span> in Telegram, <span class="mono">/advisor</span> in Slack) with the same assistant. This preview cannot reach external services, so below is exactly what would be sent.</p></header>
      <div class="cols">
        ${panel('Telegram', 'Bot token + chat ID · webhook registered from Settings', `<div class="pb" style="display:grid;gap:12px"><div class="tg-bubble">${toTelegramHtml(md).replace(/\n/g, '<br>')}</div>
          <div class="xs faint">Setup: create a bot with @BotFather, add it to the deal-team group, paste the token and chat ID in Settings → Telegram, press <b>Save &amp; register webhook</b>. Incoming updates are verified with Telegram's secret-token header.</div></div>`)}
        ${panel('Slack', 'Incoming webhook + signed slash command', `<div class="pb" style="display:grid;gap:12px"><pre class="mono xs" style="margin:0;white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--hairline);border-radius:8px;padding:10px">${esc(toSlackMrkdwn(md))}</pre>
          <div class="xs faint">Setup: create a Slack app, enable Incoming Webhooks and add one to the channel, add a <span class="mono">/advisor</span> slash command pointing at the request URL shown in Settings, paste the webhook URL and signing secret. Requests are verified with Slack's v0 HMAC signature and a 5-minute replay window.</div></div>`)}
      </div>
      ${panel('Recent alerts that would be broadcast', 'Only alerts at or above the configured minimum severity are sent', recent.length ? `<div class="list">${recent.map((x) => `<div><div class="row" style="gap:6px;margin-bottom:3px">${sev(sevOf(x))}<b class="small">${esc(x.title)}</b></div><div class="small muted">${esc(x.body)}</div></div>`).join('')}</div>` : empty('No alerts yet', 'Run an agent to generate some.'))}
    </div>`;
  }

  // ----------------------------------------------------------------- render
  function render() {
    const app = document.getElementById('app');
    if (artStop) { artStop(); artStop = null; }
    if (!session) { app.innerHTML = loginView(); renderDock(); startLoginArt(); focusLogin(); return; }
    const p = route();
    if (role === 'client') { app.innerHTML = portal(); }
    else {
      let body;
      if (p[0] === 'e' && p[1]) body = engagement(p[1], p[2] || '');
      else body = ({ dashboard, engagements: engagementsList, clients: clientsList, agents: agentsOverview, rules, audit: auditView, graph: graphPage, assistant: assistantPage, integrations: integrationsPage }[p[0]] || dashboard)();
      app.innerHTML = staffShell(p, body);
    }
    if (p[0] === 'assistant' && role !== 'client') paintChat();
    renderDock(); mountGraphs(); motion();
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

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'login-email') {
      L.email = document.getElementById('l-email').value.trim(); L.err = null;
      if (!/^\S+@\S+\.\S+$/.test(L.email)) { L.err = 'Enter a valid email address.'; paintLogin(); return; }
      L.step = 'password'; paintLogin(); return;
    }
    if (f.dataset.form === 'login-pw') { L.password = document.getElementById('l-pw').value; loginSubmit(); return; }
    if (f.dataset.form === 'chat') { const inp = f.querySelector('input'); const q = inp.value; inp.value = ''; ask(q); }
  });
  let gqTimer = null;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.gq !== undefined) { clearTimeout(gqTimer); gqTimer = setTimeout(() => { G.q = el.value; graphViews.forEach((v) => v.setQuery(G.q)); }, 250); }
  });

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
      case 'l-side': if (L.step === 'verify' || L.step === 'welcome') return; Object.assign(L, { side: k, step: 'email', err: null, email: '', password: '' }); paintLogin(); break;
      case 'l-demo': Object.assign(L, { email: k, password: 'demo1234', err: null, step: 'password' }); paintLogin(); break;
      case 'l-back': Object.assign(L, { step: 'email', err: null }); paintLogin(); break;
      case 'l-switch': Object.assign(L, { side: L.side === 'firm' ? 'client' : 'firm', err: null, errSwitch: false, step: 'password' }); paintLogin(); break;
      case 'signout': signOut(); break;
      case 'g-toggle': G.hidden.has(k) ? G.hidden.delete(k) : G.hidden.add(k); el.setAttribute('aria-pressed', String(!G.hidden.has(k))); graphViews.forEach((v) => v.setHidden([...G.hidden])); break;
      case 'g-reset': G.q = ''; document.querySelectorAll('[data-gq]').forEach((i) => { i.value = ''; }); graphViews.forEach((v) => { v.setQuery(''); v.reset(); }); break;
      case 'g-close': G.sel = null; graphViews.forEach((v) => v.reset()); document.querySelectorAll('[data-gcard]').forEach((c) => { c.innerHTML = graphCard(null); }); break;
      case 'g-focus': { const card = el.closest('[data-gcard]'); const v = graphViews[[...document.querySelectorAll('[data-gcard]')].indexOf(card)]; if (v) v.focus(k); break; }
      case 'c-toggle': chat.open = !chat.open; renderDock(); break;
      case 'c-close': chat.open = false; renderDock(); break;
      case 'c-ask': ask(k); break;
      case 'c-engine': chat.engine = k; document.querySelectorAll('[data-act=c-engine]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); break;
      case 'pdf': makePdf(k, id, el); break;
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
    if (fresh) session = null;
    else { try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; } }
    applySession();
    render();
  }
  boot(false).catch((e) => { document.getElementById('app').innerHTML = `<div class="loading">Could not start the preview: ${esc(e.message)}</div>`; });
})();
