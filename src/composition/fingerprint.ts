import { createHash } from "node:crypto";
import type { GridIntelRepositories } from "../repositories/ports/index.ts";

/* ==========================================================
   COMPOSITION — WHAT A REPORT WAS BUILT FROM

   A report carries a fingerprint of the data it used, so that it can
   be reproduced and audited (ADR 0019). The repositories it is built
   on are wrapped so that every result they return is digested as it
   passes: nothing is changed, filtered or held back.

   The fingerprint is the SHA-256 of the sorted, distinct SHA-256
   digests of those results, each written as JSON with its keys in
   order. Sorting makes it independent of the order the services ask
   in; the same records give the same fingerprint, and a changed,
   added or removed record gives another.

   A result is digested only when a repository is asked for it, so the
   report must be built on a cache of its own: a result served from
   the process's cache was never read and would be missing.
========================================================== */

/** JSON with every object's keys in order; a Map as its entries, a Set as its values. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, function (_key, item: unknown) {
    if (item instanceof Map) return [...item.entries()];
    if (item instanceof Set) return [...item.values()];
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
    }
    return item;
  });
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * The canonical JSON of an object or array, made once per object and kept: a report reads the
 * same records many times (once for every scope), and each is written once. Keyed by the object
 * itself, so it lasts only as long as the records do.
 */
export type CanonicalMemo = WeakMap<object, string>;

/** Exactly `canonicalJson(value)`, with every object and array written once per memo. */
export function canonicalText(value: unknown, memo: CanonicalMemo = new WeakMap()): string | undefined {
  // undefined when JSON leaves the value out (undefined, a function, a symbol), as JSON.stringify does.
  const write = (item: unknown): string | undefined => {
    if (item !== null && typeof item === "object" && typeof (item as { toJSON?: unknown }).toJSON === "function") item = (item as { toJSON: () => unknown }).toJSON();
    if (item === undefined || typeof item === "function" || typeof item === "symbol") return undefined;
    if (item === null || typeof item !== "object") return JSON.stringify(item) ?? "null";
    const known = memo.get(item);
    if (known !== undefined) return known;
    let text: string;
    if (item instanceof Map) text = write([...item.entries()])!;
    else if (item instanceof Set) text = write([...item.values()])!;
    else if (Array.isArray(item)) text = `[${item.map((child) => write(child) ?? "null").join(",")}]`;
    else {
      const record = item as Record<string, unknown>;
      const fields: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const child = write(record[key]);
        if (child !== undefined) fields.push(`${JSON.stringify(key)}:${child}`);
      }
      text = `{${fields.join(",")}}`;
    }
    memo.set(item, text);
    return text;
  };
  return write(value);
}

export interface RecordingRepositories {
  repos: GridIntelRepositories;
  /** The fingerprint of everything returned so far. */
  fingerprint(): string;
  /** How many distinct results were returned. */
  size(): number;
}

export function recordingRepositories(repos: GridIntelRepositories): RecordingRepositories {
  const digests = new Set<string>();
  const memo: CanonicalMemo = new WeakMap();
  // The repositories answer the same query with the same records while a report is built, so a
  // query asked again is not digested again: its result is already in the set.
  const asked = new Set<string>();
  const record = (query: string) => (value: unknown) => {
    if (!asked.has(query)) {
      asked.add(query);
      digests.add(sha256(canonicalText(value, memo) ?? "undefined"));
    }
    return value;
  };
  const wrapped = Object.fromEntries(
    Object.entries(repos).map(([name, port]) => [
      name,
      Object.fromEntries(
        Object.entries(port as Record<string, unknown>).map(([method, fn]) => [
          method,
          typeof fn !== "function"
            ? fn
            : (...args: unknown[]) => {
                const result = (fn as (...a: unknown[]) => unknown).apply(port, args);
                const digest = record(`${name}.${method}${canonicalText(args, memo)}`);
                return result instanceof Promise ? result.then(digest) : digest(result);
              },
        ]),
      ),
    ]),
  ) as unknown as GridIntelRepositories;
  return {
    repos: wrapped,
    fingerprint: () => sha256([...digests].sort().join("\n")),
    size: () => digests.size,
  };
}
