/** Shared domain vocabulary, stage machine and display metadata. */

export const ROLES = ['OWNER', 'ADVISOR', 'ANALYST', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Managing Director',
  ADVISOR: 'Transaction Advisor',
  ANALYST: 'Analyst',
  CLIENT: 'Client',
};

export const AGENTS = ['FINANCIAL', 'LEGAL', 'RISK', 'PROSPECTUS', 'SECRETARY', 'PROJECT'] as const;
export type AgentKey = (typeof AGENTS)[number];

export const AGENT_META: Record<AgentKey, {
  name: string; short: string; blurb: string; accent: string; expertise: string[];
}> = {
  FINANCIAL: {
    name: 'Financial Agent',
    short: 'Financial',
    blurb: 'Examines financial statements against IFRS, the Commercial Code and ECMA financial-disclosure directives, and drafts the financial due-diligence report.',
    accent: '#3f8f6f',
    expertise: ['IFRS / IFRS for SMEs', 'Commercial Code of Ethiopia 2021 (Proc. 1243/2021)', 'ECMA financial disclosure directives', 'Income Tax Proc. 979/2016', 'Ratio & working-capital analysis'],
  },
  LEGAL: {
    name: 'Legal Agent',
    short: 'Legal',
    blurb: 'Tests corporate, contractual and governance documents against Ethiopian commercial law, ECMA directives and the FDRE Constitution, and drafts the legal due-diligence report.',
    accent: '#5b6fc9',
    expertise: ['Commercial Code Proc. 1243/2021', 'Capital Market Proc. 1248/2021', 'ECMA directives', 'FDRE Constitution', 'Federal & regional court practice', 'Family law (succession of shareholdings)'],
  },
  RISK: {
    name: 'Risk Agent',
    short: 'Risk',
    blurb: 'Consolidates legal and financial findings into a scored risk register and sets the disclosure strategy for each risk in the prospectus.',
    accent: '#c08a3e',
    expertise: ['Inherent / residual scoring', 'Risk-factor disclosure drafting', 'Mitigation design', 'Cross-report correlation'],
  },
  PROSPECTUS: {
    name: 'Prospectus Agent',
    short: 'Prospectus',
    blurb: 'Drafts the prospectus section by section to the ECMA prescribed contents, in international offering-document style.',
    accent: '#8a5fc0',
    expertise: ['ECMA prospectus content directive', 'IOSCO disclosure standards', 'Offering-document drafting', 'Cross-referencing & consistency'],
  },
  SECRETARY: {
    name: 'Secretary Agent',
    short: 'Secretary',
    blurb: 'Captures meeting minutes and project updates, propagates them to the other agents, and notifies the deal team and the client.',
    accent: '#3f8fa8',
    expertise: ['Minute-taking', 'Action-item extraction', 'Stakeholder briefing', 'Email & portal distribution'],
  },
  PROJECT: {
    name: 'Project Management Agent',
    short: 'Project',
    blurb: 'Watches the contract, milestones, payments and schedule; sets deadlines for the other agents and escalates slippage.',
    accent: '#b3607a',
    expertise: ['Milestone tracking', 'Fee & invoice status', 'Critical-path deadlines', 'Agent orchestration'],
  },
};

export const STAGES = [
  'ONBOARDING',
  'DOCUMENT_COLLECTION',
  'DUE_DILIGENCE',
  'RISK_ASSESSMENT',
  'PROSPECTUS_DRAFTING',
  'INTERNAL_REVIEW',
  'ECMA_FILING',
  'CLOSING',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_META: Record<Stage, { label: string; blurb: string; gateThreshold: number }> = {
  ONBOARDING: { label: 'Onboarding', blurb: 'KYC, engagement letter and scope agreed.', gateThreshold: 0 },
  DOCUMENT_COLLECTION: { label: 'Document Collection', blurb: 'Client uploads the mandated document set.', gateThreshold: 40 },
  DUE_DILIGENCE: { label: 'Due Diligence', blurb: 'Legal and financial review; gap reports drafted.', gateThreshold: 75 },
  RISK_ASSESSMENT: { label: 'Risk Assessment', blurb: 'Risk register scored and disclosure strategy set.', gateThreshold: 85 },
  PROSPECTUS_DRAFTING: { label: 'Prospectus Drafting', blurb: 'Section-by-section drafting to ECMA contents.', gateThreshold: 90 },
  INTERNAL_REVIEW: { label: 'Internal Review', blurb: 'Partner sign-off and client approval.', gateThreshold: 95 },
  ECMA_FILING: { label: 'ECMA Filing', blurb: 'Submission to the Ethiopian Capital Market Authority.', gateThreshold: 100 },
  CLOSING: { label: 'Closing', blurb: 'Approval, listing and file closure.', gateThreshold: 100 },
};

export function stageIndex(stage: string): number {
  const i = STAGES.indexOf(stage as Stage);
  return i < 0 ? 0 : i;
}

export function nextStage(stage: string): Stage | null {
  const i = stageIndex(stage);
  return i >= STAGES.length - 1 ? null : STAGES[i + 1];
}

export const TRANSACTION_TYPES = [
  'IPO', 'RIGHTS_ISSUE', 'BOND', 'PRIVATE_PLACEMENT', 'MA', 'RESTRUCTURING', 'VALUATION',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_LABEL: Record<TransactionType, string> = {
  IPO: 'Initial Public Offering',
  RIGHTS_ISSUE: 'Rights Issue',
  BOND: 'Bond / Debt Issue',
  PRIVATE_PLACEMENT: 'Private Placement',
  MA: 'Merger & Acquisition',
  RESTRUCTURING: 'Corporate Restructuring',
  VALUATION: 'Valuation Mandate',
};

export const LEGAL_FORMS = [
  'SHARE_COMPANY', 'PLC', 'ONE_MEMBER_PLC', 'PUBLIC_ENTERPRISE', 'COOPERATIVE', 'BRANCH',
] as const;
export const LEGAL_FORM_LABEL: Record<string, string> = {
  SHARE_COMPANY: 'Share Company',
  PLC: 'Private Limited Company',
  ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_ENTERPRISE: 'Public Enterprise',
  COOPERATIVE: 'Cooperative Society',
  BRANCH: 'Foreign Branch',
};

export const SECTORS = [
  'BANKING', 'INSURANCE', 'MICROFINANCE', 'MANUFACTURING', 'AGRO_PROCESSING', 'REAL_ESTATE',
  'CONSTRUCTION', 'TELECOM', 'LOGISTICS', 'HOSPITALITY', 'HEALTHCARE', 'EDUCATION',
  'ENERGY', 'MINING', 'TECHNOLOGY', 'RETAIL', 'OTHER',
] as const;

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 100, HIGH: 40, MEDIUM: 15, LOW: 5, INFO: 1,
};

export const GAP_TYPES = ['REGULATORY', 'COMPLIANCE', 'EDITORIAL', 'FINANCIAL', 'DISCLOSURE'] as const;
export type GapType = (typeof GAP_TYPES)[number];

export const GAP_LABEL: Record<GapType, string> = {
  REGULATORY: 'Regulatory gap',
  COMPLIANCE: 'Compliance gap',
  EDITORIAL: 'Editorial gap',
  FINANCIAL: 'Financial gap',
  DISCLOSURE: 'Disclosure gap',
};

export const REQUIREMENT_STATUSES = [
  'MISSING', 'REQUESTED', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAIVED',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/** Fraction of a requirement's weight that counts as "complete" per status. */
export const REQUIREMENT_CREDIT: Record<RequirementStatus, number> = {
  MISSING: 0,
  REQUESTED: 0,
  SUBMITTED: 0.6,
  UNDER_REVIEW: 0.75,
  ACCEPTED: 1,
  REJECTED: 0,
  WAIVED: 1,
};

export const FINDING_STATUSES = [
  'OPEN', 'ACKNOWLEDGED', 'IN_REMEDIATION', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE',
] as const;

export const RISK_CATEGORIES = [
  'LEGAL', 'FINANCIAL', 'OPERATIONAL', 'MARKET', 'REGULATORY', 'GOVERNANCE', 'ESG',
] as const;

export const CATEGORIES = [
  'CORPORATE', 'FINANCIAL', 'LEGAL', 'GOVERNANCE', 'TAX', 'TECHNICAL', 'REGULATORY',
] as const;

export function riskBand(score: number): { label: string; tone: 'critical' | 'high' | 'medium' | 'low' } {
  if (score >= 20) return { label: 'Critical', tone: 'critical' };
  if (score >= 12) return { label: 'High', tone: 'high' };
  if (score >= 6) return { label: 'Moderate', tone: 'medium' };
  return { label: 'Low', tone: 'low' };
}

export function fmtMoney(v: number | null | undefined, currency = 'ETB'): string {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const unit = abs >= 1_000_000_000 ? ['bn', 1e9] : abs >= 1_000_000 ? ['m', 1e6] : abs >= 1_000 ? ['k', 1e3] : ['', 1];
  const n = v / (unit[1] as number);
  const s = (unit[1] as number) === 1 ? n.toFixed(0) : n.toFixed(n < 10 ? 2 : 1);
  return `${currency} ${s}${unit[0]}`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relTime(v: string | null | undefined): string {
  if (!v) return '—';
  const then = new Date(v).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(v);
}

export function titleCase(v: string): string {
  return v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
