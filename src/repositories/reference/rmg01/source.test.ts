import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/* The vendored dataset is kept byte for byte: every file's SHA-256 must match SOURCE.md, and
   SOURCE.md must list every file in the folder. A changed, added or missing file fails here. */
const HERE = import.meta.dirname;
const DATA = join(HERE, "data");

function listed(): Map<string, string> {
  const source = readFileSync(join(HERE, "SOURCE.md"), "utf8");
  const rows = [...source.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/gm)];
  return new Map(rows.map((row) => [row[1], row[2]]));
}

describe("the vendored RMG01 dataset (v1.0.2, bd9dea2)", () => {
  const table = listed();

  it("lists the 20 CSVs, the licence, the citation and the dataset's README", () => {
    assert.equal(table.size, 23);
    assert.equal([...table.keys()].filter((file) => file.endsWith(".csv")).length, 20);
    for (const file of ["LICENSE", "CITATION.cff", "README.md"]) assert.ok(table.has(file), file);
  });

  it("holds exactly the listed files", () => {
    assert.deepEqual(readdirSync(DATA).sort(), [...table.keys()].sort());
  });

  it("matches every listed SHA-256", () => {
    for (const [file, sha] of table) {
      const actual = createHash("sha256").update(readFileSync(join(DATA, file))).digest("hex");
      assert.equal(actual, sha, file);
    }
  });

  it("is licensed CC BY 4.0", () => {
    assert.match(readFileSync(join(DATA, "LICENSE"), "utf8"), /Attribution 4\.0 International/);
    assert.match(readFileSync(join(DATA, "CITATION.cff"), "utf8"), /license: CC-BY-4\.0/);
  });
});
