import type { BillingRecord, Money, Payment } from "@/domain";
import type { ConnectionPlan, FeederPlan, PaymentBehaviour } from "./network.ts";
import { DEMO_PERIOD, at, wat } from "./clock.ts";
import { CONNECTIONS, DEMO_CURRENCY, FEEDERS, MV_CUSTOMER } from "./network.ts";
import { round, seeded } from "./rng.ts";
import { BILLING_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — BILLING AND PAYMENTS

   Three ways an account is charged:
   - prepaid: two to four vends in the month, each paid as it is
     raised, for roughly the energy the meter recorded;
   - postpaid with a meter: one bill at the month-end billing run,
     for the energy the meter recorded;
   - unmetered: one estimated bill at the month-end run, for a fixed
     monthly energy that does not depend on what was used.
   Government (MDA) accounts are metered and billed on a meter
   reading like any postpaid account; what sets them apart is how
   seldom they pay.

   Payments are on a cash basis: money received during the month.
   For postpaid and unmetered accounts the amount received is sized
   against this month's bill, which stands in for the settlement of
   earlier bills that the dataset does not hold.
========================================================== */

/** The month-end billing run: 30 September, 23:30 WAT. */
const BILLING_RUN_MS = at(29, 23, 30);

function money(ngn: number): Money {
  return { amountMinor: Math.round(ngn * 100), currency: DEMO_CURRENCY };
}

/** The share of a bill an account pays, drawn from its feeder's payment behaviour. */
function paidFraction(behaviour: PaymentBehaviour, random: () => number): number {
  const draw = random();
  if (draw < behaviour.full) return 1;
  if (draw < behaviour.full + behaviour.none) return 0;
  return 0.3 + random() * 0.5;
}

export function buildDemoBilling(recordedKwh: ReadonlyMap<string, number>): {
  billingRecords: BillingRecord[];
  payments: Payment[];
} {
  const billingRecords: BillingRecord[] = [];
  const payments: Payment[] = [];
  const feederById = new Map(FEEDERS.map((feeder) => [feeder.id, feeder]));

  const charge = (record: Omit<BillingRecord, "provenance">, method?: string) =>
    billingRecords.push({ ...record, provenance: demoProvenance(BILLING_SOURCE, record.id, method) });
  const receive = (payment: Omit<Payment, "provenance">) =>
    payments.push({ ...payment, provenance: demoProvenance(BILLING_SOURCE, payment.id) });

  const monthEndBill = (
    connection: ConnectionPlan,
    feeder: FeederPlan,
    basis: "meter_reading" | "estimated",
    energyKwh: number,
    tariffCode: string,
    fraction: number,
    random: () => number,
  ) => {
    const id = `BILL-2026-09-${connection.customerId}`;
    const amount = money(energyKwh * feeder.tariffNgnPerKwh);
    charge(
      {
        id,
        customerId: connection.customerId,
        basis,
        billedAt: wat(BILLING_RUN_MS),
        consumptionPeriod: DEMO_PERIOD,
        energyKwh,
        amount,
        tariffCode,
      },
      basis === "estimated" ? "Synthetic estimated billing: a fixed monthly energy by customer category." : undefined,
    );
    const paid = Math.round(amount.amountMinor * fraction);
    if (paid > 0) {
      receive({
        id: `PAY-2026-09-${connection.customerId}`,
        customerId: connection.customerId,
        receivedAt: wat(at(2 + Math.floor(random() * 26), 8 + Math.floor(random() * 9), Math.floor(random() * 60))),
        amount: { amountMinor: paid, currency: DEMO_CURRENCY },
        channel: random() < 0.6 ? "bank" : "agent",
      });
    }
  };

  for (const connection of CONNECTIONS) {
    if (connection.disconnected) continue;
    const feeder = feederById.get(connection.feederId) as FeederPlan;
    const random = seeded(`billing:${connection.customerId}`);

    if (connection.customerId === MV_CUSTOMER.customerId) {
      const energy = recordedKwh.get(connection.customerId) ?? 0;
      monthEndBill(connection, feeder, "meter_reading", energy, MV_CUSTOMER.tariffCode, MV_CUSTOMER.paymentFraction, random);
      continue;
    }

    if (connection.metering === "prepaid") {
      const recorded = recordedKwh.get(connection.customerId) ?? 0;
      const vended = recorded * (0.94 + random() * 0.12);
      const vends = 2 + Math.floor(random() * 3);
      for (let i = 0; i < vends; i++) {
        const id = `VEND-2026-09-${connection.customerId}-${i + 1}`;
        const energyKwh = round(vended / vends, 1);
        const amount = money(energyKwh * feeder.tariffNgnPerKwh);
        // One vend in each equal slice of the month, so vends never bunch up.
        const day = Math.floor(((i + random()) * 30) / vends);
        const vendedAt = wat(at(day, 7 + Math.floor(random() * 14), Math.floor(random() * 60)));
        charge({
          id,
          customerId: connection.customerId,
          basis: "prepaid_vend",
          billedAt: vendedAt,
          energyKwh,
          amount,
          tariffCode: `${feeder.tariffCode} non-MD`,
        });
        receive({
          id: `PAY-${id}`,
          customerId: connection.customerId,
          receivedAt: vendedAt,
          amount,
          billingRecordId: id,
          channel: "vending",
        });
      }
      continue;
    }

    if (connection.metering === "postpaid") {
      const energy = recordedKwh.get(connection.customerId) ?? 0;
      const government = connection.category === "government";
      monthEndBill(
        connection,
        feeder,
        "meter_reading",
        energy,
        `${feeder.tariffCode} ${government ? "MD" : "non-MD"}`,
        paidFraction(government ? feeder.payment.government : feeder.payment.postpaid, random),
        random,
      );
      continue;
    }

    const estimate = feeder.estimatedKwh[connection.category === "commercial" ? "commercial" : "residential"];
    monthEndBill(
      connection,
      feeder,
      "estimated",
      estimate,
      `${feeder.tariffCode} non-MD (estimated)`,
      paidFraction(feeder.payment.unmetered, random),
      random,
    );
  }

  return { billingRecords, payments };
}
