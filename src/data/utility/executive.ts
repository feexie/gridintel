import type {
  UtilityRegion,
  ExecutiveEvent,
} from "@/types/executive";

export const utilityRegions: UtilityRegion[] = [
  {
    id: "adamawa",
    name: "Adamawa",

    substations: 12,
    feeders: 48,
    transformers: 1240,

    customers: 145000,

    prepaidMeters: 92000,
    postpaidMeters: 53000,
    postpaidCustomers: 53000,

    revenueBilled: 820000000,
    revenueCollected: 710000000,

    collectionEfficiency: 86.6,

    technicalLosses: 9.4,
    commercialLosses: 7.8,
    atccLosses: 17.2,

    saidi: 14.2,
    saifi: 9.6,
  },

  {
    id: "borno",
    name: "Borno",

    substations: 16,
    feeders: 62,
    transformers: 1635,

    customers: 218000,

    prepaidMeters: 141000,
    postpaidMeters: 77000,
    postpaidCustomers: 77000,

    revenueBilled: 1200000000,
    revenueCollected: 1030000000,

    collectionEfficiency: 85.8,

    technicalLosses: 10.2,
    commercialLosses: 8.5,
    atccLosses: 18.7,

    saidi: 16.1,
    saifi: 10.4,
  },

  {
    id: "taraba",
    name: "Taraba",

    substations: 10,
    feeders: 36,
    transformers: 920,

    customers: 97000,

    prepaidMeters: 61000,
    postpaidMeters: 36000,
    postpaidCustomers: 36000,

    revenueBilled: 510000000,
    revenueCollected: 441000000,

    collectionEfficiency: 86.5,

    technicalLosses: 8.9,
    commercialLosses: 7.2,
    atccLosses: 16.1,

    saidi: 12.4,
    saifi: 8.1,
  },

  {
    id: "yobe",
    name: "Yobe",

    substations: 11,
    feeders: 41,
    transformers: 1015,

    customers: 112000,

    prepaidMeters: 71000,
    postpaidMeters: 41000,
    postpaidCustomers: 41000,

    revenueBilled: 620000000,
    revenueCollected: 542000000,

    collectionEfficiency: 87.4,

    technicalLosses: 9.1,
    commercialLosses: 7.4,
    atccLosses: 16.5,

    saidi: 13.1,
    saifi: 8.7,
  },
];

export const executiveEvents: ExecutiveEvent[] = [
  {
    id: "1",
    region: "Yobe",
    substation: "DTR",
    feeder: "Ali-Marami Feeder",
    status: "OUTAGE",
    timestamp: "09:35 AM",
    customersAffected: 25000,
  },

  {
    id: "2",
    region: "Adamawa",
    substation: "Jimeta",
    feeder: "Feeder 4",
    status: "RESTORED",
    timestamp: "10:02 AM",
    customersAffected: 12000,
  },
];
