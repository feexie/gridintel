import type { ReportId } from "../../constants/navigation.ts";
import type { GlossaryEntry, RegulatoryReference } from "./views.ts";

/* ==========================================================
   SERVICES — THE REPORTS, AS CONFIGURATION (ADR 0019)

   One report service, one layout; each report is a configuration:
   its code, the version of its definition, its glossary and the
   regulatory requirements it was checked against.

   REGULATORY REFERENCES ARE NOT CONFORMITY CLAIMS. Each says which
   field of an official instrument the report carries, partly carries
   or does not carry, as read from the instrument cited. No report is
   said to conform to a regulator's template unless it has been
   checked against that template; none has been. The sources and what
   was read are in docs/reports/REGULATORY_FORMATS.md.
========================================================== */

export interface ReportDefinition {
  id: ReportId;
  /** In the report ID: "GI-REL-…". */
  code: string;
  /** Raised whenever the sections or the figures in them change. */
  version: string;
  glossary: GlossaryEntry[];
  regulatory: RegulatoryReference[];
}

const NOT_A_CLAIM =
  "How far this report carries the fields of the instruments below, as read from the instruments themselves. It is not a claim that the report conforms to any regulator's or programme's template: none has been checked against the template it would be filed on.";

export const REGULATORY_NOTE = NOT_A_CLAIM;

const COMMON: GlossaryEntry[] = [
  { term: "Measured", meaning: "Read from a meter, a device or a source record." },
  { term: "Reported", meaning: "A figure published by someone else, shown as they stated it. It is never altered." },
  { term: "Calculated", meaning: "Computed by GridIntel from records, under a named and versioned methodology." },
  { term: "Estimated", meaning: "An estimate, not a measurement; the method is named with it." },
  { term: "Derived", meaning: "A residual: what is left when other figures are subtracted. It carries their uncertainty." },
  { term: "Insufficient data", meaning: "An input the figure needs is missing. No value is given rather than a guess, and never a zero." },
  { term: "Not available", meaning: "No source holds this figure, or the data does not cover the period." },
  { term: "Same basis", meaning: "A reported figure and a calculation count the same things over the same period by the same rule. Only figures on the same basis are compared." },
  { term: "Data fingerprint", meaning: "A SHA-256 digest of every record the report was built from. The same records give the same fingerprint; any change to them gives another." },
  { term: "Report ID", meaning: "The report's code, its period and the first characters of a digest of its definition, methodologies and data fingerprint. The same report of the same data has the same ID." },
];

const RELIABILITY_TERMS: GlossaryEntry[] = [
  { term: "SAIDI", meaning: "System Average Interruption Duration Index: the hours of interruption the average customer served had in the period. Customer-hours interrupted ÷ customers served." },
  { term: "SAIFI", meaning: "System Average Interruption Frequency Index: the interruptions the average customer served had in the period. Customer interruptions ÷ customers served." },
  { term: "CAIDI", meaning: "Customer Average Interruption Duration Index: the average length of an interruption, in hours. SAIDI ÷ SAIFI." },
  { term: "ASAI", meaning: "Average Service Availability Index: the share of customer-hours in the period with supply." },
  { term: "Network-attributable", meaning: "The part of an index caused by interruptions that began on the distribution network (33 kV and 11 kV lines, distribution transformers, the low-voltage network), under the reference methodology." },
  { term: "Upstream supply", meaning: "Interruptions that began at the transmission station or above it: not the distribution network's." },
  { term: "Load shedding", meaning: "A feeder opened on purpose because the supply allocated was short. It began nowhere on the network." },
  { term: "Origin point", meaning: "The part of the system an outage record names as where an interruption began. It decides the attribution." },
  { term: "Service band", meaning: "NERC's Service-Based Tariff band of a feeder, with its minimum average hours of supply a day: A 20, B 16, C 12, D 8, E 4." },
  { term: "Provisional", meaning: "A figure that includes an interruption still open at the end of the period, counted to its end. It is calculated, not estimated, and is final only when the restoration is recorded." },
  { term: "Attribution-rule finding", meaning: "Where a reported figure states an attribution rule other than the reference one: the same figure on both rules and the difference, so a reader sees what the rule changes." },
];

const COMPLIANCE_TERMS: GlossaryEntry[] = [
  { term: "Availability", meaning: "Customer-weighted share of the period with supply: 1 − (customer-hours interrupted ÷ customer-hours in the period). Every recorded interruption is counted." },
  { term: "Hours of supply a day", meaning: "The average hours a day the average connection had supply in the period." },
  { term: "Connection", meaning: "A customer connection in the site's register. An active connection is one billed in the period." },
  { term: "Energy sold", meaning: "Energy billed. For a prepaid account it is energy purchased, which may be used later." },
  { term: "Consumption", meaning: "Energy recorded by customer meters." },
  { term: "Renewable fraction", meaning: "The share of energy generated that came from PV." },
  { term: "Performance ratio", meaning: "PV energy delivered against what the array's rating and the measured irradiation would give; curtailment counts as a loss (IEC 61724)." },
  { term: "Collection efficiency", meaning: "Revenue collected in the period ÷ revenue billed in the period, on a cash basis." },
  { term: "Claim", meaning: "A figure a site's own report states. It agrees when it is on the basis of the calculation and within the tolerance of it." },
  { term: "Tariff assumption", meaning: "A rate used to price bills in this dataset that is not a published or approved tariff." },
];

const REPORTING_2009 = "NERC Reporting Compliance Regulations 2009 (NERC-R-02-09), s. 9 and Schedule 4A";
const MYTO_2024 = "NERC June 2024 Supplementary Order to MYTO 2024 (e.g. ORDER/NERC/2024/068, YEDC), para. 9 and Appendix 1";
const MINIGRID_2023 = "NERC Mini-Grid Regulations 2023 (NERC-R-117-2023)";
const DARES_PIM = "DARES Project Implementation Manual (REA, October 2024, rev. June 2025), Component 1";

export const REPORT_DEFINITIONS: Record<"reliability" | "compliance", ReportDefinition> = {
  reliability: {
    id: "reliability",
    code: "REL",
    version: "1",
    glossary: [...RELIABILITY_TERMS, ...COMMON],
    regulatory: [
      { instrument: REPORTING_2009, requirement: "1. SAIDI: total duration of interruption (hrs), total number of interruptions to customers, total number of registered customers; monthly", coverage: "partly", where: "Sections 1–3 give SAIDI and its parts by DisCo, substation and feeder. The denominator is customers served by the network in the registry; whether it is the Schedule's \"registered customers\" is to be confirmed." },
      { instrument: REPORTING_2009, requirement: "2. SAIFI: total number of system interruptions, total number of supply points affected (from distribution transformer uprisers); monthly", coverage: "partly", where: "Sections 1–3 give SAIFI per customer served. A count by supply point (transformer upriser) is not calculated." },
      { instrument: REPORTING_2009, requirement: "3. CAIDI: SAIDI, SAIFI; monthly", coverage: "covered", where: "Sections 1–3." },
      { instrument: REPORTING_2009, requirement: "4. CAIFI: total number of customer interruptions, total number of registered customers; monthly", coverage: "not_covered", where: "Not calculated: it needs the number of distinct customers interrupted, which the methodology does not yet count." },
      { instrument: REPORTING_2009, requirement: "5–6. HV and LV fault clearance indices: faults cleared within 8 hours against faults reported; monthly", coverage: "not_covered", where: "Not calculated. The outage records hold the times it would be counted from." },
      { instrument: MYTO_2024, requirement: "Service-Based Tariff bands and their minimum hours of supply a day (A 20, B 16, C 12, D 8, E 4)", coverage: "covered", where: "Section 5 tests each feeder's days against its band minimum, and gives its average over the period." },
      { instrument: MYTO_2024, requirement: "9(c). Publish daily a rolling seven-day average of daily hours of supply on each Band A feeder", coverage: "partly", where: "Section 5 and the CSV give each Band A feeder's hours of supply day by day; the rolling seven-day average is not calculated." },
      { instrument: MYTO_2024, requirement: "9(d)–(e). A Band A feeder below its committed level on two, and on seven, consecutive days", coverage: "partly", where: "Section 5 lists every feeder-day below the band minimum; runs of consecutive days are not counted." },
    ],
  },
  compliance: {
    id: "compliance",
    code: "MGC",
    version: "1",
    glossary: [...COMPLIANCE_TERMS, ...COMMON],
    regulatory: [
      { instrument: `${MINIGRID_2023}, s. 13(2) and s. 21(2)`, requirement: "Reports in the form prescribed in Schedule 4, per mini-grid or combined for a portfolio, at least once a year; M&E reports on the Schedule 4 template", coverage: "not_covered", where: "Schedule 4 is not in the published text read (it ends at section 28). The report cannot be set against it until the template is supplied." },
      { instrument: `${MINIGRID_2023}, s. 16(1)`, requirement: "Supply in accordance with the contract with the community, as prescribed in Schedules 10 and 11", coverage: "partly", where: "Section 1 gives availability and hours of supply by site; the contracted service level is not in the records, so it is not tested." },
      { instrument: `${MINIGRID_2023}, s. 22(3)`, requirement: "Tariffs by the MYTO methodology; allowable technical losses not above 4% and non-technical losses not above 3%", coverage: "partly", where: "Section 4 states the tariff as an assumption. Section 3 gives site loss as a share of energy generated; it is not split into technical and non-technical loss." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Number of connections per site; customer acquisition", coverage: "partly", where: "Section 2 gives connections and active connections for the period; acquisition over time is not calculated." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Average consumption per user (ACPU)", coverage: "covered", where: "Section 2: consumption per connection (customer meters) and energy sold per connection (billing)." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Number of customers in each consumption bracket (<5 kWh, 5–10 kWh, …)", coverage: "not_covered", where: "Not calculated." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Renewable energy fraction", coverage: "covered", where: "Section 3." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Percentage of time of available power supply at a site per month, as measured by inverter output", coverage: "partly", where: "Section 1 gives customer-weighted availability from interruption records, not from inverter output." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "SAIFI and SAIDI per site", coverage: "partly", where: "Section 1 gives interruptions per connection and lists every interruption with its duration; a site SAIDI is not stated as such." },
      { instrument: `${DARES_PIM}, Table O.1`, requirement: "Average revenue per user (ARPU); effective tariff", coverage: "partly", where: "Section 5 gives revenue per connection. No effective tariff is worked out: tariffs in this dataset are assumptions." },
      { instrument: `${DARES_PIM}, PBG disbursement, milestone 2`, requirement: "Minimum kWh sold in a year = 30 kWh × connections achieved; every connection with consumption above 0 kWh", coverage: "not_covered", where: "An annual test: not assessable from the period held, and connections with no consumption are not counted." },
    ],
  },
};
