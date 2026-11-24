/* ==========================================================
   ANALYTICS — LOAN ARITHMETIC SHARED BY THE PLANNERS

   Repaying an asset's cost from a charge a day: the months it takes,
   with or without a funder's yearly return (monthly compounding),
   and the month-by-month schedule. Moved here from the Metering
   Marketplace so the E-mobility planner uses the same arithmetic;
   the Marketplace passes its own days per month and its results are
   unchanged.

   Pledge order is shared too: the lowest return first, then the
   pledge that names fewer areas, then by id.
========================================================== */

/** Months to repay a cost from a charge a day; null when there is no charge. */
export function monthsToRepayAt(cost: number, chargePerDay: number | null, daysPerMonth: number): number | null {
  return chargePerDay === null || chargePerDay <= 0 ? null : cost / (chargePerDay * daysPerMonth);
}

/** Months for a charge a month to repay a cost as a loan at a yearly rate (monthly compounding); null when the charge never repays it. */
export function monthsToRepayWithReturnAt(cost: number, chargePerDay: number | null, ratePerYear: number, daysPerMonth: number): number | null {
  if (ratePerYear <= 0) return monthsToRepayAt(cost, chargePerDay, daysPerMonth);
  if (chargePerDay === null || chargePerDay <= 0) return null;
  const perMonth = chargePerDay * daysPerMonth;
  const rate = ratePerYear / 12;
  const owedShare = (cost * rate) / perMonth;
  return owedShare >= 1 ? null : -Math.log(1 - owedShare) / Math.log(1 + rate);
}

/** Month by month: the charge a month until the cost, with the funder's return on the balance, is repaid; the last month pays only what is left. */
export function repaymentScheduleAt(cost: number, chargePerDay: number, ratePerYear: number, daysPerMonth: number): { month: number; paid: number; balance: number }[] {
  const perMonth = chargePerDay * daysPerMonth;
  if (perMonth <= 0 || cost <= 0 || cost * (ratePerYear / 12) >= perMonth) return [];
  const rows: { month: number; paid: number; balance: number }[] = [];
  let balance = cost;
  for (let month = 1; balance > 1e-6; month++) {
    balance *= 1 + ratePerYear / 12;
    const paid = Math.min(perMonth, balance);
    balance -= paid;
    rows.push({ month, paid, balance: balance < 1e-6 ? 0 : balance });
  }
  return rows;
}

/** The order pledges are placed in: the lowest return first, then fewer areas named, then by id. */
export function pledgeOrder<P extends { id: string; returnPercent: number }>(areas: (pledge: P) => number): (a: P, b: P) => number {
  return (a, b) => a.returnPercent - b.returnPercent || areas(a) - areas(b) || a.id.localeCompare(b.id);
}
