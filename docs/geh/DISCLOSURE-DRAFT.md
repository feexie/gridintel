# Global Energy Hackathon: disclosure

Paste-ready text for the portal, below the line.

---

**Existed before the sprint.** Tag `geh-baseline`, commit `839c5d9`, tagged 30 October 2026 at 15:45 WAT, before the sprint began at 17:00 WAT. Public repository: https://github.com/feexie/gridintel. At the tag: GridIntel's Utility Intelligence and Mini-grid Intelligence on synthetic demonstration data; a layered architecture with provenance on every value; unit and browser tests; a demo and a tenant deployment. Planning was a placeholder page with no figures. Every change since the tag: https://github.com/feexie/gridintel/compare/geh-baseline...geh-sprint

**Built during the sprint** (branch `geh-sprint`; one row per commit, with its time, in `docs/geh/CHANGELOG-GEH.md`, also shown in the app under About this build):

- Planning section and the Metering planner: Plan, Fund, Monitor.
- Published-figures layer: NERC's per-DisCo metering, installations, collection efficiency, ATC&C losses and tariffs, each cited.
- Metering Fund: a 120-month pay-as-you-meter cash model; the charge against the 5% cap, and the public money needed to hold it there; four price shocks and four mitigations; initial investment against break-even; Brief 15's two impact measures (customers metered by year 5, estimated bills removed).
- GridIntel structure: the charge as a share of each bill, Lifeline customers exempt, public top-up, first-loss layer, reserve account, investor returns, the inflation pass-through needed.
- DisCo allocation: need and repayment-risk scores, the first million meters against a pro-rata split, a pilot card.
- DT sequencing on the synthetic network: ranking by revenue recovered per naira, and the revolving effect.
- Monitoring: plan against synthetic actuals, tranches released against verified installs.
- About this build page, and a script that writes the key figures from the services.
- Copy edit: removed generic AI wording.
- Tests for each new method, service and screen.

**Datasets.** NERC Quarterly Reports for Q1 2026 and Q2 2026; NERC's September 2026 MYTO supplementary orders; press reports S1 to S5 (AllAfrica/Vanguard, Nigeria Startup Act, Mondaq, The Guardian Nigeria, ThisDay), shown as reported; GEH Brief 15 and its references. The DisCo network, its DTs and the monitoring records are synthetic and labelled so on every screen.

**AI tools.** Claude and Claude Code (Anthropic), used to write code and documents under the Founder's direction. No AI runs in the product: every figure comes from a deterministic, versioned, tested method.

**Open-source.** No new library was added to the application. pypdf and PyMuPDF were used outside the repository to read NERC's PDF tables; they are not shipped.
