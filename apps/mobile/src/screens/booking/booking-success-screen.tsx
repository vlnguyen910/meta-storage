import { Check, Copy } from "lucide-react-native";
import { Text, View } from "react-native";
import type { BookingSuccessScreenProps } from "../../common/booking.types";
import { appointmentTime, formatAppointmentDate } from "../../common/customer-home.utils";
import { Button, Card, Icon, IconButton, Row, SectionHeading } from "../../components/ui";
import { BookingQr } from "../../components/ui/booking-qr";
import { dateTime, money } from "../../components/ui/mobile-ui";
import { BOOKING as M } from "../../features/booking/booking.messages";
import { BookingSummary } from "../../features/booking/components/booking-parts";
import { WEB_BASE_URL } from "../../lib/runtime-config";

export function BookingSuccessScreen({
  state: s,
  onHome,
  onAppointment,
}: BookingSuccessScreenProps) {
  if (!s.draft) return null;
  return (
    <>
      <View className="items-center pb-5 pt-3">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <Icon as={Check} size={36} className="text-primary" />
        </View>
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="mb-2 text-center font-body-bold text-[26px] leading-9 text-primary"
        >
          {M.success}
        </Text>
        <Text className="text-center font-body text-label leading-6 text-muted">
          {M.successHint}
        </Text>
      </View>
      <Card compact outlined>
        <Text className="mb-2 text-center font-body text-[12px] text-muted">
          {M.reservationCode}
        </Text>
        <View className="mb-3 flex-row items-center gap-1">
          <Text
            selectable
            className="min-w-0 flex-1 text-center font-body-semibold text-label text-primary"
          >
            {s.draft.id}
          </Text>
          <IconButton
            icon={Copy}
            label={`${M.copy}: ${M.reservationCode}`}
            onPress={() => void s.copy(s.draft?.id ?? "")}
          />
        </View>
        <BookingQr
          value={new URL(`/customer/reservations/${s.draft.id}`, WEB_BASE_URL).toString()}
          label={M.lookupQr}
        />
        <Text className="text-center font-body text-[12px] leading-5 text-muted">
          {M.lookupHint}
        </Text>
      </Card>
      <SectionHeading title={M.receipt} />
      <BookingSummary state={s} />
      <Card compact outlined>
        <Row label={M.name} value={s.user.name} />
        <Row label={M.phone} value={s.values.contactPhone} />
        <Row label={M.date} value={formatAppointmentDate(s.values.checkInDate)} />
        <Row label={M.slots} value={s.appointment ? appointmentTime(s.appointment) : "—"} />
        <Row
          label={M.period}
          value={`${dateTime(s.draft.rentalStartAt)} → ${dateTime(s.draft.rentalEndAt)}`}
        />
        <Row
          label={M.unit}
          value={s.appointment?.assignedUnit?.physicalUnitCode ?? M.waitingAssignment}
        />
        <Row label={M.total} value={money(s.draft.totalAmount)} />
        <Text className="mt-3 font-body-semibold text-label text-primary">{M.paid}</Text>
      </Card>
      {s.appointment ? (
        <Button
          label={M.viewAppointment}
          onPress={() => s.appointment && onAppointment(s.appointment.id)}
        />
      ) : null}
      <Button label={M.home} variant="outline" onPress={onHome} />
    </>
  );
}
