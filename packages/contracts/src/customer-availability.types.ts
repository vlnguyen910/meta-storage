export type CustomerAvailability = {
  facilityId: string;
  unitTypeId: string;
  period: { startsAt: string; endsAt: string };
  availableCount: number;
  asOf: string;
};
