import { Text, View } from "react-native";
import type { BookingScreenProps } from "../common/booking.types";
import { appointmentTime, formatAppointmentDate } from "../common/customer-home.utils";
import { ActionLink, Card, Notice, Row, SectionHeading } from "../components/ui";
import { dateTime } from "../components/ui/mobile-ui";
import { BOOKING as M } from "../features/booking/booking.messages";
import { BookingCosts, BookingSummary } from "../features/booking/components/booking-parts";

export function BookingReviewScreen({ state: s }: BookingScreenProps) {
  return (
    <>
      <SectionHeading title={M.review} />
      <Text className="mb-4 font-body text-label leading-6 text-muted">{M.reviewHint}</Text>
      {s.paymentUncertain ? (
        <Notice>{M.leavePayment}</Notice>
      ) : (
        <View className="mb-2 flex-row justify-end">
          <ActionLink label={`${M.edit}: ${M.unit}`} onPress={() => s.edit(0)} disabled={s.busy} />
        </View>
      )}
      <BookingSummary state={s} />
      <Card compact outlined>
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text className="flex-1 font-body-bold text-body text-primary">{M.appointment}</Text>
          {!s.paymentUncertain ? (
            <ActionLink label={M.edit} onPress={() => s.edit(1)} disabled={s.busy} />
          ) : null}
        </View>
        <Row label={M.name} value={s.user.name} />
        <Row label={M.email} value={s.user.email ?? "—"} />
        <Row label={M.phone} value={s.values.contactPhone} />
        <Row label={M.date} value={formatAppointmentDate(s.values.checkInDate)} />
        <Row
          label={M.slots}
          value={
            s.appointment
              ? appointmentTime(s.appointment)
              : s.slot
                ? `${s.slot.startTime.slice(0, 5)} – ${s.slot.endTime.slice(0, 5)}`
                : "—"
          }
        />
        {s.values.notes ? <Row label={M.notes} value={s.values.notes} /> : null}
        {s.draft ? (
          <Row
            label={M.period}
            value={`${dateTime(s.draft.rentalStartAt)} → ${dateTime(s.draft.rentalEndAt)}`}
          />
        ) : null}
      </Card>
      <BookingCosts state={s} />
      <Notice>{M.paymentHint}</Notice>
    </>
  );
}
