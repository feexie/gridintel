import type { Alarm, AssetRef, Severity } from "@/domain";
import { MINUTE_MS, at, wat } from "./clock.ts";
import { FEEDERS, SUBSTATIONS, incomerOf } from "./network.ts";
import { INTERRUPTION_WINDOWS } from "./outages.ts";
import { ALARM_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — ALARMS FROM SOURCE SYSTEMS

   The alarm list a utility's own systems would hold: what the
   substation relays, the remote terminal units and the transformer
   monitors raised. These are records from a source system. They are
   NOT the conditions GridIntel derives from telemetry (loading above
   rating, a monitor gone quiet): those are calculated, are never
   written here, and are shown apart from these.

   The list is built from the interruptions already designed, so the
   alarm list and the outage log agree: each unplanned interruption
   that protection or a monitor would see raises one alarm, at the
   moment supply was lost, cleared when the last part was restored.

   - Load shedding raises no alarm: the feeder is opened on purpose.
   - Planned maintenance raises none: the system is told beforehand.
   - No alarm is raised for a transformer loaded above its rating.
     The synthetic source systems have no such alarm, which is the
     realistic case and is why GridIntel derives that condition.
   - No alarm is raised for the monitor that stopped reporting
     (DT-OLD-3): the head-end it reports to does not alarm on
     silence. GridIntel derives that condition too.

   Three alarms are not tied to an interruption, to exercise the
   states a list must show: one still active and unacknowledged at
   the demo clock, one active and acknowledged, and one whose raise
   time the source did not record.
========================================================== */

interface AlarmPlan {
  code: string;
  severity: Severity;
  message: string;
  subject: AssetRef;
}

const HILLCREST = SUBSTATIONS.find((substation) => substation.id === "SS-HIL") as (typeof SUBSTATIONS)[number];
const FARM_ROAD = FEEDERS.find((feeder) => feeder.id === "FD-FRM") as (typeof FEEDERS)[number];
const RURAL_INCOMER = incomerOf(FARM_ROAD);

/** What a source system would raise for an interruption that began here; null when it would raise nothing. */
function planFor(window: (typeof INTERRUPTION_WINDOWS)[number]): AlarmPlan | null {
  if (window.planned) return null;
  const origin = window.origin;
  switch (window.originPoint) {
    case "transmission_station":
    case "subtransmission_line": {
      // The substation sees only that its 33 kV supply has gone, whichever end the cause was at.
      const riverside = window.id.includes("SS-RIV");
      return {
        code: "INCOMER-UV",
        severity: riverside ? "critical" : "high",
        message: riverside
          ? "33 kV incomer: loss of voltage. All 11 kV feeders de-energised."
          : `33 kV incomer 2 (${RURAL_INCOMER.line}): loss of voltage. Bus section ${RURAL_INCOMER.busSection} de-energised.`,
        subject: { kind: "substation", id: riverside ? "SS-RIV" : HILLCREST.id },
      };
    }
    case "mv_feeder":
      if (!("id" in origin)) return null;
      return window.endMs - window.startMs <= 5 * MINUTE_MS
        ? { code: "FDR-TRIP-RECLOSE", severity: "medium", message: "11 kV feeder breaker tripped on overcurrent; auto-reclose successful.", subject: { kind: "feeder", id: origin.id } }
        : { code: "FDR-TRIP-LOCKOUT", severity: "high", message: "11 kV feeder breaker tripped on earth fault and locked out.", subject: { kind: "feeder", id: origin.id } };
    case "distribution_transformer":
    case "lv_network":
      if (!("id" in origin)) return null;
      return {
        code: "DT-LV-LOSS",
        severity: "medium",
        message: "Transformer monitor: loss of low-voltage supply on all phases.",
        subject: { kind: "distribution_transformer", id: origin.id },
      };
    case "grid":
      return null;
  }
}

export function buildDemoAlarms(): Alarm[] {
  const alarms: Alarm[] = [];
  for (const window of INTERRUPTION_WINDOWS) {
    const plan = planFor(window);
    if (plan === null) continue;
    const id = window.id.replace(/^OUT-/, "ALM-");
    alarms.push({
      id,
      subject: plan.subject,
      code: plan.code,
      severity: plan.severity,
      message: plan.message,
      raisedAt: wat(window.startMs),
      clearedAt: wat(window.endMs),
      // Acknowledged by the control room a few minutes after it was raised.
      acknowledgedAt: wat(window.startMs + 4 * MINUTE_MS),
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, id),
    });
  }

  alarms.push(
    {
      // Still standing at the demo clock, and nobody has acknowledged it.
      id: "ALM-2026-09-30-SS-HIL-DC",
      subject: { kind: "substation", id: "SS-HIL" },
      code: "DC-SUPPLY-LOW",
      severity: "high",
      message: "110 V DC supply low: battery charger failure. Protection will run on the battery alone.",
      raisedAt: wat(at(29, 21, 40)),
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, "ALM-2026-09-30-SS-HIL-DC"),
    },
    {
      // Standing for four days, acknowledged, not yet cleared.
      id: "ALM-2026-09-26-PT-RIV-1-OIL",
      subject: { kind: "power_transformer", id: "PT-RIV-1" },
      code: "PT-OIL-TEMP-HIGH",
      severity: "medium",
      message: "Power transformer top-oil temperature above its alarm setting.",
      raisedAt: wat(at(25, 20, 5)),
      acknowledgedAt: wat(at(25, 20, 12)),
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, "ALM-2026-09-26-PT-RIV-1-OIL"),
    },
    {
      // Entered by hand with no time. Whether it is active cannot be told, and is not assumed.
      id: "ALM-SS-RIV-DOOR",
      subject: { kind: "substation", id: "SS-RIV" },
      code: "DOOR-OPEN",
      severity: "low",
      message: "Control room door contact open.",
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, "ALM-SS-RIV-DOOR", "Entered by hand in the alarm log, with no time recorded."),
    },
  );

  return alarms.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
