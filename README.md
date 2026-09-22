# ET Transactional Advisor OS

An operating system for licensed transaction advisers in Ethiopia. It takes a mandate
from onboarding through document collection, due diligence, risk assessment and
prospectus drafting to an ECMA filing — with a shared dashboard the client can see.

Six specialised agents do the first pass; a human expert reviews and approves everything
before it leaves the firm.

---

## Running it

```bash
npm install
npm run seed     # creates the database and a full demo practice
npm run dev      # http://localhost:3000
```

Sign in with password `demo1234`:

| Email | Role | Sees |
|---|---|---|
| `hundaol@siinqee-ib.demo` | Managing Director | Everything, including approvals and user management |
| `meron@siinqee-ib.demo` | Transaction Advisor | Deal team: clients, engagements, stage advances |
| `dawit@siinqee-ib.demo` | Analyst | Review and agent runs, no stage advance or approval |
| `finance@abyssiniaagro.et` | Client | The client portal for Abyssinia Agro only |

`npm run seed` wipes and rebuilds the database. `npm run preview:build` produces
`preview/dist/advisor-os.html` — a single-file, serverless build of the app that runs the same
repository layer, scoring engine and agents in the browser on the seeded database (via sql.js),
for demos where no server is available. `npm test` runs the suite. `npm run build`
produces the production build; `npm start` serves it.

---

## What it does

**Client and engagement management.** A client record carries the company's registration,
capital, sector and contacts. An engagement hangs off it and is pinned to a *rule pack*
version at the moment it is opened, so a later amendment to the firm's regulatory library
never silently changes a file already under review.

**Document compliance.** Opening an engagement materialises the pack's document checklist,
the prospectus skeleton and the milestone plan. Uploads are auto-filed against the
checklist by matching filename, title and body text. Completeness is *weighted*, not
counted: a five-weight audited account set moves the number more than a one-weight
insurance schedule, and statuses earn partial credit (submitted 60%, under review 75%,
accepted or waived 100%).

**Stage gates.** An engagement cannot advance while completeness is below the stage
threshold or a critical finding is open. A lead advisor can override; the override is
recorded in the audit trail against their name.

**Six agents.** Each runs the pack's deterministic rules first — reproducible, citable, and
the same every time — then, when an Anthropic key is configured, a reasoning pass for the
judgement-based gaps rules cannot express. Both passes are logged separately.

| Agent | What it does |
|---|---|
| Financial | Tests statements against IFRS, the Commercial Code and ECMA disclosure rules; drafts the financial DD report |
| Legal | Tests corporate, contractual and governance documents against Ethiopian commercial law and ECMA directives; drafts the legal DD report |
| Risk | Consolidates findings into a scored register and sets each risk's disclosure strategy |
| Prospectus | Drafts the offering document section by section to the prescribed contents |
| Secretary | Turns raw meeting notes into minutes, extracts action items, notifies the team and the client |
| Project Management | Watches milestones, payments and the critical path; schedules the other agents and chases missing documents |

**Human in the loop, structurally.** Every report carries an unremovable "Expert Review
Record" section and cannot be approved by an analyst. Findings need a human verdict
(confirmed, rejected, amended). A draft written on a thin document set says so explicitly,
so an empty findings list can never be mistaken for a clean opinion.

**Client portal.** The client sees the stage tracker, what is still needed and why, what is
under review, what has been accepted, their milestones, and only the findings an adviser
has explicitly shared. Internal notes, draft reports and the rest of the book stay invisible.

**Two-sided sign-in.** One login page with an *Advisory firm* / *Client* switch, a
four-step sequence (email → password → session checks → welcome) and a guard that tells a
client who picked the firm side (or vice versa) to switch, rather than signing them in to
the wrong surface.

**Knowledge graph.** `/graph` and the dashboard draw the whole operation — firm, people,
clients, engagements, documents, missing documents, findings, risks, agents and rule packs —
as a force-directed graph. Drag, zoom, filter by type, search, and click any node for its
details and neighbours; critical nodes pulse.

**Ask the OS.** A portfolio assistant (`/assistant`, plus a floating dock on every page)
answers questions across all engagements: missing documents, critical findings, covenant
headroom, ratios, fees, milestones, owners. A BM25 index and intent handlers answer from the
records and cite them; with an Anthropic key, Claude reasons over the retrieved records.
Client users get the same assistant scoped to their own engagement and shared findings only.

**PDF outputs.** Legal DD (36 pp), Financial DD (36 pp), Combined DD & risk (51 pp) and the
prospectus (30 pp) are typeset with pdfmake from the live engagement — cover, contents,
KPI rows, ratio and covenant tables, SVG charts, rule-by-rule test results, the review
trail and a draft watermark until approved. Unsupported statements are marked
`[INFORMATION REQUIRED]` rather than invented.

**Sample data room.** `src/lib/dataroom/` holds a fully fictional 33-document data room for
Abyssinia Agro-Industries S.C. (balanced FY2023–25 financials, projections, articles,
registers, contracts, board minutes, tax and licence records) with planted gaps so every
agent has real work: no audit committee, missing beneficial-owner data, a change-of-control
clause, a director loan, stale tax clearance, an insurance placeholder, and stretched DSO,
interest cover and gearing headroom. `npm run dataroom:export` writes them as PDFs; the
documents tab offers them as downloads.

**Telegram and Slack.** Settings → Telegram & Slack: alerts at or above a chosen severity go
to a Telegram group (bot token + chat ID, webhook registered in one click and verified with
the secret-token header) and a Slack channel (incoming webhook). `/ask` in Telegram and
`/advisor` in Slack (HMAC-v0 signed, 5-minute replay window) answer with the assistant.
Secrets are stored server-side and only ever returned masked.

**Motion.** Scroll-reveal panels, count-up figures, button ripples, animated meters and
login art — all disabled under `prefers-reduced-motion`, and content is visible at rest.

**Audit trail.** Logins, uploads, review decisions, agent runs, stage overrides, approvals —
every material action with actor, entity and timestamp.

---

## Architecture

```
src/lib/
  schema.sql        the whole relational model
  db.ts             better-sqlite3 access layer (typed helpers, transactions)
  domain.ts         shared vocabulary: roles, stages, severities, formatting
  progress.ts       the scoring engine — completeness, compliance, gates, health
  rulepacks/        the regulatory library (see below)
  agents/
    ruleEngine.ts   deterministic rule evaluation + document auto-filing
    anthropic.ts    minimal Messages API client
    prompts.ts      agent system prompts and output schemas
    runner.ts       the six agents, orchestration, fallback, notifications
  documents.ts      storage plus PDF/DOCX/text extraction, no external binaries
  notify.ts         in-app notifications and SMTP email with an outbox fallback
  auth.ts           password auth, JWT session cookies, role capabilities
src/app/            Next.js App Router — staff workspace, client portal, API routes
src/components/     the UI kit and the feature components
preview/            browser shims + build for the serverless single-file demo
tests/              111 tests over scoring, rules, packs, data layer and the full workflow
```

**Rule packs** are the firm's codified view of a transaction type: the document checklist
with weights and authority references, the tests each document must pass, the prospectus
contents with drafting guidance, and the milestone and fee plan. Three ship:
`ECMA-EQUITY` (IPO, rights issue, private placement), `ECMA-DEBT` (bonds) and `MA-ETH`
(M&A, restructuring, valuation). They are plain TypeScript data in `src/lib/rulepacks/` —
adding a pack needs no code changes elsewhere, and the test suite enforces their integrity
(unique codes, real cross-references, every rule cites an authority and gives an action).

### Deliberate choices

- **SQLite via better-sqlite3**, not an ORM. The schema is one readable file, queries are
  explicit, and there is no binary to download at install time. Swapping to Postgres means
  rewriting `db.ts` and the DDL; nothing above that layer changes.
- **The rule engine is primary, the model is secondary.** A regulated deliverable needs a
  reproducible baseline you can defend to ECMA. The reasoning pass adds nuance; it never
  replaces the citable pass, and the product is fully functional with no API key at all.
- **Findings carry a `dedupeKey`.** Re-running an agent refreshes rather than duplicates,
  so agents can be run as often as the team likes.
- **Missing documents are not findings during document collection.** The checklist is the
  right surface for that; findings start at due diligence, when absence becomes a gap.
- **No client-side state library.** Server components read through one `snapshot()` call
  per engagement; mutations go through API routes and `router.refresh()`.

---

## Configuration

### Deploying to Vercel

The project deploys to Vercel as-is (Next.js preset, no build settings to change):

- **Demo data on first boot.** Vercel functions can only write to `/tmp`, so on Vercel the database lives
  at `/tmp/advisor-os` and is restored from the bundled snapshot in `seed/` on each cold start. The demo
  works out of the box, but **changes do not persist** between cold starts or across instances. For real
  use, move the data layer to a hosted database and uploads to object storage.
- **Refresh the snapshot** after changing the seed: `npm run seed && npm run seed:snapshot`, then commit `seed/`.
- **Environment variables:** set a long random `AUTH_SECRET`. `APP_URL` defaults to the Vercel production URL.
  `DATABASE_URL` and `UPLOAD_DIR` are not used. Placeholder values such as `change-me` are ignored.

### Branding

The deployment is branded for **Siinqee Investment Bank S.C.** ("Make it count"). Names and the
palette sampled from the bank's logo — royal blue `#012DE6`, bright blue `#3E5DFF`, yellow `#E9D001` —
live in `src/lib/brand.ts`, with theme tokens at the top of `src/app/globals.css`. The bank's logo files
are in `public/brand/`: `logo.png` (dark text, light surfaces), `logo-dark.png` (white text, dark
surfaces and PDF covers) and `mark.png` (symbol only, sidebar and favicon). The firm's ECMA licence
number, TIN and contact details are left blank in the seed so that only official values are shown.


All optional — the app runs fully without any of it. See `.env.example`.

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the reasoning pass on every agent. Without it, the rule engine runs alone. |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-4-5`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Real email delivery. Without it, mail goes to an in-memory outbox visible in Settings. |
| `AUTH_SECRET` | **Change this before deploying.** Signs session cookies. |
| `DATA_DIR` | Where the database and uploads live. Defaults to `./data`. |

---

## Before this is used on a live mandate

1. **Verify every citation.** The authority references in the rule packs are drafting aids
   the firm maintains. Confirm each article number against the Negarit Gazeta edition and
   the ECMA directive in force at the filing date. The packs carry this warning in the UI.
2. **Change `AUTH_SECRET`**, and serve over HTTPS so the session cookie is sent `Secure`.
3. **Move uploads off local disk** if you deploy to more than one instance.
4. **Add malware scanning** on upload if clients will upload directly.
5. **Consider OCR** — scanned PDFs yield no text, so the agents skip them. The document
   room shows the extracted character count so a reviewer can see when that has happened.
