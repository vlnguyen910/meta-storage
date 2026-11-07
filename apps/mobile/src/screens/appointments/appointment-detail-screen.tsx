import { CalendarClock, MapPin, QrCode, Warehouse } from "lucide-react-native";
import { Platform, ScrollView, Text, View } from "react-native";
import type { AppointmentDetailScreenProps } from "../../common/customer-home.types";
import {
  appointmentTime,
  appointmentTiming,
  formatAppointmentDate,
  paymentLabel,
} from "../../common/customer-home.utils";
import { Card, Icon, Notice, Row, StatusPill } from "../../components/ui";
import { BookingQr } from "../../components/ui/booking-qr";
import { dateTime, money } from "../../components/ui/mobile-ui";
import { FacilitySummary } from "../../features/customer-home/components/facility-card";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { CUSTOMER_HOME as M } from "../../features/customer-home/customer-home.messages";
import { useAppointmentDetail } from "../../features/customer-home/use-customer-home";

export function AppointmentDetailScreen({ owner, id }: AppointmentDetailScreenProps) {
  const state = useAppointmentDetail(owner, id);
  const a = state.appointment;
  const reservation = a?.reservation;
  return (
    <ScrollView
      accessibilityLabel={M.detail}
      tabIndex={Platform.OS === "web" ? 0 : undefined}
      contentContainerClassName="grow px-4 py-5"
    >
      <View className="mx-auto w-full max-w-3xl">
        <QueryFeedback
          pending={state.query.isPending}
          error={state.query.isError}
          retry={() => void state.query.refetch()}
        />
        {a ? (
          <>
            <Card compact outlined>
              <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
                <View className="flex-row items-center gap-2">
                  <Icon as={CalendarClock} size={24} className="text-primary" />
                  <View>
                    <Text className="font-body text-[12px] text-muted">
                      {M.types[a.appointmentType]}
                    </Text>
                    <Text className="font-body-bold text-[20px] leading-7 text-primary">
                      {appointmentTime(a)}
                    </Text>
                  </View>
                </View>
                <StatusPill
                  label={M.statuses[a.status]}
                  tone={a.status === "CONFIRMED" || a.status === "COMPLETED" ? "green" : "neutral"}
                />
              </View>
              <Row label={M.date} value={formatAppointmentDate(a.scheduledDate)} />
              <Text className="mb-3 font-body-semibold text-[12px] text-warning-strong">
                {appointmentTiming(a, state.now)}
              </Text>
              <View className="flex-row gap-2">
                <Icon as={MapPin} className="text-primary" />
                <FacilitySummary name={a.facility?.name} address={a.facility?.address} />
              </View>
            </Card>
            <Card title={M.unit} compact outlined>
              <View className="mb-3 flex-row items-center gap-3">
                <Icon as={Warehouse} size={28} className="text-primary" />
                <Text className="shrink font-body-bold text-title leading-8 text-primary">
                  {a.assignedUnit?.physicalUnitCode ?? M.unassigned}
                </Text>
              </View>
              <Row
                label={M.size}
                value={a.unitType?.sizeLabel ?? reservation?.unitType?.sizeLabel ?? M.empty}
              />
              {state.unitType ? (
                <View className="mt-2 flex-row gap-2">
                  {[
                    [M.dimensions, `${state.unitType.lengthM} m × ${state.unitType.widthM} m`],
                    [M.height, `${state.unitType.heightM} m`],
                    [M.volume, `${state.unitType.sizeCbm} m³`],
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      className="min-w-0 flex-1 gap-1 rounded-control bg-customer-subtle p-2"
                    >
                      <Text className="text-center font-body text-[10px] text-ink">{label}</Text>
                      <Text className="text-center font-body-semibold text-[12px] leading-5 text-ink">
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : state.units.isError ? (
                <Notice>{M.unitUnavailable}</Notice>
              ) : null}
            </Card>
            <View className="mb-4 rounded-card bg-primary p-5">
              <View className="mb-3 flex-row items-center gap-2">
                <Icon as={QrCode} className="text-primary-foreground" />
                <Text className="shrink font-body-bold text-[18px] text-primary-foreground">
                  {M.qr}
                </Text>
              </View>
              <Text className="mb-4 font-body text-label leading-6 text-primary-foreground">
                {state.qrUrl ? M.qrHint : M.qrUnavailable}
              </Text>
              {state.qrUrl ? <BookingQr value={state.qrUrl} label={M.qrLabel} /> : null}
            </View>
            <Card title={M.contract} compact outlined>
              {reservation ? (
                <>
                  <Row
                    label={M.rentalPeriod}
                    value={`${dateTime(reservation.rentalStartAt)} – ${dateTime(reservation.rentalEndAt)}`}
                  />
                  <Row label={M.duration} value={String(reservation.requestedMonths)} />
                </>
              ) : null}
              <Row label={M.customer} value={a.customerName ?? M.empty} />
              <Row label={M.phone} value={a.contactPhone ?? M.empty} />
              <Row label={M.assignedStaff} value={a.assignedStaffName ?? M.empty} />
              <Row
                label={M.payment}
                value={paymentLabel(a.paymentStatus ?? reservation?.paymentStatus)}
              />
              {reservation ? (
                <>
                  <Row label={M.rentalFee} value={money(reservation.rentalFeeAmount)} />
                  <Row label={M.deposit} value={money(reservation.depositAmount)} />
                  <Row label={M.total} value={money(reservation.totalAmount)} />
                </>
              ) : null}
              {a.notes ? (
                <Text className="mt-3 font-body text-label leading-6 text-muted">
                  {M.notes}: {a.notes}
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
