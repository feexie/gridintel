import type { FunderKind } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { monthsToRepayWithReturnAt, pledgeOrder, repaymentScheduleAt } from "../loan.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: FUNDING HUBS FROM A PER-SWAP ADD-ON

   - Each swap carries an add-on that goes into escrow and repays the
     hub's funder: escrow a day = add-on × swaps a day.
   - Months to repay the hub = its cost ÷ (escrow a day × days a
     month); with a funder's return, the months for that escrow to
     repay the cost as a loan at that rate (the arithmetic the
     Metering Marketplace uses, analytics/planning/loan.ts).
   - Matching, as the Marketplace orders pledges: the lowest return
     first, then the pledge that names fewer feeders, then by id. A
     pledge funds a hub only when it names the hub's feeder, has the
     hub's whole cost left, and (unless it is a grant) the hub repays
     within the pledge's tenor at its return. Hubs are taken by id;
     each is funded once. What a pledge cannot place is queued; hubs
     left unfunded are waiting. A hub with no cost cannot be matched
     and is named, never matched at 0.
   Hubs and their batteries only: rider and vehicle finance are out
   of scope.
========================================================== */

export interface SwapFinanceParameters {
  /** ₦ a swap into escrow. Reported (cited by the service). */
  addOnPerSwap: number;
  daysPerMonth: number;
}

export const EMOBILITY_SWAP_FINANCE_REFERENCE: Methodology<SwapFinanceParameters> = {
  id: "gridintel.planning.emobility-swap-finance",
  version: "0.1.0",
  name: "GridIntel reference matching of pledges to swap hubs",
  description:
    "A per-swap add-on into escrow repays a hub's cost at the funder's return; pledges matched to hubs by return, feeders named, tenor and the hub's whole cost; what cannot be placed is queued.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { addOnPerSwap: 1_000, daysPerMonth: 30.4 },
};

export interface HubFinanceInput {
  id: string;
  feederId: string;
  /** ₦; null when no cost is held. */
  cost: number | null;
  swapsPerDay: number;
}

export interface HubPledgeInput {
  id: string;
  kind: FunderKind;
  amountNaira: number;
  returnPercent: number;
  /** null for a grant, which is not repaid. */
  tenorMonths: number | null;
  feeders: readonly string[];
}

export function escrowPerDay(swapsPerDay: number, parameters = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters): number {
  return Math.max(0, swapsPerDay) * parameters.addOnPerSwap;
}

/** Months for the hub's escrow to repay its cost at a yearly return; null without a cost, or when the escrow never repays it. */
export function hubMonthsToRepay(hub: HubFinanceInput, ratePerYear: number, parameters = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters): number | null {
  if (hub.cost === null || hub.cost <= 0) return null;
  return monthsToRepayWithReturnAt(hub.cost, escrowPerDay(hub.swapsPerDay, parameters), ratePerYear, parameters.daysPerMonth);
}

export function hubRepaymentSchedule(hub: HubFinanceInput, ratePerYear: number, parameters = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters) {
  if (hub.cost === null || hub.cost <= 0) return [];
  return repaymentScheduleAt(hub.cost, escrowPerDay(hub.swapsPerDay, parameters), ratePerYear, parameters.daysPerMonth);
}

/** Whether a pledge may fund a hub: its feeder, and (unless a grant) repaid within the tenor at the pledge's return. */
export function canFundHub(pledge: HubPledgeInput, hub: HubFinanceInput, parameters = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters): boolean {
  if (!pledge.feeders.includes(hub.feederId) || hub.cost === null || hub.cost <= 0) return false;
  if (pledge.tenorMonths === null) return true;
  const months = hubMonthsToRepay(hub, pledge.returnPercent / 100, parameters);
  return months !== null && months <= pledge.tenorMonths;
}

export interface HubMatch {
  pledgeId: string;
  hubId: string;
  naira: number;
}

export interface HubMatchResult {
  matches: HubMatch[];
  /** By pledge id: money placed, money queued, hubs funded. */
  pledges: Record<string, { placed: number; queued: number; hubs: number }>;
  /** Hubs with a cost that no pledge funded. */
  waiting: string[];
  /** Hubs with no cost, which cannot be matched. */
  notCosted: string[];
}

/** Matches pledges to hubs. Deterministic: the same inputs give the same matches. */
export function matchHubPledges(pledges: readonly HubPledgeInput[], hubs: readonly HubFinanceInput[], parameters = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters): HubMatchResult {
  const ordered = [...pledges].sort(pledgeOrder<HubPledgeInput>((pledge) => pledge.feeders.length));
  const byId = [...hubs].sort((a, b) => a.id.localeCompare(b.id));
  const funded = new Set<string>();
  const matches: HubMatch[] = [];
  const result: HubMatchResult["pledges"] = {};
  for (const pledge of ordered) {
    let money = pledge.amountNaira;
    let count = 0;
    for (const hub of byId) {
      if (funded.has(hub.id) || hub.cost === null || hub.cost > money + 1e-6 || !canFundHub(pledge, hub, parameters)) continue;
      funded.add(hub.id);
      money -= hub.cost;
      count += 1;
      matches.push({ pledgeId: pledge.id, hubId: hub.id, naira: hub.cost });
    }
    result[pledge.id] = { placed: pledge.amountNaira - money, queued: money, hubs: count };
  }
  return {
    matches,
    pledges: result,
    waiting: byId.filter((hub) => hub.cost !== null && hub.cost > 0 && !funded.has(hub.id)).map((hub) => hub.id),
    notCosted: byId.filter((hub) => hub.cost === null || hub.cost <= 0).map((hub) => hub.id),
  };
}
