import type { BillingRecord, Customer, Payment, Period } from "@/domain";
import type { Methodology, SiteParameters } from "../core/methodology.ts";
import type { CalculatedKpi, MonetaryInput } from "../core/result.ts";
import type { Quantity, SiteKpiContext } from "./quantity.ts";
import type { SiteIndex } from "./registry.ts";
import { billingByAccount } from "../billing/totals.ts";
import { SITE_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { calculateCollectionEfficiency } from "../losses/collection.ts";
import { knownQuantity, missingQuantity, over, siteKpi } from "./quantity.ts";
import { siteCustomers, siteScope } from "./registry.ts";

/* ==========================================================
   ANALYTICS — SITE REVENUE, COLLECTION AND CONNECTIONS

   The commercial side of a site, from its accounts' charges and
   payments in the period:

     connections          active accounts at the site's connections
     energy sold          Σ energy of the charges raised (billed). For
                          a prepaid account this is energy PURCHASED,
                          which is not what was used in the period:
                          credit is carried from one month to the next
     revenue billed       Σ amounts of the charges raised
     revenue collected    Σ payments received (cash basis)
     collection efficiency  collected ÷ billed

   Per connection, over ACTIVE connections:
     energy sold per connection   energy sold ÷ connections
     consumption per connection   energy delivered (customer meters)
                                  ÷ connections
     revenue per connection       revenue billed ÷ connections

   Productive use: the share of energy sold that went to accounts
   recorded as productive use. An account whose flag is not recorded
   is unknown, so with any such account the share is not available.

   The same totals are given by tariff tier, as the operator names
   its tiers, and by CUSTOMER CLASS, to show who has not paid: an
   account recorded as productive use is its own class, and any
   other account is in the class of its category (residential,
   commercial, public). Each class says how many of its accounts are
   prepaid and postpaid, because a prepaid account pays as it buys
   and cannot owe. Amounts are in major currency units. Records in another
   currency make the revenue figures unavailable; nothing is
   converted. With no billing records available at all every figure
   is missing, never zero.
========================================================== */

export interface TierTotals {
  tier: string;
  accounts: number;
  activeAccounts: number;
  /** null when a charge of the tier states no energy. */
  energySoldKwh: number | null;
  revenueBilled: number;
  revenueCollected: number;
}

export interface ClassTotals {
  /** "productive_use", or the account's category; "not_recorded" for an account with neither. */
  customerClass: string;
  accounts: number;
  prepaidAccounts: number;
  postpaidAccounts: number;
  revenueBilled: number;
  revenueCollected: number;
  /** Billed less collected in the period, on a cash basis. */
  notCollected: number;
  /** Collected ÷ billed; null for a class that was billed nothing. */
  collectionEfficiency: number | null;
}

export interface SiteCommercial {
  currency: string;
  connections: CalculatedKpi;
  /** Every account on the register, whatever its status. */
  connectionsAll: CalculatedKpi;
  energySold: CalculatedKpi;
  revenueBilled: CalculatedKpi;
  revenueCollected: CalculatedKpi;
  collectionEfficiency: CalculatedKpi;
  energySoldPerConnection: CalculatedKpi;
  consumptionPerConnection: CalculatedKpi;
  revenuePerConnection: CalculatedKpi;
  productiveUseShare: CalculatedKpi;
  productiveUse: { accounts: number; notRecorded: number };
  /** By tariff tier, in tier-name order; "not_recorded" holds accounts with no tier. */
  byTier: TierTotals[];
  /** By customer class, in class-name order. */
  byClass: ClassTotals[];
  /** Charges by how the energy was determined. */
  chargesByBasis: Record<BillingRecord["basis"], number>;
}

export function computeSiteCommercial(params: {
  index: SiteIndex;
  siteId: string;
  period: Period;
  /** False when the source holds no billing records at all. */
  recordsAvailable: boolean;
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  currency: string;
  /** Energy delivered at the site's customer meters, from the site energy balance. */
  energyDelivered: Quantity;
  methodology?: Methodology<SiteParameters>;
  computedAt: string;
}): SiteCommercial {
  const { index, siteId, period, currency } = params;
  const methodology = params.methodology ?? SITE_REFERENCE;
  const scope = siteScope(siteId);
  const context: SiteKpiContext = { scope, period, methodology: methodologyRef(methodology), computedAt: params.computedAt };
  const kpi = siteKpi.bind(null, context);

  const accounts = siteCustomers(index, siteId);
  const own = new Map<string, Customer>(accounts.map((customer) => [customer.id, customer]));
  const active = accounts.filter((customer) => customer.accountStatus === "active");
  const billingRecords = params.billingRecords.filter((record) => own.has(record.customerId));
  const payments = params.payments.filter((payment) => own.has(payment.customerId));
  const foreign = [...billingRecords.map((record) => record.amount.currency), ...payments.map((payment) => payment.amount.currency)].some((code) => code !== currency);
  const byAccount = billingByAccount({ period, billingRecords, payments, currency });

  let energyKwh: number | null = 0;
  let estimatedKwh = 0;
  let billed = 0;
  let collected = 0;
  let productiveKwh: number | null = 0;
  const tiers = new Map<string, TierTotals>();
  const classes = new Map<string, ClassTotals>();
  for (const customer of accounts) {
    const tierName = customer.tariffTier ?? "not_recorded";
    let tier = tiers.get(tierName);
    if (tier === undefined) tiers.set(tierName, (tier = { tier: tierName, accounts: 0, activeAccounts: 0, energySoldKwh: 0, revenueBilled: 0, revenueCollected: 0 }));
    tier.accounts += 1;
    if (customer.accountStatus === "active") tier.activeAccounts += 1;
    const className = customer.productiveUse === true ? "productive_use" : (customer.category ?? "not_recorded");
    let group = classes.get(className);
    if (group === undefined) classes.set(className, (group = { customerClass: className, accounts: 0, prepaidAccounts: 0, postpaidAccounts: 0, revenueBilled: 0, revenueCollected: 0, notCollected: 0, collectionEfficiency: null }));
    group.accounts += 1;
    if (customer.paymentMode === "prepaid") group.prepaidAccounts += 1;
    if (customer.paymentMode === "postpaid") group.postpaidAccounts += 1;
    const entry = byAccount.get(customer.id);
    if (entry === undefined) continue;
    billed += entry.amountBilled;
    collected += entry.amountPaid;
    tier.revenueBilled += entry.amountBilled;
    tier.revenueCollected += entry.amountPaid;
    group.revenueBilled += entry.amountBilled;
    group.revenueCollected += entry.amountPaid;
    tier.energySoldKwh = tier.energySoldKwh === null || entry.energyBilledKwh === null ? null : tier.energySoldKwh + entry.energyBilledKwh;
    energyKwh = energyKwh === null || entry.energyBilledKwh === null ? null : energyKwh + entry.energyBilledKwh;
    if (customer.productiveUse === true) productiveKwh = productiveKwh === null || entry.energyBilledKwh === null ? null : productiveKwh + entry.energyBilledKwh;
  }
  for (const group of classes.values()) {
    group.notCollected = group.revenueBilled - group.revenueCollected;
    group.collectionEfficiency = group.revenueBilled === 0 ? null : group.revenueCollected / group.revenueBilled;
  }
  const chargesByBasis: SiteCommercial["chargesByBasis"] = { meter_reading: 0, prepaid_vend: 0, estimated: 0 };
  for (const record of billingRecords) {
    if (!byAccount.has(record.customerId)) continue;
    chargesByBasis[record.basis] += 1;
    if (record.basis === "estimated" && record.energyKwh !== null) estimatedKwh += record.energyKwh;
  }

  const ref = (name: string) => `billing:site:${siteId}:${name}`;
  const noRecords = "billing records for the site";
  const energySoldInput: Quantity = !params.recordsAvailable
    ? missingQuantity("kWh", noRecords)
    : energyKwh === null
      ? missingQuantity("kWh", "the energy of every charge raised in the period")
      : {
          value: energyKwh,
          unit: "kWh",
          origin: "observed",
          quality: estimatedKwh > 0 ? "estimated" : "measured",
          ...(estimatedKwh > 0 ? { estimatedShare: energyKwh === 0 ? null : estimatedKwh / energyKwh } : {}),
          ref: ref("energy_billed"),
          missing: [],
          warnings: [],
        };
  const money = (value: number, name: string): Quantity & MonetaryInput => {
    const available = params.recordsAvailable && !foreign;
    return {
      value: available ? value : null,
      unit: "currency",
      currency,
      scale: 1,
      origin: "observed",
      quality: available ? "measured" : "missing",
      ref: ref(name),
      missing: available ? [] : [params.recordsAvailable ? `${name.replaceAll("_", " ")} in ${currency} (some records are in another currency; nothing was converted)` : noRecords],
      warnings: [],
    };
  };
  const revenueBilledInput = money(billed, "revenue_billed");
  const revenueCollectedInput = money(collected, "revenue_collected");
  const activeCount = knownQuantity(active.length, "count", `registry:active_accounts:site:${siteId}`);

  const energySold = kpi("energy_billed", "kWh", { chargesRaised: energySoldInput }, (v) => v("chargesRaised"), { basis: { energySold: "billed" } });
  const notRecorded = accounts.filter((customer) => customer.productiveUse === undefined).length;
  const productiveInput: Quantity =
    notRecorded > 0
      ? missingQuantity("kWh", `whether ${notRecorded} account(s) are productive use (not recorded)`)
      : !params.recordsAvailable
        ? missingQuantity("kWh", noRecords)
        : productiveKwh === null
          ? missingQuantity("kWh", "the energy of every charge raised to a productive-use account")
          : { value: productiveKwh, unit: "kWh", origin: "observed", quality: "measured", ref: ref("energy_billed_productive_use"), missing: [], warnings: [] };

  return {
    currency,
    connections: kpi("connection_count", "count", { activeAccounts: activeCount }, (v) => v("activeAccounts"), { basis: { connections: "active" } }),
    connectionsAll: kpi("connection_count", "count", { accounts: knownQuantity(accounts.length, "count", `registry:accounts:site:${siteId}`) }, (v) => v("accounts"), { basis: { connections: "all" } }),
    energySold,
    revenueBilled: kpi("revenue_billed", "currency", { chargesRaised: revenueBilledInput }, (v) => v("chargesRaised")),
    revenueCollected: kpi("revenue_collected", "currency", { paymentsReceived: revenueCollectedInput }, (v) => v("paymentsReceived"), { basis: { collection: "cash" } }),
    collectionEfficiency: calculateCollectionEfficiency({ scope, period, revenueBilled: revenueBilledInput, revenueCollected: revenueCollectedInput, collectionBasis: "cash", context: { computedAt: params.computedAt } }),
    energySoldPerConnection: kpi("energy_sold_per_connection", "kWh_per_connection", { energySold: energySoldInput, activeConnections: activeCount }, (v) => over(v("energySold"), v("activeConnections")), {
      basis: { energySold: "billed", connections: "active" },
      undefinedBecause: "The site has no active connection.",
    }),
    consumptionPerConnection: kpi("consumption_per_connection", "kWh_per_connection", { energyDelivered: params.energyDelivered, activeConnections: activeCount }, (v) => over(v("energyDelivered"), v("activeConnections")), {
      basis: { energySold: "metered", connections: "active" },
      undefinedBecause: "The site has no active connection.",
    }),
    revenuePerConnection: kpi("revenue_per_connection", "currency", { revenueBilled: revenueBilledInput, activeConnections: activeCount }, (v) => over(v("revenueBilled"), v("activeConnections")), {
      basis: { connections: "active" },
      undefinedBecause: "The site has no active connection.",
    }),
    productiveUseShare: kpi("productive_use_share", "fraction", { energySoldToProductiveUse: productiveInput, energySold: energySoldInput }, (v) => over(v("energySoldToProductiveUse"), v("energySold")), {
      basis: { energySold: "billed" },
      undefinedBecause: "No energy was sold in the period.",
    }),
    productiveUse: { accounts: accounts.filter((customer) => customer.productiveUse === true).length, notRecorded },
    byTier: [...tiers.values()].sort((a, b) => (a.tier < b.tier ? -1 : a.tier > b.tier ? 1 : 0)),
    byClass: [...classes.values()].sort((a, b) => (a.customerClass < b.customerClass ? -1 : a.customerClass > b.customerClass ? 1 : 0)),
    chargesByBasis,
  };
}
