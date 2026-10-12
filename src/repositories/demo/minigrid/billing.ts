import type { BillingRecord, Money, Payment } from "@/domain";
import type { SiteMonth } from "./simulate.ts";
import { DEMO_PERIOD, at, wat } from "../clock.ts";
import { round, seeded } from "../rng.ts";
import { demoProvenance } from "../sources.ts";
import { MINIGRID_CURRENCY, SITE_BILLING_SOURCE } from "./design.ts";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES: VENDS, BILLS AND PAYMENTS

   Two ways an account is charged:
   - prepaid: several vends in the month, each paid as it is
     raised. What an account buys in a month is close to what its
     meter recorded, and not equal to it: credit is carried over;
   - postpaid: one bill at the month-end run for what the smart
     meter recorded. Public institutions are postpaid at every site;
     at Palm Landing every account is.

   Payments are on a cash basis: money received during the month.
   For a postpaid account the amount received is sized against this
   month's bill, which stands in for the settlement of earlier bills
   that the dataset does not hold.

   An account whose meter has a gap in the month is, if postpaid,
   billed on an estimate and the charge says so. A disconnected
   account is not charged.

   Tariffs are assumptions of the synthetic model, not current or
   published rates.
========================================================== */

const BILLING_RUN_MS = at(29, 23, 30);
const ESTIMATE_METHOD = "Billed on an estimate: the meter did not report on every day of the month.";

function money(ngn: number): Money {
  return { amountMinor: Math.round(ngn * 100), currency: MINIGRID_CURRENCY };
}

export function buildSiteBilling(month: SiteMonth): { billingRecords: BillingRecord[]; payments: Payment[] } {
  const billingRecords: BillingRecord[] = [];
  const payments: Payment[] = [];
  const { site } = month;
  for (const connection of month.connections) {
    if (!connection.active) continue;
    const random = seeded(`minigrid:billing:${connection.customerId}`);
    const { group } = connection;
    const recorded = month.recordedKwh.get(connection.customerId);
    // A meter with a gap: the account's energy for billing is estimated at the group's mean.
    const used = recorded ?? group.dailyKwh * 30;

    if (group.paymentMode === "prepaid") {
      const vends = group.productiveUse ? 6 + Math.floor(random() * 5) : group.category === "commercial" ? 4 + Math.floor(random() * 3) : 2 + Math.floor(random() * 3);
      const bought = used * (0.94 + random() * 0.12);
      const weights = Array.from({ length: vends }, () => 0.5 + random());
      const total = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < vends; i++) {
        const kwh = round((bought * weights[i]) / total, 2);
        const when = wat(at(Math.min(29, Math.floor(((i + random()) * 30) / vends)), 7 + Math.floor(random() * 13), Math.floor(random() * 60)));
        const id = `VND-${connection.customerId}-${i + 1}`;
        const amount = money(kwh * group.tariffNgnPerKwh);
        billingRecords.push({ id, customerId: connection.customerId, basis: "prepaid_vend", billedAt: when, energyKwh: kwh, amount, tariffCode: group.tier, provenance: demoProvenance(SITE_BILLING_SOURCE, id) });
        payments.push({ id: `PAY-${id}`, customerId: connection.customerId, receivedAt: when, amount, billingRecordId: id, channel: "vending", provenance: demoProvenance(SITE_BILLING_SOURCE, `PAY-${id}`) });
      }
      continue;
    }

    const id = `BILL-${connection.customerId}-2026-09`;
    const kwh = round(used, 2);
    const amount = money(kwh * group.tariffNgnPerKwh);
    billingRecords.push({
      id,
      customerId: connection.customerId,
      basis: recorded === undefined ? "estimated" : "meter_reading",
      billedAt: wat(BILLING_RUN_MS),
      consumptionPeriod: DEMO_PERIOD,
      energyKwh: kwh,
      amount,
      tariffCode: group.tier,
      provenance: demoProvenance(SITE_BILLING_SOURCE, id, recorded === undefined ? ESTIMATE_METHOD : undefined),
    });
    // Public institutions pay late everywhere; other postpaid accounts pay as their site's customers do.
    const behaviour = group.category === "public" ? { full: 0.34, none: 0.33 } : site.postpaid;
    const draw = random();
    const fraction = draw < behaviour.full ? 1 : draw < behaviour.full + behaviour.none ? 0 : 0.3 + random() * 0.5;
    if (fraction > 0) {
      const paymentId = `PAY-${connection.customerId}-2026-09`;
      payments.push({
        id: paymentId,
        customerId: connection.customerId,
        receivedAt: wat(at(4 + Math.floor(random() * 22), 9 + Math.floor(random() * 8), Math.floor(random() * 60))),
        amount: money((amount.amountMinor / 100) * fraction),
        channel: "agent",
        provenance: demoProvenance(SITE_BILLING_SOURCE, paymentId),
      });
    }
  }
  return { billingRecords, payments };
}
