/* ==========================================================
   SERVICES — PLANNING: THE METERING FUND'S ASSUMPTIONS

   Every assumption the fund model takes, with its default, its unit,
   its range and its basis. They travel in the page address, so a
   scenario reloads exactly. Values in the address are in the units
   the screen shows (percent as 10 for 10%); `readAssumptions` turns
   them into the fractions the method takes.
========================================================== */

export type CaseId = "brief" | "nigeria";

export type AssumptionUnit = "naira" | "usd" | "percent" | "naira_per_usd" | "kwh_month" | "meters" | "customers" | "month";

export interface AssumptionSpec {
  key: string;
  label: string;
  unit: AssumptionUnit;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  /** Why the default is what it is. */
  basis: string;
  /** A placeholder is shown as one until a sourced figure replaces it. */
  origin: "assumption" | "placeholder";
  group: "meter" | "money" | "customers" | "bands" | "public" | "shocks";
  /** Only for one case. */
  onlyFor?: CaseId;
}

const percent = (key: string, label: string, defaultValue: number, basis: string, group: AssumptionSpec["group"], extra: Partial<AssumptionSpec> = {}): AssumptionSpec => ({
  key,
  label,
  unit: "percent",
  defaultValue,
  min: 0,
  max: 100,
  step: 0.5,
  basis,
  origin: "assumption",
  group,
  ...extra,
});

export const BANDS = ["A", "B", "C", "D", "E"] as const;

/** The monthly consumption of a residential customer in each band: an assumption until DisCo billing data replaces it. */
const CONSUMPTION_DEFAULTS: Record<(typeof BANDS)[number], number> = { A: 200, B: 150, C: 100, D: 75, E: 50 };

export const ASSUMPTIONS: AssumptionSpec[] = [
  { key: "fx", label: "Exchange rate", unit: "naira_per_usd", defaultValue: 1_334, min: 100, max: 10_000, step: 1, basis: "30 October 2026, to confirm. NERC's September 2026 tariff orders use N1,369/$.", origin: "assumption", group: "money" },
  { key: "hardware", label: "Meter hardware, single-phase", unit: "usd", defaultValue: 45, min: 1, max: 500, step: 1, basis: "GEH Brief 15: mini-grid meters fell to about $40; utility meters cost more.", origin: "assumption", group: "meter" },
  percent("duty", "Import duty", 10, "Base case. The 2018 MAP scheme stalled when duty rose from 10% to 45% (GEH Brief 15).", "meter"),
  { key: "install", label: "Installation and logistics", unit: "naira", defaultValue: 25_000, min: 0, max: 500_000, step: 500, basis: "Per meter. Assumption.", origin: "assumption", group: "meter" },
  percent("reserve", "Maintenance and replacement reserve", 2, "Per year, of meter cost, while the meter is being repaid. Meter life 10 years.", "meter", { step: 0.1 }),
  percent("failure", "Meters failing a year", 1, "Replaced from the reserve. Assumption, set by the user.", "meter", { step: 0.1 }),
  percent("usdRate", "Investor / DFI capital in dollars, a year", 8, "Concessional DFI rate. Assumption to verify.", "money", { step: 0.25 }),
  percent("ngnRate", "Capital in naira, a year", 22, "Used when naira-denominated funding is on. Assumption to verify.", "money", { step: 0.25 }),
  percent("cap", "Charge cap, share of the monthly bill", 5, "No customer's charge should exceed this share of a typical bill.", "money", { step: 0.5, max: 50 }),
  percent("gain", "Collection gain from metering", 15, "Of the metered customer's billed revenue: metered customers stop disputing estimated bills. Assumption.", "money"),
  percent("gainToFund", "Share of that gain paid to the fund", 50, "Agreed with the DisCo. Assumption.", "money"),
  percent("nonPaying", "Customers who stop buying tokens or fall behind", 10, "Their charge is not collected. Assumption.", "customers"),
  percent("exempt", "Customers exempt from the charge", 0, "Lifeline and vulnerable customers, paid for by the public pool. Set in the equity view.", "customers"),
  percent("growth", "Customer growth a year", 2, "GEH Brief 15 test scenario. Assumption.", "customers", { onlyFor: "brief", step: 0.1 }),
  percent("passThrough", "Inflation passed into tariffs", 0, "NERC's September 2026 orders keep Band A frozen since July 2024 and Bands B to E since December 2022. Raise it to test tariffs that follow inflation.", "money", { step: 5 }),
  { key: "pmi2027", label: "PMI meters in 2027", unit: "meters", defaultValue: 750_000, min: 0, max: 5_000_000, step: 1_000, basis: "Reported, citing NERC's factsheet (S1, S2). Spread evenly over 12 months and shared by unmetered customers: assumptions.", origin: "assumption", group: "public", onlyFor: "nigeria" },
  { key: "pmiLater", label: "PMI meters a year after 2027", unit: "meters", defaultValue: 0, min: 0, max: 5_000_000, step: 1_000, basis: "Not published consistently. Set by the user.", origin: "assumption", group: "public", onlyFor: "nigeria" },
  { key: "publicMeters", label: "Publicly funded meters a year", unit: "meters", defaultValue: 0, min: 0, max: 5_000_000, step: 1_000, basis: "The brief's scenario has limited public funding. Set by the user.", origin: "assumption", group: "public", onlyFor: "brief" },
  { key: "grants", label: "DISREP and MAF grants into the fund a year", unit: "naira", defaultValue: 0, min: 0, max: 1e12, step: 1e8, basis: "Set by the user.", origin: "assumption", group: "public" },
  ...BANDS.map((band): AssumptionSpec => ({ key: `use${band}`, label: `Band ${band} consumption a month`, unit: "kwh_month", defaultValue: CONSUMPTION_DEFAULTS[band], min: 0, max: 2_000, step: 5, basis: "A residential customer. Assumption, to be replaced with DisCo billing data.", origin: "assumption", group: "bands" })),
  ...BANDS.map((band): AssumptionSpec => ({ key: `share${band}`, label: `Customers in Band ${band}`, unit: "percent", defaultValue: 20, min: 0, max: 100, step: 1, basis: "To be replaced with sourced figures. NERC's reports give no split of customers by band.", origin: "placeholder", group: "bands" })),
  percent("shockDuty", "Import duty in the duty shock", 45, "The rise that stalled the 2018 MAP scheme (GEH Brief 15).", "shocks"),
  percent("shockDevaluation", "Naira devaluation", 30, "The naira loses this share of its value against the dollar.", "shocks"),
  percent("shockInflation", "Inflation a year in the inflation shock", 30, "Applied to naira costs and, by the pass-through, to tariffs.", "shocks"),
  { key: "shockMonth", label: "Month the shocks start", unit: "month", defaultValue: 13, min: 1, max: 60, step: 1, basis: "Year 2, after the fund has committed to its first meters. Assumption.", origin: "assumption", group: "shocks" },
  percent("localShare", "Local-assembly share of the meter", 40, "Used when local assembly is on: that share is priced in naira, without duty.", "meter"),
];

export type MitigationKey = "local" | "naira" | "dutyReserve" | "indexed";

export const MITIGATIONS: { key: MitigationKey; label: string; effect: string }[] = [
  { key: "local", label: "Local assembly", effect: "Part of the meter is assembled in Nigeria and priced in naira, free of import duty." },
  { key: "naira", label: "Naira-denominated funding", effect: "The fund borrows in naira, at the naira rate, so a fall in the naira does not raise what it owes." },
  { key: "dutyReserve", label: "Duty-shock reserve", effect: "The charge is set as if duty were at the shock level; the extra is held against a duty rise." },
  { key: "indexed", label: "Charge indexed to the tariff", effect: "The charge rises with the tariff. It helps only when inflation is passed into tariffs; with tariffs frozen it changes nothing." },
];

export interface Assumptions {
  caseId: CaseId;
  /** "national" or a DisCo id, for the Nigeria case. */
  disco: string;
  values: Record<string, number>;
  mitigations: Record<MitigationKey, boolean>;
  /** Keys whose value differs from the default. */
  changed: string[];
}

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the assumptions from the page address; anything missing or out of range takes its default. */
export function readAssumptions(query: Query): Assumptions {
  const caseId: CaseId = first(query.case) === "nigeria" ? "nigeria" : "brief";
  const values: Record<string, number> = {};
  const changed: string[] = [];
  for (const spec of ASSUMPTIONS) {
    const raw = first(query[spec.key]);
    const parsed = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
    const valid = Number.isFinite(parsed) && parsed >= spec.min && parsed <= spec.max;
    values[spec.key] = valid ? parsed : spec.defaultValue;
    if (valid && parsed !== spec.defaultValue) changed.push(spec.key);
  }
  const on = (key: MitigationKey) => first(query[key]) === "1" || first(query[key]) === "on";
  return {
    caseId,
    disco: first(query.disco) ?? "national",
    values,
    mitigations: { local: on("local"), naira: on("naira"), dutyReserve: on("dutyReserve"), indexed: on("indexed") },
    changed,
  };
}
