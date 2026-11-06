import { CalendarClock, RotateCcw } from "lucide-react-native";
import { Text, View } from "react-native";
import type { RentalCardProps } from "../../../common/my-storage.types";
import { rentalPeriod, rentalTiming, storageDate } from "../../../common/my-storage.utils";
import { Button, Card, Icon, StatusPill } from "../../../components/ui";
import { FacilitySummary } from "../../customer-home/components/facility-card";
import { MY_STORAGE as M } from "../my-storage.messages";
export function RentalCard({
  rental: r,
  now,
  compact = false,
  onDetails,
  onRenew,
  onRebook,
}: RentalCardProps) {
  const active = r.status === "ACTIVE",
    timing = rentalTiming(r, now),
    code = r.storageUnit?.code ?? M.unassigned;
  if (compact && active)
    return (
      <Card compact outlined>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-control bg-primary-soft">
            <Text className="text-center font-body-bold text-[12px] text-primary">
              {r.unitType.sizeLabel}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-body-bold text-label text-ink">{code}</Text>
            <View className="my-1 flex-row">
              <StatusPill compact label={M.active} tone="green" />
            </View>
            <Text className="font-body text-[12px] leading-5 text-customer-muted">
              {r.unitType.name} · {M.end}: {storageDate(r.endAt)}
            </Text>
          </View>
          <View className="w-[88px]">
            <Button
              label={M.details}
              accessibilityLabel={`${M.details}: ${code}`}
              onPress={onDetails}
              variant="outline"
              compact
              inline
            />
          </View>
        </View>
      </Card>
    );
  return (
    <Card compact outlined>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <Text
          selectable
          className={`shrink rounded-[4px] px-2 py-1 font-body-bold text-[12px] ${active ? "bg-customer-mint text-primary-dark" : "bg-customer-subtle text-primary"}`}
        >
          {M.unitCode}: {code}
        </Text>
        <StatusPill
          compact
          label={active ? M.active : M.closed}
          tone={active ? "green" : "neutral"}
        />
      </View>
      <View className="mb-3 flex-row gap-3">
        <View className="h-16 w-16 items-center justify-center rounded-control bg-customer-subtle px-1">
          <Text className="text-center font-body-bold text-[18px] leading-6 text-primary">
            {r.unitType.sizeLabel}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-1 font-body-bold text-body leading-6 text-ink">
            {r.unitType.name}
          </Text>
          <FacilitySummary
            compact
            name={r.facility.name}
            address={active ? undefined : r.facility.address}
          />
        </View>
      </View>
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Icon as={CalendarClock} size={16} className="text-primary" />
        <Text className="shrink font-body-medium text-[12px] leading-5 text-ink">
          {rentalPeriod(r)}
        </Text>
        {timing ? (
          <StatusPill compact label={timing.label} tone={timing.overdue ? "red" : "amber"} />
        ) : null}
      </View>
      {!active && r.closedAt ? (
        <Text className="mb-3 font-body text-[12px] leading-5 text-muted">
          {M.closedOn}: {storageDate(r.closedAt)}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2 border-t border-line pt-3">
        {active && onRenew ? (
          <Button label={M.renew} onPress={onRenew} variant="outline" compact inline />
        ) : !active && onRebook ? (
          <View className="min-w-[150px] flex-1">
            <Button
              label={M.rebook}
              onPress={onRebook}
              leadingIcon={<Icon as={RotateCcw} size={16} className="text-white" />}
              compact
              inline
            />
          </View>
        ) : null}
        <View className={active ? "" : "min-w-[100px] flex-1"}>
          <Button
            label={active ? M.details : M.record}
            accessibilityLabel={`${active ? M.details : M.record}: ${code}`}
            onPress={onDetails}
            variant="outline"
            compact
            inline
          />
        </View>
      </View>
    </Card>
  );
}
