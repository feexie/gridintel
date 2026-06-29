import { substations } from "@/data/utility/substations";
import { feeders } from "@/data/utility/feeders";
import { transformers } from "@/data/utility/transformers";
import { meters } from "@/data/utility/meters";

export function getUtilityMetrics() {
  const totalSubstations =
    substations.length;

  const totalFeeders =
    feeders.length;

  const totalTransformers =
    transformers.length;

  const totalMeters =
    meters.length;

  const totalCustomers =
    feeders.reduce(
      (sum, feeder) =>
        sum + feeder.customers,
      0
    );

  const totalFeederLoad =
    feeders.reduce(
      (sum, feeder) =>
        sum + feeder.loadMw,
      0
    );

  const averageTransformerLoading =
    transformers.length > 0
      ? transformers.reduce(
          (sum, transformer) =>
            sum +
            transformer.loadPercent,
          0
        ) / transformers.length
      : 0;

  const onlineAssets =
    [
      ...substations,
      ...feeders,
      ...transformers,
      ...meters,
    ].filter(
      (asset) =>
        asset.status === "online"
    ).length;

  const warningAssets =
    [
      ...substations,
      ...feeders,
      ...transformers,
      ...meters,
    ].filter(
      (asset) =>
        asset.status === "warning"
    ).length;

  const offlineAssets =
    [
      ...substations,
      ...feeders,
      ...transformers,
      ...meters,
    ].filter(
      (asset) =>
        asset.status === "offline"
    ).length;

  return {
    totalSubstations,
    totalFeeders,
    totalTransformers,
    totalMeters,

    totalCustomers,

    totalFeederLoad:
      Number(
        totalFeederLoad.toFixed(1)
      ),

    averageTransformerLoading:
      Number(
        averageTransformerLoading.toFixed(
          1
        )
      ),

    onlineAssets,
    warningAssets,
    offlineAssets,
  };
}
