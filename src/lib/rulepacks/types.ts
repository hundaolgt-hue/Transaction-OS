export type Category = 'CORPORATE' | 'FINANCIAL' | 'LEGAL' | 'GOVERNANCE' | 'TAX' | 'TECHNICAL' | 'REGULATORY';

export interface RequirementSpec {
  code: string;
  title: string;
  category: Category;
  description: string;
  authorityRef: string;
  mandatory: boolean;
  weight: number;
  appliesToStage: string;
  /** Keywords used to auto-match an uploaded document to this requirement. */
  matchHints: string[];
}

export type CheckKind =
  | 'MUST_CONTAIN'      // every phrase in `phrases` must appear
  | 'MUST_CONTAIN_ANY'  // at least one phrase must appear
  | 'MUST_NOT_CONTAIN'  // no phrase may appear
  | 'NUMERIC_PRESENT'   // a number matching `pattern` must appear
  | 'DATE_FRESHNESS'    // document must reference a date within `maxAgeMonths`
  | 'CROSS_DOC'         // requires another requirement code to be accepted
  | 'EDITORIAL';        // style / drafting quality checks

export interface RuleSpec {
  id: string;
  agent: 'FINANCIAL' | 'LEGAL' | 'RISK' | 'PROSPECTUS';
  /** Requirement codes this rule is evaluated against; '*' means all documents. */
  appliesTo: string[];
  kind: CheckKind;
  gapType: 'REGULATORY' | 'COMPLIANCE' | 'EDITORIAL' | 'FINANCIAL' | 'DISCLOSURE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  /** Written for the reviewer: what the rule tests and why it matters. */
  detail: string;
  citation: string;
  recommendation: string;
  phrases?: string[];
  pattern?: string;
  maxAgeMonths?: number;
  requires?: string[];
}

export interface ProspectusSectionSpec {
  code: string;
  sequence: number;
  heading: string;
  requiredBy: string;
  /** Guidance handed to the Prospectus Agent when drafting. */
  guidance: string;
  /** Requirement codes whose documents feed this section. */
  sourceRequirements: string[];
  minWords: number;
}

export interface MilestoneSpec {
  name: string;
  description: string;
  sequence: number;
  offsetDays: number;
  feeShare: number; // fraction of total fee
}

export interface RulePack {
  key: string;
  name: string;
  version: string;
  authority: string;
  description: string;
  disclaimer: string;
  /** What the drafted document set is called on this kind of mandate. */
  outputLabel: string;
  transactionTypes: string[];
  requirements: RequirementSpec[];
  rules: RuleSpec[];
  prospectus: ProspectusSectionSpec[];
  milestones: MilestoneSpec[];
}
