import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DataSource,
  ReferenceCaveat,
  ReferenceClaim,
  ReferenceCustomer,
  ReferenceCustomerClass,
  ReferenceMeterDay,
  ReferenceOutage,
  ReferencePayment,
  ReferenceReportedIndices,
  ReferenceSite,
  ReferenceSiteDay,
  ReferenceTariffEvent,
} from "@/domain";
import type { ReferenceSiteRecords, ReferenceSiteRepository } from "../../ports/reference.ts";
import { numberOrNull, parseCsv, textOrNull, type CsvRow } from "../csv.ts";

/* ==========================================================
   REFERENCE ADAPTER — SITE RMG01

   A real solar mini-grid in southern Nigeria, from the dataset
   Kemabonta & Geoffrey (2026), v1.0.2, CC BY 4.0, vendored unchanged
   under ./data (see SOURCE.md; a test checks every file's SHA-256).
   REAL, PUBLISHED DATA: not synthetic, and not an organization's own
   records. It is a reference beside a portfolio, never part of one.

   The tables are read as published: blanks stay null (a gap day is
   not a day of no use), the publisher's flags and status words are
   kept, and nothing is totalled, averaged or picked here. The
   figures the publisher states about its own data (the 17.9% meter
   gap, the customers buying credit each year) are transcribed as
   claims with where they are stated, so the analytics can set a
   calculation beside them.

   The files are read once, on the server, from the repository's own
   folder (traced into the deployment in next.config.ts).
========================================================== */

const SITE_ID = "rmg01";
const PREFIX = "Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_";
const DATA_DIR = ["src", "repositories", "reference", "rmg01", "data"];

export const RMG01_SOURCE: DataSource = {
  id: "kemabonta-geoffrey-2026-rmg01",
  name: "A Multi-Year Daily Operations Dataset from a Rural Solar Mini-Grid in Southern Nigeria",
  kind: "published_dataset",
  description: "Daily use per meter, daily site totals, payments, customers, tariffs, an outage log and site documents of one rural solar mini-grid (site RMG01).",
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  attribution:
    "Kemabonta, T. & Geoffrey, A. (2026). A Multi-Year Daily Operations Dataset from a Rural Solar Mini-Grid in Southern Nigeria [Data set], v1.0.2. https://doi.org/10.5281/zenodo.24098636",
  url: "https://doi.org/10.5281/zenodo.24098636",
  release: "v1.0.2 (commit bd9dea2)",
  dated: "2026-10-24",
  notice: "GridIntel's calculations on the published data; the data are unchanged.",
};

type Table =
  | "Site_Description"
  | "Site_Daily"
  | "Meter_Daily"
  | "Customers"
  | "Payments"
  | "Reliability_Outages"
  | "Reliability_Indices"
  | "Tariffs_and_Events"
  | "Caveats";

const requiredNumber = (value: string | undefined, what: string): number => {
  const number = numberOrNull(value);
  if (number === null) throw new Error(`RMG01: ${what} is blank`);
  return number;
};

function customerClass(value: string | undefined): ReferenceCustomerClass | null {
  if (value === "residential") return "residential";
  if (value === "non-residential") return "non_residential";
  return null;
}

function site(rows: CsvRow[]): ReferenceSite {
  const facts = rows.map((row) => ({
    item: row.item,
    value: row.value,
    unit: textOrNull(row.unit),
    status: textOrNull(row.status),
    notes: textOrNull(row.notes),
    source: textOrNull(row.source),
  }));
  const region = facts.find((fact) => fact.item === "Country and region")?.value ?? "Southern Nigeria";
  return {
    id: SITE_ID,
    code: "RMG01",
    name: "Site A (RMG01)",
    country: "Nigeria",
    region,
    // Site_Description: "Name, administrative area and coordinates are withheld."
    locationWithheld: true,
    sourceId: RMG01_SOURCE.id,
    facts,
  };
}

function day(row: CsvRow): ReferenceSiteDay {
  const outage = row.logged_outage_flag;
  return {
    siteId: SITE_ID,
    date: row.date,
    communityKwh: numberOrNull(row.site_kwh_community_series),
    sumOfMetersKwh: numberOrNull(row.site_kwh_sum_of_meters),
    metersReporting: numberOrNull(row.meters_reporting),
    creditBoughtNgn: numberOrNull(row.cash_payments_NGN),
    flags: row.data_flag ? row.data_flag.split(";").map((flag) => flag.trim()).filter(Boolean) : [],
    loggedOutage: outage === "1" ? 1 : outage === "0" ? 0 : null,
  };
}

const meterDay = (row: CsvRow): ReferenceMeterDay => ({
  siteId: SITE_ID,
  date: row.date,
  meterCode: row.meter_code,
  kwh: requiredNumber(row.kwh, `kWh of ${row.meter_code} on ${row.date}`),
  customerClass: customerClass(row.customer_class),
});

const customer = (row: CsvRow): ReferenceCustomer => ({
  siteId: SITE_ID,
  customerCode: row.customer_code,
  customerClass: customerClass(row.customer_class),
  yearCreated: numberOrNull(row.year_created),
  metersLinked: numberOrNull(row.meters_linked_count),
});

const payment = (row: CsvRow): ReferencePayment => ({
  siteId: SITE_ID,
  date: row.date,
  amountNgn: requiredNumber(row.amount_NGN, `the payment of ${row.date}`),
  type: row.type,
  customerCode: textOrNull(row.customer_code),
});

const outage = (row: CsvRow): ReferenceOutage => ({
  siteId: SITE_ID,
  eventId: row.event_id,
  date: row.date,
  startTime: textOrNull(row.start_time),
  endTime: textOrNull(row.end_time),
  crossesMidnight: row.crosses_midnight === "yes",
  durationHoursRecorded: numberOrNull(row.duration_h_recorded),
  durationHoursFromTimes: numberOrNull(row.duration_h_from_times),
  cause: row.cause_recorded,
  causeCategory: textOrNull(row.cause_category),
  customersInterrupted: numberOrNull(row.customers_interrupted),
  customersServed: numberOrNull(row.customers_served),
  customerHours: numberOrNull(row.customer_hours),
  notes: textOrNull(row.notes),
});

const indices = (row: CsvRow): ReferenceReportedIndices => ({
  siteId: SITE_ID,
  month: row.month,
  eventsLogged: requiredNumber(row.events_logged, `events logged in ${row.month}`),
  saidiHours: numberOrNull(row.saidi_h),
  caidiHours: numberOrNull(row.caidi_h),
  saifi: numberOrNull(row.saifi),
  asaiPercentAsReported: numberOrNull(row.asai_pct_as_reported),
  asaiPercentHoursInMonth: numberOrNull(row.asai_pct_hours_in_month),
  notes: textOrNull(row.notes),
});

function tariffEvent(row: CsvRow): ReferenceTariffEvent {
  const recordType = row.record_type;
  if (recordType !== "tariff" && recordType !== "event" && recordType !== "data_note") throw new Error(`RMG01: unknown record type "${recordType}"`);
  return {
    siteId: SITE_ID,
    recordType,
    periodStart: textOrNull(row.period_start),
    periodEnd: textOrNull(row.period_end),
    description: row.description,
    value: numberOrNull(row.value),
    unit: textOrNull(row.unit),
    source: textOrNull(row.source),
    notes: textOrNull(row.notes),
  };
}

const caveat = (row: CsvRow): ReferenceCaveat => ({ siteId: SITE_ID, id: row.id, topic: row.topic, description: row.description });

/**
 * The figures the publisher states about its own data. The meter gap is stated in Caveats C05
 * (and the README); the customers buying credit each year are rows of Site_Description.
 */
function claims(description: CsvRow[]): ReferenceClaim[] {
  const stated: ReferenceClaim[] = [
    {
      siteId: SITE_ID,
      key: "meter_gap_share",
      label: "Site total above the sum of the meters, over all days with both",
      value: 0.179,
      unit: "fraction",
      decimals: 3,
      from: "2022-06-06",
      to: "2025-01-25",
      locator: "Caveats C05; README",
    },
    {
      siteId: SITE_ID,
      key: "meter_gap_share",
      label: "Sum of the meters below the site total in the independent export of the data concentrator",
      value: 0.086,
      unit: "fraction",
      decimals: 3,
      from: "2024-01-30",
      to: "2025-01-25",
      locator: "Caveats C05, C17",
    },
  ];
  for (const row of description) {
    const match = /^Customers with at least one PAY payment in (\d{4})$/.exec(row.item);
    if (!match) continue;
    const year = match[1];
    stated.push({
      siteId: SITE_ID,
      key: "customers_buying_credit",
      label: `Customers with at least one PAY payment in ${year}`,
      value: requiredNumber(row.value, row.item),
      unit: "customers",
      decimals: 0,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      locator: "Site_Description",
    });
  }
  return stated;
}

export function rmg01Reference(root = process.cwd()): ReferenceSiteRepository {
  const read = async (table: Table) => parseCsv(await readFile(join(root, ...DATA_DIR, `${PREFIX}${table}.csv`), "utf8"));
  let loaded: Promise<ReferenceSiteRecords> | null = null;

  const load = async (): Promise<ReferenceSiteRecords> => {
    const [description, days, meterDays, customers, payments, outages, reported, tariffs, caveats] = await Promise.all([
      read("Site_Description"),
      read("Site_Daily"),
      read("Meter_Daily"),
      read("Customers"),
      read("Payments"),
      read("Reliability_Outages"),
      read("Reliability_Indices"),
      read("Tariffs_and_Events"),
      read("Caveats"),
    ]);
    return {
      site: site(description),
      source: RMG01_SOURCE,
      days: days.map(day),
      meterDays: meterDays.map(meterDay),
      customers: customers.map(customer),
      payments: payments.map(payment),
      outages: outages.map(outage),
      reportedIndices: reported.map(indices),
      tariffEvents: tariffs.map(tariffEvent),
      caveats: caveats.map(caveat),
      claims: claims(description),
    };
  };
  // A failed read is not kept: the next call reads again.
  const records = () =>
    (loaded ??= load().catch((error: unknown) => {
      loaded = null;
      throw error;
    }));

  return {
    sites: async () => [(await records()).site],
    sources: async () => [RMG01_SOURCE],
    records: async (siteId) => (siteId === SITE_ID ? records() : null),
  };
}
