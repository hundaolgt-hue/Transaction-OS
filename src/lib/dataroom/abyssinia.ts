/**
 * The demo data room for Abyssinia Agro-Industries S.C. — a fictional issuer.
 * One document per ECMA-EQUITY checklist item, rendered from the financial
 * model so every figure reconciles. Some documents carry deliberate gaps so
 * the agents have real work to do; they are listed in GAPS below.
 */
import { FIN, PROJ, INTERIM, OFFER, PROCEEDS, YEARS, PROJ_YEARS } from './model';
import { doc, table, n } from './format';

export interface DataRoomDoc { code: string | null; title: string; fileName: string; body: string; accept: boolean }

export const COMPANY = {
  name: 'Abyssinia Agro-Industries S.C.',
  legalName: 'Abyssinia Agro-Industries Share Company',
  registration: 'MT/AA/2/0000451892/2018',
  tin: '0045678901',
  licence: 'AA/BL/09/2018/R8',
  incorporated: '14 March 2018',
  headOffice: 'Kality Industrial Zone, Akaki Kality Sub-city, Addis Ababa',
  plants: ['Kality (Addis Ababa) — crushing and refining', 'Bishoftu — refining and packaging', 'Adama — seed intake and warehousing'],
  employees: 684,
  auditor: 'Bekele, Tessema & Co. Chartered Accountants',
  valuer: 'Sidama Valuation Partners PLC',
  bank: 'Meskel Commercial Bank S.C.',
  devBank: 'Entoto Development Bank',
};

/** Deliberate weaknesses, so reviewers can check what the agents should catch. */
export const GAPS = [
  'Articles of association do not provide for an audit committee (Legal rule L-002).',
  'Shareholder register does not identify beneficial owners of corporate holders (L-007).',
  'Distribution agreement contains a change-of-control termination right (L-008).',
  'Related-party schedule discloses an outstanding loan to the chairman (L-011).',
  'Tax clearance certificate is older than its six-month validity (F-011).',
  'Insurance schedule still carries a "to be confirmed" placeholder (E-001).',
  'Gearing is 1.01x against a 1.25x covenant — headroom narrows once the fourth line is debt-funded (financial analysis).',
  'Receivable days lengthened over the review period (financial analysis).',
];

const F = FIN;
const y3 = (pick: (f: typeof F.FY2025) => number) => YEARS.map((y) => pick(F[y]));

// ---------------------------------------------------------------- corporate

const moa = doc('Memorandum of Association of Abyssinia Agro-Industries Share Company', [
  ['Registration number', COMPANY.registration],
  ['Consolidated text as at', '12 November 2024'],
  ['Legal form', 'Share Company'],
], [
  'Registered under the Commercial Code of Ethiopia, Proclamation No. 1243/2021.',
  '',
  '1. NAME. The name of the Company is Abyssinia Agro-Industries Share Company ("the Company").',
  `2. HEAD OFFICE. The head office of the Company is at ${COMPANY.headOffice}. The Company may open branches elsewhere in Ethiopia by resolution of the board.`,
  '3. OBJECTS. The objects of the Company are: (a) the purchase, cleaning, crushing and solvent extraction of oilseeds including sesame, niger seed, soybean and sunflower; (b) the refining, bleaching, deodorising, packaging and distribution of edible oil; (c) the production and sale of oilseed cake and meal for animal feed; (d) the operation of outgrower and input-finance schemes with farmers and cooperatives; and (e) all activities incidental to the foregoing.',
  '4. DURATION. The duration of the Company is indefinite.',
  `5. CAPITAL. The subscribed capital of the Company is Birr ${n(F.FY2025.shareCapital * 1000)} divided into ${n(OFFER.existingShares)} ordinary shares of Birr ${OFFER.parValue} each, fully subscribed and paid up.`,
  '6. LIABILITY. The liability of the shareholders is limited to the amount unpaid, if any, on the shares held by them.',
  '7. AMENDMENTS. The memorandum was amended on 20 June 2023 (increase of capital from Birr 400,000,000 to Birr 480,000,000) and on 12 November 2024 (restatement of objects to include outgrower finance).',
  '8. FOUNDERS. The founding shareholders and their original subscriptions are set out in the schedule to this memorandum.',
  '',
  'Signed at Addis Ababa this 12th day of November 2024 by the Chairman of the Board and the Company Secretary, and certified by the Ministry of Trade and Regional Integration.',
]);

const aoa = doc('Articles of Association of Abyssinia Agro-Industries Share Company', [
  ['Consolidated text as at', '12 November 2024'],
  ['Adopted by', 'Extraordinary general meeting of 12 November 2024'],
], [
  'PART I — SHARES AND SHARE CAPITAL',
  'Article 3. The share capital is divided into ordinary shares of Birr 300 each, each carrying one vote at general meetings and an equal right to dividends and to surplus assets on winding up.',
  'Article 4. Shares are indivisible as regards the Company. Joint holders shall appoint one representative.',
  'Article 5. The Company shall maintain a register of shareholders at its head office recording the name, nationality and address of each holder and the number of shares held.',
  'Article 6. Transfer of shares. Shares are freely transferable. A transfer of shares takes effect as regards the Company when entered in the register. Upon admission of the shares to a securities exchange, transfers shall be effected in accordance with the rules of that exchange and of the central securities depository, and no right of pre-emption on transfer shall apply.',
  'Article 7. Increase of capital. The capital may be increased by resolution of an extraordinary general meeting. Existing shareholders have a pre-emptive right to subscribe for new shares in proportion to their holdings unless the general meeting resolves to waive that right for a public offering.',
  '',
  'PART II — GENERAL MEETINGS',
  'Article 12. The ordinary general meeting shall be held within four months of the close of each financial year.',
  'Article 13. An extraordinary general meeting may be convened by the board or on the requisition of shareholders holding not less than one tenth of the subscribed capital.',
  'Article 14. Notice of a general meeting shall be published in a newspaper of national circulation not less than fifteen days before the meeting.',
  'Article 15. The quorum of an ordinary general meeting is shareholders representing one quarter of the subscribed capital. The quorum of an extraordinary general meeting is shareholders representing one half of the subscribed capital. Resolutions amending these articles require a majority of two thirds of the votes of shares represented.',
  '',
  'PART III — THE BOARD OF DIRECTORS',
  'Article 20. The Company shall be managed by a board of not fewer than five and not more than nine directors elected by the general meeting for a term of three years, renewable.',
  'Article 21. At least one third of the directors shall be independent of management and of any shareholder holding more than ten per cent of the capital.',
  'Article 24. The board shall meet not less than four times in each financial year. The quorum is a majority of directors in office.',
  'Article 25. A director who has a direct or indirect interest in a transaction with the Company shall declare that interest and shall not vote on it.',
  'Article 27. The board shall appoint a chief executive officer and determine the terms of that appointment.',
  'Article 28. The board may establish such committees as it considers appropriate and shall determine their composition and terms of reference.',
  '',
  'PART IV — ACCOUNTS AND AUDIT',
  'Article 31. The financial year of the Company runs from 8 July to 7 July.',
  'Article 32. The general meeting shall appoint an external auditor registered with the Accounting and Auditing Board of Ethiopia.',
  'Article 33. The financial statements shall be prepared in accordance with International Financial Reporting Standards.',
  'Article 34. The board shall submit audited accounts to the ordinary general meeting together with its annual report.',
  '',
  'PART V — DIVIDENDS AND RESERVES',
  'Article 36. Not less than five per cent of annual net profit shall be transferred to a legal reserve until the reserve equals ten per cent of capital.',
  'Article 37. Dividends are declared by the general meeting on the recommendation of the board.',
  '',
  'PART VI — DISSOLUTION',
  'Article 40. On dissolution the assets remaining after the discharge of liabilities shall be distributed among shareholders in proportion to their holdings.',
  '',
  'Signed by the Chairman and the Company Secretary, 12 November 2024.',
]);

const registration = doc('Certificate of Commercial Registration', [
  ['Issued by', 'Ministry of Trade and Regional Integration'],
  ['Registration number', COMPANY.registration],
  ['Name of business organisation', COMPANY.legalName],
  ['Legal form', 'Share Company'],
  ['Date of registration', COMPANY.incorporated],
  ['Registered capital', 'Birr 480,000,000'],
  ['Principal business', 'Manufacture of vegetable and animal oils and fats'],
  ['Head office', COMPANY.headOffice],
  ['Renewed', '06 October 2025'],
  ['Valid until', '05 October 2026'],
], ['This certificate is issued under the Commercial Registration and Business Licensing Proclamation No. 980/2016. Signed and sealed by the Registrar.']);

const licence = doc('Business Licence 2025/26', [
  ['Issued by', 'Addis Ababa City Administration Trade Bureau'],
  ['Licence number', COMPANY.licence],
  ['Issued to', COMPANY.legalName],
  ['Fields of business', 'Manufacture of edible oil; wholesale of oilseed cake and meal; import of processing machinery for own use'],
  ['Date of issue', '06 October 2025'],
  ['Valid to', '05 October 2026'],
], ['Branch licences: Bishoftu (OR/BL/77/2021/R4, valid to 30 September 2026); Adama (OR/BL/12/2020/R5, valid to 30 September 2026). Signed and sealed by the licensing officer.']);

const SHAREHOLDERS: [string, string, number][] = [
  ['Getachew Mengistu', 'Ethiopian', 512_000],
  ['Hiwot Assefa', 'Ethiopian', 288_000],
  ['Kality Holdings PLC', 'Ethiopian (company)', 240_000],
  ['Rift Valley Investments PLC', 'Ethiopian (company)', 176_000],
  ['Tigist Alemu', 'Ethiopian', 96_000],
  ['Abyssinia Agro Employee Share Trust', 'Ethiopian (trust)', 80_000],
  ['Other holders (41)', 'Ethiopian', 208_000],
];

const register = doc('Register of Shareholders as at 30 June 2026', [
  ['Company', COMPANY.legalName],
  ['Total issued shares', `${n(OFFER.existingShares)} ordinary shares of Birr ${OFFER.parValue}`],
  ['Certified by', 'Company Secretary, 2 July 2026'],
], [
  table(['Holder', 'Nationality', 'Shares', 'Per cent', 'Paid up'],
    SHAREHOLDERS.map(([h, nat, s]) => [h, nat, s, `${((s / OFFER.existingShares) * 100).toFixed(1)}%`, 'Fully paid'])),
  '',
  'The register records holders of record only. Transfers registered in the period: 4 (aggregate 14,200 shares), all between existing holders.',
]);

const capitalEvidence = doc('Capital Subscription and Payment Evidence', [
  ['Prepared by', 'Company Secretary'],
  ['Date', '4 July 2026'],
], [
  'Capital history',
  table(['Date', 'Event', 'Shares issued', 'Capital after (Birr)'], [
    ['14 March 2018', 'Incorporation', 1_000_000, '300,000,000'],
    ['2 August 2021', 'Rights issue to existing holders', 333_334, '400,000,200'],
    ['20 June 2023', 'Capital increase (EGM of 20 June 2023)', 266_666, '480,000,000'],
  ]),
  '',
  `Bank confirmation. ${COMPANY.bank} (Kality branch) confirms by letter dated 28 June 2023 that Birr 80,000,000 was received into the Company's capital account no. ending 4471 between 21 June and 27 June 2023 from the subscribers listed in the attached subscription list, and that the amount has been released to the Company's operating account on registration of the increase.`,
  '',
  'Subscription list (June 2023 increase)',
  table(['Subscriber', 'Shares', 'Amount (Birr)'], [
    ['Getachew Mengistu', 85_333, '25,599,900'], ['Hiwot Assefa', 48_000, '14,400,000'],
    ['Kality Holdings PLC', 40_000, '12,000,000'], ['Rift Valley Investments PLC', 29_333, '8,799,900'],
    ['Tigist Alemu', 16_000, '4,800,000'], ['Other holders', 48_000, '14,400,200'],
  ]),
  '',
  'Signed: Company Secretary. Bank letter signed and sealed by the branch manager.',
]);

// --------------------------------------------------------------- governance

const boardResolution = doc('Extract of Board Resolution of 18 April 2026', [
  ['Meeting', 'Ordinary meeting of the board of directors'],
  ['Held at', 'Head office, 18 April 2026, 09:30'],
  ['Present', 'Getachew Mengistu (Chair), Hiwot Assefa, Dr Alemayehu Fikre, Tigist Alemu, Bekele Roba, Sara Mohammed'],
  ['Quorum', 'Six of seven directors present; quorum satisfied'],
], [
  'RESOLVED:',
  `1. That, subject to the approval of an extraordinary general meeting, the Company offer ${n(OFFER.newShares)} new ordinary shares of Birr ${OFFER.parValue} par value to the public and apply for their admission, together with the existing ${n(OFFER.existingShares)} shares, to the Ethiopian Securities Exchange.`,
  `2. That the offer price be set within a price range of Birr ${OFFER.priceLow} to Birr ${OFFER.priceHigh} per share, the final offer price to be fixed by the board on the recommendation of the transaction adviser after book-building, and that the number of shares may not exceed ${n(OFFER.newShares)}.`,
  '3. That Siinqee Investment Bank S.C. be appointed transaction adviser, and that the Chief Executive Officer negotiate the appointment of a licensed underwriter, a registrar and legal counsel.',
  '4. That the board approve the use of proceeds set out in the paper tabled at the meeting.',
  '5. That the Chief Executive Officer and the Chief Finance Officer be jointly authorised to execute all documents necessary to give effect to these resolutions.',
  '',
  'The meeting closed at 11:15. Certified a true extract. Signed: Getachew Mengistu, Chairman; Mekdes Hailu, Company Secretary.',
]);

const egm = doc('Minutes of the Extraordinary General Meeting of 30 May 2026', [
  ['Held at', 'Ghion Hall, Addis Ababa, 30 May 2026, 10:00'],
  ['Notice', 'Published in a national newspaper on 12 May 2026 (18 days before the meeting)'],
  ['Shares represented', '1,400,000 of 1,600,000 shares (87.5% of subscribed capital)'],
  ['Quorum', 'Extraordinary general meeting quorum of one half of capital satisfied'],
], [
  'AGENDA: (1) increase of capital by public offering; (2) waiver of pre-emptive rights; (3) listing on the Ethiopian Securities Exchange; (4) amendment of Article 5 of the memorandum.',
  '',
  'RESOLUTIONS',
  `1. Increase of capital from Birr 480,000,000 to Birr 1,080,000,000 by the issue of up to ${n(OFFER.newShares)} new ordinary shares by public offering. Passed by a majority of 1,386,000 votes (99.0% of shares represented); 14,000 against.`,
  '2. Waiver of pre-emptive rights in respect of the public offering, with a priority allocation of up to 10% of the offer to existing shareholders. Passed by a majority of 1,352,000 votes (96.6%); 48,000 against.',
  '3. Application for admission of all shares to the Ethiopian Securities Exchange. Passed unanimously.',
  '4. Amendment of Article 5 of the memorandum to reflect the new capital upon completion. Passed by a majority of 1,386,000 votes (99.0%), exceeding the two-thirds majority required.',
  '',
  'Scrutineers: Bekele, Tessema & Co. Signed by the Chair of the meeting and the Secretary.',
]);

const profiles = doc('Directors and Senior Management — Profiles and Declarations', [
  ['Prepared by', 'Company Secretary'],
  ['Date', '20 April 2026'],
], [
  table(['Name', 'Position', 'Independent', 'Shareholding'], [
    ['Getachew Mengistu', 'Chairman, non-executive director', 'No', '32.0% direct; controls Kality Holdings PLC (15.0%)'],
    ['Hiwot Assefa', 'Non-executive director', 'No', '18.0% direct; controls Rift Valley Investments PLC (11.0%)'],
    ['Dr Alemayehu Fikre', 'Independent non-executive director', 'Yes', 'None'],
    ['Sara Mohammed', 'Independent non-executive director', 'Yes', 'None'],
    ['Tigist Alemu', 'Chief Finance Officer, executive director', 'No', '6.0%'],
    ['Bekele Roba', 'Chief Executive Officer, executive director', 'No', 'None'],
    ['Yared Tesfaye', 'Non-executive director', 'No', 'Represents the Employee Share Trust'],
  ]),
  '',
  'Getachew Mengistu — Chairman. BSc Agricultural Economics (Haramaya University). Thirty-one years in oilseed trading and processing; founder of Kality Holdings PLC. Director since incorporation.',
  'Hiwot Assefa — Non-executive director. MBA (Addis Ababa University). Former deputy chief executive of a commercial bank; chairs the board\'s informal finance group.',
  'Dr Alemayehu Fikre — Independent director. PhD in Food Technology; former head of a national food-science research institute. No relationship with the Company other than as director.',
  'Sara Mohammed — Independent director. LLB, LLM in Commercial Law; practising advocate for sixteen years.',
  'Tigist Alemu — Chief Finance Officer. ACCA. Twelve years in manufacturing finance; joined 2019.',
  'Bekele Roba — Chief Executive Officer. MSc Industrial Engineering. Previously plant director at a regional agro-processor; appointed 2021.',
  'Yared Tesfaye — Director nominated by the Employee Share Trust. Head of production, Kality.',
  '',
  'Senior management: Mekdes Hailu (Company Secretary and Head of Legal); Daniel Ayele (Head of Procurement and Outgrower Programmes); Liya Gebre (Head of Sales and Distribution); Samuel Worku (Head of Quality and Regulatory).',
  '',
  'Fit and proper declarations were signed by each director on 20 April 2026. No director has been the subject of a bankruptcy order, a disqualification order, or a conviction for an offence involving dishonesty.',
  'Remuneration FY2025 (Birr): board fees 4,200,000 in aggregate; CEO 6,840,000; CFO 4,920,000; key management personnel in aggregate 24,118,000.',
]);

const relatedParty = doc('Related-Party Transaction Schedule FY2023–FY2025', [
  ['Prepared by', 'Chief Finance Officer'],
  ['Reviewed by', 'Bekele, Tessema & Co. (agreed-upon procedures)'],
  ['Date', '14 September 2026'],
], [
  table(['Counterparty', 'Relationship', 'Nature', 'FY2023', 'FY2024', 'FY2025'], [
    ['Kality Holdings PLC', 'Controlled by the Chairman', 'Purchase of oilseed', 142_300, 166_900, 188_440],
    ['Kality Holdings PLC', 'Controlled by the Chairman', 'Warehouse rental (Adama)', 6_000, 6_600, 7_200],
    ['Rift Valley Investments PLC', 'Controlled by a director', 'Transport services', 18_880, 21_400, 24_760],
    ['Getachew Mengistu', 'Chairman', 'Loan to director — interest-free, repayable on demand', 0, 12_000, 12_000],
    ['Key management personnel', 'Directors and executives', 'Compensation', 19_200, 21_600, 24_118],
  ]),
  '',
  'Amounts in Birr \'000. The loan to director (Getachew Mengistu) of Birr 12,000,000 was advanced on 3 October 2023 to fund a personal land acquisition and remained outstanding at 7 July 2025 and at the date of this schedule. It was approved by the board on 28 September 2023; no shareholder approval was sought.',
  'Purchases from Kality Holdings PLC are made at the prevailing Ethiopian Commodity Exchange reference price plus a handling margin of 1.5%.',
  '',
  'Signed: Tigist Alemu, Chief Finance Officer.',
]);

const governance = doc('Board Charter and Corporate Governance Framework', [
  ['Adopted by', 'Board of directors, 18 April 2026'],
  ['Version', '1.0'],
], [
  '1. Role of the board. The board sets strategy, approves budgets and major capital expenditure, oversees risk and internal control, and appoints and evaluates the Chief Executive Officer.',
  '2. Composition. The board comprises seven directors, of whom two are independent. The board intends to appoint a third independent director before admission.',
  '3. Committees. The board intends to establish an audit and risk committee and a nomination and remuneration committee within six months of admission. Until then their functions are exercised by the full board.',
  '4. Internal audit. An internal audit function reporting to the Chief Executive Officer was established in January 2025 with two staff.',
  '5. Conflicts of interest. Directors declare interests annually and before any relevant board item; a register of interests is kept by the Company Secretary.',
  '6. Evaluation. The board will conduct an annual evaluation of its performance beginning in FY2027.',
  '',
  'Signed: Getachew Mengistu, Chairman.',
]);

// ---------------------------------------------------------------- financial

function statementTable(title: string, rows: [string, (f: typeof F.FY2025) => number][]) {
  return [title, table(['Birr \'000', ...YEARS], rows.map(([l, pick]) => [l, ...y3(pick)]))].join('\n');
}

const audited = doc('Audited Financial Statements FY2023–FY2025', [
  ['Entity', COMPANY.legalName],
  ['Periods', 'Years ended 7 July 2023, 2024 and 2025'],
  ['Auditor', COMPANY.auditor],
  ['Presentation currency', 'Ethiopian Birr, thousands'],
], [
  'STATEMENT OF COMPLIANCE',
  'These financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS) as issued by the International Accounting Standards Board and the Financial Reporting Proclamation No. 847/2014. They have been prepared on the historical cost basis and on a going concern basis.',
  '',
  statementTable('STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME', [
    ['Revenue', (f) => f.revenue], ['Cost of sales', (f) => -f.cogs], ['Gross profit', (f) => f.gross],
    ['Selling and distribution expenses', (f) => -f.selling], ['Administrative expenses', (f) => -f.admin],
    ['Other income', (f) => f.otherIncome], ['Operating profit', (f) => f.operating],
    ['Finance costs', (f) => -f.financeCosts], ['Profit before tax', (f) => f.pbt],
    ['Income tax expense', (f) => -f.tax], ['Profit for the year', (f) => f.pat],
  ]),
  '',
  statementTable('STATEMENT OF FINANCIAL POSITION', [
    ['Property, plant and equipment', (f) => f.ppe], ['Right-of-use assets', (f) => f.rou],
    ['Total non-current assets', (f) => f.nonCurrentAssets],
    ['Inventories', (f) => f.inventories], ['Trade and other receivables', (f) => f.receivables],
    ['Cash and cash equivalents', (f) => f.cash], ['Total current assets', (f) => f.currentAssets],
    ['Total assets', (f) => f.totalAssets],
    ['Share capital', (f) => f.shareCapital], ['Retained earnings and reserves', (f) => f.retained],
    ['Total equity', (f) => f.equity],
    ['Borrowings — non-current', (f) => f.borrowingsNC], ['Lease liabilities', (f) => f.leaseLiabilities],
    ['Total non-current liabilities', (f) => f.nonCurrentLiabilities],
    ['Borrowings — current portion', (f) => f.borrowingsCurrent], ['Trade and other payables', (f) => f.payables],
    ['Current tax payable', (f) => f.taxPayable], ['Total current liabilities', (f) => f.currentLiabilities],
    ['Total equity and liabilities', (f) => f.equity + f.totalLiabilities],
  ]),
  '',
  statementTable('STATEMENT OF CASH FLOWS', [
    ['Net cash from operating activities', (f) => f.opCash], ['Net cash used in investing activities', (f) => f.invCash],
    ['Net cash from financing activities', (f) => f.finCash], ['Depreciation and amortisation', (f) => f.depreciation],
    ['Capital expenditure', (f) => f.capex], ['Dividends paid', (f) => f.dividends],
  ]),
  '',
  'STATEMENT OF CHANGES IN EQUITY',
  `Share capital increased from Birr 400,000 thousand to Birr 480,000 thousand in FY2024 following the capital increase of June 2023. Dividends of Birr ${n(F.FY2024.dividends)} thousand (FY2024) and Birr ${n(F.FY2025.dividends)} thousand (FY2025) were paid. The balance of retained earnings moves by the profit for the year less dividends.`,
  '',
  'NOTES TO THE FINANCIAL STATEMENTS',
  'Note 1 — Basis of preparation. Historical cost, except where stated. Functional currency Ethiopian Birr.',
  'Note 3 — Revenue. Revenue comprises sales of refined edible oil (FY2025: 81%), oilseed cake and meal (16%) and other products (3%). Revenue is recognised on delivery.',
  'Note 9 — Property, plant and equipment. Additions in FY2025 include advance payments of Birr 186,000 thousand for the fourth crushing line.',
  'Note 11 — Inventories. Raw oilseed Birr 402,110 thousand; finished goods Birr 148,300 thousand; packaging and spares Birr 62,470 thousand (FY2025).',
  'Note 12 — Borrowings. Term facilities with Meskel Commercial Bank S.C. and Entoto Development Bank secured by mortgages over the Kality and Bishoftu plants. See note 12.3 for covenants.',
  'Note 12.3 — Covenants. The facilities require a ratio of total borrowings to equity not exceeding 1.25 and a debt service coverage ratio of not less than 1.30, tested annually. The Company was in compliance at each year end.',
  'Note 18 — Equity. Movements in share capital and reserves.',
  'Note 22 — Commitments and contingencies. Capital commitments for the fourth line Birr 226,000 thousand. Contingent liabilities in respect of legal proceedings are described in note 22.2; no provision is recognised where an outflow is not probable.',
  'Note 24 — Related parties. Related party transactions and balances, including key management personnel compensation of Birr 24,118 thousand (FY2025) and a loan receivable from a director of Birr 12,000 thousand, are disclosed in this note.',
  '',
  'Approved by the board on 10 October 2025 and signed on its behalf by the Chairman and the Chief Finance Officer.',
]);

const interim = doc('Condensed Interim Financial Information — Nine Months to 7 April 2026', [
  ['Status', 'Reviewed, not audited (ISRE 2410 review by the auditor)'],
  ['Period', INTERIM.period],
  ['Date of review report', '28 May 2026'],
], [
  table(['Birr \'000', '9M to 7 Apr 2026', '9M to 7 Apr 2025'], [
    ['Revenue', INTERIM.revenue, INTERIM.comparativeRevenue],
    ['Gross profit', INTERIM.gross, 529_100],
    ['Operating profit', INTERIM.operating, 322_400],
    ['Finance costs', -INTERIM.financeCosts, -143_500],
    ['Profit before tax', INTERIM.pbt, INTERIM.comparativePbt],
    ['Profit for the period', INTERIM.pat, 125_230],
  ]),
  '',
  table(['Birr \'000', '7 Apr 2026', '7 Jul 2025'], [
    ['Total assets', INTERIM.totalAssets, F.FY2025.totalAssets],
    ['Cash and cash equivalents', INTERIM.cash, F.FY2025.cash],
    ['Total borrowings', INTERIM.borrowings, F.FY2025.borrowingsNC + F.FY2025.borrowingsCurrent],
    ['Total equity', INTERIM.equity, F.FY2025.equity],
  ]),
  '',
  'Prepared in accordance with IAS 34 on the basis of the accounting policies applied in the annual financial statements. Revenue grew 11.4% on the comparative period, driven by refined-oil volumes; gross margin improved to 25.7%. Signed by the Chief Finance Officer, 28 May 2026.',
]);

const auditorReport = doc('Independent Auditor\'s Report FY2025', [
  ['Auditor', COMPANY.auditor],
  ['AABE registration', 'AABE/AF/0187'],
  ['Date', '14 October 2025'],
], [
  'To the Shareholders of Abyssinia Agro-Industries Share Company',
  '',
  'Opinion. We have audited the financial statements of Abyssinia Agro-Industries Share Company, which comprise the statement of financial position as at 7 July 2025, and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements. In our opinion, the accompanying financial statements present fairly, in all material respects, the financial position of the Company as at 7 July 2025 and its financial performance and its cash flows for the year then ended in accordance with International Financial Reporting Standards.',
  '',
  'Basis for opinion. We conducted our audit in accordance with International Standards on Auditing. We are independent of the Company in accordance with the IESBA Code and the ethical requirements relevant in Ethiopia.',
  '',
  'Key audit matters. (1) Valuation of raw oilseed inventory, given price volatility. (2) Recoverability of trade receivables from distributors, which lengthened during the year. (3) Classification and disclosure of the related-party loan to a director.',
  '',
  'Independence confirmation. The firm confirms that it has provided no non-audit services to the Company in FY2025 other than agreed-upon procedures on the related-party schedule, and that the engagement partner has served for three years.',
  '',
  'Signed: Abebe Tessema, Engagement Partner, for and on behalf of Bekele, Tessema & Co. Chartered Accountants, Addis Ababa.',
]);

const projections = doc('Financial Projections FY2026–FY2030 and Assumptions', [
  ['Prepared by', 'Management, reviewed by the transaction adviser'],
  ['Date', '2 August 2026'],
  ['Basis of preparation', 'Consistent with the accounting policies of the audited financial statements'],
], [
  table(['Birr \'000', ...PROJ_YEARS], [
    ['Revenue', ...PROJ_YEARS.map((y) => PROJ[y].revenue)],
    ['EBITDA', ...PROJ_YEARS.map((y) => PROJ[y].ebitda)],
    ['Depreciation', ...PROJ_YEARS.map((y) => -PROJ[y].depreciation)],
    ['Finance costs', ...PROJ_YEARS.map((y) => -PROJ[y].financeCosts)],
    ['Profit before tax', ...PROJ_YEARS.map((y) => PROJ[y].pbt)],
    ['Profit after tax', ...PROJ_YEARS.map((y) => PROJ[y].pat)],
    ['Capital expenditure', ...PROJ_YEARS.map((y) => PROJ[y].capex)],
    ['Seed crushed (thousand tonnes)', ...PROJ_YEARS.map((y) => PROJ[y].volumeKt)],
  ]),
  '',
  'PRINCIPAL ASSUMPTIONS',
  'Within management\'s control: (a) the fourth crushing line is commissioned by the end of Q2 FY2027, adding 40,000 tonnes a year of seed capacity; (b) administrative costs grow at 8% a year; (c) capital expenditure as scheduled above; (d) dividend payout of 25% of profit after tax from FY2027.',
  'Outside management\'s control: (e) oilseed input prices rise at 9% a year and edible-oil selling prices at 10%; (f) the Birr depreciates against the US dollar at 12% a year, affecting imported spares and chemicals; (g) no change in the corporate income tax rate of 30%; (h) foreign-exchange allocation for machinery imports remains available.',
  '',
  'SENSITIVITY ANALYSIS (FY2028 profit after tax)',
  table(['Scenario', 'Change', 'PAT Birr \'000', 'vs base'], [
    ['Base case', '—', PROJ.FY2028.pat, '—'],
    ['Oilseed price +5pp above base', 'Input cost', Math.round(PROJ.FY2028.pat * 0.81), '-19%'],
    ['Line commissioning delayed 6 months', 'Volume', Math.round(PROJ.FY2028.pat * 0.9), '-10%'],
    ['Birr depreciation +10pp', 'FX', Math.round(PROJ.FY2028.pat * 0.94), '-6%'],
  ]),
  '',
  'Signed: Bekele Roba, Chief Executive Officer; Tigist Alemu, Chief Finance Officer.',
]);

const useOfProceeds = doc('Use of Proceeds Statement', [
  ['Gross proceeds at the offer price', `Birr ${n(OFFER.gross * 1000)} (${n(OFFER.newShares)} shares at Birr ${OFFER.price})`],
  ['Estimated offer expenses', `Birr ${n(OFFER.expenses * 1000)}`],
  ['Net proceeds', `Birr ${n((OFFER.gross - OFFER.expenses) * 1000)}`],
  ['Approved by', 'Board of directors, 18 April 2026'],
], [
  table(['Priority', 'Use', 'Amount Birr \'000', 'Timing'], PROCEEDS.map((p) => [p.priority, p.use, p.amount, p.timing])),
  '',
  `Total applied: Birr ${n(PROCEEDS.reduce((a, p) => a + p.amount, 0))} thousand. If the offer is not fully subscribed, proceeds will be applied in the order of priority shown; the packaging expansion and the outgrower programme would then be funded from operating cash flow or deferred. Pending application, proceeds will be held in interest-bearing deposits with licensed Ethiopian banks.`,
  '',
  'Signed: Chief Finance Officer.',
]);

const valuation = doc('Independent Valuation Report', [
  ['Valuer', COMPANY.valuer],
  ['Valuation date', '7 April 2026'],
  ['Report date', '12 August 2026'],
  ['Standard', 'International Valuation Standards (IVS 105)'],
], [
  'Methods. The valuation applies a discounted cash flow method (weight 60%) and a market approach using comparable listed edible-oil processors in East Africa (weight 40%). A net asset value cross-check is provided.',
  '',
  'Discounted cash flow. Free cash flows from the management projections FY2026–FY2030 are discounted at a cost of equity of 24.5% (Ethiopian 10-year government yield proxy 17.0%, equity risk premium 6.0%, beta 1.05, size premium 1.2%). Terminal growth 6.0% in nominal Birr terms.',
  '',
  table(['Method', 'Equity value Birr \'000', 'Per share (Birr)', 'Weight'], [
    ['Discounted cash flow', 2_210_000, '1,381', '60%'],
    ['Market approach (EV/EBITDA 5.4x–6.6x)', 2_020_000, '1,263', '40%'],
    ['Weighted value (pre-money)', 2_134_000, '1,334', '—'],
    ['Net asset value cross-check', F.FY2025.equity, Math.round(F.FY2025.equity * 1000 / OFFER.existingShares).toLocaleString('en-US'), '—'],
  ]),
  '',
  `Conclusion. The weighted pre-money equity value of Birr 2,134 million supports an offer price range of Birr ${OFFER.priceLow}–${OFFER.priceHigh} per share after a discount for the capital raised, the illiquidity of a newly listed share and an IPO discount of 15%. Note: per-share values above are stated on the existing share count; the offer price reflects the par value of Birr 300 and the premium determined by the board.`,
  '',
  'Signed: Meseret Alemayehu, MRICS, for Sidama Valuation Partners PLC.',
]);

const facilities = doc('Bank Statements Summary and Facility Agreements', [
  ['Prepared by', 'Treasury'],
  ['Date', '31 July 2026'],
], [
  table(['Lender', 'Facility', 'Limit Birr \'000', 'Outstanding 7 Jul 2025', 'Maturity', 'Security'], [
    [COMPANY.bank, 'Term loan A', 620_000, 498_200, 'June 2031', 'First mortgage, Kality plant'],
    [COMPANY.bank, 'Term loan B', 300_000, 256_400, 'June 2029', 'Second mortgage, Kality plant'],
    [COMPANY.devBank, 'Project loan', 450_000, 381_600, 'March 2033', 'Mortgage, Bishoftu plant; pledge of machinery'],
    [COMPANY.bank, 'Overdraft', 120_000, 81_598, 'Annual renewal', 'Floating charge on inventory'],
  ]),
  '',
  `Financial covenants (all facilities): total borrowings to equity not to exceed 1.25x; debt service coverage ratio not less than 1.30x; no dividend exceeding 50% of profit after tax without lender consent. At 7 July 2025 the gearing ratio was ${((F.FY2025.borrowingsNC + F.FY2025.borrowingsCurrent) / F.FY2025.equity).toFixed(2)}x and the debt service coverage ratio 1.41x. Lenders have confirmed in writing that no event of default has occurred.`,
  '',
  'Principal bank accounts: operating account and capital account with Meskel Commercial Bank S.C.; collection accounts with two other licensed banks. Twelve months of statements are held in the data room sub-folder 4.2.',
  '',
  'Signed: Head of Treasury.',
]);

// ---------------------------------------------------------------------- tax

const taxClearance = doc('Tax Clearance Certificate', [
  ['Issued by', 'Ministry of Revenue — Large Taxpayers Branch Office'],
  ['Taxpayer', COMPANY.legalName],
  ['TIN', COMPANY.tin],
  ['Date of issue', '11 February 2026'],
  ['Validity', 'Six months from the date of issue'],
], [
  'This is to certify that the above taxpayer has settled its obligations in respect of business profit tax, value added tax, withholding tax and employment income tax up to the date of this certificate. Signed and sealed by the branch manager.',
]);

const vatFilings = doc('VAT and Withholding Tax Filings Summary FY2025', [
  ['Prepared by', 'Tax Manager'],
  ['Period', '8 July 2024 – 7 July 2025'],
], [
  table(['Month', 'Output VAT', 'Input VAT', 'Net VAT paid', 'Withholding remitted', 'Filed on time'],
    ['Hamle', 'Nehase', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miyazya', 'Ginbot', 'Sene'].map((m, i) => [
      m, 36_000 + i * 900, 24_100 + i * 610, 11_900 + i * 290, 2_100 + i * 40, i === 7 ? 'No — filed 6 days late, penalty Birr 38,000 paid' : 'Yes',
    ])),
  '',
  'Amounts in Birr \'000. Payment evidence (bank transfer receipts) for each month is held in the data room. Signed: Tax Manager.',
]);

const taxDisputes = doc('Tax Assessment and Dispute Schedule', [
  ['Prepared by', 'Company Secretary and Head of Legal'],
  ['Date', '10 July 2026'],
], [
  table(['Tax', 'Period', 'Assessed Birr \'000', 'Stage', 'Counsel view'], [
    ['Business profit tax — disallowed depreciation on revalued assets', 'FY2022', 14_800, 'Before the Tax Appeal Commission; hearing listed November 2026', 'Possible, not probable; no provision'],
    ['Withholding tax on imported services', 'FY2023', 2_300, 'Objection lodged; awaiting decision', 'Probable in part; provision Birr 1,100 thousand'],
  ]),
  '',
  'Signed: Mekdes Hailu, Head of Legal.',
]);

// -------------------------------------------------------------------- legal

const litigation = doc('Litigation and Contingency Schedule', [
  ['Prepared by', 'External counsel — Yohannes & Associates Law Office'],
  ['Date', '30 June 2026'],
], [
  table(['No.', 'Matter', 'Forum', 'Claim amount Birr \'000', 'Stage', 'Counsel opinion'], [
    [1, 'Abyssinia Agro v. Koka Freight PLC — spoiled consignment', 'Federal First Instance Court, file 284/2024', 3_400, 'Pleadings closed', 'Probable recovery of 70%'],
    [2, 'Gihon Bank S.C. v. Abyssinia Agro — letter-of-credit charges', 'Federal High Court, file 119/2025', 6_900, 'Awaiting judgment', 'Possible loss; not probable'],
    [3, 'Claim by 14 former Bishoftu employees — severance', 'Federal First Instance Court, Labour Division, file 902/2025', 1_850, 'At court-annexed mediation', 'Probable settlement at about Birr 1,200 thousand; provided'],
    [4, 'Oromia Land Administration — boundary dispute, Adama warehouse', 'Adama City Court, file 57/2026', 0, 'Filed May 2026', 'Remote; non-monetary'],
  ]),
  '',
  'No proceedings are pending against any director in that capacity. Counsel is not aware of any threatened proceedings likely to have a material effect on the Company.',
  '',
  'Signed: Yohannes Bekele, Advocate, Yohannes & Associates Law Office.',
]);

const contracts = doc('Schedule of Material Contracts', [
  ['Prepared by', 'Company Secretary'],
  ['Date', '15 July 2026'],
], [
  '1. Oilseed supply agreement with the Sheger Farmers\' Cooperative Union, dated 3 January 2024, five-year term. Minimum annual offtake of 42,000 tonnes at Ethiopian Commodity Exchange reference prices. Either party may terminate on twelve months\' notice after year three.',
  '2. Distribution agreement with Gihon Trading House PLC, dated 19 August 2023, three-year term renewable, exclusive for the Addis Ababa and Oromia markets (about 38% of FY2025 refined-oil revenue). Clause 18.2 provides that upon a change of control of the Company the distributor may terminate on sixty days\' notice and claim a termination fee of six months\' average margin.',
  '3. Plant construction and supply contract with Chengdu Oilseed Machinery Co. Ltd, dated 2 February 2025, for the fourth crushing line. Contract price USD 7.9 million; 30% paid; performance bond 10%; liquidated damages 0.1% a day capped at 10%.',
  '4. Lease of the Adama warehouse from Kality Holdings PLC (a related party), twenty-year lease commencing 1 July 2019.',
  '5. Facility agreements listed in the bank facilities schedule.',
  '6. Packaging supply agreement with Bole PET Industries PLC, dated 1 March 2025, two-year term, fixed prices reviewed quarterly.',
  '',
  'Copies of each contract are held in data room folder 7. Signed: Company Secretary.',
]);

const titles = doc('Title Deeds and Land Holding Certificates', [
  ['Prepared by', 'Head of Legal'],
  ['Encumbrance searches dated', '22 June 2026'],
], [
  table(['Site', 'Certificate no.', 'Area (m²)', 'Lease period', 'Expires', 'Encumbrance'], [
    ['Kality plant', 'AA/LH/KLT/0917', 48_200, '60 years from 2018', '2078', `First and second mortgage in favour of ${COMPANY.bank}`],
    ['Bishoftu plant', 'OR/LH/BSH/2210', 31_500, '50 years from 2020', '2070', `Mortgage in favour of ${COMPANY.devBank}`],
    ['Adama warehouse', 'Leased from Kality Holdings PLC', 12_000, '20-year sublease from 2019', '2039', 'None registered'],
  ]),
  '',
  'Lease payments are current. The Kality lease-hold was acquired at auction; the Bishoftu holding was allotted by the regional investment board. Signed: Head of Legal.',
]);

const ip = doc('Intellectual Property Register', [
  ['Prepared by', 'Head of Legal'],
  ['Date', '10 July 2026'],
], [
  table(['Mark', 'Class', 'Registration no.', 'Registered', 'Renewal due'], [
    ['ABYSSINIA GOLD (word and device)', '29', 'ET/TM/2019/4412', '2019', '2026'],
    ['SHEGER SESAME', '29', 'ET/TM/2021/1180', '2021', '2028'],
    ['KALITY PURE', '29', 'ET/TM/2022/0931', '2022', '2029'],
  ]),
  '',
  'The ABYSSINIA GOLD mark falls due for renewal in December 2026. Registered with the Ethiopian Intellectual Property Authority. Signed: Head of Legal.',
]);

const employment = doc('Employment and Pension Compliance Report', [
  ['Prepared by', 'Head of Human Resources'],
  ['Date', '30 June 2026'],
], [
  `Headcount at 30 June 2026: ${COMPANY.employees} permanent employees (Kality 402, Bishoftu 198, Adama 51, head office 33) and about 220 seasonal workers at harvest.`,
  'Collective agreement with the basic trade union, signed 14 February 2025, three-year term.',
  'Pension contributions: employer 11% and employee 7% of basic salary remitted monthly to the Private Organisations Employees Social Security Agency. A contribution statement for July 2023 – June 2026 confirms no arrears.',
  'Occupational safety: one lost-time injury in FY2025; a fire-safety audit of the Kality plant was completed in March 2026 with four minor recommendations, all closed.',
  '',
  'Signed: Head of Human Resources.',
]);

const insurance = doc('Insurance Policy Schedule', [
  ['Prepared by', 'Head of Finance Operations'],
  ['Date', '1 July 2026'],
], [
  table(['Cover', 'Insurer', 'Sum insured Birr \'000', 'Expiry'], [
    ['Fire and allied perils — Kality plant', 'Zuquala Mutual Insurance S.C.', 1_450_000, '30 June 2027'],
    ['Fire and allied perils — Bishoftu plant', 'Zuquala Mutual Insurance S.C.', 820_000, '30 June 2027'],
    ['Stock (seed and finished goods)', 'Zuquala Mutual Insurance S.C.', 600_000, '30 June 2027'],
    ['Public and product liability', 'Wenchi General Insurance S.C.', 50_000, '30 June 2027'],
    ['Directors and officers liability', 'To be confirmed — quotations requested', 0, '—'],
  ]),
  '',
  'Signed: Head of Finance Operations.',
]);

// --------------------------------------------------------------- regulatory

const noObjection = doc('Regulator Letters — Food Safety Registration and No-Objection', [
  ['Prepared by', 'Head of Quality and Regulatory'],
  ['Date', '5 July 2026'],
], [
  'The Company holds current product registrations for ABYSSINIA GOLD refined sesame oil, blended edible oil and fortified edible oil (vitamin A and D). Fortification complies with the national mandatory fortification standard.',
  'As the Company is not in a sector whose regulator must approve a change in capital, no formal no-objection is required; a letter of comfort from the sector ministry dated 2 July 2026 confirms that it has no objection to the listing.',
  '',
  'Signed: Head of Quality and Regulatory.',
]);

const esia = doc('Environmental and Social Impact Assessment — Fourth Crushing Line', [
  ['Prepared by', 'Green Horn Environmental Consultants PLC'],
  ['Authorisation', 'Environmental clearance issued 18 March 2026, valid for the construction phase'],
], [
  'Scope: construction and operation of a 40,000-tonne-a-year crushing and refining line at Kality, with an effluent treatment upgrade.',
  'Principal impacts: effluent with high oil and grease load; hexane storage; boiler emissions; traffic on the Kality access road.',
  'Mitigation: dissolved-air flotation effluent plant; bunded hexane store with vapour recovery; switch of the new boiler to husk biomass; traffic management plan.',
  'Social: 120 construction jobs and 85 permanent jobs; no resettlement required.',
  '',
  'Signed: Lead consultant.',
]);

const kyc = doc('AML / KYC Pack — Beneficial Ownership and Screening', [
  ['Prepared by', 'Compliance officer'],
  ['Date', '22 April 2026'],
], [
  'Beneficial owners holding, directly or indirectly, 10% or more:',
  table(['Beneficial owner', 'Direct', 'Indirect', 'Total', 'Via'], [
    ['Getachew Mengistu', '32.0%', '12.2%', '44.2%', 'Kality Holdings PLC (81% owned)'],
    ['Hiwot Assefa', '18.0%', '7.0%', '25.0%', 'Rift Valley Investments PLC (64% owned)'],
  ]),
  '',
  'Identity documents for each controller are held on file. Politically exposed person (PEP) and sanctions screening was run on 22 April 2026 against the national and UN consolidated lists for all directors, controllers and their close associates: no matches. Source of wealth: oilseed trading and prior manufacturing interests, supported by tax returns for five years.',
  '',
  'Signed: Compliance officer.',
]);

const underwriting = doc('Draft Underwriting Agreement', [
  ['Status', 'Draft for negotiation — v3, 5 September 2026'],
  ['Underwriter', 'Gondar Gate Securities S.C. (licensed securities dealer)'],
], [
  `Commitment: firm underwriting of 60% of the offer shares (1,200,000 shares) at the final offer price; best efforts for the balance.`,
  'Commission: 2.25% of gross proceeds on the underwritten portion; 1.25% on the best-efforts portion.',
  'Conditions: ECMA approval of the prospectus; no material adverse change; delivery of legal opinions and a comfort letter from the auditor.',
  'Termination: force majeure, suspension of trading on the exchange, or a material adverse change before allotment.',
  '',
  'Initialled for identification by the parties.',
]);

const registrar = doc('Registrar and Depository Appointment', [
  ['Registrar', 'Gondar Gate Securities S.C. (registrar services division)'],
  ['Letter of engagement', '1 September 2026'],
], [
  'The registrar will maintain the register of members after admission, process applications and refunds, and interface with the central securities depository for dematerialisation of existing shares before listing.',
  '',
  'Signed by the parties.',
]);

const marketStudy = doc('Industry and Market Study — Ethiopian Edible Oil', [
  ['Prepared by', 'Transaction adviser research desk (synthetic study for demonstration)'],
  ['Date', 'July 2026'],
], [
  'Market size. National edible-oil consumption is estimated at 1.1–1.3 million tonnes a year, of which domestic processors supply roughly a quarter; the balance is imported palm and soybean oil.',
  'Growth. Demand has grown at 6–8% a year on the back of population growth and urbanisation. Import substitution is a stated policy priority, supporting domestic crushing capacity.',
  'Competition. The domestic market has four processors with more than 50,000 tonnes a year of seed capacity and many small expellers. The Company estimates its share of domestically produced refined oil at 9%.',
  'Inputs. Sesame, niger seed and soybean are the main domestic oilseeds; sesame export prices set the floor for domestic procurement.',
  'Regulation. Mandatory fortification with vitamins A and D applies to all refined edible oil sold domestically.',
  '',
  'Sources: synthetic figures prepared for demonstration; a real study would cite the statistical service, the customs authority and industry associations.',
]);

// -------------------------------------------------------------------- export

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const d = (code: string | null, title: string, body: string, accept = true): DataRoomDoc =>
  ({ code, title, fileName: `${slug(title)}.txt`, body, accept });

export const ABYSSINIA_DATAROOM: DataRoomDoc[] = [
  d('ECMA-C-001', 'Memorandum of Association (as amended 2024)', moa),
  d('ECMA-C-002', 'Articles of Association (in force)', aoa),
  d('ECMA-C-003', 'Certificate of Commercial Registration', registration),
  d('ECMA-C-004', 'Business Licence 2025-26', licence),
  d('ECMA-C-005', 'Register of Shareholders as at 30 June 2026', register),
  d('ECMA-C-006', 'Capital Subscription and Payment Evidence', capitalEvidence),
  d('ECMA-G-001', 'Board Resolution of 18 April 2026', boardResolution),
  d('ECMA-G-002', 'EGM Minutes of 30 May 2026', egm),
  d('ECMA-G-003', 'Board and Senior Management Profiles', profiles),
  d('ECMA-G-004', 'Related-Party Transaction Schedule FY2023-FY2025', relatedParty, false),
  d('ECMA-G-005', 'Board Charter and Governance Framework', governance, false),
  d('ECMA-F-001', 'Audited Financial Statements FY2023-FY2025', audited),
  d('ECMA-F-002', 'Interim Financial Statements - 9M to April 2026', interim),
  d('ECMA-F-003', 'Independent Auditor Report FY2025', auditorReport),
  d('ECMA-F-004', 'Financial Projections FY2026-FY2030', projections, false),
  d('ECMA-F-005', 'Use of Proceeds Statement', useOfProceeds),
  d('ECMA-F-006', 'Independent Valuation Report', valuation, false),
  d('ECMA-F-007', 'Bank Facilities and Covenants', facilities),
  d('ECMA-T-001', 'Tax Clearance Certificate', taxClearance, false),
  d('ECMA-T-002', 'VAT and Withholding Filings FY2025', vatFilings),
  d('ECMA-T-003', 'Tax Assessment and Dispute Schedule', taxDisputes),
  d('ECMA-L-001', 'Litigation and Contingency Schedule', litigation),
  d('ECMA-L-002', 'Schedule of Material Contracts', contracts, false),
  d('ECMA-L-003', 'Title Deeds and Land Holding Certificates', titles),
  d('ECMA-L-004', 'Intellectual Property Register', ip),
  d('ECMA-L-005', 'Employment and Pension Compliance Report', employment),
  d('ECMA-L-006', 'Insurance Policy Schedule', insurance, false),
  d('ECMA-R-001', 'Regulator Letters and No-Objection', noObjection),
  d('ECMA-R-002', 'Environmental and Social Impact Assessment', esia),
  d('ECMA-R-003', 'AML-KYC Pack', kyc),
  d('ECMA-R-004', 'Draft Underwriting Agreement', underwriting, false),
  d('ECMA-R-005', 'Registrar and Depository Appointment', registrar),
  d(null, 'Industry and Market Study - Ethiopian Edible Oil', marketStudy),
];
