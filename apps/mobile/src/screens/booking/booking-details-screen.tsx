import { Controller } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import type { BookingScreenProps } from "../../common/booking.types";
import { canSelectCheckInSlot } from "../../common/check-in-schedule.utils";
import { CalendarField, ChoiceTabs, Field, Notice, SectionHeading } from "../../components/ui";
import { BOOKING as M } from "../../features/booking/booking.messages";
import { BookingSummary } from "../../features/booking/components/booking-parts";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";

export function BookingDetailsScreen({ state: s }: BookingScreenProps) {
  return (
    <>
      <BookingSummary state={s} />
      <SectionHeading title={M.tenant} />
      <Text className="mb-4 font-body text-[12px] leading-5 text-muted">{M.accountHint}</Text>
      <Field label={M.name} value={s.user.name} editable={false} />
      <Field
        label={M.email}
        value={s.user.email ?? ""}
        editable={false}
        keyboardType="email-address"
      />
      <Controller
        control={s.form.control}
        name="contactPhone"
        render={({ field, fieldState }) => (
          <Field
            label={M.phone}
            hint={M.phoneHint}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? M.invalidForm : undefined}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
            editable={!s.busy}
          />
        )}
      />
      <SectionHeading title={M.duration} />
      <ChoiceTabs
        options={[1, 2, 3, 6, 12].map((n) => ({ value: String(n), label: `${n} ${M.month}` }))}
        value={String(s.values.durationMonths)}
        onChange={(v) => s.form.setValue("durationMonths", Number(v))}
        disabled={s.busy}
      />
      <Controller
        control={s.form.control}
        name="checkInDate"
        render={({ field, fieldState }) => (
          <CalendarField
            label={M.date}
            minDate={s.minDate}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error ? M.invalidForm : undefined}
            disabled={s.busy}
          />
        )}
      />
      <Text className="mb-2 font-body-semibold text-label text-ink">{M.slots}</Text>
      <QueryFeedback
        pending={s.slots.isPending}
        error={s.slots.isError}
        retry={() => void s.slots.refetch()}
      />
      <View className="mb-3 flex-row flex-wrap gap-2">
        {s.slots.data?.map((slot) => {
          const selected = slot.id === s.values.checkInSlotId;
          const disabled = s.busy || !canSelectCheckInSlot(s.values.checkInDate, slot.startTime);
          return (
            <Pressable
              key={slot.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => s.form.setValue("checkInSlotId", slot.id)}
              className={`min-h-touch min-w-[140px] grow items-center justify-center rounded-control border px-3 py-3 web:focus-visible:outline-2 web:focus-visible:outline-ring ${selected ? "border-primary bg-primary-soft" : "border-line bg-surface"} ${disabled ? "opacity-55" : ""}`}
            >
              <Text className="font-body-semibold text-label text-primary">{slot.name}</Text>
              <Text className="font-body text-[12px] text-customer-muted">
                {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {s.slots.isSuccess && !s.slots.data.length ? <Notice>{M.noSlots}</Notice> : null}
      {s.scheduleReady ? (
        <QueryFeedback
          pending={s.availability.isFetching}
          error={s.availability.isError}
          retry={() => void s.availability.refetch()}
        />
      ) : null}
      {s.availability.data && !s.availability.isFetching ? (
        <Notice error={!s.availability.data.availableCount}>
          {s.availability.data.availableCount
            ? M.available(s.availability.data.availableCount)
            : M.capacity}
        </Notice>
      ) : null}
      <Controller
        control={s.form.control}
        name="notes"
        render={({ field, fieldState }) => (
          <Field
            label={M.notes}
            placeholder={M.notesHint}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? M.invalidForm : undefined}
            maxLength={2000}
            multiline
            numberOfLines={3}
            editable={!s.busy}
          />
        )}
      />
    </>
  );
}
