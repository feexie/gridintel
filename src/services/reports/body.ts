import type { MetricView, SourcingView } from "../operations/views.ts";
import type { ReportSection } from "./views.ts";

/** What a report's builder returns: its figures and sections, before the envelope (document.ts) is put round them. */
export interface ReportBody {
  organization: string | null;
  summary: MetricView[];
  summaryNotes: string[];
  sections: ReportSection[];
  sourcing: SourcingView;
}
