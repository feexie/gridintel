import type { CustomerCategory } from "./network.ts";

/* ==========================================================
   DEMO ADAPTER — LOAD SHAPES

   How a connection's demand varies, as assumptions of the synthetic
   model (DATASET_ASSUMPTIONS.md). The energy model uses them to
   generate consumption; the network design uses the same figures to
   size a transformer for the demand it will actually see, so the two
   cannot drift apart.

     demand = peak demand × hourly shape × weekday factor
              × daily factor × hourly noise
========================================================== */

/** Demand as a share of the category's peak, by hour of the day in WAT. */
export const SHAPE: Record<CustomerCategory, readonly number[]> = {
  residential: [
    0.35, 0.3, 0.28, 0.27, 0.28, 0.35, 0.5, 0.6, 0.5, 0.4, 0.38, 0.38,
    0.42, 0.45, 0.42, 0.4, 0.45, 0.6, 0.8, 0.95, 1.0, 0.95, 0.75, 0.5,
  ],
  commercial: [
    0.1, 0.1, 0.1, 0.1, 0.1, 0.12, 0.2, 0.4, 0.7, 0.9, 1.0, 1.0,
    0.95, 0.95, 1.0, 0.95, 0.9, 0.8, 0.6, 0.4, 0.25, 0.15, 0.12, 0.1,
  ],
  industrial: [
    0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.7, 0.7, 0.7, 0.7, 0.7,
  ],
  // Offices: a working-day load with little outside office hours.
  government: [
    0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.15, 0.35, 0.8, 1.0, 1.0, 1.0,
    0.95, 0.95, 1.0, 0.95, 0.7, 0.35, 0.2, 0.15, 0.12, 0.12, 0.12, 0.12,
  ],
};

/** Demand on a day of the week relative to a weekday: [Sunday … Saturday]. */
export const WEEK: Record<CustomerCategory, readonly number[]> = {
  residential: [1.06, 1, 1, 1, 1, 1, 1.06],
  commercial: [0.5, 1, 1, 1, 1, 1, 0.85],
  industrial: [0.6, 1, 1, 1, 1, 1, 0.9],
  government: [0.2, 1, 1, 1, 1, 1, 0.25],
};

/** A transformer's demand on one day relative to its usual: drawn once per transformer and day, from `low` to `low + span`. */
export const DAY_FACTOR = { low: 0.92, span: 0.16 };
/** A connection's demand in one hour relative to its shape: drawn per connection and hour, from `low` to `low + span`. */
export const HOURLY_NOISE = { low: 0.8, span: 0.4 };

/**
 * The most the day-to-day and hour-to-hour variation can add to a demand, whatever is drawn:
 * the highest daily factor times the highest hourly noise. A transformer whose demand before
 * variation stays below 1 ÷ this of its rating cannot exceed its rating under any seed.
 */
export const MAX_VARIATION = (DAY_FACTOR.low + DAY_FACTOR.span) * (HOURLY_NOISE.low + HOURLY_NOISE.span);

/** The hour of the week at which a set of connections draws most, before variation, and what it draws (kW). */
export function highestDemand(connections: readonly { category: CustomerCategory; peakKw: number }[]): { kw: number; weekday: number; hour: number } {
  let best = { kw: 0, weekday: 1, hour: 0 };
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      let kw = 0;
      for (const connection of connections) kw += connection.peakKw * SHAPE[connection.category][hour] * WEEK[connection.category][weekday];
      if (kw > best.kw) best = { kw, weekday, hour };
    }
  }
  return best;
}
