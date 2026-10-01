import type { DataSource } from "@/domain";

/* ==========================================================
   REPOSITORY PORTS — DATA SOURCES (PROVENANCE)

   Every record's `Provenance.sourceSystem` names one of these.
========================================================== */

export interface SourceRepository {
  listDataSources(): Promise<DataSource[]>;
}
