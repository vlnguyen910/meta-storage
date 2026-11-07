import { CalendarClock, Eye, QrCode, Warehouse } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { AppointmentCardProps } from "../../../common/customer-home.types";
import {
  appointmentTime,
  formatAppointmentDate,
  paymentLabel,
} from "../../../common/customer-home.utils";
import { Button, Card, Icon, StatusPill } from "../../../components/ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";
import { FacilitySummary } from "./facility-card";

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
        <Card compact outlined>
          <View className="mb-3 flex-row items-start gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <View className="items-start">
                <StatusPill label={M.statuses[a.status]} tone={tone} compact />
              </View>
              <FacilitySummary name={a.facility?.name} address={a.facility?.address} />
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
    <Card compact outlined>
      <View className="absolute right-0 top-0 rounded-bl-control rounded-tr-card bg-customer-mint px-3 py-1">
        <Text className="font-body-bold text-[10px] uppercase text-primary-dark">
          {M.statuses[a.status]}
        </Text>
      </View>
      <View className="mb-3 mt-1 flex-row items-start gap-3">
        <View className="mt-1 h-10 w-10 items-center justify-center rounded-control border border-outline-variant/60 bg-customer-subtle">
          <Icon as={QrCode} size={22} className="text-primary" />
        </View>
        <View className="min-w-0 flex-1 gap-1 pt-3">
          {a.paymentStatus ? (
            <StatusPill
              compact
              label={paymentLabel(a.paymentStatus)}
              tone={a.paymentStatus === "SUCCEEDED" ? "green" : "amber"}
            />
          ) : null}
          <FacilitySummary compact name={a.facility?.name} address={a.facility?.address} />
        </View>
      </View>
      <View className="mb-3 gap-1 rounded-control bg-customer-subtle px-3 py-2">
        <View className="flex-row items-center gap-2">
          <Icon as={Warehouse} size={16} className="text-primary" />
          <Text className="shrink font-body text-[12px] leading-5 text-ink">
            {M.size}:{" "}
            <Text className="font-body-bold">{a.unitType?.sizeLabel ?? M.unassigned}</Text>
            {a.assignedUnit ? ` · ${a.assignedUnit.physicalUnitCode}` : ""}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 border-t border-outline-variant/40 pt-1">
          <Icon as={CalendarClock} size={16} className="text-warning-strong" />
          <Text className="shrink font-body-semibold text-[12px] leading-5 text-warning-strong">
            {appointmentTime(a)} · {formatAppointmentDate(a.scheduledDate)}
          </Text>
        </View>
      </View>
      <View className="w-[52%]">
        <Button
          compact
          inline
          label={M.view}
          accessibilityLabel={label}
          leadingIcon={<Icon as={Eye} size={18} className="text-white" />}
          onPress={onPress}
        />
      </View>
    </Card>
  );
}
