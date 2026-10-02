import type { DataSource, Provenance } from "@/domain";
import type { SourceRepository } from "../../repositories/ports/index.ts";

/* ==========================================================
   SERVICES — SOURCING

   Every service result says which data sources its records came
   from. A result is marked synthetic as soon as ANY record behind
   it comes from a source of kind "synthetic", and that marker must
   be shown wherever the result is displayed.
========================================================== */

export interface Sourcing {
  /** The sources of the records used, in id order. */
  sources: DataSource[];
  /** True when any record used comes from a synthetic demonstration dataset. */
  synthetic: boolean;
  /** Source ids named by records but not found among the registered sources. */
  unknownSources: string[];
}

/** A service result together with where its records came from. */
export interface Sourced<T> {
  result: T;
  sourcing: Sourcing;
}

/** Collects the source ids of the records a service used. */
export class SourceTrail {
  private readonly ids = new Set<string>();

  add(records: Iterable<{ provenance: Provenance }>): this {
    for (const record of records) this.ids.add(record.provenance.sourceSystem);
    return this;
  }

  /** Takes over the sources of a result that was built on other results. */
  addSourcing(sourcing: Sourcing): this {
    for (const source of sourcing.sources) this.ids.add(source.id);
    for (const id of sourcing.unknownSources) this.ids.add(id);
    return this;
  }

  async resolve(sources: SourceRepository): Promise<Sourcing> {
    const known = new Map((await sources.listDataSources()).map((source) => [source.id, source]));
    const ids = [...this.ids].sort();
    const used = ids.flatMap((id) => known.get(id) ?? []);
    return {
      sources: used,
      synthetic: used.some((source) => source.kind === "synthetic"),
      unknownSources: ids.filter((id) => !known.has(id)),
    };
  }
}
