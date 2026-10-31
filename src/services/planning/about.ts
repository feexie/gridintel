import type { SprintRecordRepository } from "../../repositories/ports/sprint.ts";
import type { AboutBuildView } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: ABOUT THIS BUILD (M4)

   What existed at the baseline and what the sprint added, read from
   the sprint changelog (docs/geh/CHANGELOG-GEH.md): its "At the
   baseline" list and its table of commits, each with its time. A row
   that cannot be read is counted, not dropped.
========================================================== */

export const REPOSITORY_URL = "https://github.com/feexie/gridintel";
export const COMPARE_URL = `${REPOSITORY_URL}/compare/geh-baseline...geh-sprint`;

const ROW = /^\|\s*([^|]+?)\s*\|\s*`([0-9a-f]{7,40})`\s*\|\s*(.+?)\s*\|\s*$/;

export function readChangelog(text: string | null): AboutBuildView {
  const lines = (text ?? "").split(/\r?\n/);
  const baselineAt = lines.findIndex((line) => /^##\s+At the baseline/.test(line));
  const summary: string[] = [];
  if (baselineAt !== -1) {
    for (const line of lines.slice(baselineAt + 1)) {
      if (/^##\s/.test(line) || line.startsWith("|")) break;
      const bullet = /^-\s+(.*)$/.exec(line.trim());
      if (bullet) summary.push(bullet[1]);
    }
  }
  const tableLines = lines.filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line) && !/^\|\s*Time/.test(line));
  const rows = tableLines.flatMap((line) => {
    const match = ROW.exec(line);
    return match ? [{ time: match[1], commit: match[2], commitUrl: `${REPOSITORY_URL}/commit/${match[2]}`, what: match[3].replace(/`/g, "") }] : [];
  });
  return {
    baseline: { tag: "geh-baseline", commit: "839c5d9", time: "Friday 30 October 2026, 15:45 WAT", summary },
    sprint: { window: "Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026, 18:00 WAT", branch: "geh-sprint", compareUrl: COMPARE_URL },
    rows,
    unread: text === null ? 0 : tableLines.length - rows.length,
    how: text === null ? "The sprint changelog could not be read on this deployment. Every change is in the comparison on GitHub." : "Read from docs/geh/CHANGELOG-GEH.md in the repository: one row per commit, written as each was made. The comparison on GitHub shows every line changed since the baseline tag.",
  };
}

export async function aboutBuildView(record: SprintRecordRepository): Promise<AboutBuildView> {
  return readChangelog(await record.changelog());
}
