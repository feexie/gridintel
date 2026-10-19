# Regulatory reporting formats: what the reports are set against

Research for Phase REPORTS-A (2026-10-15). It records the official
instruments read, what each asks a DisCo or a mini-grid operator to report,
and which of those fields the GridIntel reports carry.

**This is not a claim of conformity.** No GridIntel report is said to
conform to a regulator's or a programme's template. A report can be said to
conform only once it has been checked against the template it would be
filed on; none has been, and for the mini-grid regulations the template
itself is not in the published text (below). The reports show their
coverage of each field in their "Regulatory references" appendix, from
`src/services/reports/catalogue.ts`.

## Sources read

| # | Instrument | Where it was read | What was read |
| --- | --- | --- | --- |
| 1 | NERC **Reporting Compliance Regulations 2009**, Regulation No. NERC-R-02-09 | nerc.gov.ng, `wp-content/uploads/2012/03/Reporting Compliance Regulations.pdf` | Section 9 (distribution licensee) and Schedule 4A, "Required data for computation of key performance indicators for electricity distribution companies" |
| 2 | NERC **June 2024 Supplementary Order to the Multi-Year Tariff Order 2024**, e.g. ORDER/NERC/2024/068 (Yola Electricity Distribution Plc) | nerc.gov.ng, `wp-content/uploads/2024/06/YEDC-MYTO-ORDER-JUNE-2024.pdf` | Paragraph 9 (monitoring of service commitments), paragraph 10 (band performance, downgrade, compensation), Appendix 1 (service bands and their minimum hours) |
| 3 | NERC **Mini-Grid Regulations 2023**, Regulation No. NERC-R-117-2023, dated 29 December 2023 | nerc.gov.ng, `wp-content/uploads/2024/01/MINIGRIDREGULATIONS.pdf` (a scan; read page by page) | Arrangement of sections and schedules; sections 11–13, 16, 19, 21, 22 |
| 4 | REA, **DARES Project Implementation Manual** (dated October 2024; cover June 2025) | nep.rea.gov.ng, `assets/documents/resource-hub/DARES_PIM_Final.pdf` | Component 1: Table O.1 (key performance indicators), the performance-based grant milestones, verification |

Other instruments are named by these and were not read; they are listed
under "What I need from the Founder".

## 1. DisCo reliability and performance (Reliability and service standards report)

### NERC Reporting Compliance Regulations 2009, Schedule 4A

Section 9 obliges a distribution licensee to report breaches, significant
changes, annual reports, accounts and audit reports, and a monthly customer
complaints report and register. Schedule 4A lists the data for the DisCo's
key performance indicators, most of them monthly:

| S/N | KPI (Schedule's words) | Data | Frequency | This report |
| --- | --- | --- | --- | --- |
| 1 | System Average Interruption Duration Indicator (SAIDI) | Total duration of interruption (hrs); total number of interruptions to customers; total number of registered customers | Monthly | **Partly.** SAIDI and its parts by DisCo, substation and feeder (sections 1–3). The denominator is customers served by the network in the registry; whether that is the Schedule's "registered customers" is to be confirmed |
| 2 | System Average Interruption Frequency Indicator (SAIFI) | Total number of system interruptions; total number of supply points affected (from distribution transformer uprisers) | Monthly | **Partly.** SAIFI per customer served (sections 1–3). A count by supply point is not calculated |
| 3 | Customer Average Interruption Duration Indicator (CAIDI) | SAIDI; SAIFI | Monthly | **Carried** (sections 1–3) |
| 4 | Customer Average Interruption Frequency Indicator (CAIFI) | Total customer interruptions; total registered customers | Monthly | **Not carried.** Needs the number of distinct customers interrupted |
| 5–6 | HV and LV fault clearance indices | Faults cleared within 8 hours; faults reported | Monthly | **Not carried.** The outage records hold the times |
| 7–8 | Distribution losses; technical losses | Energy delivered to the DisCo; energy billed; physical losses | Monthly | For the DisCo operations report (REPORTS-B) |
| 15–16 | Billing efficiency; collection efficiency | Energy billed and received; revenue billed and collected; closing balance | Monthly | For the DisCo operations report (REPORTS-B) |
| 12–14, 17–20 | Staff cost, productivity, unit cost, naira per kWh, outstanding debt, capacity costs | Financial | Monthly / quarterly | Not held by GridIntel |

Open point: the 2009 Regulations were made under the Electric Power Sector
Reform Act 2005, which the Electricity Act 2023 repealed. Whether they, and
Schedule 4A, still apply, and whether NERC now asks for a different
template (or the state regulators do, for the states that regulate their
own markets), is for the Founder to confirm.

### NERC MYTO 2024 Supplementary Orders (Service-Based Tariff)

| Provision | Requirement | This report |
| --- | --- | --- |
| Appendix 1 | Service bands and their minimum average hours of supply a day: A 20, B 16, C 12, D 8 (and E 4) | **Carried.** The engine's band minimums are these; section 5 tests each feeder-day against its band and gives the average over the period |
| 9(a) | NERC obtains hours of supply on each Band A feeder from the DisCo's head-end system | Not a report; the daily hours per feeder are in the CSV |
| 9(c) | Publish daily, by 09:00 the next day, a rolling seven-day average of daily hours of supply on each Band A feeder | **Partly.** The daily hours are given; the rolling seven-day average is not calculated |
| 9(d)–(e) | Explain a Band A feeder below its committed level on two consecutive days; downgrade after seven consecutive days (Order NERC/334/2022) | **Partly.** Every feeder-day below the band minimum is listed (section 5); runs of consecutive days are not counted |

The order read is one DisCo's for June 2024. NERC issues such orders per
DisCo and per month; later orders were not read.

## 2. Mini-grids (Mini-grid compliance and results report)

### NERC Mini-Grid Regulations 2023 (NERC-R-117-2023)

| Section | Requirement | This report |
| --- | --- | --- |
| 13(2) | The permit holder provides reports in the form prescribed in **Schedule 4**, for each mini-grid or combined for a portfolio, at least once a year unless the Commission prescribes otherwise | **Not carried.** Schedule 4 ("Reporting form") is listed in the arrangement of sections, but the published file ends at section 28 and does not contain the schedules |
| 21(2) | The operator files a monitoring and evaluation report on the **M&E reporting template in Schedule 4**, or as its permit or registration says, on paper or through a platform the Commission approves | **Not carried**, for the same reason |
| 16(1) | Supply in accordance with the contract with the community, as prescribed in Schedules 10 and 11 | **Partly.** Availability and hours of supply by site (section 1); the contracted service level is not in the records |
| 19(2) | The Metering Code applies to every mini-grid | Shown, not tested: how many connections have a meter that recorded the whole period (section 2) |
| 22(3) | Retail tariffs by the MYTO methodology (Schedule 14); allowable technical losses not above 4%, non-technical not above 3% | **Partly.** The tariff is stated as an assumption (section 4); site loss is given as a share of energy generated, not split into technical and non-technical (section 3) |

### DARES Project Implementation Manual, Component 1

The Project Management Unit collects data from every participating
mini-grid developer and reports Table O.1's indicators quarterly. An
Independent Verification Agent verifies connections and service; progress
is tracked on the Odyssey platform.

| Indicator (Table O.1) | Unit, frequency | This report |
| --- | --- | --- |
| Number of connections per site | #, annually | **Partly.** Connections in the register and with an active account (section 2) |
| Customer acquisition rate | %, regular | Not carried |
| Customers in each consumption bracket (<5 kWh, 5–10 kWh, …) | #, quarterly | Not carried |
| Average consumption per user (ACPU) | kWh, monthly | **Carried.** Consumption per connection (meters) and energy sold per connection (billing) |
| Renewable energy fraction | fraction, annually | **Carried** (section 3) |
| Percentage of time of available power supply per month, as measured by inverter output | %, monthly | **Partly.** Customer-weighted availability from interruption records, not inverter output |
| SAIFI, SAIDI per site | #, minutes | **Partly.** Interruptions per connection, and each interruption with its duration |
| ARPU; effective tariff | USD | **Partly.** Revenue per connection; no effective tariff, the tariff being an assumption |
| OPEX, EBITDA | USD | Not held |

Performance-based grant for isolated mini-grids: 80% on commissioning and
connection of the targeted customers; the remaining 20% on a minimum
consumption, **minimum kWh sold in a year = 30 kWh × connections
achieved**, with every connection's consumption above 0 kWh. Not carried:
it is an annual test, and connections with no consumption are not counted.

## 3. State electricity regulators (added 2026-10-19)

**Why it matters for the reports.** The 2023 amendment to the
Constitution (Second Schedule, Part II, paragraph 14(b)) lets a state's
House of Assembly make laws on the generation, transmission and
distribution of electricity in areas within the state. Under the
Electricity Act 2023 (as amended), a state that enacts its own
electricity law and sets up a regulator notifies NERC, which then issues
an order transferring regulatory oversight of the intrastate market to
the state regulator (section 230 of the Act, which the Akwa Ibom order
cites). After the
transfer:

- the DisCo forms a subsidiary ("SubCo") for intrastate supply and
  distribution in the state, which takes its licence from the state
  regulator (Edo order, as summarised by NERC);
- the state regulator has exclusive responsibility for the end-user
  tariff methodology, and its approved end-user tariffs are the only ones
  that apply in the state (Gombe order, para. G; Akwa Ibom order,
  para. G);
- the state regulator takes on customer complaints, dispute resolution
  and consumer protection in the state (Akwa Ibom order, para. H; NERC
  notice of 4 May 2026);
- NERC keeps oversight of inter-state and international activity:
  generation and transmission from the national grid, and the contracts
  and tariffs for them, stay with NERC (Gombe and Akwa Ibom orders,
  paras. F–G; Edo notice).

So a DisCo's reliability and performance reports may have to serve a
state regulator for its SubCo in a transferred state as well as NERC,
and a mini-grid in a transferred state may answer to the state regulator
rather than to NERC's Mini-Grid Regulations 2023. **What each state
regulator asks to be reported, and in what form, has not been read**; no
state regulator's reporting regulation or template is in these notes.

### Which states (from NERC's own publications)

NERC's notice "Update on Electricity Regulation: Transition to State
Electricity Regulators" (nerc.gov.ng, 4 May 2026) says regulatory
oversight of intrastate electricity has been formally transferred to
**15 states**, and lists them under "States With Active State Electricity
Regulators":

| State | Regulator (as NERC names it) | NERC order or notice read |
| --- | --- | --- |
| Abia | ASERA | Notice, 25 June 2025 |
| Anambra | ASERC | Notice and order, 17 October 2025 |
| Bayelsa | BYERA (Bayelsa State Electricity Regulatory Agency) | Notice, 25 August 2025 (order on transition, 21 August 2025) |
| Edo | ESERC | Order, 20 August 2024; notice, 21 August 2024 |
| Ekiti | EERB | Orders for the BEDC and IBEDC areas, 19 December 2024 |
| Enugu | EERC | Order, 22 April 2024 |
| Imo | Imo State Electricity Regulatory Commission | Order NERC/2024/073, 29 June 2024 |
| Kogi | KSERC | Order, September 2024; KSERC took over, notice of 12 March 2025 |
| Lagos | Lagos State Electricity Regulatory Commission | Transition orders for Ikeja Electric and EKEDC, 19 December 2024 |
| Nasarawa | NASERC | Order, 1 August 2025 |
| Niger | NSERC | Orders for the AEDC and IBEDC areas, 10 January 2025 |
| Ogun | OGERC | Orders for the IBEDC, Ikeja Electric and EKEDC areas, 30 December 2024 |
| Ondo | (named in the 4 May 2026 list) | Order not read |
| Oyo | OSERC | Order, 5 August 2024 |
| Plateau | PSERC | Order, 14 March 2025 |

Two further transfer orders have been issued since, and neither state is
in the 4 May 2026 list:

| State | Regulator | Order | Status |
| --- | --- | --- | --- |
| Gombe | GOSERC | **NERC/2026/001**, effective 7 January 2026; transfers to be completed by 6 July 2026 (para. H) | Completion not confirmed from an official source |
| Akwa Ibom | AKSERC | **NERC/2026/087**, effective 18 August 2026; transfers to be completed by 17 February 2027 (para. I) | In transition |

Secondary sources (Leadership, The Whistler, Channels, The Guardian)
give other counts, from 8 to 17 states, depending on their date. They
are not relied on here. The list above is from NERC's own pages and
orders, read on 2026-10-19; it will change, and should be read again
before a report is filed.

Sources (all nerc.gov.ng): `media/update-on-electricity-regulation-transition-to-state-electricity-regulators/`;
`wp-content/uploads/2026/01/Order-Transferring-Regulatory-Oversight-to-Gombe-State-Electricity-Regulatory-CommissionGOSERC.pdf`;
`wp-content/uploads/2026/08/Transfer-Order-of-Regulatory-Oversight-AKSERC.pdf`;
`media/transfer-of-regulatory-oversight-of-the-electricity-market-in-edo-state-to-eserc/`;
and the site's search for "transfer of regulatory oversight" (57
results), from which the order dates above are taken. The Gombe and
Akwa Ibom orders are scans; their first and last pages were read.

## What I need from the Founder

1. **NERC Mini-Grid Regulations 2023, Schedule 4** (the reporting form and
   M&E template), and Schedules 10, 11 and 14 if you have them. The
   published file stops at section 28.
2. **The template a DisCo files its monthly performance data on today**: is
   it still Schedule 4A of the 2009 Regulations, or a newer NERC (or state
   regulator) template? And, for any transferred state the reports are
   meant for (section 3), the state regulator's reporting regulation or
   template, and whether a SubCo reports to it, to NERC, or to both.
   And NERC's current **Order on Key Performance Indicators** for a
   DisCo, which the MYTO orders refer to.
3. **The Band A feeder performance report format**: the "Directive for
   Operationalization of Band A Feeders" and Order NERC/334/2022 (migration
   and compensation), and any template a DisCo submits or publishes for
   them.
4. **DARES (or NEP) reporting templates**: the grant agreement's reporting
   annex, the Odyssey data fields or export, and the Independent
   Verification Agent's verification template.
5. **For the permit application**: the monitoring and reporting plan's
   required contents, if NERC prescribes them, so the sample report can be
   set against them.
