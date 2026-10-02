import type { BillingBasis, BillingRecord, DataQuality, Payment, Period, ScopeRef } from "@/domain";
import type { InputValue, MonetaryInput, Warning } from "../core/result.ts";
import type { TopologyIndex } from "../topology/registry.ts";
import { periodBounds, toEpochMs } from "../core/time.ts";
import { servicePointsUnder } from "../topology/registry.ts";

/* ==========================================================
   ANALYTICS — BILLING TOTALS FOR A SCOPE

   Sums the charges raised and the payments received in a period
   for the customer accounts connected under a scope:

     energy billed      Σ BillingRecord.energyKwh   (billedAt in period)
     revenue billed     Σ BillingRecord.amount      (billedAt in period)
     revenue collected  Σ Payment.amount            (receivedAt in period)

   Collection is on a cash basis: what was received in the period,
   whichever charge it settles.

   An account is attributed to a scope through its CURRENT service
   point. Energy billed is "estimated" as soon as one charge in it
   was estimated rather than read from a meter. When billing records
   are not available at all, every total is missing, never 0. With
   records available, an empty period is a real zero.

   ACCOUNTS. By default every account under the scope is counted.
   With `accounts: "low_voltage_non_md"` only accounts supplied
   through a distribution transformer AND recorded as non-MD are
   counted: the ordinary low-voltage customers whose average billed
   rate is used to value unbilled energy. A customer supplied
   directly at medium voltage is never among them. An account whose
   demand class is not recorded is left out too, and counted in
   `unknownDemandClassExcluded`: a missing class is not assumed to
   be non-MD.

   Amounts are returned in major currency units (scale 1). Records
   in any other currency than the one asked for make the revenue
   totals unavailable; nothing is converted.
========================================================== */

export interface BasisTotals {
  records: number;
  /** null when a record of this basis states no energy. */
  energyKwh: number | null;
  /** Major currency units. */
  amount: number;
}

export interface BillingTotals {
  scope: ScopeRef;
  period: Period;
  /** Revenue collected is money received in the period, whichever charge it settles. */
  collectionBasis: "cash";
  energyBilled: InputValue;
  revenueBilled: MonetaryInput;
  revenueCollected: MonetaryInput;
  byBasis: Record<BillingBasis, BasisTotals>;
  /** Accounts connected under the scope, whatever their status. */
  accountsInScope: number | null;
  /** Accounts with at least one charge in the period. */
  accountsBilled: number;
  /**
   * With `accounts: "low_voltage_non_md"`: low-voltage accounts left out
   * because their demand class is not recorded. 0 otherwise.
   */
  unknownDemandClassExcluded: number;
  warnings: Warning[];
}

const MINOR_PER_MAJOR = 100;

/** What one account was charged and paid in a period. Amounts are in major currency units. */
export interface AccountBilling {
  customerId: string;
  /** null when a charge states no energy. */
  energyBilledKwh: number | null;
  /** True when any charge was estimated rather than read from a meter. */
  estimated: boolean;
  amountBilled: number;
  amountPaid: number;
  charges: number;
}

/**
 * Charges and payments in a period, per account. Records in another
 * currency, or without a usable time, are left out; an account with no
 * record in the period is absent from the result rather than zero.
 */
export function billingByAccount(params: {
  period: Period;
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  currency: string;
}): Map<string, AccountBilling> {
  const accounts = new Map<string, AccountBilling>();
  const bounds = periodBounds(params.period);
  if (bounds === null) return accounts;
  const inPeriod = (timestamp: string): boolean => {
    const ms = toEpochMs(timestamp);
    return ms !== null && ms >= bounds.startMs && ms < bounds.endMs;
  };
  const account = (customerId: string): AccountBilling => {
    let entry = accounts.get(customerId);
    if (entry === undefined) {
      entry = { customerId, energyBilledKwh: 0, estimated: false, amountBilled: 0, amountPaid: 0, charges: 0 };
      accounts.set(customerId, entry);
    }
    return entry;
  };
  for (const record of params.billingRecords) {
    if (record.amount.currency !== params.currency || !inPeriod(record.billedAt)) continue;
    const entry = account(record.customerId);
    entry.charges += 1;
    entry.amountBilled += record.amount.amountMinor / MINOR_PER_MAJOR;
    if (record.basis === "estimated") entry.estimated = true;
    entry.energyBilledKwh =
      entry.energyBilledKwh === null || record.energyKwh === null ? null : entry.energyBilledKwh + record.energyKwh;
  }
  for (const payment of params.payments) {
    if (payment.amount.currency !== params.currency || !inPeriod(payment.receivedAt)) continue;
    account(payment.customerId).amountPaid += payment.amount.amountMinor / MINOR_PER_MAJOR;
  }
  return accounts;
}

function emptyBasis(): BasisTotals {
  return { records: 0, energyKwh: 0, amount: 0 };
}

export function billingTotals(params: {
  index: TopologyIndex;
  scope: ScopeRef;
  period: Period;
  /** False when the source holds no billing records at all. */
  recordsAvailable: boolean;
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  /** ISO 4217 code the totals are stated in. */
  currency: string;
  /** Which accounts under the scope to count; all of them by default. */
  accounts?: "all" | "low_voltage_non_md";
}): BillingTotals {
  const { index, scope, period, currency } = params;
  const ref = (name: string) => `billing:${scope.kind}:${scope.id}:${name}`;
  const warnings: Warning[] = [];
  const byBasis: Record<BillingBasis, BasisTotals> = {
    meter_reading: emptyBasis(),
    prepaid_vend: emptyBasis(),
    estimated: emptyBasis(),
  };
  const missing = (reason: Warning): BillingTotals => ({
    scope,
    period,
    collectionBasis: "cash",
    energyBilled: { value: null, unit: "kWh", origin: "observed", quality: "missing", ref: ref("energy_billed") },
    revenueBilled: { value: null, unit: "currency", currency, scale: 1, origin: "observed", quality: "missing", ref: ref("revenue_billed") },
    revenueCollected: { value: null, unit: "currency", currency, scale: 1, origin: "observed", quality: "missing", ref: ref("revenue_collected") },
    byBasis,
    accountsInScope: null,
    accountsBilled: 0,
    unknownDemandClassExcluded: 0,
    warnings: [...warnings, reason],
  });

  if (!params.recordsAvailable) {
    return missing({ code: "BILLING_NOT_AVAILABLE", message: "The source holds no billing records." });
  }
  const bounds = periodBounds(period);
  if (bounds === null) {
    return missing({ code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." });
  }
  const points = servicePointsUnder(index, scope);
  if (points.value === null) return missing(points.warnings[0]);
  warnings.push(...points.warnings);

  const lowVoltageOnly = params.accounts === "low_voltage_non_md";
  const pointIds = new Set(
    points.value.filter((sp) => !lowVoltageOnly || sp.supply.kind === "distribution_transformer").map((sp) => sp.id),
  );
  const connected = index.registry.customers.filter(
    (customer) => customer.servicePointId !== undefined && pointIds.has(customer.servicePointId),
  );
  const unknownDemandClassExcluded = lowVoltageOnly ? connected.filter((customer) => customer.demandClass === undefined).length : 0;
  if (unknownDemandClassExcluded > 0) {
    warnings.push({
      code: "DEMAND_CLASS_UNKNOWN",
      message: `${unknownDemandClassExcluded} account(s) with no demand class recorded were left out of the low-voltage non-MD figures.`,
    });
  }
  const accounts = new Set(
    connected.filter((customer) => !lowVoltageOnly || customer.demandClass === "non_md").map((customer) => customer.id),
  );
  const inPeriod = (timestamp: string, id: string): boolean => {
    const ms = toEpochMs(timestamp);
    if (ms === null) {
      warnings.push({ code: "INVALID_TIMESTAMP", message: `Record ${id} has no usable time and was not counted.`, ref: id });
      return false;
    }
    return ms >= bounds.startMs && ms < bounds.endMs;
  };

  let energyKwh: number | null = 0;
  let billedMinor = 0;
  let collectedMinor = 0;
  let foreignCurrency = false;
  let estimated = false;
  const billedAccounts = new Set<string>();

  for (const record of params.billingRecords) {
    if (!accounts.has(record.customerId) || !inPeriod(record.billedAt, record.id)) continue;
    if (record.amount.currency !== currency) {
      foreignCurrency = true;
      continue;
    }
    billedAccounts.add(record.customerId);
    const basis = byBasis[record.basis];
    basis.records += 1;
    basis.amount += record.amount.amountMinor / MINOR_PER_MAJOR;
    billedMinor += record.amount.amountMinor;
    if (record.basis === "estimated") estimated = true;
    if (record.energyKwh === null) {
      basis.energyKwh = null;
      energyKwh = null;
      warnings.push({ code: "BILLED_ENERGY_NOT_STATED", message: `Charge ${record.id} states no energy.`, ref: record.id });
    } else {
      basis.energyKwh = basis.energyKwh === null ? null : basis.energyKwh + record.energyKwh;
      energyKwh = energyKwh === null ? null : energyKwh + record.energyKwh;
    }
  }
  for (const payment of params.payments) {
    if (!accounts.has(payment.customerId) || !inPeriod(payment.receivedAt, payment.id)) continue;
    if (payment.amount.currency !== currency) {
      foreignCurrency = true;
      continue;
    }
    collectedMinor += payment.amount.amountMinor;
  }

  if (foreignCurrency) {
    warnings.push({
      code: "CURRENCY_MISMATCH",
      message: `Some records are not in ${currency}; revenue totals are not available and nothing was converted.`,
    });
  }
  const energyQuality: DataQuality = energyKwh === null ? "missing" : estimated ? "estimated" : "measured";
  const revenueQuality: DataQuality = foreignCurrency ? "missing" : "measured";

  const estimatedKwh = byBasis.estimated.energyKwh;
  const estimatedShare =
    energyKwh === null || estimatedKwh === null || energyKwh === 0 ? null : estimatedKwh / energyKwh;

  return {
    scope,
    period,
    collectionBasis: "cash",
    energyBilled: {
      value: energyKwh,
      unit: "kWh",
      origin: "observed",
      quality: energyQuality,
      ...(estimated ? { estimatedShare } : {}),
      ref: ref("energy_billed"),
    },
    revenueBilled: {
      value: foreignCurrency ? null : billedMinor / MINOR_PER_MAJOR,
      unit: "currency",
      currency,
      scale: 1,
      origin: "observed",
      quality: revenueQuality,
      ref: ref("revenue_billed"),
    },
    revenueCollected: {
      value: foreignCurrency ? null : collectedMinor / MINOR_PER_MAJOR,
      unit: "currency",
      currency,
      scale: 1,
      origin: "observed",
      quality: revenueQuality,
      ref: ref("revenue_collected"),
    },
    byBasis,
    accountsInScope: accounts.size,
    accountsBilled: billedAccounts.size,
    unknownDemandClassExcluded,
    warnings,
  };
}
