/* The record of the Global Energy Hackathon sprint, as the repository keeps it
   (docs/geh/CHANGELOG-GEH.md). The adapter returns the text as written, or null when it cannot be
   read on this deployment. */
export interface SprintRecordRepository {
  changelog(): Promise<string | null>;
}
