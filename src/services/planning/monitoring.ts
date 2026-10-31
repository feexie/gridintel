import type { DiscoId, MeteringPlanQuarter } from "@/domain";
import type { MonitoringRepository } from "../../repositories/ports/monitoring.ts";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import { compareQuarter, MONITORING_REFERENCE, planEscrow, spreadOverQuarters } from "../../analytics/planning/monitoring.ts";
import { recommendedSplit, startingCostPerMeter } from "./allocation.ts";
import { readAssumptions } from "./assumptions.ts";
import { DISCO_NAMES, formatCount, formatNaira } from "./metering.ts";
import type { MonitoringRowView, MonitoringView, ShownFigure } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: MONITORING THE METERING PROGRAMME (M4)

   Plan against actual per DisCo per quarter (docs/geh/DESIGN.md,
   section 6). The plan is the DisCo allocation's recommended first
   million, spread evenly over the programme's first four quarters,
   with the GridIntel structure's charge; the actuals are monitoring
   records. Today those records are synthetic, and every actual is
   marked so.
========================================================== */

export const MONITORING_PATH = "/dashboard/planning/metering/monitoring";

/** The programme's first four quarters: July 2026 to June 2027, year 1 of the Metering Fund's Nigeria case. */
export const PROGRAMME_QUARTERS = [
  { id: "2026-Q3", label: "2026 Q3 (July to September)" },
  { id: "2026-Q4", label: "2026 Q4 (October to December)" },
  { id: "2027-Q1", label: "2027 Q1 (January to March)" },
  { id: "2027-Q2", label: "2027 Q2 (April to June)" },
] as const;

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const percent = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;

/** The plan: each DisCo's recommended first million meters, spread evenly over the four quarters. */
export async function monitoringPlan(published: PublishedFiguresRepository): Promise<MeteringPlanQuarter[]> {
  const split = await recommendedSplit(published);
  return split.flatMap((row) => spreadOverQuarters(row.recommended, PROGRAMME_QUARTERS.length).map((plannedMeters, index) => ({ disco: row.disco, quarter: PROGRAMME_QUARTERS[index].id, plannedMeters })));
}

export async function monitoringView(published: PublishedFiguresRepository, monitoring: MonitoringRepository, query: Query): Promise<MonitoringView> {
  const quarterId = PROGRAMME_QUARTERS.some((one) => one.id === first(query.quarter)) ? first(query.quarter)! : PROGRAMME_QUARTERS[0].id;
  const quarterIndex = PROGRAMME_QUARTERS.findIndex((one) => one.id === quarterId);
  const quarter = PROGRAMME_QUARTERS[quarterIndex];
  const [plan, records, sources, tariffs] = await Promise.all([monitoringPlan(published), monitoring.records(), monitoring.sources(), published.residentialTariffs()]);
  const reported = new Set(records.map((record) => record.quarter));
  const costPerMeter = startingCostPerMeter();

  /* The planned charge: the GridIntel structure's share of a typical Band C bill, on the DisCo's own tariff. */
  const fund = readAssumptions({}).values;
  const chargeOf = (disco: DiscoId): number | null => {
    const bandC = tariffs.filter((row) => row.disco === disco && row.band === "C" && row.nairaPerKwh !== null).sort((a, b) => b.effective.localeCompare(a.effective))[0];
    return bandC === undefined ? null : (fund.billShare / 100) * bandC.nairaPerKwh! * fund.useC;
  };
  const planned = (disco: DiscoId, id: string) => plan.find((row) => row.disco === disco && row.quarter === id)?.plannedMeters ?? 0;
  const upTo: string[] = PROGRAMME_QUARTERS.slice(0, quarterIndex + 1).map((one) => one.id);
  const discos = Object.keys(DISCO_NAMES) as DiscoId[];
  const supplyPlan = 12;

  let rows: MonitoringRowView[] | null = null;
  let behind: string[] = [];
  let held = 0;
  let released = 0;
  if (reported.has(quarterId)) {
    rows = discos.map((disco) => {
      const record = records.find((one) => one.disco === disco && one.quarter === quarterId);
      const meters = planned(disco, quarterId);
      const charge = chargeOf(disco);
      if (record === undefined) {
        return { disco, name: DISCO_NAMES[disco], plannedMeters: formatCount(meters), installed: "Not reported", verified: "Not reported", againstPlan: "Not reported", behind: false, trancheReleased: "Not reported", trancheHeld: "Not reported", supplyPlan: `${supplyPlan} h`, supplyActual: "Not reported", consumptionPlan: `${fund.useC} kWh`, consumptionActual: "Not reported", escrowPlan: "Not reported", escrowActual: "Not reported", repaidPlan: "Not reported", repaidActual: "Not reported" };
      }
      const compared = compareQuarter(meters, record, costPerMeter, charge);
      const repaidPlan = upTo.reduce<number | null>((sum, id) => {
        const one = planEscrow(planned(disco, id), charge);
        return sum === null || one === null ? null : sum + one;
      }, 0);
      const repaidActual = records.filter((one) => one.disco === disco && upTo.includes(one.quarter)).reduce((sum, one) => sum + one.investorRepaid, 0);
      if (compared.behind) behind.push(DISCO_NAMES[disco]);
      held += compared.trancheHeld;
      released += compared.trancheReleased;
      return {
        disco,
        name: DISCO_NAMES[disco],
        plannedMeters: formatCount(meters),
        installed: formatCount(record.metersInstalled),
        verified: formatCount(record.metersVerified),
        againstPlan: compared.againstPlan === null ? "No plan" : percent(compared.againstPlan, 1),
        behind: compared.behind,
        trancheReleased: formatNaira(compared.trancheReleased),
        trancheHeld: compared.trancheHeld > 0 ? formatNaira(compared.trancheHeld) : "Nothing",
        supplyPlan: `${supplyPlan} h`,
        supplyActual: `${record.supplyHoursPerDay.toFixed(1)} h`,
        consumptionPlan: `${fund.useC} kWh`,
        consumptionActual: `${record.consumptionKwhPerMonth} kWh`,
        escrowPlan: compared.escrowPlan === null ? "Not available: no Band C tariff" : formatNaira(compared.escrowPlan),
        escrowActual: formatNaira(record.escrowCollected),
        repaidPlan: repaidPlan === null ? "Not available: no Band C tariff" : formatNaira(repaidPlan),
        repaidActual: formatNaira(repaidActual),
      };
    });
  }
  behind = behind.sort();

  const headline =
    rows === null
      ? `${quarter.label}: not yet reported. Plan: ${formatCount(discos.reduce((sum, disco) => sum + planned(disco, quarterId), 0))} meters across the 11 DisCos.`
      : behind.length === 0
        ? `Every DisCo installed at least ${percent(MONITORING_REFERENCE.parameters.behindBelow)} of its planned meters, verified, in ${quarter.label.split(" (")[0]}.`
        : `${behind.length} of 11 DisCos are behind plan on verified installs in ${quarter.label.split(" (")[0]}: ${formatNaira(held)} of fund money is held until their installs are verified.`;

  const totals: ShownFigure[] =
    rows === null
      ? []
      : [
          { key: "released", label: "Released in tranches, against verified installs", value: formatNaira(released), origin: "synthetic", basis: `Verified meters × ${formatNaira(costPerMeter)} a meter, on synthetic records` },
          { key: "held", label: "Held until installs are verified", value: formatNaira(held), origin: "synthetic", basis: "Planned meters not yet verified × the cost of a meter, on synthetic records" },
          { key: "behind", label: "DisCos behind plan", value: behind.length === 0 ? "None" : behind.join(", "), origin: "synthetic", basis: `Verified installs below ${percent(MONITORING_REFERENCE.parameters.behindBelow)} of plan` },
        ];

  return {
    quarter: quarter.label,
    quarters: PROGRAMME_QUARTERS.map((one) => ({ id: one.id, label: one.label.split(" (")[0], href: `${MONITORING_PATH}?quarter=${one.id}`, current: one.id === quarterId, reported: reported.has(one.id) })),
    headline,
    headlineHow: `How this is calculated: plan = each DisCo's recommended first million meters (DisCo allocation, NERC figures) spread evenly over four quarters. Actual = monitoring records, synthetic today. Behind = verified installs below ${percent(MONITORING_REFERENCE.parameters.behindBelow)} of plan.`,
    trancheLine: "Fund money is released in tranches against verified installs: results-based. A tranche pays for meters a certified installer has fitted and the DisCo has commissioned; nothing is paid ahead of that.",
    rows,
    notReported: rows === null ? `No monitoring records for ${quarter.label} yet. The quarter is shown as not reported, not as zero.` : null,
    totals,
    how: `How this is calculated: planned supply = ${supplyPlan} hours a day (assumption: the Band C level of service). Planned consumption = ${fund.useC} kWh a month (the Metering Fund's Band C assumption). Planned escrow = planned meters × 1.5 months in place on average × the charge (${fund.billShare}% of a Band C bill on the DisCo's September 2026 tariff). In the GridIntel structure escrow repays investors, so planned repayment to date is planned escrow to date.`,
    methodology: { id: MONITORING_REFERENCE.id, version: MONITORING_REFERENCE.version, disclaimer: MONITORING_REFERENCE.disclaimer },
    sourcing: { synthetic: sources.some((one) => one.kind === "synthetic"), sources: sources.map((one) => ({ id: one.id, name: one.name, kind: one.kind })) },
  };
}
