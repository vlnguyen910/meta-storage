import { Pressable, Text, View } from "react-native";
import { canSelectCheckInSlot } from "../../../common/check-in-schedule.utils";
import { storageDate } from "../../../common/my-storage.utils";
import { Button, CalendarField, Card, Notice, Row } from "../../../components/ui";
import { QueryFeedback } from "../../customer-home/components/query-feedback";
import { MY_STORAGE as M } from "../my-storage.messages";
import { useRentalReturn } from "../use-rental-return";

export function ReturnScheduleSection({
  owner,
  rentalId,
  endAt,
}: {
  owner: string;
  rentalId: string;
  endAt: string;
}) {
  const s = useRentalReturn(owner, rentalId, endAt);
  const history = s.items.filter((item) => item.id !== s.active?.id);
  return (
    <Card title={M.returnTitle} compact outlined>
      {s.message ? <Notice error={s.message.error}>{s.message.text}</Notice> : null}
      <QueryFeedback
        pending={s.appointments.isPending}
        error={s.appointments.isError}
        retry={() => void s.appointments.refetch()}
        errorMessage={M.returnLoadError}
      />
      {s.active ? (
        <>
          <Notice>{M.returnPending}</Notice>
          <Row label={M.returnDate} value={storageDate(s.active.scheduledDate)} />
          <Row label={M.returnSlots} value={s.active.slotName ?? M.unknown} />
          <Row label={M.paymentStatus} value={M.returnStatuses[s.active.status] ?? M.unknown} />
          <Button
            label={M.returnCancel}
            variant="outline"
            loading={s.cancelling}
            disabled={s.busy}
            onPress={() => s.active && s.cancel(s.active.id)}
          />
        </>
      ) : s.appointments.isSuccess && !s.formOpen ? (
        <Button label={M.returnSchedule} onPress={s.openForm} />
      ) : null}
      {s.formOpen && !s.active ? (
        <>
          <Text className="mb-3 font-body text-[12px] leading-5 text-muted">{M.returnHint}</Text>
          <CalendarField
            label={M.returnDate}
            value={s.date}
            onChange={s.setDate}
            disabled={s.busy}
          />
          <Text className="mb-2 font-body-semibold text-label text-ink">{M.returnSlots}</Text>
          <QueryFeedback
            pending={s.slots.isPending}
            error={s.slots.isError}
            retry={() => void s.slots.refetch()}
          />
          <View className="mb-3 flex-row flex-wrap gap-2">
            {s.slots.data?.map((slot) => {
              const selected = slot.id === s.slotId;
              const disabled = s.busy || !canSelectCheckInSlot(s.date, slot);
              return (
                <Pressable
                  key={slot.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => s.setSlotId(slot.id)}
                  className={`min-h-touch min-w-[140px] grow items-center justify-center rounded-control border px-3 py-3 ${selected ? "border-primary bg-primary-soft" : "border-line bg-surface"} ${disabled ? "opacity-55" : ""}`}
                >
                  <Text className="font-body-semibold text-label text-primary">{slot.name}</Text>
                  <Text className="font-body text-[12px] text-customer-muted">
                    {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {s.slots.isSuccess && !s.slots.data.length ? <Notice>{M.returnNoSlots}</Notice> : null}
          {s.confirmEarly ? (
            <>
              <Notice>{M.returnEarlyDescription(storageDate(endAt))}</Notice>
              <Button
                label={M.returnEarlyConfirm}
                loading={s.creating}
                disabled={s.busy}
                onPress={s.confirmSubmit}
              />
              <Button
                label={M.returnEarlyBack}
                variant="outline"
                disabled={s.busy}
                onPress={() => s.setConfirmEarly(false)}
              />
            </>
          ) : (
            <>
              <Button
                label={M.returnSubmit}
                loading={s.creating}
                disabled={s.busy || !s.canSubmit}
                onPress={s.submit}
              />
              <Button label={M.close} variant="outline" disabled={s.busy} onPress={s.closeForm} />
            </>
          )}
        </>
      ) : null}
      {history.length ? (
        <View className="mt-2 border-t border-line pt-3">
          <Text className="mb-2 font-body-semibold text-label text-ink">{M.returnHistory}</Text>
          {history.map((item) => (
            <Text key={item.id} className="mb-1 font-body text-[12px] leading-5 text-muted">
              {storageDate(item.scheduledDate)} · {item.slotName ?? ""} ·{" "}
              {M.returnStatuses[item.status] ?? item.status}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
