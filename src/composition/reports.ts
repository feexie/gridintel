import type { ReportId } from "../constants/navigation.ts";
import type { OperationsRuntime } from "../services/operations/levels.ts";
import type { ReportBody } from "../services/reports/body.ts";
import type { ReportDocumentView } from "../services/reports/views.ts";
import { REPORTS } from "../constants/navigation.ts";
import { createMemoryCache } from "../services/analytics/cache.ts";
import { REPORT_DEFINITIONS } from "../services/reports/catalogue.ts";
import { complianceReport } from "../services/reports/compliance.ts";
import { reportCsv } from "../services/reports/csv.ts";
import { SAMPLE_LABEL, identitySeed, methodsUsed, reportDocument, reportIdOf, sampleNotice } from "../services/reports/document.ts";
import { availability, coverageLabel, defaultPeriodKey, parsePeriod, periodChoices, type ReportCoverage } from "../services/reports/period.ts";
import { reliabilityReport } from "../services/reports/reliability.ts";
import { recordingRepositories, sha256 } from "./fingerprint.ts";
import { getClock, getDataNotice, getMinigridRuntime, getRuntime } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — REPORTS (ADR 0019)

   A report is built from the same services as the screens, for the
   period it names, on:
   - the repositories the screens use, wrapped so that every result
     they return is digested (fingerprint.ts), and
   - a result cache of its own, so that every record it uses is read
     and digested rather than served from the screens' cache.
   The finished document is then kept in the process's cache, so a
   page, its PDF and its CSV are the same report with the same ID and
   generation time.

   A period the data does not wholly cover is answered with a
   document that says so and holds no figure. Nothing is read for it.
========================================================== */

type BuiltReport = "reliability" | "compliance";

const BUILDERS: Record<BuiltReport, { runtime: () => OperationsRuntime; build: (runtime: OperationsRuntime, offset: string) => Promise<ReportBody> }> = {
  reliability: { runtime: getRuntime, build: reliabilityReport },
  compliance: { runtime: getMinigridRuntime, build: complianceReport },
};

function isBuilt(id: string): id is BuiltReport {
  return id in BUILDERS;
}

/** What the data covers. The demonstration dataset: September 2026, in West Africa Time. */
export function reportCoverage(): ReportCoverage {
  const { reportingPeriod } = getClock();
  const offset = /([+-]\d{2}:\d{2}|Z)$/.exec(reportingPeriod.start)?.[1] ?? "Z";
  return { start: reportingPeriod.start, end: reportingPeriod.end, offset: offset === "Z" ? "+00:00" : offset };
}

/** A built report in the catalogue; undefined for a planned one or an unknown id. */
function itemOf(id: string) {
  return REPORTS.find((item) => item.id === id && !item.planned);
}

async function build(id: BuiltReport, periodKey: string): Promise<ReportDocumentView | null> {
  const item = itemOf(id);
  const coverage = reportCoverage();
  const period = parsePeriod(periodKey, coverage.offset);
  if (item === undefined || period === null) return null;
  const definition = REPORT_DEFINITIONS[id];
  const notice = getDataNotice();
  const sample = notice === null ? null : sampleNotice(notice.summary);
  const periods = periodChoices(coverage);
  const covered = availability(period, coverage);
  if (!covered.available) return reportDocument({ item, definition, period, periods, sample, built: null, unavailable: covered.reason });

  const base = BUILDERS[id].runtime();
  const recording = recordingRepositories(base.repos);
  // "Now" for the report is the end of its period: a day's report is as of that day's end.
  const runtime: OperationsRuntime = { ...base, repos: recording.repos, period: { start: period.start, end: period.end }, now: period.end, cache: createMemoryCache() };
  const body = await BUILDERS[id].build(runtime, coverage.offset);
  const methods = methodsUsed(body);
  const dataFingerprint = recording.fingerprint();
  const reportId = reportIdOf(definition, period, sha256(identitySeed(definition, period, methods, dataFingerprint)));
  return reportDocument({
    item,
    definition,
    period,
    periods,
    sample,
    built: { body, reportId, generatedAt: new Date().toISOString(), dataAsOf: period.end, dataFingerprint, methods },
    unavailable: null,
  });
}

/** One report for one period, built once while the cache is valid. null for an unknown report or an address that names no period. */
function document(id: string, periodKey: string): Promise<ReportDocumentView | null> {
  if (!isBuilt(id)) return Promise.resolve(null);
  return BUILDERS[id].runtime().cache!.get(`report:${id}|${periodKey}`, () => build(id, periodKey));
}

export const reports = {
  document,
  /** The report's figures as CSV; null where `document` is null. */
  csv: async (id: string, periodKey: string): Promise<{ fileName: string; body: string } | null> => {
    const view = await document(id, periodKey);
    return view === null ? null : { fileName: view.csvFileName, body: reportCsv(view) };
  },
  /** The period a report opens on. */
  defaultPeriod: (): string => defaultPeriodKey(getClock().reportingPeriod.start),
  /** Every period a report can be asked for, for building its pages ahead of time: those covered and those that are not. */
  periodKeys: (): string[] => {
    const choices = periodChoices(reportCoverage());
    return [...choices.days, ...choices.months, ...choices.years].map((choice) => choice.period.key);
  },
  /** The ids of the built reports of a sector. */
  built: (sector: "utility" | "minigrid"): ReportId[] => REPORTS.filter((item) => item.sector === sector && !item.planned).map((item) => item.id),
  coverage: reportCoverage,
  /** What the data covers, in words: "1 September 2026 to 30 September 2026". */
  coverageWords: (): string => coverageLabel(reportCoverage()),
  /** The label every report carries while the data is synthetic; null for real data. */
  sampleLabel: (): string | null => (getDataNotice() === null ? null : SAMPLE_LABEL),
};
