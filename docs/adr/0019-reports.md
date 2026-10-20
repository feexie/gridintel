# ADR 0019: Reports are configurations of one report service and one print layout

Date: 2026-10-15
Status: Accepted for Phase REPORTS-A. The purpose, the five reports, the
data-integrity rules and the split into REPORTS-A and REPORTS-B are the
Founder's (2026-10-15). The rest is engineering, recorded here. A
server-side PDF library is a decision gate and is proposed only (below).

## Context

GridIntel will be put in front of people who need a document, not a
screen: a regulator checking a DisCo's reliability, a DisCo's management,
a mini-grid operator, and a mini-grid regulator or a programme funder
(REA/DARES-type programmes). The Founder will also attach sample reports to
proposals and to a permit application's monitoring and reporting plan.

A document lives longer than a screen and travels further. It is printed,
cropped, forwarded and quoted without the application around it. So the
rules that keep the screens honest have to be carried by the document
itself: the synthetic label, each figure's status and origin, the period
the data covers, and enough identity to reproduce it.

## Decisions

1. **One report service, one layout; each report is a configuration.**
   `src/services/reports`: the period (`period.ts`), the catalogue of
   definitions with their code, version, glossary and regulatory references
   (`catalogue.ts`), one builder per report, the document envelope
   (`document.ts`) and the CSV (`csv.ts`). One layout,
   `src/components/reports/ReportDocument.tsx`, prints every report. A
   report's view model (`ReportDocumentView`) is sections of four kinds of
   block: figures, tables, comparisons and statements.
2. **Reports are built from the same services as the screens.** A builder
   arranges the read models the screens already use (the Reliability
   workspace, the Operations blocks, the Sites portfolio and site views)
   for the report's period. It calculates nothing. A figure a read model
   gives as a bare number is given the status, origin and method it already
   has (`cells.ts`); missing is "insufficient data", never zero.
3. **A period the data does not wholly cover is not available.** A report
   is for a day, a month or a year, named in its address
   (`/2026-09-14`, `/2026-09`, `/2026`). The demonstration data covers
   September 2026, so every day and the month are reports and the year is
   a page that says it is not available, with the reason, and holds no
   figure and no report ID. A period is never filled, shortened to the
   part held, or scaled. "Now" for a report is the end of its period: a
   day's report is as of that day's end.
4. **A reported figure is compared only with a calculation for the same
   period.** Comparisons now carry the reported figure's own period
   (`ReportedComparisonView.reportedPeriod`). A day's report names the
   periods the held reports are for and compares none of them.
5. **Every report carries its identity.**
   - *Report ID*: `GI-{code}-{period}-{8 hex}`, the hex from SHA-256 of the
     definition and its version, the period, the methodologies with their
     versions, and the data fingerprint. The same report of the same data
     has the same ID on any machine; a different ID means something
     differs.
   - *Data fingerprint*: SHA-256 over the sorted, distinct SHA-256 digests
     of every result the report's services were given by the repositories,
     each written as JSON with its keys in order. The report is built on
     repositories wrapped to digest what passes through them
     (`src/composition/fingerprint.ts`) and on a result cache of its own,
     so every record it used was read, and digested, for it.
   - *Time the figures were computed*: the wall clock when the document
     was produced, read in the composition root. It is not the data's
     clock, and for a page built ahead of time it is the build's time.
   - *Period, data as-of time, definition version, and every methodology
     with its version*, on the cover and in the method appendix.
6. **While the data is synthetic, no printed page is without the label.**
   "SAMPLE: SYNTHETIC DATA" is in the top margin of every printed page
   (with the report ID), in the bottom margin (with "shows format and
   method, not real results"), and as a pattern of the words over the
   whole of every page, above the figures. The pattern is SVG text in a
   fixed element, so it is repeated on every page and printed even when
   background graphics are switched off. The cover states that the report
   shows the format and methods GridIntel would deliver, not real results.
   The CSV carries the label on every row and in its file name.
7. **Print from the browser.** The report page is A4, with page breaks, a
   cover, contents, the sections, an appendix on method, sources and how
   to reproduce it, the regulatory references and a glossary and key.
   "Print or save as PDF" opens the browser's own dialog, on a desktop and
   on a phone. Nothing is sent anywhere.
8. **The figures as CSV**, one row per figure: the sample label, report
   ID, period, section, table, row, column, value (unrounded, as the
   service holds it), unit, currency, status, origin, methodology and
   version, and the figure's note. A missing value is an empty cell with
   its status. A cell a spreadsheet would read as a formula is written as
   text.
9. **Reports and access (extends ADR 0018).** Each sector has a Reports
   screen (`utility.reports`, `minigrid.reports`). Each report has a key
   below it: `utility.reports.reliability`,
   `minigrid.reports.compliance`, and for REPORTS-B
   `utility.reports.operations`, `utility.reports.daily-brief`,
   `minigrid.reports.site-performance`. Holding a key opens everything
   below it. Holding one report's key also opens the sector's Reports
   screen, which then lists that report only. `/dashboard/reports` lists
   every report the viewer may open, across sectors, and opens to anyone
   who may open one.

   Example roles, recorded and not built (no login is built):

   | Role | Keys |
   | --- | --- |
   | Regulator checking DisCo reliability (e.g. NERC) | `utility.reports.reliability` |
   | Mini-grid regulator or programme funder (e.g. NERC mini-grid desk, REA/DARES) | `minigrid.reports.compliance` |
   | DisCo management | `utility` (every screen and report of the sector) |
   | DisCo network planning | `utility.overview`, `utility.map`, `utility.assets`, `utility.reliability`, `utility.reports.reliability` |
   | Mini-grid operator | `minigrid` |

10. **Regulatory references are not conformity claims.** Each report lists
    the fields of the official instruments read for it, and says for each
    whether the report carries it, partly carries it or does not. No report
    is said to conform to a regulator's or programme's template unless it
    has been checked against that template. None has been. The sources are
    in `docs/reports/REGULATORY_FORMATS.md`.

## Proposed, not decided: a server-side PDF

A decision gate (a major dependency, and new infrastructure). Proposed
only.

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| **A. Headless Chromium on the server** (Playwright or Puppeteer, with a serverless Chromium build) | Prints this same page to PDF | One layout; the PDF is what the browser prints, label rules included; can embed the report ID and fingerprint in the PDF's metadata | A large dependency (~50 MB) and a function near Vercel's size limit; cold starts of seconds |
| B. A PDF layout library (e.g. `@react-pdf/renderer`) | A second layout drawn for PDF | Small, fast | Two layouts to keep in step; the label rules re-done by hand |
| C. A hosted rendering service | An external API prints the page | Nothing to run | An external integration, and the report's data leaves the platform |

Recommendation: **none now.** The browser's own print is enough for
sample reports and proposals. Take **A** when reports must be produced
without a person (scheduled, e-mailed, archived as filed), and decide it
then.

## Consequences

- A report built ahead of time (ADR 0012) has the build's time as the time
  its figures were computed; the CSV is produced on request and has its
  own. The two carry the same report ID, which is what ties them. So the
  cover does not say "Generated", which a reader would take as the time
  the page was printed; it says "Figures computed <time>, from data as of
  <as-of>", and the CSV "Figures computed at" (REPORTS-A fix, 2026-10-19).
- On a report page the data bar names the report's own period (a day or
  the month) and its as-of time, or "not available for this period"; the
  composition root gives the bar every report period by its key, and the
  bar looks up the one in the address (REPORTS-A fix, 2026-10-19). The bar
  is left out when the report is printed.
- XLSX is not built. CSV opens in every spreadsheet. An XLSX file needs
  either a dependency (a decision gate) or a small writer of our own;
  proposed for REPORTS-B.
- The tariff in the mini-grid data is an assumption of the synthetic model
  and is not a record. The compliance report states it as one, shows each
  tier's billed revenue beside its energy sold, and works out no rate.
- Adding a report is: a definition in `catalogue.ts`, a builder over
  existing read models, an entry in `REPORTS` (navigation), and its
  builder in `composition/reports.ts`.

## Amendment (2026-10-20): Phase REPORTS-B

The other three reports, by the Founder's instruction of 2026-10-19. The
rules of REPORTS-A hold unchanged. Engineering decisions:

1. **A report names the kinds of period it is made for** (`periodKinds`).
   The daily operations brief is for a day; its month and year are pages
   that say "not available for this period" with the report's own reason,
   and only days are offered. It opens on the last day the data covers.
2. **No loss account and no money for a day.** A loss account, collection
   efficiency and revenue per connection compare energy delivered, billed
   and paid over one span; bills for a month's supply are not issued on the
   day the energy is delivered, and payments arrive on days of their own.
   The read models would give a day's ratios (a day's collection
   efficiency of 148%, an ATC&C of 45% with its technical part missing);
   the DisCo operations and site performance reports give, in their place,
   "not available for a day" with this reason, and leave out the findings
   about money. The compliance report of REPORTS-A still gives a site's
   revenue and collection for a day: an open question for the Founder.
3. **The daily brief is one page.** A definition may be printed on one
   page (`onePage`): the cover runs into the sections with no contents,
   and in print the lede and section purposes are left out and tables set
   closer; the appendices follow on pages of their own. Every day of
   September was printed and measured; the browser test prints the
   quietest and the busiest day and checks each takes one page.
4. **A count from an incomplete record is not a count.** A brief's count
   of standing alarms or of interruptions in progress is "insufficient
   data" when the record is not complete, never a number that could read
   as none.
5. **XLSX is written here, without a dependency.** The CSV's rows, one
   sheet, values as numbers, the header frozen and filtered, the sample
   label in every row, in the printed header and footer and in the file's
   title. The archive is stored, not compressed, and carries no clock: the
   same document gives the same bytes. A dependency would have been a
   decision gate; it was not needed.
6. **The fingerprint was made faster, not changed.** The DisCo operations
   report reads about 880 results (the same billing records once for every
   scope); digesting each took 63 s for the month. Each object's canonical
   JSON is now written once and a query asked again is not digested again:
   the same digests (tested against `canonicalJson`), in about 7 s.
7. **The quiet-monitor rule** was found to call every monitor quiet on any
   day before 30 September (the demonstration's check-ins are held for the
   last day only, but were declared complete for the month). Fixed by the
   Founder's decision of 2026-10-19: ADR 0011, amendment.

Keys and roles are as recorded above (decision 9); no new key.

