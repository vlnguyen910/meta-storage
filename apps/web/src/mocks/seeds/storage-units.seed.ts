import { StorageUnitStatus } from "@metastorage/contracts";
import type { MockStorageUnit } from "../types";
import { facilitySeeds } from "./facilities.seed";

const unitTemplates = [
  ["Kho tiêu chuẩn", "2 m²", 2, 900_000],
  ["Kho tiêu chuẩn", "2 m²", 2, 900_000],
  ["Kho tiêu chuẩn", "4 m²", 4, 1_500_000],
  ["Kho tiêu chuẩn", "4 m²", 4, 1_500_000],
  ["Kho tiêu chuẩn", "6 m²", 6, 2_100_000],
  ["Kho tiêu chuẩn", "6 m²", 6, 2_100_000],
  ["Kho kiểm soát ẩm", "4 m²", 4, 1_900_000],
  ["Kho kiểm soát ẩm", "4 m²", 4, 1_900_000],
] as const;

const unavailableStatuses = [
  StorageUnitStatus.OCCUPIED,
  StorageUnitStatus.MAINTENANCE,
  StorageUnitStatus.INSPECTION,
];

function unitTypeIdFor(facilityIndex: number, unitType: string, sizeLabel: string): string {
  const templateIndex = unitTemplates.findIndex(
    ([candidateType, candidateSize]) => candidateType === unitType && candidateSize === sizeLabel,
  );
  return `00000000-0000-0000-${String(facilityIndex + 1).padStart(4, "0")}-${String(
    templateIndex + 1,
  ).padStart(12, "0")}`;
}

export const storageUnitSeeds: MockStorageUnit[] = facilitySeeds.flatMap(
  (facility, facilityIndex) =>
    unitTemplates.map(([unitType, sizeLabel, sizeSqm, basePrice], index) => ({
      id: `${facility.code.toLowerCase()}-unit-${index + 1}`,
      facilityId: facility.id,
      unitTypeId: unitTypeIdFor(facilityIndex, unitType, sizeLabel),
      code: `${facility.code}-${String(index + 1).padStart(3, "0")}`,
      unitType,
      sizeLabel,
      sizeSqm,
      monthlyPrice: basePrice - facilityIndex * 75_000,
      status:
        index >= 5 + (facilityIndex === 2 ? 1 : 0)
          ? (unavailableStatuses[(index + facilityIndex) % unavailableStatuses.length] ??
            StorageUnitStatus.MAINTENANCE)
          : StorageUnitStatus.AVAILABLE,
    })),
);
