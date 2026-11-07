import { Text, View } from "react-native";
import type { BookingUnitsScreenProps } from "../../common/booking.types";
import { ActionLink, Card, ChoiceTabs, Notice, SectionHeading } from "../../components/ui";
import { BOOKING as M } from "../../features/booking/booking.messages";
import { UnitChoice } from "../../features/booking/components/booking-parts";
import { FacilitySummary } from "../../features/customer-home/components/facility-card";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";

export function BookingUnitsScreen({ state: s, onChangeFacility }: BookingUnitsScreenProps) {
  return (
    <>
      <Card compact outlined>
        <View className="mb-2 flex-row items-center justify-between gap-2">
          <Text className="font-body-medium text-[12px] text-muted">{M.facility}</Text>
          <ActionLink label={M.changeFacility} onPress={onChangeFacility} disabled={s.busy} />
        </View>
        <FacilitySummary name={s.facility.name} address={s.facility.address} />
      </Card>
      <SectionHeading title={M.area} />
      <ChoiceTabs
        options={[
          { value: "all", label: M.allAreas },
          { value: "small", label: M.small },
          { value: "medium", label: M.medium },
          { value: "large", label: M.large },
        ]}
        value={s.area}
        onChange={s.setArea}
        disabled={s.busy}
      />
      <QueryFeedback
        pending={s.types.isPending}
        error={s.types.isError}
        retry={() => void s.types.refetch()}
      />
      {s.units.map((unit) => (
        <UnitChoice
          key={unit.id}
          unit={unit}
          selected={s.values.unitTypeId === unit.id}
          onSelect={() => {
            if (!s.busy) s.form.setValue("unitTypeId", unit.id);
          }}
        />
      ))}
      {s.types.isSuccess && !s.units.length ? <Notice>{M.noUnits}</Notice> : null}
    </>
  );
}
