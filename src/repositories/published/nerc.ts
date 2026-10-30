import type { BandTariff, Citation, DiscoId, PublishedInstallations, PublishedMetering, ReportedNationalMetering, ServiceBand } from "@/domain";
import type { PublishedFiguresRepository } from "../ports/published.ts";

/* Published metering figures for Nigeria, transcribed from the documents named in each citation
   (GEH sprint, 30 October 2026). Every figure is as the document states it. Nothing here is
   synthetic, and nothing is calculated: totals, rates and growth are worked out in analytics.

   NERC's quarterly reports give each DisCo's active and metered customers and the meters it
   installed. NERC's September 2026 tariff orders give each band's allowed residential tariff for
   the states NERC still regulates; a state with its own regulator sets its own tariffs. */

const Q2_2026 = "nerc-q2-2026";
const Q1_2026 = "nerc-q1-2026";
const THISDAY = "s5-thisday-2026-10-15";
const BRIEF = "b15-geh-brief";

const DISCO_ORDERS: Record<DiscoId, { code: string; file: string }> = {
  abuja: { code: "AEDC", file: "AEDC_HOLDCO_YSS_September_2026_088" },
  benin: { code: "BEDC", file: "BEDC_HOLDCO_YSS_September_2026_089" },
  enugu: { code: "EEDC", file: "EEDC_HOLDCO_YSS_September_2026_090" },
  eko: { code: "EKEDP", file: "EKEDP_HOLDCO_YSS_September_2026_091" },
  ibadan: { code: "IBEDC", file: "IBEDC_HOLDCO_YSS_September_2026_092" },
  ikeja: { code: "IE", file: "IE_HOLDCO_YSS_September_2026_093" },
  jos: { code: "JED", file: "JED_HOLDCO_YSS_September_2026_094" },
  kaduna: { code: "KAEDC", file: "KAEDC_HOLDCO_YSS_September_2026_095" },
  kano: { code: "KEDCO", file: "KEDCO_HOLDCO_YSS_Septmeber_2026_096" },
  port_harcourt: { code: "PHED", file: "PHED_HOLDCO_YSS_September_2026_097" },
  yola: { code: "YEDC", file: "YEDC_HOLDCO_YSS_September_2026_098" },
};

const orderCitation = (disco: DiscoId) => `nerc-myto-2026-09-${DISCO_ORDERS[disco].code.toLowerCase()}`;

export const NERC_CITATIONS: Citation[] = [
  {
    id: Q2_2026,
    title: "NERC, Second Quarter 2026 Report",
    url: "https://nerc.gov.ng/wp-content/uploads/2026/09/2026_Q2_Report.pdf",
    published: "2026-09-29",
    standing: "primary",
    locator: "Table 15, p. 56: metering progress as of 30 June 2026; Appendix IX, p. 76: meter installation for all frameworks",
  },
  {
    id: Q1_2026,
    title: "NERC, First Quarter 2026 Report",
    url: "https://nerc.gov.ng/wp-content/uploads/2026/07/2026_Q1-Report.pdf",
    published: "2026-07-02",
    standing: "primary",
    locator: "Table 18, p. 58: metering progress as of 31 March 2026",
  },
  {
    id: THISDAY,
    title: "ThisDay, \"NERC: Metering Rate Now 63.1%, 4.7m Customers Still Without Devices\", reporting NERC's metering factsheet of 14 October 2026",
    url: "https://www.thisdaylive.com/2026/10/15/nerc-metering-rate-now-63-1-4-7m-customers-still-without-devices/",
    published: "2026-10-15",
    standing: "secondary",
    locator: "Figures for August 2026, as reported; the factsheet itself was not found on nerc.gov.ng",
  },
  {
    id: BRIEF,
    title: "GEH Brief 15, \"Meter every customer\", citing NERC",
    url: null,
    published: null,
    standing: "secondary",
    locator: "Reference data: December 2025",
  },
  ...(Object.keys(DISCO_ORDERS) as DiscoId[]).map((disco) => ({
    id: orderCitation(disco),
    title: `NERC, ${DISCO_ORDERS[disco].code} MYTO September 2026 (supplementary order, effective 1 September 2026)`,
    url: `https://nerc.gov.ng/wp-content/uploads/2026/09/${DISCO_ORDERS[disco].file}.pdf`,
    published: "2026-09-02",
    standing: "primary" as const,
    locator: "Table 3, p. 7: approved allowed tariffs (N/kWh), non-MD classes, for the states NERC regulates in the franchise area",
  })),
];

const metering = (asOf: string, citationId: string, rows: [DiscoId, number, number, number][]): PublishedMetering[] =>
  rows.map(([disco, activeCustomers, meteredCustomers, meteringRatePercent]) => ({ disco, asOf, activeCustomers, meteredCustomers, meteringRatePercent, citationId }));

const METERING: PublishedMetering[] = [
  ...metering("2026-03-31", Q1_2026, [
    ["abuja", 1_371_518, 1_094_344, 79.79],
    ["benin", 1_098_270, 637_238, 58.02],
    ["eko", 666_679, 590_015, 88.5],
    ["enugu", 1_652_808, 853_227, 51.62],
    ["ibadan", 2_501_809, 1_316_122, 52.61],
    ["ikeja", 1_337_621, 1_176_543, 87.96],
    ["jos", 822_309, 284_332, 34.58],
    ["kaduna", 548_043, 199_642, 36.43],
    ["kano", 799_094, 282_756, 35.38],
    ["port_harcourt", 1_077_117, 720_241, 66.87],
    ["yola", 511_580, 169_619, 33.16],
  ]),
  ...metering("2026-06-30", Q2_2026, [
    ["abuja", 1_403_657, 1_142_283, 81.38],
    ["benin", 1_142_721, 697_207, 61.01],
    ["eko", 685_304, 607_877, 88.7],
    ["enugu", 1_676_095, 870_872, 51.96],
    ["ibadan", 2_536_676, 1_461_585, 57.62],
    ["ikeja", 1_347_218, 1_184_385, 87.91],
    ["jos", 828_737, 293_509, 35.42],
    ["kaduna", 555_389, 221_208, 39.83],
    ["kano", 806_043, 327_856, 40.67],
    ["port_harcourt", 1_094_057, 751_148, 68.66],
    ["yola", 513_589, 185_909, 36.2],
  ]),
];

const installed = (quarter: string, rows: [DiscoId, number][]): PublishedInstallations[] => rows.map(([disco, meters]) => ({ disco, quarter, meters, citationId: Q2_2026 }));

/* Appendix IX of the Q2 report; its Q1 column carries NERC's revision of Q1 (426,985, from 357,495). */
const INSTALLATIONS: PublishedInstallations[] = [
  ...installed("2026-Q1", [["abuja", 50_330], ["benin", 72_738], ["eko", 39_251], ["enugu", 6_118], ["ibadan", 91_992], ["ikeja", 46_330], ["jos", 27_074], ["kaduna", 12_592], ["kano", 26_554], ["port_harcourt", 41_795], ["yola", 12_211]]),
  ...installed("2026-Q2", [["abuja", 47_939], ["benin", 59_969], ["eko", 17_862], ["enugu", 17_645], ["ibadan", 102_090], ["ikeja", 7_842], ["jos", 9_177], ["kaduna", 21_566], ["kano", 18_983], ["port_harcourt", 30_907], ["yola", 16_290]]),
];

const NATIONAL: ReportedNationalMetering[] = [
  { asOf: "2026-10-15", period: "August 2026", meteringRatePercent: 63.1, activeCustomers: 12_750_000, meteredCustomers: 8_050_000, unmeteredCustomers: 4_704_224, citationId: THISDAY },
  { asOf: "2025-12-31", period: "December 2025", meteringRatePercent: 57.27, activeCustomers: 12_160_000, meteredCustomers: 6_970_000, unmeteredCustomers: null, citationId: BRIEF },
];

/* Table 3 of each order: the non-MD class of each band. Band A is N209.50 in every order. YEDC's
   table lists no Band E. */
const BANDS: ServiceBand[] = ["A", "B", "C", "D", "E"];
const TARIFF_ROWS: Record<DiscoId, (number | null)[]> = {
  abuja: [209.5, 63.35, 51.79, 33.95, 32.88],
  benin: [209.5, 68.56, 56.91, 41.2, 41.21],
  enugu: [209.5, 66.47, 53.78, 36.49, 36.2],
  eko: [209.5, 61.0, 48.53, 32.48, 32.44],
  ibadan: [209.5, 67.25, 56.4, 32.44, 32.26],
  ikeja: [209.5, 62.48, 45.8, 31.24, 31.24],
  jos: [209.5, 63.26, 52.83, 40.12, 39.9],
  kaduna: [209.5, 62.63, 51.12, 35.41, 35.41],
  kano: [209.5, 65.29, 47.57, 32.02, 31.88],
  port_harcourt: [209.5, 68.96, 56.38, 39.67, 39.44],
  yola: [209.5, 63.33, 52.51, 50.01, null],
};
const TARIFFS: BandTariff[] = (Object.keys(TARIFF_ROWS) as DiscoId[]).flatMap((disco) =>
  BANDS.map((band, index) => ({ disco, band, nairaPerKwh: TARIFF_ROWS[disco][index], effective: "2026-09-01", citationId: orderCitation(disco) })),
);

export function nercPublishedFigures(): PublishedFiguresRepository {
  return {
    citations: async () => NERC_CITATIONS,
    metering: async () => METERING,
    installations: async () => INSTALLATIONS,
    nationalReports: async () => NATIONAL,
    residentialTariffs: async () => TARIFFS,
  };
}
