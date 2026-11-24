import type { ReferenceCustomer, ReferencePayment } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — REFERENCE SITE: CUSTOMERS WHO BOUGHT CREDIT

   - Buyers in a year: distinct customers with at least one payment
     of type PAY (credit bought through an agent) dated in the
     calendar year.
   - Repeat buyers: of the buyers in one year, those who are buyers
     again in a later year. "x of y", never called retention: the
     customer file has no closure dates, so who left is not known.
   - Accounts created to date: customers whose account was created
     in or before the year; customers with no year are not counted.

   Payments are credit bought, not energy sold: nothing here is a
   revenue, a collection rate or a price per kWh. Customer codes are
   used to count only.
========================================================== */

export const REFERENCE_CREDIT_BUYERS: Methodology<Record<string, never>> = {
  id: "gridintel.reference.credit-buyers",
  version: "0.1.0",
  name: "Customers who bought credit in a year",
  description: "Distinct customers with at least one credit purchase (PAY) in a calendar year, repeat buyers between two years, and accounts created to date.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

function buyerSet(payments: readonly ReferencePayment[], year: number): Set<string> {
  const prefix = String(year);
  const buyers = new Set<string>();
  for (const payment of payments) if (payment.type === "PAY" && payment.customerCode !== null && payment.date.startsWith(prefix)) buyers.add(payment.customerCode);
  return buyers;
}

/** Distinct customers who bought credit (PAY) in the calendar year. */
export const creditBuyers = (payments: readonly ReferencePayment[], year: number): number => buyerSet(payments, year).size;

export interface RepeatBuyers {
  firstYear: number;
  laterYear: number;
  /** Buyers in the first year. */
  of: number;
  /** Of those, buyers again in the later year. */
  again: number;
}

/** Of the customers who bought credit in `firstYear`, those who bought again in `laterYear`. */
export function repeatBuyers(payments: readonly ReferencePayment[], firstYear: number, laterYear: number): RepeatBuyers {
  const first = buyerSet(payments, firstYear);
  const later = buyerSet(payments, laterYear);
  let again = 0;
  for (const customer of first) if (later.has(customer)) again++;
  return { firstYear, laterYear, of: first.size, again };
}

/** Accounts created in or before the year; accounts with no year created are not counted. */
export const accountsCreatedTo = (customers: readonly ReferenceCustomer[], year: number): number =>
  customers.filter((customer) => customer.yearCreated !== null && customer.yearCreated <= year).length;
