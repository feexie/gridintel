# ADR 0022: Reference sites from published data

Date: 2026-11-24
Status: **Accepted** (Founder, 24 November 2026, at the MG-REAL review). The
scope and the answers to the plan's open questions are the Founder's
(`docs/design/MG-PLAN.md`, section 6).

## Context

Until now GridIntel held two kinds of record: an organization's own (synthetic
today) and figures published by a regulator or the press (`ReportedKpi`, the
NERC figures). A third kind has arrived: a real operator's records, published
by someone else under a licence. The first is the RMG01 dataset (Kemabonta &
Geoffrey 2026, v1.0.2, CC BY 4.0): four and a half years of daily use per
meter, payments, customers, tariffs, an outage log and the site's documents,
for one solar mini-grid in southern Nigeria.

Such a site is not any organization's own, and it is not a single figure. It
is a whole site's records, real, with the publisher's caveats, to be shown
beside a portfolio and later used to plan new sites (MG-PLAN-A).

## Decisions

1. **A layer of its own.** `src/domain/reference.ts` holds the reference
   records; `ReferenceSiteRepository` (`src/repositories/ports/reference.ts`)
   returns the sites as a **list**, so a second dataset is a second adapter
   with no change to a port or a method. The adapters live under
   `src/repositories/reference/`, with an import boundary of their own.
2. **Everything is reported.** The adapter reads the published tables as they
   are: blanks stay null, the publisher's flags and status words are kept, and
   nothing is totalled or picked. Figures the publisher states about its own
   data are transcribed as claims with where they are stated. GridIntel's
   figures are calculated under named methods (`gridintel.reference.*` 0.1.0)
   and set beside each claim, which agrees only when it rounds to the stated
   figure at the stated decimals.
3. **Never in a portfolio.** No count, total, share or finding of an
   organization's portfolio includes a reference site. On the Sites screen it
   has a section of its own; on the Mini-grid verification card and the public
   summary it is a line of its own, marked "Published data" and not
   synthetic.
4. **Credited wherever shown.** The dataset is a `DataSource` of the new kind
   `published_dataset`, with its licence, the licence's address, the citation
   and the changes made ("GridIntel's calculations on the published data; the
   data are unchanged"). Every view that carries a reference figure carries
   the credit, and a browser test checks it on every screen that shows one.
5. **Vendored, pinned and checked.** The dataset's CSVs, licence, citation
   file and README are kept unchanged under
   `src/repositories/reference/rmg01/data`, pinned at the version's commit;
   `SOURCE.md` lists every file's SHA-256 and a unit test recomputes them.
   `.gitattributes` keeps the files byte for byte. They are read on the
   server and traced into the deployment (`next.config.ts`). A new version is
   a reviewed commit.
6. **Public reference, in every deployment.** A reference site is served in
   the public demonstration and in a tenant deployment alike, read-only,
   behind no organization's gate of its own (it is under the Mini-grid
   screens, which the grant still governs).
7. **Codes are counted, never shown.** The publisher's meter, customer and
   agent codes are pseudonymous; they are used to count and group, and no view
   shows one. Where a caveat quotes a code, the view replaces it with "[code]"
   and says so. The publisher's numbering ranges (such as "codes C0001 to
   C0245" in a fact note) name no one and are kept as published (Founder,
   24 November 2026).
8. **The data bar says what the page is.** Above a reference site's page
   the dashboard's bar reads "PUBLISHED DATA": the page is a real site's
   published records, the operator's portfolio on the other screens is
   synthetic, and the dataset's citation links to its DOI. Every other
   screen's bar is unchanged. The bar takes the notices from the
   repository's catalogue (site ids and their datasets), so the published
   files are not read on every screen (Founder, 24 November 2026).

## Consequences

- A second dataset (Zenodo 22149102 is named for later) is its own decision
  gate, then an adapter.
- MG-PLAN-A builds its benchmarks from `ReferenceSiteRepository`, each with
  the number of reference sites behind it.
- What a reference figure may not be read as is held with the service
  (`NOT_CLAIMED` in `src/services/minigrid/reference.ts`) and shown on the
  page.
