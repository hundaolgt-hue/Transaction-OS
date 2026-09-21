PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legalName TEXT,
  tin TEXT,
  licenseNo TEXT,
  addressLine TEXT,
  city TEXT NOT NULL DEFAULT 'Addis Ababa',
  country TEXT NOT NULL DEFAULT 'Ethiopia',
  phone TEXT,
  email TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ANALYST',
  title TEXT,
  phone TEXT,
  avatarColor TEXT NOT NULL DEFAULT '#2f6f5e',
  active INTEGER NOT NULL DEFAULT 1,
  clientId TEXT REFERENCES clients(id) ON DELETE SET NULL,
  lastLoginAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(orgId);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legalForm TEXT NOT NULL DEFAULT 'SHARE_COMPANY',
  sector TEXT NOT NULL DEFAULT 'OTHER',
  tin TEXT,
  businessLicenseNo TEXT,
  registrationDate TEXT,
  paidUpCapital REAL,
  currency TEXT NOT NULL DEFAULT 'ETB',
  addressLine TEXT,
  city TEXT NOT NULL DEFAULT 'Addis Ababa',
  region TEXT,
  website TEXT,
  primaryContactName TEXT,
  primaryContactEmail TEXT,
  primaryContactPhone TEXT,
  riskRating TEXT NOT NULL DEFAULT 'UNRATED',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(orgId);

CREATE TABLE IF NOT EXISTS engagements (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  transactionType TEXT NOT NULL DEFAULT 'IPO',
  stage TEXT NOT NULL DEFAULT 'ONBOARDING',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  targetRaise REAL,
  currency TEXT NOT NULL DEFAULT 'ETB',
  startDate TEXT NOT NULL,
  targetFilingDate TEXT,
  leadAdvisorId TEXT REFERENCES users(id) ON DELETE SET NULL,
  rulePackKey TEXT,
  documentThreshold INTEGER NOT NULL DEFAULT 80,
  description TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eng_org ON engagements(orgId);
CREATE INDEX IF NOT EXISTS idx_eng_client ON engagements(clientId);

CREATE TABLE IF NOT EXISTS stage_events (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  fromStage TEXT,
  toStage TEXT NOT NULL,
  note TEXT,
  actorName TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stage_eng ON stage_events(engagementId);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL UNIQUE REFERENCES engagements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  signedDate TEXT,
  effectiveDate TEXT,
  endDate TEXT,
  feeModel TEXT NOT NULL DEFAULT 'FIXED',
  totalFee REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB',
  vatPercent REAL NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  scopeSummary TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  contractId TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sequence INTEGER NOT NULL DEFAULT 0,
  dueDate TEXT,
  completedAt TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paymentAmount REAL NOT NULL DEFAULT 0,
  paymentStatus TEXT NOT NULL DEFAULT 'UNBILLED',
  invoiceNo TEXT,
  paidAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_ms_contract ON milestones(contractId);

CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CORPORATE',
  description TEXT,
  authorityRef TEXT,
  mandatory INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 1,
  appliesToStage TEXT NOT NULL DEFAULT 'DUE_DILIGENCE',
  dueDate TEXT,
  status TEXT NOT NULL DEFAULT 'MISSING',
  waivedReason TEXT,
  sequence INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_req_eng ON requirements(engagementId);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  requirementId TEXT REFERENCES requirements(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  fileName TEXT NOT NULL,
  storageKey TEXT NOT NULL,
  mimeType TEXT NOT NULL DEFAULT 'application/octet-stream',
  sizeBytes INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  supersedesId TEXT,
  extractedText TEXT,
  pageCount INTEGER,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  reviewNote TEXT,
  uploadedById TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploadedByRole TEXT NOT NULL DEFAULT 'ADVISOR',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_eng ON documents(engagementId);
CREATE INDEX IF NOT EXISTS idx_doc_req ON documents(requirementId);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  task TEXT NOT NULL DEFAULT 'ANALYZE',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  engine TEXT NOT NULL DEFAULT 'RULES',
  model TEXT,
  input TEXT,
  output TEXT,
  summary TEXT,
  error TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  tokensIn INTEGER NOT NULL DEFAULT 0,
  tokensOut INTEGER NOT NULL DEFAULT 0,
  durationMs INTEGER NOT NULL DEFAULT 0,
  findingsCount INTEGER NOT NULL DEFAULT 0,
  triggeredById TEXT REFERENCES users(id) ON DELETE SET NULL,
  startedAt TEXT,
  finishedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_eng ON agent_runs(engagementId);

CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_run ON agent_logs(runId);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  documentId TEXT REFERENCES documents(id) ON DELETE SET NULL,
  requirementId TEXT REFERENCES requirements(id) ON DELETE SET NULL,
  agentRunId TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  agent TEXT NOT NULL DEFAULT 'LEGAL',
  gapType TEXT NOT NULL DEFAULT 'COMPLIANCE',
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  citation TEXT,
  recommendation TEXT,
  excerpt TEXT,
  confidence REAL NOT NULL DEFAULT 0.7,
  status TEXT NOT NULL DEFAULT 'OPEN',
  humanVerdict TEXT,
  assigneeId TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolvedById TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolvedAt TEXT,
  resolutionNote TEXT,
  visibleToClient INTEGER NOT NULL DEFAULT 0,
  dedupeKey TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_find_eng ON findings(engagementId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_find_dedupe ON findings(engagementId, dedupeKey) WHERE dedupeKey IS NOT NULL;

CREATE TABLE IF NOT EXISTS dd_reports (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'LEGAL',
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  sections TEXT NOT NULL DEFAULT '[]',
  executiveSummary TEXT,
  generatedBy TEXT NOT NULL DEFAULT 'RULES',
  reviewerId TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewedAt TEXT,
  approvedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rep_eng ON dd_reports(engagementId);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  findingId TEXT REFERENCES findings(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'LEGAL',
  description TEXT NOT NULL,
  likelihood INTEGER NOT NULL DEFAULT 3,
  impact INTEGER NOT NULL DEFAULT 3,
  inherentScore INTEGER NOT NULL DEFAULT 9,
  mitigation TEXT,
  residualLikelihood INTEGER NOT NULL DEFAULT 2,
  residualImpact INTEGER NOT NULL DEFAULT 2,
  residualScore INTEGER NOT NULL DEFAULT 4,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  disclosureStrategy TEXT,
  prospectusPlacement TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_eng ON risks(engagementId);

CREATE TABLE IF NOT EXISTS prospectus_sections (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  heading TEXT NOT NULL,
  requiredBy TEXT,
  body TEXT NOT NULL DEFAULT '',
  wordCount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  generatedBy TEXT,
  reviewNote TEXT,
  completeness INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(engagementId, code)
);
CREATE INDEX IF NOT EXISTS idx_pros_eng ON prospectus_sections(engagementId);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  durationMin INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  attendees TEXT NOT NULL DEFAULT '[]',
  agenda TEXT,
  minutes TEXT,
  decisions TEXT,
  actionItems TEXT NOT NULL DEFAULT '[]',
  distributed INTEGER NOT NULL DEFAULT 0,
  organiserId TEXT REFERENCES users(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meet_eng ON meetings(engagementId);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  engagementId TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  assigneeId TEXT REFERENCES users(id) ON DELETE SET NULL,
  agentOwner TEXT,
  dueDate TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'TODO',
  source TEXT NOT NULL DEFAULT 'HUMAN',
  completedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_eng ON tasks(engagementId);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  authorId TEXT REFERENCES users(id) ON DELETE SET NULL,
  authorName TEXT NOT NULL DEFAULT 'System',
  body TEXT NOT NULL,
  documentId TEXT REFERENCES documents(id) ON DELETE CASCADE,
  findingId TEXT REFERENCES findings(id) ON DELETE CASCADE,
  visibleToClient INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cmt_doc ON comments(documentId);
CREATE INDEX IF NOT EXISTS idx_cmt_find ON comments(findingId);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engagementId TEXT REFERENCES engagements(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'INFO',
  severity TEXT NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  readAt TEXT,
  emailedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(userId, createdAt);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actorId TEXT REFERENCES users(id) ON DELETE SET NULL,
  actorName TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  engagementId TEXT,
  metadata TEXT,
  ip TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(orgId, createdAt);
