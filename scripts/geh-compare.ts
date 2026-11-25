/* Compares the GEH key figures with a baseline, figure by figure (Phase NAV-B, Founder,
   25 November 2026): `npm run geh:figures` regenerates docs/geh/KEY-FIGURES.md from the
   services; this reads every figure row (screen, figure, wording, value, origin, source) from
   the new file and from the baseline, and lists any difference. The stamp line is not a figure
   and is ignored. The committed file is restored afterwards, so the stamp never changes.

     node scripts/geh-compare.ts [baseline-commit] [--list out.tsv]

   The baseline defaults to the commit NAV-B started from. Exits 1 on any difference. */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const listAt = args.indexOf("--list");
const listFile = listAt >= 0 ? args[listAt + 1] : null;
const baseline = args.find((arg, index) => !arg.startsWith("--") && index !== listAt + 1) ?? "8445269";
const FILE = "docs/geh/KEY-FIGURES.md";

const rowsOf = (text: string) => text.split(/\r?\n/).filter((line) => line.startsWith("| ") && !line.startsWith("| Screen |") && !line.startsWith("| --- |"));

const before = rowsOf(execFileSync("git", ["show", `${baseline}:${FILE}`], { encoding: "utf8" }));
const committed = readFileSync(FILE, "utf8");
execFileSync(process.execPath, ["scripts/geh-key-figures.ts"], { stdio: "ignore" });
const after = rowsOf(readFileSync(FILE, "utf8"));
writeFileSync(FILE, committed);

const missing = before.filter((row) => !after.includes(row));
const added = after.filter((row) => !before.includes(row));
const reordered = missing.length === 0 && added.length === 0 && before.some((row, index) => after[index] !== row);
if (listFile) writeFileSync(listFile, after.map((row) => row.slice(2, -2).split(" | ").join("\t")).join("\n") + "\n");

console.log(`Baseline ${baseline}: ${before.length} figures. Now: ${after.length} figures.`);
console.log(`Identical (value, wording, origin and source): ${after.filter((row) => before.includes(row)).length}.`);
if (missing.length + added.length === 0 && !reordered) {
  console.log("No difference.");
} else {
  for (const row of missing) console.log(`- ${row}`);
  for (const row of added) console.log(`+ ${row}`);
  if (reordered) console.log("The same figures in a different order.");
  process.exit(1);
}
