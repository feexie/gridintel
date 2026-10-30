import type { BandTariff, Citation, PublicMeteringProgramme, PublishedInstallations, PublishedMetering, ReportedNationalMetering } from "@/domain";

/* Figures published by a regulator or reported in the press, for the Metering planner
   (docs/geh/DESIGN.md). Each record names the citation it was taken from. The adapter returns
   them as published; it never totals, averages or picks a latest one. */
export interface PublishedFiguresRepository {
  citations(): Promise<Citation[]>;
  /** Each DisCo's metering at each date a document gives it. */
  metering(): Promise<PublishedMetering[]>;
  /** Meters each DisCo installed in each quarter a document gives. */
  installations(): Promise<PublishedInstallations[]>;
  /** National figures reported without a DisCo breakdown. */
  nationalReports(): Promise<ReportedNationalMetering[]>;
  /** The allowed residential tariff of each band of each DisCo. */
  residentialTariffs(): Promise<BandTariff[]>;
  /** Public metering programmes, as reported. */
  programmes(): Promise<PublicMeteringProgramme[]>;
}
