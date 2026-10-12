import type { InterruptionCause, InterruptionClass, KpiBasis, Outage, Period } from "@/domain";
import type { Methodology, SiteParameters } from "../core/methodology.ts";
import type { CalculatedKpi, Warning } from "../core/result.ts";
import type { Quantity, SiteKpiContext } from "./quantity.ts";
import { SITE_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { MS_PER_MINUTE, periodBounds, toEpochMs } from "../core/time.ts";
import { knownQuantity, missingQuantity, over, siteKpi } from "./quantity.ts";
import { siteScope } from "./registry.ts";

/* ==========================================================
   ANALYTICS — SITE AVAILABILITY

   Whether the site's customers had supply, from the interruptions
   recorded for the site. It is customer-weighted, like the network
   indices: an interruption of some of the site's connections counts
   for those connections only.

     customer-hours interrupted = Σ customers affected × hours of the
                                  interruption inside the period
     availability (uptime)      = 1 − customer-hours interrupted
                                      ÷ (connections × hours in period)
     hours of supply per day    = 24 × availability
     interruptions per connection = Σ customers affected ÷ connections,
                                  over interruptions that began in the
                                  period

   Every interruption counts, whatever its length: there is no
   momentary threshold. Each figure is given twice, with planned
   interruptions and without, so that a reported figure is set
   beside the one on its own basis. An interruption whose planned
   status is not known counts as unplanned.

   An exposure is left out, with a warning, when it has no start
   time or no customer count, or when it has no end time and its
   source does not say it is still open. One the source says is open
   counts to the end of the period and makes the result provisional.

   With no interruption record available at all, availability is not
   known. It is never taken to be 100%.
========================================================== */

const ALL_CLASSES: readonly InterruptionClass[] = ["network", "upstream_supply", "load_management", "other"];

export interface SiteAvailabilityVariant {
  basis: KpiBasis;
  availability: CalculatedKpi;
  hoursOfSupply: CalculatedKpi;
  interruptionsPerConnection: CalculatedKpi;
}

export interface SiteAvailability {
  /** Every interruption counted. */
  all: SiteAvailabilityVariant;
  /** Planned interruptions left out. */
  unplannedOnly: SiteAvailabilityVariant;
  /** Interruptions that began in the period, planned or not. */
  interruptions: number | null;
  /** Hours without supply for the average connection, by recorded cause. Null when availability is not known. */
  hoursLostByCause: Partial<Record<InterruptionCause, number>> | null;
  /** True when an interruption still open at the end of the period is counted. */
  provisional: boolean;
  excludedExposures: number;
}

export function computeSiteAvailability(params: {
  siteId: string;
  period: Period;
  /** Interruptions recorded for the period. Those that do not affect this site are ignored. */
  outages: readonly Outage[];
  /** False when the source holds no interruption records at all. */
  recordsAvailable: boolean;
  /** Active connections at the site; null when the registry cannot say. */
  connections: number | null;
  methodology?: Methodology<SiteParameters>;
  computedAt: string;
}): SiteAvailability {
  const { siteId, period } = params;
  const methodology = params.methodology ?? SITE_REFERENCE;
  const context: SiteKpiContext = { scope: siteScope(siteId), period, methodology: methodologyRef(methodology), computedAt: params.computedAt };
  const bounds = periodBounds(period);
  const warnings: Warning[] = [];
  const totals = { all: { hours: 0, customers: 0 }, unplanned: { hours: 0, customers: 0 } };
  const byCause: Partial<Record<InterruptionCause, number>> = {};
  let interruptions = 0;
  let excluded = 0;
  let provisional = false;

  if (bounds !== null) {
    for (const outage of params.outages) {
      let began = false;
      for (const exposure of outage.exposures) {
        if (!("id" in exposure.affected) || exposure.affected.kind !== "site" || exposure.affected.id !== siteId) continue;
        const startMs = exposure.interruptedAt === undefined ? null : toEpochMs(exposure.interruptedAt);
        let endMs = exposure.restoredAt === undefined ? null : toEpochMs(exposure.restoredAt);
        const open = exposure.restoredAt === undefined && outage.status === "open";
        if (open) endMs = bounds.endMs;
        if (startMs === null || endMs === null || exposure.customersAffected === null) {
          excluded += 1;
          warnings.push({
            code: "EXPOSURE_EXCLUDED",
            message: `An exposure of interruption ${outage.id} was left out: ${startMs === null ? "no start time" : endMs === null ? "no restoration time, and the source does not say it is open" : "no customer count"}.`,
            ref: outage.id,
          });
          continue;
        }
        const overlapMs = Math.min(endMs, bounds.endMs) - Math.max(startMs, bounds.startMs);
        if (overlapMs <= 0) continue;
        if (open) provisional = true;
        const startsInPeriod = startMs >= bounds.startMs && startMs < bounds.endMs;
        const customerHours = (exposure.customersAffected * overlapMs) / (60 * MS_PER_MINUTE);
        const count = startsInPeriod ? exposure.customersAffected : 0;
        totals.all.hours += customerHours;
        totals.all.customers += count;
        if (outage.planned !== true) {
          totals.unplanned.hours += customerHours;
          totals.unplanned.customers += count;
        }
        byCause[outage.cause] = (byCause[outage.cause] ?? 0) + customerHours;
        if (startsInPeriod) began = true;
      }
      if (began) interruptions += 1;
    }
  }
  if (provisional) {
    warnings.push({ code: "PROVISIONAL_OPEN_INTERRUPTION", message: "Provisional: includes an interruption still open at the end of the period, counted to the period end." });
  }

  const periodHours = bounds === null ? null : (bounds.endMs - bounds.startMs) / (60 * MS_PER_MINUTE);
  const connections: Quantity =
    params.connections === null ? missingQuantity("count", "the number of active connections at the site") : knownQuantity(params.connections, "count", `registry:active_connections:site:${siteId}`);
  const hoursInPeriod: Quantity = periodHours === null ? missingQuantity("hours", "period") : knownQuantity(periodHours, "hours", "period");

  const variant = (sums: { hours: number; customers: number }, planned: "included" | "excluded"): SiteAvailabilityVariant => {
    const basis: KpiBasis = { interruptionClasses: ALL_CLASSES, plannedInterruptions: planned };
    const record = (value: number, unit: "hours" | "count", what: string): Quantity =>
      params.recordsAvailable
        ? { value, unit, origin: "observed", quality: "measured", ref: `interruptions:site:${siteId}:${what}`, missing: [], warnings: [] }
        : missingQuantity(unit, "interruption records for the site");
    const interrupted = record(sums.hours, "hours", "customer_hours");
    const fraction = (v: (name: string) => number) => {
      const exposure = v("connections") * v("hoursInPeriod");
      return exposure === 0 ? null : 1 - v("customerHoursInterrupted") / exposure;
    };
    const quantities = { customerHoursInterrupted: interrupted, connections, hoursInPeriod };
    const options = { basis, warnings, undefinedBecause: "The site has no active connection, so availability to its customers is undefined." };
    return {
      basis,
      availability: siteKpi(context, "availability", "fraction", quantities, fraction, options),
      hoursOfSupply: siteKpi(context, "hours_of_supply", "hours_per_day", quantities, (v) => { const share = fraction(v); return share === null ? null : 24 * share; }, options),
      interruptionsPerConnection: siteKpi(context, "saifi", "interruptions_per_customer", { customersInterrupted: record(sums.customers, "count", "customers_interrupted"), connections }, (v) => over(v("customersInterrupted"), v("connections")), options),
    };
  };

  const known = params.recordsAvailable && bounds !== null;
  const average = (customerHours: number) => (params.connections === null || params.connections === 0 ? null : customerHours / params.connections);
  let hoursLostByCause: SiteAvailability["hoursLostByCause"] = null;
  if (known && params.connections !== null && params.connections > 0) {
    hoursLostByCause = {};
    for (const cause of Object.keys(byCause) as InterruptionCause[]) hoursLostByCause[cause] = average(byCause[cause] as number) as number;
  }
  return {
    all: variant(totals.all, "included"),
    unplannedOnly: variant(totals.unplanned, "excluded"),
    interruptions: known ? interruptions : null,
    hoursLostByCause,
    provisional,
    excludedExposures: excluded,
  };
}
