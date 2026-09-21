/**
 * Seeds a realistic Ethiopian advisory practice so the app can be demonstrated
 * and tested end to end. Safe to re-run: it wipes and rebuilds the database.
 */
import fs from 'node:fs';
import { env } from '../src/lib/env';

import { db, insert, id, now } from '../src/lib/db';
import { createUser } from '../src/lib/auth';
import * as repo from '../src/lib/repo/core';
import { storeFile } from '../src/lib/documents';
import { runAgent } from '../src/lib/agents/runner';
import { ABYSSINIA_DATAROOM } from '../src/lib/dataroom/abyssinia';
import { SYNTHETIC } from '../src/lib/dataroom/format';
import { BRAND } from '../src/lib/brand';

async function main() {
  // Remove any previous database so the seed is deterministic.
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${env.dbPath}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.rmSync(env.uploadDir, { recursive: true, force: true });
  db();

  const iso = (d: Date) => d.toISOString();
  const days = (n: number) => new Date(Date.now() + n * 86400000);

  // ------------------------------------------------------------------- firm

  const orgId = id('org');
  insert('orgs', {
    id: orgId,
    // Firm identity comes from src/lib/brand.ts. Registration, licence and
    // contact details are left blank on purpose — enter the bank's official
    // values rather than shipping invented ones.
    name: BRAND.name,
    legalName: BRAND.legalName,
    tin: null,
    licenseNo: null,
    addressLine: null,
    city: BRAND.city,
    country: 'Ethiopia',
    phone: null,
    email: null,
    createdAt: now(),
  });

  const owner = await createUser({
    orgId, email: 'hundaol@siinqee-ib.demo', name: 'Hundaol Girma',
    password: 'demo1234', role: 'OWNER', title: 'Managing Director, Investment Banking',
    phone: '+251 91 123 4567',
  });
  const advisor = await createUser({
    orgId, email: 'meron@siinqee-ib.demo', name: 'Meron Tadesse',
    password: 'demo1234', role: 'ADVISOR', title: 'Senior Transaction Advisor',
  });
  const analyst = await createUser({
    orgId, email: 'dawit@siinqee-ib.demo', name: 'Dawit Bekele',
    password: 'demo1234', role: 'ANALYST', title: 'Analyst — Financial Due Diligence',
  });
  await createUser({
    orgId, email: 'selam@siinqee-ib.demo', name: 'Selamawit Hailu',
    password: 'demo1234', role: 'ANALYST', title: 'Analyst — Legal Due Diligence',
  });

  console.log('✓ firm and four staff accounts');

  // ---------------------------------------------------------------- clients

  const abyssinia = repo.createClient(orgId, {
    name: 'Abyssinia Agro-Industries S.C.',
    legalForm: 'SHARE_COMPANY', sector: 'AGRO_PROCESSING',
    tin: '0045678901', businessLicenseNo: 'AA/BL/09/2018',
    registrationDate: iso(new Date('2018-03-14')),
    paidUpCapital: 480_000_000, currency: 'ETB',
    addressLine: 'Kality Industrial Zone, Akaki Kality Sub-city',
    city: 'Addis Ababa', region: 'Addis Ababa',
    website: 'abyssiniaagro.et',
    primaryContactName: 'Tigist Alemu', primaryContactEmail: 'finance@abyssiniaagro.et',
    primaryContactPhone: '+251 91 445 8890',
    riskRating: 'MEDIUM', status: 'ACTIVE',
    notes: 'Oilseed crushing and edible-oil refining. Three plants: Kality, Bishoftu, Adama. Seeking listing on the ESX to fund a fourth line.',
  });

  const lalibela = repo.createClient(orgId, {
    name: 'Lalibela Cement Manufacturing PLC',
    legalForm: 'PLC', sector: 'MANUFACTURING',
    tin: '0033445566', businessLicenseNo: 'AM/BL/14/2015',
    registrationDate: iso(new Date('2015-09-02')),
    paidUpCapital: 1_250_000_000, currency: 'ETB',
    addressLine: 'Dessie Road, Kombolcha Industrial Park',
    city: 'Kombolcha', region: 'Amhara',
    primaryContactName: 'Yohannes Girma', primaryContactEmail: 'yohannes@lalibelacement.et',
    riskRating: 'HIGH', status: 'ACTIVE',
    notes: 'Raising a five-year corporate bond to refinance USD-denominated plant debt.',
  });

  const awash = repo.createClient(orgId, {
    name: 'Awash Logistics Group S.C.',
    legalForm: 'SHARE_COMPANY', sector: 'LOGISTICS',
    tin: '0077889900', businessLicenseNo: 'AA/BL/22/2012',
    registrationDate: iso(new Date('2012-06-19')),
    paidUpCapital: 320_000_000, currency: 'ETB',
    addressLine: 'Modjo Dry Port Road',
    city: 'Modjo', region: 'Oromia',
    primaryContactName: 'Kalkidan Wolde', primaryContactEmail: 'kalkidan@awashlogistics.et',
    riskRating: 'LOW', status: 'ACTIVE',
    notes: 'Acquiring a regional trucking fleet; buy-side due diligence mandate.',
  });

  const nileTech = repo.createClient(orgId, {
    name: 'Nile Digital Systems PLC',
    legalForm: 'PLC', sector: 'TECHNOLOGY',
    tin: '0099887766',
    paidUpCapital: 45_000_000, currency: 'ETB',
    city: 'Addis Ababa', region: 'Addis Ababa',
    primaryContactName: 'Samuel Negash',
    riskRating: 'UNRATED', status: 'PROSPECT',
    notes: 'Early conversations about a private placement in 2027.',
  });

  console.log('✓ four clients');

  // ------------------------------------------------------------ engagements

  const ipo = repo.createEngagement(orgId, {
    clientId: abyssinia.id,
    name: 'Initial public offering of 2,000,000 ordinary shares on the ESX',
    transactionType: 'IPO',
    targetRaise: 900_000_000,
    currency: 'ETB',
    startDate: iso(days(-96)),
    targetFilingDate: iso(days(62)),
    leadAdvisorId: advisor.id,
    documentThreshold: 80,
    stage: 'DUE_DILIGENCE',
    description: 'Full-scope transaction advisory: due diligence, valuation support, prospectus drafting and ECMA filing for a primary offer of 2,000,000 ordinary shares of ETB 300 par at an indicative ETB 450 per share.',
  });

  const bond = repo.createEngagement(orgId, {
    clientId: lalibela.id,
    name: 'ETB 1.5bn five-year secured corporate bond',
    transactionType: 'BOND',
    targetRaise: 1_500_000_000,
    currency: 'ETB',
    startDate: iso(days(-48)),
    targetFilingDate: iso(days(104)),
    leadAdvisorId: owner.id,
    documentThreshold: 85,
    stage: 'DOCUMENT_COLLECTION',
    description: 'Structuring, trustee appointment, due diligence and offering-document drafting for a secured bond refinancing the plant facility.',
  });

  const ma = repo.createEngagement(orgId, {
    clientId: awash.id,
    name: 'Acquisition of 100% of Rift Valley Haulage PLC',
    transactionType: 'MA',
    targetRaise: 410_000_000,
    currency: 'ETB',
    startDate: iso(days(-27)),
    targetFilingDate: iso(days(75)),
    leadAdvisorId: advisor.id,
    documentThreshold: 75,
    stage: 'DOCUMENT_COLLECTION',
    description: 'Buy-side legal, financial and tax due diligence, competition clearance analysis and SPA negotiation support.',
  });

  console.log('✓ three engagements with checklists and prospectus skeletons');

  // ----------------------------------------------------------- portal users

  await createUser({
    orgId, email: 'finance@abyssiniaagro.et', name: 'Tigist Alemu',
    password: 'demo1234', role: 'CLIENT', title: 'Chief Finance Officer', clientId: abyssinia.id,
  });
  await createUser({
    orgId, email: 'yohannes@lalibelacement.et', name: 'Yohannes Girma',
    password: 'demo1234', role: 'CLIENT', title: 'Finance Director', clientId: lalibela.id,
  });

  console.log('✓ two client portal logins');

  // -------------------------------------------------------------- contracts

  repo.createContract(ipo.id, {
    title: 'Transaction advisory services agreement — Abyssinia Agro-Industries S.C.',
    totalFee: 6_800_000, currency: 'ETB', feeModel: 'HYBRID', status: 'SIGNED',
    signedDate: iso(days(-96)), effectiveDate: iso(days(-96)),
    scopeSummary: 'Advisory, due diligence, valuation support, prospectus drafting and ECMA filing. Success fee of 0.35% of gross proceeds payable on admission, in addition to the fixed fee below.',
  });
  repo.createContract(bond.id, {
    title: 'Bond issue advisory agreement — Lalibela Cement Manufacturing PLC',
    totalFee: 4_200_000, currency: 'ETB', feeModel: 'FIXED', status: 'SIGNED',
    signedDate: iso(days(-48)), effectiveDate: iso(days(-46)),
    scopeSummary: 'Structuring, trustee liaison, due diligence, offering-document drafting and ECMA submission.',
  });
  repo.createContract(ma.id, {
    title: 'Buy-side due diligence mandate — Awash Logistics Group S.C.',
    totalFee: 2_400_000, currency: 'ETB', feeModel: 'FIXED', status: 'SIGNED',
    signedDate: iso(days(-27)),
    scopeSummary: 'Legal, financial and tax due diligence on Rift Valley Haulage PLC, competition analysis and SPA support.',
  });

  // Advance the IPO fee position so the dashboard has something to show.
  const ipoContract = repo.getContract(ipo.id)!;
  const ipoMilestones = repo.listMilestones(ipoContract.id);
  repo.updateMilestone(ipoMilestones[0].id, { status: 'COMPLETED', completedAt: iso(days(-92)), paymentStatus: 'PAID', paidAt: iso(days(-88)), invoiceNo: 'INV-2026-0041' });
  repo.updateMilestone(ipoMilestones[1].id, { status: 'COMPLETED', completedAt: iso(days(-34)), paymentStatus: 'PAID', paidAt: iso(days(-27)), invoiceNo: 'INV-2026-0052' });
  repo.updateMilestone(ipoMilestones[2].id, { status: 'IN_PROGRESS', paymentStatus: 'INVOICED', invoiceNo: 'INV-2026-0067' });

  const bondContract = repo.getContract(bond.id)!;
  const bondMilestones = repo.listMilestones(bondContract.id);
  repo.updateMilestone(bondMilestones[0].id, { status: 'COMPLETED', completedAt: iso(days(-45)), paymentStatus: 'PAID', paidAt: iso(days(-40)), invoiceNo: 'INV-2026-0058' });

  console.log('✓ contracts, milestones and fee positions');

  // -------------------------------------------------------------- documents

  interface Seed { code: string; title: string; body: string; accept?: boolean }

  // The IPO engagement gets the full synthetic data room: one document per checklist item.
  const ipoDocs: Seed[] = ABYSSINIA_DATAROOM.map((d) => ({ code: d.code ?? '', title: d.title, body: d.body, accept: d.accept }));

  const bondDocs: Seed[] = [
    {
      code: 'ECMA-C-002', title: 'Articles of Association — Lalibela Cement', accept: true,
      body: `ARTICLES OF ASSOCIATION OF LALIBELA CEMENT MANUFACTURING PRIVATE LIMITED COMPANY

  Article 4. The capital of the Company is Birr 1,250,000,000 divided into 12,500 shares of Birr 100,000 each.
  Article 7. Transfer of shares to a person who is not a member requires the prior written consent of members holding not less than three quarters of the capital.
  Article 11. The general meeting of members shall be held annually.
  Article 16. The management of the Company is vested in a board of four managers.
  Article 23. The Company shall appoint an external auditor.

  Adopted 2 September 2015; last amended 7 March 2023.`,
    },
    {
      code: 'ECMA-D-001', title: 'Draft Trust Deed — ETB 1.5bn Secured Notes',
      body: `TRUST DEED
  constituting ETB 1,500,000,000 secured notes due 2031

  THIS DEED is made between Lalibela Cement Manufacturing PLC (the "Issuer") and [TRUSTEE TO BE CONFIRMED] (the "Trustee").

  1. AMOUNT AND FORM. The Issuer constitutes secured notes in the aggregate principal amount of Birr 1,500,000,000.
  2. INTEREST. The notes bear interest at 11.75% per annum payable semi-annually in arrear on 30 June and 31 December.
  3. MATURITY. The notes mature on 30 June 2031.
  4. SECURITY. The notes are secured by a first-ranking mortgage over the Kombolcha plant and a floating charge over the Issuer's movable assets.
  5. COVENANTS. The Issuer shall maintain a debt service coverage ratio of not less than 1.35:1 tested semi-annually, and shall not incur additional secured indebtedness without the consent of the Trustee.
  6. MEETINGS OF HOLDERS. Provisions for meetings of noteholders are set out in Schedule 3.
  7. GOVERNING LAW. The laws of the Federal Democratic Republic of Ethiopia.

  [TBD: events of default schedule to be inserted following counsel review.]
  [INSERT: ranking statement to be confirmed against the existing Development Bank facility.]`,
    },
    {
      code: 'ECMA-F-001', title: 'Audited Financial Statements FY2023–FY2025 — Lalibela Cement',
      body: `LALIBELA CEMENT MANUFACTURING PLC
  FINANCIAL STATEMENTS FOR THE YEAR ENDED 7 JULY 2025

  The financial statements have been prepared in accordance with International Financial Reporting Standards.

  STATEMENT OF FINANCIAL POSITION (Birr '000)
                                     FY2025      FY2024
  Property, plant and equipment    4,880,220   4,612,880
  Inventories                        712,440     668,190
  Trade receivables                  402,118     388,220
  Cash                                88,440     142,006
  Total assets                     6,083,218   5,811,296
  Share capital                    1,250,000   1,250,000
  Accumulated losses                (188,440)    (96,220)
  Borrowings                       3,902,118   3,588,440
  Trade payables                   1,119,540   1,069,076

  STATEMENT OF PROFIT OR LOSS (Birr '000)
  Revenue                          2,188,440   2,402,118
  Cost of sales                   (1,902,880) (1,988,440)
  Gross profit                       285,560     413,678
  Finance costs                     (402,118)   (366,880)
  Loss before tax                   (216,558)    (98,442)

  MATERIAL UNCERTAINTY RELATED TO GOING CONCERN
  The Company incurred a loss before tax of Birr 216,558,000 for the year ended 7 July 2025 and, as at that date, its current liabilities exceeded its current assets by Birr 618,440,000. These events indicate that a material uncertainty exists that may cast significant doubt on the Company's ability to continue as a going concern. The directors have prepared a refinancing plan, the principal element of which is the proposed bond issue.

  STATEMENT OF CASH FLOWS and STATEMENT OF CHANGES IN EQUITY are set out on pages 8 and 9.`,
    },
    {
      code: 'ECMA-D-005', title: 'Debt Service Coverage Model — summary output',
      body: `LALIBELA CEMENT — DEBT SERVICE COVERAGE SUMMARY
  Base case, Birr '000

  Period    EBITDA     Debt service    Coverage
  FY2027     688,440       502,118        1.37
  FY2028     742,118       502,118        1.48
  FY2029     801,440       502,118        1.60
  FY2030     866,880       502,118        1.73
  FY2031     938,220     1,502,118        0.62

  Assumptions: clinker price growth of 6% per annum; capacity utilisation rising from 62% to 78%; coal cost indexed to the base period.

  Note: FY2031 coverage reflects bullet repayment of principal. Refinancing or a sinking fund will be required.`,
    },
    {
      code: 'ECMA-T-001', title: 'Tax Clearance Certificate — Lalibela Cement',
      body: `MINISTRY OF REVENUE
  TAX CLEARANCE CERTIFICATE

  Lalibela Cement Manufacturing PLC, TIN 0033445566, has settled its tax obligations to the date of this certificate.
  Date of issue: 3 June 2026. Valid for six months.`,
    },
  ];

  const maDocs: Seed[] = [
    {
      code: 'MA-001', title: 'Heads of Terms — Rift Valley Haulage acquisition', accept: true,
      body: `HEADS OF TERMS
  between Awash Logistics Group S.C. (the "Buyer") and the shareholders of Rift Valley Haulage PLC (the "Sellers")

  1. TRANSACTION. The Buyer will acquire 100% of the issued capital of Rift Valley Haulage PLC.
  2. CONSIDERATION. Birr 410,000,000 on a cash-free, debt-free basis, subject to a normalised working capital adjustment.
  3. CONDITIONS. Completion is conditional on satisfactory due diligence, clearance under the Trade Competition and Consumer Protection Proclamation, and the consent of the Sellers' principal lender.
  4. EXCLUSIVITY. The Sellers grant exclusivity for ninety days from the date of these heads.
  5. STATUS. These heads of terms are not legally binding save for clauses 4, 6 and 7.

  Dated 24 August 2026.`,
    },
    {
      code: 'MA-004', title: 'Target Data Room Index',
      body: `RIFT VALLEY HAULAGE PLC — DATA ROOM INDEX
  Section 1 Corporate: memorandum, articles, share register, board minutes 2021–2026. COMPLETE
  Section 2 Financial: audited accounts FY2023–FY2025, management accounts to April 2026. COMPLETE
  Section 3 Tax: clearance certificate, VAT returns. PARTIAL — FY2024 VAT returns outstanding
  Section 4 Contracts: haulage framework agreements, fuel supply. COMPLETE
  Section 5 Property: Modjo depot lease, Dire Dawa yard title. PARTIAL — Dire Dawa title deed not uploaded
  Section 6 Employment: contracts, payroll, pension statements. PARTIAL — pension contribution statement outstanding
  Section 7 Litigation: schedule of proceedings. COMPLETE
  Section 8 Insurance: fleet policies. COMPLETE

  Last updated 12 September 2026.`,
    },
    {
      code: 'ECMA-F-001', title: 'Rift Valley Haulage — Audited Accounts FY2023–FY2025',
      body: `RIFT VALLEY HAULAGE PLC
  FINANCIAL STATEMENTS FOR THE YEARS ENDED 7 JULY 2023 TO 2025

  These financial statements have been prepared in accordance with IFRS for SMEs.

  STATEMENT OF FINANCIAL POSITION (Birr '000)
                                  FY2025    FY2024    FY2023
  Motor vehicles                 388,220   402,118   366,880
  Trade receivables              142,006   128,440   112,118
  Cash                            42,118    38,220    29,006
  Total assets                   572,344   568,778   508,004
  Share capital                  120,000   120,000   120,000
  Retained earnings              188,440   166,220   142,880
  Borrowings                     198,220   212,118   188,440

  STATEMENT OF PROFIT OR LOSS (Birr '000)
  Revenue                        602,118   566,880   498,440
  Operating profit                88,440    81,220    68,006
  Profit for the year             52,118    48,006    39,440

  Notes 1 to 19 form part of these statements.`,
    },
    {
      code: 'ECMA-L-001', title: 'Rift Valley Haulage — Litigation Schedule',
      body: `SCHEDULE OF PROCEEDINGS — RIFT VALLEY HAULAGE PLC

  1. Road traffic claim, Adama, file 442/2025. Claim amount Birr 1,800,000. External counsel assesses the claim as probable in part; provision of Birr 900,000 recommended.
  2. Contract dispute with Dire Fuel PLC, Federal High Court, file 288/2026. Claim amount Birr 4,200,000. Counsel's opinion: the Company has a strong defence; outcome assessed as possible but not probable.
  3. Employment claim, Modjo, file 71/2026. Claim amount Birr 320,000. Counsel considers settlement likely.

  Prepared by Abebe & Partners, 5 September 2026.`,
    },
  ];

  async function seedDocs(engagementId: string, seeds: Seed[], uploaderId: string) {
    const reqs = repo.listRequirements(engagementId);
    for (const s of seeds) {
      const req = reqs.find((r) => r.code === s.code);
      const body = s.body.startsWith('SYNTHETIC') ? s.body : `${SYNTHETIC}\n\n${s.body}`;
    const bytes = Buffer.from(body, 'utf8');
      const stored = await storeFile(engagementId, `${s.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.txt`, 'text/plain', bytes);
      const doc = repo.createDocument({
        engagementId,
        requirementId: req?.id ?? null,
        title: s.title,
        fileName: `${s.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.txt`,
        storageKey: stored.storageKey,
        mimeType: 'text/plain',
        sizeBytes: stored.sizeBytes,
        version: 1,
        supersedesId: null,
        extractedText: stored.extractedText,
        pageCount: null,
        status: s.accept ? 'ACCEPTED' : 'SUBMITTED',
        reviewNote: null,
        uploadedById: uploaderId,
        uploadedByRole: 'CLIENT',
      });
      if (req) repo.updateRequirement(req.id, { status: s.accept ? 'ACCEPTED' : 'SUBMITTED' });
      void doc;
    }
  }

  await seedDocs(ipo.id, ipoDocs, analyst.id);
  await seedDocs(bond.id, bondDocs, analyst.id);
  await seedDocs(ma.id, maDocs, analyst.id);

  console.log('✓ documents seeded and filed against the checklist');

  // --------------------------------------------------------------- meetings

  repo.createMeeting({
    engagementId: ipo.id,
    title: 'Weekly deal team call — week 13',
    scheduledAt: iso(days(-4)),
    durationMin: 45,
    location: 'Teams',
    attendees: JSON.stringify(['Hundaol Girma', 'Meron Tadesse', 'Dawit Bekele', 'Tigist Alemu (CFO)']),
    agenda: '1. Document collection status\n2. Outstanding valuation inputs\n3. Auditor availability for the reporting accountant role\n4. Filing timetable',
    minutes: `Document collection stands at roughly two thirds. Tigist confirmed the valuation report is with the valuer and expected within ten days.

  Dawit to prepare the working capital analysis once the interim accounts are reviewed.
  Meron will obtain the related-party schedule from the company secretary this week.
  Action: Tigist to send the facility agreements including the Meskel Commercial Bank covenant schedule by Friday.
  Action: Dawit to draft the ratio pack for the MD&A section.
  The board has asked whether the filing can be pulled forward by two weeks. Agreed to revisit once the prospectus is at 70%.`,
    organiserId: advisor.id,
  });

  repo.createMeeting({
    engagementId: bond.id,
    title: 'Trustee selection and structuring session',
    scheduledAt: iso(days(-11)),
    durationMin: 90,
    location: `${BRAND.shortName} offices`,
    attendees: JSON.stringify(['Hundaol Girma', 'Yohannes Girma', 'Counsel — Abebe & Partners']),
    agenda: '1. Trustee candidates\n2. Security package\n3. Coverage covenant level\n4. Going concern disclosure',
    minutes: `Three trustee candidates reviewed. Counsel to confirm licensing status of each.

  The security package will comprise a first mortgage over the Kombolcha plant plus a floating charge. Counsel noted the Development Bank facility may carry a negative pledge; this must be checked before the ranking statement is finalised.

  Coverage covenant agreed at 1.35:1 tested semi-annually.

  Action: Yohannes to obtain the Development Bank consent letter.
  Action: counsel to draft the events of default schedule.`,
    organiserId: owner.id,
  });

  console.log('✓ meetings with raw notes');

  // ------------------------------------------------------------- agent runs

  console.log('  running agents (deterministic engine)…');
  for (const agent of ['LEGAL', 'FINANCIAL', 'RISK'] as const) {
    await runAgent({ engagementId: ipo.id, orgId, agent, triggeredById: analyst.id, actorName: 'Dawit Bekele', forceRules: true });
  }
  await runAgent({ engagementId: ipo.id, orgId, agent: 'PROSPECTUS', triggeredById: advisor.id, actorName: 'Meron Tadesse', forceRules: true });
  await runAgent({ engagementId: ipo.id, orgId, agent: 'PROJECT', triggeredById: owner.id, actorName: 'Hundaol Girma', forceRules: true });
  await runAgent({ engagementId: ipo.id, orgId, agent: 'SECRETARY', triggeredById: advisor.id, actorName: 'Meron Tadesse', forceRules: true });

  for (const agent of ['LEGAL', 'FINANCIAL'] as const) {
    await runAgent({ engagementId: bond.id, orgId, agent, triggeredById: analyst.id, actorName: 'Dawit Bekele', forceRules: true });
  }
  await runAgent({ engagementId: ma.id, orgId, agent: 'LEGAL', triggeredById: analyst.id, actorName: 'Selamawit Hailu', forceRules: true });

  // Triage a couple of findings so the app does not look untouched.
  const ipoFindings = repo.listFindings(ipo.id);
  if (ipoFindings[0]) {
    repo.updateFinding(ipoFindings[0].id, {
      status: 'ACKNOWLEDGED', humanVerdict: 'CONFIRMED', assigneeId: advisor.id, visibleToClient: 1,
    });
  }
  const lowest = ipoFindings.find((f) => f.severity === 'LOW');
  if (lowest) {
    repo.updateFinding(lowest.id, {
      status: 'RESOLVED', humanVerdict: 'CONFIRMED', resolvedById: analyst.id,
      resolvedAt: now(), resolutionNote: 'Placeholder removed in the re-issued document received 14 September 2026.',
    });
  }

  console.log('✓ agent runs, findings, risks and report drafts');

  // ------------------------------------------------------------------ done

  const snap = repo.snapshot(orgId, ipo.id)!;
  console.log('');
  console.log('─────────────────────────────────────────────────────────');
  console.log('  Seed complete');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  IPO engagement ${snap.engagement.reference}`);
  console.log(`    completeness ${snap.completeness.percent}%  ·  findings ${snap.compliance.open} open (${snap.compliance.critical} critical)`);
  console.log(`    risks ${snap.risks.length}  ·  prospectus ${snap.prospectusProgress.percent}%  ·  health ${snap.health.score}`);
  console.log('');
  console.log('  Sign in with password  demo1234');
  console.log('    hundaol@siinqee-ib.demo        Managing Director');
  console.log('    meron@siinqee-ib.demo          Transaction Advisor');
  console.log('    dawit@siinqee-ib.demo          Analyst');
  console.log('    finance@abyssiniaagro.et       Client portal');
  console.log('─────────────────────────────────────────────────────────');

}

main().catch((e) => { console.error(e); process.exit(1); });
