import type { Customer, GenerationAsset, Meter, MinigridSite, Organization, ServicePoint } from "@/domain";
import type { SiteRegistrySnapshot } from "../../ports/index.ts";
import type { SiteDesign } from "./design.ts";
import { DEMO_PERIOD } from "../clock.ts";
import { demoProvenance } from "../sources.ts";
import { BATTERY_ASSET, GENERATOR_ASSET, MINIGRID_CURRENCY, MINIGRID_ORGANIZATION_ID, MINIGRID_ORGANIZATION_NAME, OUTPUT_METER, PV_ASSET, SITES, SITE_REGISTRY_SOURCE, connectionsOfSite, meterOf } from "./design.ts";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES: THE REGISTER

   The operator, its four sites, each site's PV array, battery,
   inverters and generator, the powerhouse meters, and every
   connection with its smart meter and account. Built from the
   design alone: it needs no simulated energy.

   Accounts carry no names. A site's location is invented: a point
   in a climatic zone, not a real community, and its record says so.
========================================================== */

const AUDIT = { createdAt: DEMO_PERIOD.start, updatedAt: DEMO_PERIOD.start };
const LOCATION_METHOD = "Invented location for a synthetic site: a point in a climatic zone, not a real community.";

function siteRecords(site: SiteDesign): { site: MinigridSite; assets: GenerationAsset[]; servicePoints: ServicePoint[]; meters: Meter[]; customers: Customer[] } {
  const provenance = demoProvenance(SITE_REGISTRY_SOURCE);
  const base = { ...AUDIT, siteId: site.id, lifecycle: "in_service" as const, commissionedAt: site.commissioned, provenance };
  const assets: GenerationAsset[] = [
    { ...base, id: PV_ASSET(site), kind: "solar_pv", name: `${site.name} PV array`, capacityKwp: site.pvKwp },
    { ...base, id: BATTERY_ASSET(site), kind: "battery", name: `${site.name} battery`, energyCapacityKwh: site.batteryKwh, powerKw: site.batteryKw, chemistry: "lithium_iron_phosphate" },
    { ...base, id: `${site.id}-INV-PV`, kind: "inverter", name: `${site.name} PV inverter`, ratingKva: site.pvKwp, role: "pv", servesAssetIds: [PV_ASSET(site)] },
    { ...base, id: `${site.id}-INV-BAT`, kind: "inverter", name: `${site.name} battery inverter`, ratingKva: site.batteryKw, role: "battery", servesAssetIds: [BATTERY_ASSET(site)] },
    ...(site.generator === null
      ? []
      : [{ ...base, id: GENERATOR_ASSET(site), kind: "generator" as const, name: `${site.name} diesel generator`, ratingKva: site.generator.kva, ratedPowerKw: site.generator.kw, fuel: "diesel" as const }]),
  ];
  const meter = (id: string, installation: Meter["installation"]): Meter => ({ ...AUDIT, id, serialNumber: `SYN-${id}`, meterType: "smart", phases: 3, installation, lifecycle: "in_service", provenance });
  const meters: Meter[] = [
    meter(meterOf(PV_ASSET(site)), { role: "generation", siteId: site.id, assetId: PV_ASSET(site) }),
    meter(meterOf(BATTERY_ASSET(site)), { role: "storage", siteId: site.id, assetId: BATTERY_ASSET(site) }),
    ...(site.generator === null ? [] : [meter(meterOf(GENERATOR_ASSET(site)), { role: "generation", siteId: site.id, assetId: GENERATOR_ASSET(site) })]),
    meter(OUTPUT_METER(site), { role: "site_output", siteId: site.id }),
  ];
  const servicePoints: ServicePoint[] = [];
  const customers: Customer[] = [];
  for (const connection of connectionsOfSite(site)) {
    servicePoints.push({ ...AUDIT, id: connection.servicePointId, supply: { kind: "site", siteId: site.id }, lifecycle: "in_service", provenance });
    meters.push({ ...meter(connection.meterId, { role: "service_point", servicePointId: connection.servicePointId }), phases: connection.group.productiveUse ? 3 : 1 });
    customers.push({
      ...AUDIT,
      id: connection.customerId,
      operatorOrganizationId: MINIGRID_ORGANIZATION_ID,
      accountNumber: connection.customerId.replace("C-", ""),
      servicePointId: connection.servicePointId,
      category: connection.group.category,
      paymentMode: connection.group.paymentMode,
      tariffTier: connection.group.tier,
      productiveUse: connection.group.productiveUse,
      accountStatus: connection.active ? "active" : "disconnected",
      provenance,
    });
  }
  return {
    site: {
      ...AUDIT,
      id: site.id,
      code: site.code,
      name: site.name,
      operatorOrganizationId: MINIGRID_ORGANIZATION_ID,
      gridConnection: "isolated",
      distributionVoltageKv: 0.4,
      location: { latitude: site.latitude, longitude: site.longitude },
      locationBasis: "unspecified",
      lifecycle: "in_service",
      commissionedAt: site.commissioned,
      provenance: demoProvenance(SITE_REGISTRY_SOURCE, site.id, LOCATION_METHOD),
    },
    assets,
    servicePoints,
    meters,
    customers,
  };
}

let built: SiteRegistrySnapshot | null = null;

export function buildMinigridRegistry(): SiteRegistrySnapshot {
  if (built !== null) return built;
  const operator: Organization = {
    ...AUDIT,
    id: MINIGRID_ORGANIZATION_ID,
    name: MINIGRID_ORGANIZATION_NAME,
    kind: "minigrid_operator",
    countryCode: "NG",
    timezone: "Africa/Lagos",
    currency: MINIGRID_CURRENCY,
    provenance: demoProvenance(SITE_REGISTRY_SOURCE),
  };
  const records = SITES.map(siteRecords);
  built = {
    organizations: [operator],
    sites: records.map((record) => record.site),
    generationAssets: records.flatMap((record) => record.assets),
    servicePoints: records.flatMap((record) => record.servicePoints),
    meters: records.flatMap((record) => record.meters),
    customers: records.flatMap((record) => record.customers),
  };
  return built;
}
