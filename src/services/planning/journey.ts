import type { MarketplaceRepository } from "../../repositories/ports/marketplace.ts";
import { MARKETPLACE_REFERENCE, monthsToRepay, repaymentSchedule, takeAtRecharge } from "../../analytics/planning/marketplace.ts";
import { BAND_LABEL, MARKETPLACE_PATH, marketplaceMatch } from "./marketplace.ts";
import { DISCO_NAMES, formatNaira } from "./metering.ts";
import type { JourneyView } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: ONE METER'S JOURNEY

   One synthetic household, from application to the funder repaid
   (docs/geh/DESIGN.md, section 6d). The charge, the months to repay
   and the funder come from the Marketplace's terms and match; the
   household, its dates and its recharges are designed records.
========================================================== */

export const JOURNEY_PATH = "/dashboard/planning/metering/journey";
const FUND_PATH = "/dashboard/planning/metering";
const MONITORING_PATH = "/dashboard/planning/metering/monitoring";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The month a repayment falls in: the month after installation, plus k − 1. */
function monthLabel(installedOn: string, k: number): string {
  const date = new Date(`${installedOn.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + k);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function journeyView(repository: MarketplaceRepository): Promise<JourneyView> {
  const [journeys, sources, { pledges, terms, result }] = await Promise.all([repository.journeys(), repository.sources(), marketplaceMatch(repository)]);
  const record = journeys[0];
  const bandTerms = terms.find((one) => one.band === record.band)!;
  const charge = bandTerms.chargePerDay;
  const months = monthsToRepay(bandTerms.meterCost, charge);
  const schedule = charge === null ? [] : repaymentSchedule(bandTerms.meterCost, charge);
  const match = result.matches.find((one) => one.disco === record.disco && one.band === record.band);
  const pledge = match === undefined ? undefined : pledges.find((one) => one.id === match.pledgeId);
  const disco = `${DISCO_NAMES[record.disco]} DisCo`;
  const half = MARKETPLACE_REFERENCE.parameters.maxShareOfRecharge;
  const owed = charge === null ? 0 : charge * record.rechargeEveryDays;
  const recharge = takeAtRecharge(owed, record.rechargeNaira);
  const repaidIn = schedule.length;

  const headline =
    pledge === undefined || months === null
      ? `One household in ${DISCO_NAMES[record.disco]}, Band ${BAND_LABEL[record.band]}: approved by ${disco}, waiting for a funder on GridIntel.`
      : `On GridIntel one household in ${DISCO_NAMES[record.disco]} applied, ${disco} approved it, the ${pledge.funder.toLowerCase()} paid for the meter, a certified installer fitted it, and ${formatNaira(charge!)} a day at each recharge repays the funder in ${repaidIn} months.`;

  const steps: JourneyView["steps"] = [
    {
      key: "applied",
      title: "Applied",
      date: day(record.appliedOn),
      who: ["Household", "GridIntel"],
      what: `The household (reference ${record.reference}) asks for a meter on GridIntel, with no upfront payment.`,
      figures: [{ label: "Band", value: BAND_LABEL[record.band] }],
      link: { label: "Demand on the Marketplace", href: MARKETPLACE_PATH },
    },
    {
      key: "approved",
      title: "Approved",
      date: day(record.approvedOn),
      who: [disco],
      what: `${disco} confirms the account, the band and the feeder (${record.feeder}).`,
      figures: [{ label: "Feeder", value: record.feeder }],
      link: { label: "Approved applications, Marketplace", href: MARKETPLACE_PATH },
    },
    {
      key: "priced",
      title: "Priced",
      date: day(record.approvedOn),
      who: ["GridIntel"],
      what:
        charge === null
          ? "Lifeline: exempt from the meter charge."
          : `${formatNaira(charge)} a day, taken at each recharge, never more than ${half * 100}% of the recharge, into escrow. A recharge of ${formatNaira(record.rechargeNaira)} after ${record.rechargeEveryDays} days sends ${formatNaira(recharge.toEscrow)} to escrow and ${formatNaira(record.rechargeNaira - recharge.toEscrow)} to energy.`,
      figures: [
        { label: "Installed meter cost", value: formatNaira(bandTerms.meterCost) },
        { label: "Months to repay", value: months === null ? "Not repaid: exempt" : `${months.toFixed(1)} months` },
      ],
      link: { label: "Daily charge by band, Marketplace", href: MARKETPLACE_PATH },
    },
    {
      key: "funded",
      title: "Funded",
      date: day(record.fundedOn),
      who: pledge === undefined ? ["GridIntel"] : [pledge.funder, "GridIntel"],
      what: pledge === undefined ? "No pledge on the Marketplace can fund this band in this DisCo yet: waiting for a funder." : `Matched on the Marketplace to the ${pledge.funder.toLowerCase()}'s pledge (${pledge.returnPercent}% a year, ${pledge.tenorMonths === null ? "grant" : `${pledge.tenorMonths}-month tenor`}): ${months === null ? "" : `${months.toFixed(1)} months to repay fit its tenor.`}`,
      figures: pledge === undefined ? [] : [{ label: "Funder", value: pledge.funder }],
      link: { label: "Matching, Marketplace", href: MARKETPLACE_PATH },
    },
    {
      key: "installed",
      title: "Installed",
      date: day(record.installedOn),
      who: ["Certified installer", disco, pledge?.funder ?? "Funder"],
      what: `A certified installer fits the meter; ${disco} confirms it is commissioned and vending on ${day(record.confirmedOn)}. Fund money for this meter (${formatNaira(bandTerms.meterCost)}) is released against the verified install, not before.`,
      figures: [{ label: "Released against the verified install", value: formatNaira(bandTerms.meterCost) }],
      link: { label: "Tranches against verified installs, Monitoring", href: MONITORING_PATH },
    },
    {
      key: "repaying",
      title: "Repaying",
      date: schedule.length === 0 ? "Not repaid: exempt" : `From ${monthLabel(record.installedOn, 1)}`,
      who: ["Household", "GridIntel", pledge?.funder ?? "Funder"],
      what:
        schedule.length === 0
          ? "Lifeline meters are public grants and are not repaid."
          : `${formatNaira(schedule[0].paid)} a month into escrow; the balance falls to nothing in month ${repaidIn} (${monthLabel(record.installedOn, repaidIn)}), and escrow repays the funder.`,
      figures: schedule.length === 0 ? [] : [{ label: "Funder repaid", value: monthLabel(record.installedOn, repaidIn) }],
      link: { label: "Escrow and investor repayment, Metering Fund", href: FUND_PATH },
    },
  ];

  return {
    headline,
    headlineHow: `How this is calculated: the charge and the meter cost are the Marketplace's Band ${BAND_LABEL[record.band]} terms; the funder is the Marketplace's match for ${DISCO_NAMES[record.disco]}, Band ${BAND_LABEL[record.band]}. Months to repay = installed meter cost ÷ (the charge a day × ${MARKETPLACE_REFERENCE.parameters.daysPerMonth} days). The household, its dates, feeder and recharges are synthetic.`,
    household: [
      { label: "Household", value: record.reference },
      { label: "DisCo", value: DISCO_NAMES[record.disco] },
      { label: "Band", value: BAND_LABEL[record.band] },
      { label: "Feeder", value: record.feeder },
    ],
    steps,
    schedule: schedule.map((row) => ({ month: `${row.month}`, label: monthLabel(record.installedOn, row.month), paid: formatNaira(row.paid), balance: formatNaira(row.balance), repaid: row.balance <= 0 })),
    scheduleHow: `How this is calculated: each month the household's daily charges (${charge === null ? "none" : formatNaira(charge)} × ${MARKETPLACE_REFERENCE.parameters.daysPerMonth} days) go into escrow; balance = installed meter cost − paid to date; the last month pays only what is left. This repays the meter's cost; the funder's return is set in its pledge and is not modelled here.`,
    methodology: { id: MARKETPLACE_REFERENCE.id, version: MARKETPLACE_REFERENCE.version, disclaimer: MARKETPLACE_REFERENCE.disclaimer },
    sourcing: { synthetic: sources.some((one) => one.kind === "synthetic"), sources: sources.map((one) => ({ id: one.id, name: one.name, kind: one.kind })) },
  };
}
