import type { Alarm, AlarmKind, AssetRef, Severity } from "@/domain";
import { HOUR_MS, MINUTE_MS, at, wat } from "./clock.ts";
import { FEEDERS, QUIET_MONITOR, SUBSTATIONS, incomerOf } from "./network.ts";
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
   - A feeder fault raises the alarm of the protection that operated:
     an overcurrent trip or an earth-fault trip.
   - No alarm is raised for a transformer loaded above its rating.
     The synthetic source systems have no such alarm, which is the
     realistic case and is why GridIntel derives that condition. So
     DT-OLD-2 and DT-GOV-3 are derived conditions no source alarm
     raised.

   COMMUNICATIONS FAILURES. The SCADA front end polls every remote
   unit, the substation RTUs and the transformer monitors alike, and
   raises one alarm for any that misses two consecutive polls:

   - the monitor that stopped reporting (DT-OLD-3) is alarmed two
     polls after its last check-in and is still standing at the demo
     clock. GridIntel derives "monitor quiet" for the same device
     from the heartbeats, so here a source alarm and a derived
     condition agree;
   - Riverside's RTU lost its link for 33 minutes on 12 September,
     between two hourly readings, so no reading was missed. It is
     cleared. No derived condition stands beside it: the rule tests
     the as-of time only.

   Each alarm carries its canonical kind, mapped here from the code,
   as an adapter for a real alarm list would map it. The alarm that
   was entered by hand has a code that is not mapped, and no kind.

   Three alarms are not tied to an interruption or to communications,
   to exercise the states a list must show: one still active and
   unacknowledged at the demo clock, one active and acknowledged, and
   one whose raise time the source did not record.
========================================================== */

/** The source's alarm codes this adapter knows, and the kind each is. A code not listed here has no kind. */
const KIND_OF_CODE: Record<string, AlarmKind> = {
  "INCOMER-UV": "loss_of_supply",
  "DT-LV-LOSS": "loss_of_supply",
  "FDR-OC-TRIP": "overcurrent_trip",
  "FDR-EF-TRIP": "earth_fault_trip",
  "RTU-COMMS-FAIL": "communications_failure",
  "DC-SUPPLY-LOW": "equipment",
  "PT-OIL-TEMP-HIGH": "equipment",
};

/** The front end polls hourly and alarms on the second poll in a row that goes unanswered. */
const POLLS_MISSED_BEFORE_ALARM = 2;

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
      if (window.endMs - window.startMs <= 5 * MINUTE_MS) {
        return { code: "FDR-OC-TRIP", severity: "medium", message: "11 kV feeder breaker tripped on overcurrent; auto-reclose successful.", subject: { kind: "feeder", id: origin.id } };
      }
      // A cable fault between phases operates the overcurrent relay; a conductor on the ground, the earth-fault relay.
      return window.id.includes("FD-GOV")
        ? { code: "FDR-OC-TRIP", severity: "high", message: "11 kV feeder breaker tripped on overcurrent (phase fault) and locked out.", subject: { kind: "feeder", id: origin.id } }
        : { code: "FDR-EF-TRIP", severity: "high", message: "11 kV feeder breaker tripped on earth fault and locked out.", subject: { kind: "feeder", id: origin.id } };
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
  const alarms: Omit<Alarm, "kind">[] = [];
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

  const lastCheckIn = at(QUIET_MONITOR.lastCheckIn.day, QUIET_MONITOR.lastCheckIn.hour, QUIET_MONITOR.lastCheckIn.minute);
  const quietRaised = lastCheckIn + POLLS_MISSED_BEFORE_ALARM * HOUR_MS;
  alarms.push(
    {
      // The monitor GridIntel finds quiet from its heartbeats: the source alarm and the derived condition agree.
      id: "ALM-2026-09-30-ED-DT-OLD-3-COMMS",
      subject: { kind: "edge_device", id: QUIET_MONITOR.deviceId },
      code: "RTU-COMMS-FAIL",
      severity: "medium",
      message: `Communications failure: remote unit SYN-DTM-OLD3 (transformer monitor) has not answered ${POLLS_MISSED_BEFORE_ALARM} consecutive polls.`,
      raisedAt: wat(quietRaised),
      acknowledgedAt: wat(quietRaised + 25 * MINUTE_MS),
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, "ALM-2026-09-30-ED-DT-OLD-3-COMMS"),
    },
    {
      // A link that dropped and came back between two hourly readings. Cleared; nothing derived stands beside it.
      id: "ALM-2026-09-12-ED-SS-RIV-COMMS",
      subject: { kind: "edge_device", id: "ED-SS-RIV" },
      code: "RTU-COMMS-FAIL",
      severity: "high",
      message: "Communications failure: substation RTU SYN-RTU-RIV not answering polls. Telemetry and remote control unavailable.",
      raisedAt: wat(at(11, 10, 8)),
      clearedAt: wat(at(11, 10, 41)),
      acknowledgedAt: wat(at(11, 10, 11)),
      quality: "measured",
      provenance: demoProvenance(ALARM_SOURCE, "ALM-2026-09-12-ED-SS-RIV-COMMS"),
    },
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

  return alarms
    .map((alarm): Alarm => {
      const kind = KIND_OF_CODE[alarm.code];
      return kind === undefined ? alarm : { ...alarm, kind };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
