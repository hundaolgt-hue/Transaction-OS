export interface Org { id: string; name: string; legalName: string | null; tin: string | null; licenseNo: string | null; addressLine: string | null; city: string; country: string; phone: string | null; email: string | null; createdAt: string }

export interface User { id: string; orgId: string; email: string; name: string; passwordHash: string; role: string; title: string | null; phone: string | null; avatarColor: string; active: number; clientId: string | null; lastLoginAt: string | null; createdAt: string }

export type SafeUser = Omit<User, 'passwordHash'>;

export interface Client { id: string; orgId: string; name: string; legalForm: string; sector: string; tin: string | null; businessLicenseNo: string | null; registrationDate: string | null; paidUpCapital: number | null; currency: string; addressLine: string | null; city: string; region: string | null; website: string | null; primaryContactName: string | null; primaryContactEmail: string | null; primaryContactPhone: string | null; riskRating: string; status: string; notes: string | null; createdAt: string; updatedAt: string }

export interface Engagement { id: string; orgId: string; clientId: string; reference: string; name: string; transactionType: string; stage: string; status: string; targetRaise: number | null; currency: string; startDate: string; targetFilingDate: string | null; leadAdvisorId: string | null; rulePackKey: string | null; documentThreshold: number; description: string | null; createdAt: string; updatedAt: string }

export interface Contract { id: string; engagementId: string; title: string; signedDate: string | null; effectiveDate: string | null; endDate: string | null; feeModel: string; totalFee: number; currency: string; vatPercent: number; status: string; scopeSummary: string | null; createdAt: string; updatedAt: string }

export interface Milestone { id: string; contractId: string; name: string; description: string | null; sequence: number; dueDate: string | null; completedAt: string | null; status: string; paymentAmount: number; paymentStatus: string; invoiceNo: string | null; paidAt: string | null }

export interface Requirement { id: string; engagementId: string; code: string; title: string; category: string; description: string | null; authorityRef: string | null; mandatory: number; weight: number; appliesToStage: string; dueDate: string | null; status: string; waivedReason: string | null; sequence: number; createdAt: string; updatedAt: string }

export interface Document { id: string; engagementId: string; requirementId: string | null; title: string; fileName: string; storageKey: string; mimeType: string; sizeBytes: number; version: number; supersedesId: string | null; extractedText: string | null; pageCount: number | null; status: string; reviewNote: string | null; uploadedById: string | null; uploadedByRole: string; createdAt: string; updatedAt: string }

export interface Finding { id: string; engagementId: string; documentId: string | null; requirementId: string | null; agentRunId: string | null; agent: string; gapType: string; severity: string; title: string; detail: string; citation: string | null; recommendation: string | null; excerpt: string | null; confidence: number; status: string; humanVerdict: string | null; assigneeId: string | null; resolvedById: string | null; resolvedAt: string | null; resolutionNote: string | null; visibleToClient: number; dedupeKey: string | null; createdAt: string; updatedAt: string }

export interface AgentRun { id: string; engagementId: string; agent: string; task: string; status: string; engine: string; model: string | null; input: string | null; output: string | null; summary: string | null; error: string | null; progress: number; tokensIn: number; tokensOut: number; durationMs: number; findingsCount: number; triggeredById: string | null; startedAt: string | null; finishedAt: string | null; createdAt: string }

export interface AgentLog { id: string; runId: string; level: string; message: string; createdAt: string }

export interface ReportSection { id: string; heading: string; body: string; source?: string; agentGenerated?: boolean; edited?: boolean }

export interface DDReport { id: string; engagementId: string; kind: string; title: string; version: number; status: string; sections: string; executiveSummary: string | null; generatedBy: string; reviewerId: string | null; reviewedAt: string | null; approvedAt: string | null; createdAt: string; updatedAt: string }

export interface Risk { id: string; engagementId: string; findingId: string | null; code: string; title: string; category: string; description: string; likelihood: number; impact: number; inherentScore: number; mitigation: string | null; residualLikelihood: number; residualImpact: number; residualScore: number; owner: string | null; status: string; disclosureStrategy: string | null; prospectusPlacement: string | null; createdAt: string; updatedAt: string }

export interface ProspectusSection { id: string; engagementId: string; code: string; sequence: number; heading: string; requiredBy: string | null; body: string; wordCount: number; status: string; generatedBy: string | null; reviewNote: string | null; completeness: number; createdAt: string; updatedAt: string }

export interface Meeting { id: string; engagementId: string; title: string; scheduledAt: string; durationMin: number; location: string | null; attendees: string; agenda: string | null; minutes: string | null; decisions: string | null; actionItems: string; distributed: number; organiserId: string | null; createdAt: string }

export interface Task { id: string; engagementId: string; title: string; detail: string | null; assigneeId: string | null; agentOwner: string | null; dueDate: string | null; priority: string; status: string; source: string; completedAt: string | null; createdAt: string }

export interface Comment { id: string; authorId: string | null; authorName: string; body: string; documentId: string | null; findingId: string | null; visibleToClient: number; createdAt: string }

export interface Notification { id: string; userId: string; engagementId: string | null; kind: string; severity: string; title: string; body: string; link: string | null; readAt: string | null; emailedAt: string | null; createdAt: string }

export interface AuditEvent { id: string; orgId: string; actorId: string | null; actorName: string; action: string; entityType: string; entityId: string | null; engagementId: string | null; metadata: string | null; ip: string | null; createdAt: string }

export interface Session { userId: string; orgId: string; role: string; email: string; name: string; clientId: string | null }
