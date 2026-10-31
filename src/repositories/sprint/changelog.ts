import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SprintRecordRepository } from "../ports/sprint.ts";

/* The sprint changelog, read from the repository's docs. The file is traced into the deployment
   (next.config.ts); if it is still not there, the record is null, never an empty list. */
export function sprintChangelog(root = process.cwd()): SprintRecordRepository {
  return {
    changelog: async () => {
      try {
        return await readFile(join(root, "docs", "geh", "CHANGELOG-GEH.md"), "utf8");
      } catch {
        return null;
      }
    },
  };
}
