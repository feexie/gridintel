import type { DataSource, ReferenceClaim, ReferenceFact } from "@/domain";
import { accountsCreatedTo, creditBuyers, repeatBuyers } from "../../analytics/reference/buyers.ts";
import { claimStanding } from "../../analytics/reference/claims.ts";
import { meterGap } from "../../analytics/reference/meterGap.ts";
import { indicesByMonth } from "../../analytics/reference/reliability.ts";
import { meteredUseByYear } from "../../analytics/reference/use.ts";
import type { ReferenceSiteRecords, ReferenceSiteRepository } from "../../repositories/ports/reference.ts";
import type { SourcingView } from "../operations/views.ts";
import type {
  ReferenceAttributionView,
  ReferenceBarNotice,
  ReferenceClaimView,
  ReferenceFactView,
  ReferenceReliabilityMonthView,
  ReferenceSiteCardView,
  ReferenceSitesView,
  ReferenceSiteView,
  ReferenceTariffView,
  ReferenceYearView,
} from "./referenceViews.ts";

/* ==========================================================
   SERVICES — REFERENCE SITES (Phase MG-REAL)

   A real mini-grid whose records someone else published, shown
   beside an operator's portfolio and never in it: no count, total,
   share or finding of the portfolio includes it. Everything is
   reported (as the publisher states it) or calculated on the
   published records under a named method (src/analytics/reference),
   and each figure says which.

   What the figures may NOT be read as is listed on the page and
   held in NOT_CLAIMED: there is no revenue, collection rate or price
   per kWh (payments are credit bought, not energy sold), no split of
   the meter gap between its causes, no generation or battery data,
   and no reliability outside the fault log's year.

   Customer and meter codes are counted, never shown.
========================================================== */

export const REFERENCE_SITE_PATH = "/dashboard/minigrid/sites/reference";

const NOT_CLAIMED = [
  "No revenue, collection rate or price per kWh: the payments are credit bought through agents, not the value of energy used, only part of the meters report, and the tariff dates are approximate.",
  "No split of the meter gap between the unmetered air conditioning, theft and meter bypassing: the data cannot split it.",
  "No generation, PV yield, battery state or voltage: the dataset has none.",
  "No reliability figure outside December 2020 to November 2021, and no outage inferred from low use.",
  "No use within the day: the data is daily.",
  "No point on a map and no sun hours: the location is withheld.",
  "Not part of any organization's portfolio, its counts or its totals.",
];

/** The publisher's pseudonymous meter, customer and agent codes, which no view shows. */
const withoutCodes = (text: string) => text.replace(/\b[A-Z]{3}\d{2}-[MCA]\d{2,4}\b/g, "[code]");

const STANDING_NOTE = "Reference site, published data. Not part of any organization's portfolio: none of its figures is in a portfolio's counts or totals.";

const number = (value: number, digits = 0) => new Intl.NumberFormat("en-NG", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const percent = (fraction: number, digits = 1) => `${number(fraction * 100, digits)}%`;
const naira = (value: number) => `₦${number(value)}`;

function dateText(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function monthText(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function attributionOf(source: DataSource): ReferenceAttributionView {
  return {
    citation: source.attribution ?? source.name,
    url: source.url ?? "",
    licence: source.licence ?? "",
    licenceUrl: source.licenceUrl ?? "",
    changes: source.notice ?? "",
  };
}

const sourcingOf = (sources: readonly DataSource[]): SourcingView => ({
  synthetic: sources.some((source) => source.kind === "synthetic"),
  sources: sources.map((source) => ({ id: source.id, name: source.name, kind: source.kind, licence: source.licence, attribution: source.attribution, dated: source.dated })),
});

const fact = (records: ReferenceSiteRecords, item: string): ReferenceFact | undefined => records.site.facts.find((one) => one.item === item);

const FACTS: { item: string; label: string }[] = [
  { item: "Technology", label: "Technology" },
  { item: "PV capacity", label: "PV" },
  { item: "Battery capacity, value used as reference", label: "Battery" },
  { item: "Inverters", label: "Inverters" },
  { item: "Distribution network", label: "Distribution" },
  { item: "Communities served", label: "Communities served" },
  { item: "Smart meters purchased", label: "Smart meters bought" },
  { item: "Meters with readings in this dataset", label: "Meters with readings" },
  { item: "Customer accounts in the current customer file", label: "Customer accounts" },
  { item: "System energized", label: "Energized" },
];

function facts(records: ReferenceSiteRecords): ReferenceFactView[] {
  return FACTS.flatMap(({ item, label }) => {
    const found = fact(records, item);
    if (!found) return [];
    const value = found.unit && found.unit !== "km" ? `${found.value} ${found.unit}` : found.value;
    return [{ label, value, status: found.status, note: found.notes }];
  });
}

function plant(records: ReferenceSiteRecords): string {
  const pv = fact(records, "PV capacity");
  const battery = fact(records, "Battery capacity, value used as reference");
  const inverters = fact(records, "Inverters");
  return [
    pv ? `${pv.value} kWp PV` : null,
    battery ? `${battery.value} kWh lead-acid battery (documents give 136 to 150 kWh)` : null,
    inverters ? `${inverters.value.replace(" x ", " × ")} kVA inverters` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function gapClaim(records: ReferenceSiteRecords, claim: ReferenceClaim): ReferenceClaimView {
  const gap = meterGap(records.days, claim.from, claim.to);
  const calculated = claim.key === "meters_reached_share" ? gap.reached : gap.gap;
  const digits = claim.decimals - 2;
  const label =
    claim.key === "meters_reached_share"
      ? `Customer meters' share of the site meter, ${claim.from.slice(0, 4)}`
      : claim.locator.startsWith("Caveats C05;")
        ? "Customer meters below the site meter, all days with both"
        : "Customer meters below the site meter, the independent export of the data concentrator";
  const formula = claim.key === "meters_reached_share" ? "Σ sum of meters ÷ Σ site total" : "(Σ site total − Σ sum of meters) ÷ Σ site total";
  return {
    label,
    stated: percent(claim.value, digits),
    calculated: calculated === null ? null : percent(calculated, digits),
    standing: claimStanding(claim.value, claim.decimals, calculated),
    basis: `Stated in the dataset (${claim.locator}). Calculated: ${formula} over the ${number(gap.daysWithBoth)} days with both, ${dateText(claim.from)} to ${dateText(claim.to)}: ${number(gap.metersKwh, 1)} kWh metered against ${number(gap.siteKwh, 1)} kWh at the site.`,
  };
}

const YEAR_NOTES: Record<string, string> = {
  "2020": "From 26 August 2020, the first meter reading; payments from 17 July 2020.",
  "2023": "Supply interruption April to July 2023: 38 days without meter data, almost no use from 20 March to 2 July.",
  "2025": "To 25 January 2025, the end of the data.",
};

function years(records: ReferenceSiteRecords): ReferenceYearView[] {
  return meteredUseByYear(records.days, records.meterDays).map((use) => {
    const buyers = creditBuyers(records.payments, use.year);
    const accounts = accountsCreatedTo(records.customers, use.year);
    return {
      year: String(use.year),
      daysWithMeterData: `${number(use.daysWithMeterData)} of ${number(use.daysInData)}`,
      kwhPerDay: use.kwhPerDay === null ? null : number(use.kwhPerDay, 1),
      meanMetersReporting: use.meanMetersReporting === null ? null : number(use.meanMetersReporting, 0),
      kwhPerReportingMeterDay: use.kwhPerReportingMeterDay === null ? null : number(use.kwhPerReportingMeterDay, 3),
      zeroMeterDays: use.zeroMeterDayShare === null ? null : percent(use.zeroMeterDayShare),
      creditBuyers: number(buyers),
      accountsToDate: number(accounts),
      buyersShare: accounts > 0 ? percent(buyers / accounts, 0) : null,
      note: YEAR_NOTES[String(use.year)] ?? null,
    };
  });
}

function buyerClaims(records: ReferenceSiteRecords): ReferenceClaimView[] {
  return records.claims
    .filter((claim) => claim.key === "customers_buying_credit")
    .map((claim) => {
      const calculated = creditBuyers(records.payments, Number(claim.from.slice(0, 4)));
      return {
        label: `Customers who bought credit in ${claim.from.slice(0, 4)}`,
        stated: number(claim.value),
        calculated: number(calculated),
        standing: claimStanding(claim.value, claim.decimals, calculated),
        basis: `Stated in the dataset (${claim.locator}). Calculated: distinct customers with at least one credit purchase (PAY) dated in the year.`,
      };
    });
}

function reliability(records: ReferenceSiteRecords): ReferenceReliabilityMonthView[] {
  const calculated = new Map(indicesByMonth(records.outages).map((month) => [month.month, month]));
  const hours = (value: number | null) => (value === null ? null : `${number(value, 2)} h`);
  const plain = (value: number | null) => (value === null ? null : number(value, 2));
  const pct = (value: number | null) => (value === null ? null : `${number(value, 3)}%`);
  return records.reportedIndices.map((reported) => {
    const ours = calculated.get(reported.month);
    const notes = [
      reported.eventsLogged === 0 ? "No outage logged in the fault log." : null,
      ours && ours.durationDisagreements > 0
        ? `${ours.durationDisagreements} ${ours.durationDisagreements === 1 ? "event's" : "events'"} recorded duration differs from its times; the log keeps both, and the customer-hours use the recorded duration.`
        : null,
    ].filter(Boolean);
    return {
      month: monthText(reported.month),
      events: reported.eventsLogged,
      reported: {
        saidi: hours(reported.saidiHours),
        saifi: plain(reported.saifi),
        caidi: hours(reported.caidiHours),
        asaiAsReported: pct(reported.asaiPercentAsReported),
        asaiHoursInMonth: pct(reported.asaiPercentHoursInMonth),
      },
      calculated: {
        saidi: hours(ours?.saidiHours ?? null),
        saifi: plain(ours?.saifi ?? null),
        caidi: hours(ours?.caidiHours ?? null),
        asai: ours?.asai === null || ours === undefined ? null : `${number(ours.asai * 100, 3)}%`,
      },
      standing: reported.saidiHours === null ? null : claimStanding(reported.saidiHours, 2, ours?.saidiHours ?? null),
      note: notes.length > 0 ? notes.join(" ") : null,
    };
  });
}

function periodText(start: string | null, end: string | null): string {
  const part = (value: string | null) => (value === null ? "" : value === "open" ? "the end of the data" : /^\d{4}-\d{2}$/.test(value) ? monthText(value) : /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateText(value) : value);
  if (start && end && start === end) return part(start);
  return `${part(start)} to ${part(end)}`;
}

function tariffs(records: ReferenceSiteRecords): ReferenceTariffView[] {
  return records.tariffEvents
    .filter((event) => event.recordType === "tariff")
    .map((event) => ({
      period: periodText(event.periodStart, event.periodEnd),
      value: event.value === null ? "Not stated" : `${/about/i.test(event.description) ? "About " : ""}${naira(event.value)} per kWh`,
      note: event.notes,
    }));
}

function events(records: ReferenceSiteRecords): ReferenceTariffView[] {
  return records.tariffEvents
    .filter((event) => event.recordType === "event")
    .map((event) => ({ period: periodText(event.periodStart, event.periodEnd), value: event.description, note: event.notes }));
}

function siteView(records: ReferenceSiteRecords): ReferenceSiteView {
  const supply = fact(records, "Supply hours");
  const repeat = repeatBuyers(records.payments, 2021, 2024);
  const gapCauses = records.caveats.find((caveat) => caveat.id === "C17")?.description ?? "";
  return {
    id: records.site.id,
    code: records.site.code,
    name: records.site.name,
    region: records.site.region,
    locationNote: "The publisher withholds the name, the administrative area and the coordinates, so the site has no point on the map.",
    standingNote: STANDING_NOTE,
    facts: facts(records),
    meterGap: records.claims.filter((claim) => claim.key === "meter_gap_share" || claim.key === "meters_reached_share").map((claim) => gapClaim(records, claim)),
    meterGapCauses: gapCauses,
    years: years(records),
    repeatBuyers: {
      label: "Repeat buyers, 2021 and 2024",
      value: `${number(repeat.again)} of ${number(repeat.of)}`,
      basis: `How this is calculated: of the ${number(repeat.of)} customers who bought credit in 2021, those who bought credit again in 2024. Not retention: the customer file has no closure dates, so who left is not known.`,
    },
    creditBuyers: buyerClaims(records),
    reliability: reliability(records),
    reliabilityNote:
      "The operator's fault log covers December 2020 to November 2021 only (17 events); no outage log exists for any other period, and a month with no entry is \"no outage logged\". The reported ASAI divides by 8,760 hours (a whole year); the publisher's recalculation on the hours in the month is shown beside it. Calculated: SAIDI = Σ customer-hours ÷ customers served, SAIFI = Σ customers interrupted ÷ customers served, with customers served the largest count logged in the month; the reported SAIDI is compared at two decimals.",
    tariffs: tariffs(records),
    tariffNote: "As the operator reports them. The days of the changes are not recorded, and sales agents were charged a lower rate that is not recorded.",
    events: events(records),
    supply: supply ? `${supply.value}. ${supply.notes ?? ""}`.trim() : "Not stated.",
    notClaimed: NOT_CLAIMED,
    caveats: records.caveats.map((caveat) => ({ id: caveat.id, topic: caveat.topic, description: withoutCodes(caveat.description) })),
    caveatNote: "In the publisher's words, with the meter, customer and agent codes they quote replaced by [code].",
    attribution: attributionOf(records.source),
    sourcing: sourcingOf([records.source]),
  };
}

function siteCard(records: ReferenceSiteRecords): ReferenceSiteCardView {
  const firstGap = records.claims.find((claim) => claim.key === "meter_gap_share");
  const lastTariff = records.tariffEvents.filter((event) => event.recordType === "tariff").at(-1);
  const buyers2024 = creditBuyers(records.payments, 2024);
  return {
    id: records.site.id,
    code: records.site.code,
    name: records.site.name,
    region: records.site.region,
    plant: plant(records),
    href: `${REFERENCE_SITE_PATH}/${records.site.id}`,
    meterGap: firstGap
      ? gapClaim(records, firstGap)
      : { label: "Customer meters below the site meter", stated: "Not stated", calculated: null, standing: "not_calculable", basis: "The dataset states no figure." },
    creditBuyers: { label: "Customers who bought credit in 2024", value: number(buyers2024) },
    tariff: {
      label: "Tariff at the end of the data",
      value: lastTariff?.value == null ? "Not stated" : `${/about/i.test(lastTariff.description) ? "About " : ""}${naira(lastTariff.value)} per kWh`,
    },
    attribution: attributionOf(records.source),
  };
}

/** Every reference site, as cards for the Sites screen. */
export async function referenceSitesView(repo: ReferenceSiteRepository): Promise<ReferenceSitesView> {
  const sites = await repo.sites();
  const records = (await Promise.all(sites.map((site) => repo.records(site.id)))).filter((one): one is ReferenceSiteRecords => one !== null);
  return {
    heading: "Reference sites",
    note: "Real mini-grids whose records their owners published. Not part of this portfolio: none is in its counts, totals or findings.",
    sites: records.map(siteCard),
    sourcing: sourcingOf(await repo.sources()),
  };
}

/** One reference site in full; null for a site that is not held. */
export async function referenceSiteView(repo: ReferenceSiteRepository, siteId: string): Promise<ReferenceSiteView | null> {
  const records = await repo.records(siteId);
  return records === null ? null : siteView(records);
}

/** By the address of each reference site's page, what the bar above it says, with the citation
    of the site's dataset. Built from the catalogue, so the published files are not read. */
export async function referenceBarNotices(repo: ReferenceSiteRepository): Promise<Record<string, ReferenceBarNotice>> {
  return Object.fromEntries(
    (await repo.catalogue()).map(({ siteId, source, covers }) => {
      const credit = attributionOf(source);
      return [
        `${REFERENCE_SITE_PATH}/${siteId}`,
        {
          label: "PUBLISHED DATA",
          summary: `This page is a real mini-grid's published records, under ${credit.licence}. The operator's portfolio shown on the other screens is synthetic; this site is not part of it.`,
          citation: credit.citation,
          url: credit.url,
          context: [
            { term: "Records cover", value: `${dateText(covers.start)} to ${dateText(covers.end)}` },
            ...(source.dated ? [{ term: "Published", value: dateText(source.dated) }] : []),
          ],
        },
      ];
    }),
  );
}

/** Every reference site's id, for building its page ahead of time. */
export const referenceSiteIds = async (repo: ReferenceSiteRepository): Promise<string[]> => (await repo.sites()).map((site) => site.id);
