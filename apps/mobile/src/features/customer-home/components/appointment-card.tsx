import { CalendarClock, MapPin, Warehouse } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { AppointmentCardProps } from "../../../common/customer-home.types";
import {
  appointmentTime,
  formatAppointmentDate,
  paymentLabel,
} from "../../../common/customer-home.utils";
import { Button, Card, Icon, StatusPill } from "../../../components/ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";

export function AppointmentCard({ appointment: a, onPress, variant }: AppointmentCardProps) {
  const label = `${M.view}: ${a.facility?.name ?? M.unknownFacility}, ${formatAppointmentDate(a.scheduledDate)}`;
  const tone =
    a.status === "CONFIRMED" || a.status === "COMPLETED"
      ? "green"
      : a.status === "SCHEDULED"
        ? "blue"
        : "neutral";
  if (variant === "list")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        className="rounded-card active:opacity-80 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
      >
        <Card compact>
          <View className="mb-3 flex-row items-start gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <View className="items-start">
                <StatusPill label={M.statuses[a.status]} tone={tone} />
              </View>
              <Text className="font-body-bold text-[18px] leading-6 text-ink">
                {a.facility?.name ?? M.unknownFacility}
              </Text>
              {a.facility?.address ? (
                <View className="flex-row gap-1">
                  <Icon as={MapPin} size={14} className="mt-1 text-muted" />
                  <Text className="shrink font-body text-[12px] leading-5 text-muted">
                    {a.facility.address}
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="w-[96px] gap-1">
              <View className="rounded-control bg-customer-subtle px-2 py-2">
                <Text className="text-center font-body-bold text-label leading-5 text-ink">
                  {appointmentTime(a)}
                </Text>
              </View>
              <Text className="text-right font-body-medium text-[12px] leading-5 text-primary">
                {formatAppointmentDate(a.scheduledDate)}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2 rounded-control bg-customer-subtle p-2">
            <Icon as={Warehouse} size={18} className="text-primary" />
            <Text className="min-w-0 flex-1 font-body text-[12px] leading-5 text-ink">
              {a.assignedUnit?.physicalUnitCode ?? a.unitType?.sizeLabel ?? M.unassigned}
            </Text>
            <Text className="w-[100px] text-right font-body-medium text-[12px] leading-5 text-ink">
              {M.types[a.appointmentType]}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  return (
    <Card compact>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <StatusPill label={M.statuses[a.status]} tone={tone} />
        <View className="items-end gap-1">
          <Text className="font-body-medium text-[12px] text-muted">
            {M.types[a.appointmentType]}
          </Text>
          {a.paymentStatus ? (
            <Text className="font-body-medium text-[12px] text-primary">
              {paymentLabel(a.paymentStatus)}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        accessibilityRole="header"
        className="mb-2 font-body-bold text-[18px] leading-7 text-ink"
      >
        {a.facility?.name ?? M.unknownFacility}
      </Text>
      {a.facility?.address ? (
        <View className="mb-3 flex-row gap-2">
          <Icon as={MapPin} size={16} className="mt-1 text-muted" />
          <Text className="shrink font-body text-label leading-6 text-muted">
            {a.facility.address}
          </Text>
        </View>
      ) : null}
      <View className="mb-3 gap-1 rounded-control bg-customer-subtle p-2">
        <View className="flex-row gap-2">
          <Icon as={CalendarClock} size={18} className="text-primary" />
          <Text className="shrink font-body-semibold text-label leading-6 text-ink">
            {appointmentTime(a)} · {formatAppointmentDate(a.scheduledDate)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Icon as={Warehouse} size={18} className="text-primary" />
          <Text className="shrink font-body text-label leading-6 text-ink">
            {a.assignedUnit?.physicalUnitCode ?? a.unitType?.sizeLabel ?? M.unassigned}
          </Text>
        </View>
      </View>
      <Button label={M.view} accessibilityLabel={label} onPress={onPress} />
    </Card>
  );
}
