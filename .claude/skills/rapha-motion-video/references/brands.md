# Rapha products: brand rules and verified facts

Use these when the video is for one of Rapha Engineering & Consulting's Excel products. Each "verified"
fact was read from the product file or its guide; anything else shown on screen must come from the
user's files in the current request, or be labelled illustrative when you report back.

## ProjectControl (construction project control workbook)

- **Amharic product name (user-corrected, use exactly):** ራፋ የግንባታ ፕሮጀክት ቁጥጥር ስራዓት
  (the user's spelling is ስራዓት; don't "fix" it). Latin: Rapha ProjectControl / RAPHA PROJECTCONTROL.
- **Unit word:** "80 ፎርሞች" (forms), not "ሉሆች" (sheets). The user corrected this.
- **Look:** near-black/navy (#04070D / #0B1D35), amber accent #E8A447 (gradient #FFD596 → #C9781D), blue
  #5B8FE8, logo mark ▣ (rounded square + inner square), Inter + Noto Sans Ethiopic. The workbook itself
  uses navy header bands #0F2A44 with an amber rule #D98E2B, cream input cells #FFF8E6 with blue text #1F4E9C;
  copy that style when recreating a sheet on screen.
- **Sample project (Rapha_ProjectControl_Sample.xlsx):** G+4 Mixed-Use Building (worked example),
  Bole Sub-city Addis Ababa, contract SMP/WKS/2025/017, Sample Contractor PLC. 80 sheets (+ X5 Labels),
  BOQ 54 items / 12 trades, contract sum ETB 94,340,200 excl. VAT (computed: Σ qty × rate),
  570-day contract from 06-Oct-2025, 46 activities, data date 28/30-Sep-2026.
  The tutorial PDF quotes 99.1 M ETB and 84 printable documents; the dashboard shows certified 51.2 M.
  - **Formulas are not cached in the file.** LibreOffice failed to load it in this container. Read inputs with
    openpyxl and compute what you need yourself; say which numbers you computed.
  - Workbook-calculated certified value to month 11 = **49.5 M** (Cash Flow sheet in the tutorial PDF).
    An early video used "56.1 M measured", my own estimate, which the user was told is wrong. Don't reuse it.
  - Cost overrun (actual vs budget for measured work, budget = qty × rate ÷ 1.10 ÷ 1.08 or the rate build-up):
    B2-C-03 ribbed slabs −202,394; B2-C-05 rebar −113,631; B1-C-06 rebar −98,000.
  - Amharic sheet titles live in cell B3 of each sheet (e.g. 26 የመዘግየት መዝገብ, 18 የሥራ ተቋራጭ የወጪ ሪፖርት).
    Use them for eyebrows and labels so on-screen Amharic matches the product.
- **Tutorial PDF (Rapha_ProjectControl_Tutorial.pdf):** 5 setup steps + 5-step monthly cycle
  (data date → progress → measurements → IPC No. & print → check then issue), 09 Check runs 50+ rules,
  dashboard answers "on time, on budget, getting paid and safe?", View → Owner hides CPI.
  Its screenshots extract cleanly with `pdfimages -j -p` (drop the Gray smask images).

## SiteCalc Pro (site calculators workbook)

- **Look:** navy #0A1426 + gold (#F6DC93 → #DDB052 → #B98A2E), Montserrat 800 for Latin, heavy Noto Sans
  Ethiopic 900 for headlines; wordmark "SiteCalc **Pro**" (Pro in gold) + "RAPHA ENGINEERING AND CONSULTING".
- **Verified (User Guide):** 62 calculators, 191 verified test cases, English/Amharic, no macros,
  Excel · Google Sheets · LibreOffice, 25 rate templates, a price change updates every calculator,
  the Project Summary and the BOQ.
- Poster copy and numbers (user's own): "BOQ ለማዘጋጀት ሳምንት አይጠብቁ።", chips "ሁሉም ስሌት በአንድ ፋይል ·
  ወጪው በብር · ለህትመት ዝግጁ", cost card 31/22/14/12/11/10 %, "BOQ 25 categories", total ETB 8,574,690.11,
  CTA "አሁኑኑ ያውርዱ →". Poster photos can be cropped above the baked-in text/CTA and faded into navy.

## ProfitCheck (development profitability model)

- **Brand rules (user-set, strict):** ProfitCheck wordmark only (no Rapha), no price, no Ye-buna, no "no
  macros" line. CTA exactly **"አሁኑኑ ያዉርዱ →"** (with ዉ). Bank angle: say it *prepares you* for the bank
  ("ለባንክ ለማቅረብ ዝግጁ"); never claim banks accept or approve the model.
- **Look:** blueprint navy #0B1D35 with a faint 60 px grid, orange-amber #E8A33D, teal #2A9D8F (good),
  rose #C44E52 (bad); wordmark Profit (amber) + Check (white) + small amber square; pill tags
  "DEVELOPMENT FEASIBILITY" / "HOME COST ESTIMATE".
- **Poster sample values:** B+G+8 ቅይጥ አገልግሎት · ናሙና: Equity IRR 24.6% (ከ20% ግብ በላይ), profit on cost 31%,
  min DSCR 1.42x (ከ1.25x በላይ), payback 6.2 yrs, VIABLE · አዋጭ. Home: G+1 · 250 m² · Standard,
  10,400,000 ETB (9.1M–11.9M), stages 20/30/15/35 %, loan 68,500 ብር/ወር, "● አቅምዎ ይችላል".
- Four copy angles from the user: fear of loss, home cost certainty, bank-ready numbers, change-one-number.
  Two ads exist (fear-of-loss/verdict mix; bank-ready), so pick a different angle for a new one.
- The workbook may not exist yet. Scenario deltas (e.g. −10% price) are illustrative unless you have it.
