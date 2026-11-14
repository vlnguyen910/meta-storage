import {
  type AppointmentRecordDto,
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "../../components/ui/icon";
import { MobilePhoto } from "../../components/ui/mobile-photo";
import { Button, Card, dateTime, Field, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { StatusPill } from "../../components/ui/workspace-ui";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
import { staffError, useStaffCheckIn } from "../../features/staff-api/use-staff-workspace";

export function StaffCheckInView({
  owner,
  appointment,
  onBack,
  onNotify,
}: {
  owner: string;
  appointment: AppointmentRecordDto;
  onBack?: () => void;
  onNotify: (kind: "success" | "error", message: string) => void;
}) {
  const flow = useStaffCheckIn(owner, appointment.id);
  const [received, setReceived] = useState(false);
  const current = flow.appointment.data ?? appointment;
  const done = current.status === "COMPLETED" || current.handoverStage === "HANDED_OVER";
  const verified = flow.task?.status === "IN_PROGRESS" || Boolean(flow.record);
  const missingInspectionTask = flow.tasks.isSuccess && !flow.task;
  const reasons = current.assignedUnit ? [] : ["UNIT_NOT_ASSIGNED"];
  const canProceed = current.status === "CONFIRMED" && reasons.length === 0;
  const stage = done ? 4 : flow.record?.status === "PASSED" ? 4 : flow.record ? 3 : 2;
  const unitCode =
    current.assignedUnit?.physicalUnitCode ??
    appointment.assignedUnit?.physicalUnitCode ??
    M.noUnit;
  const scheduledAt = dateTime(`${current.scheduledDate}T${current.slotStart ?? "00:00:00"}+07:00`);
  if (
    flow.error ||
    (flow.appointment.isSuccess &&
      (current.assignedStaffId !== owner || ["CANCELLED", "NO_SHOW"].includes(current.status)))
  ) {
    return (
      <View>
        <Notice error>{flow.error ? staffError(flow.error) : M.workUnavailable}</Notice>
        <Button variant="outline" label={M.retry} onPress={() => void flow.refresh()} />
      </View>
    );
  }
  return (
    <View>
      <View className="mb-4">
        <Text className="mb-1 font-body-semibold text-[10px] uppercase tracking-[1.5px] text-primary">
          {M.welcome}
        </Text>
        <Heading>{`${M.bookings} · ${formatReference(current.reservationId ?? current.id, current.reservationId ? "BK" : "LH")}`}</Heading>
        <Text className="mt-1 font-body text-[12px] leading-5 text-muted">{scheduledAt}</Text>
      </View>
      <StaffFlowProgress stage={stage} done={done} />

      <Card title={done ? M.resultTitle : M.bookingDetails}>
        <View className="mb-4 flex-row flex-wrap items-center gap-2">
          <StatusPill
            label={done ? M.handedOver : (M.status[current.status] ?? current.status)}
            tone={done ? "green" : current.status === "CANCELLED" ? "red" : "blue"}
          />
          {current.paymentStatus ? (
            <StatusPill
              label={`${M.payment}: ${M.paymentStatuses[current.paymentStatus] ?? current.paymentStatus}`}
              tone={current.paymentStatus === "SUCCEEDED" ? "green" : "amber"}
            />
          ) : null}
        </View>
        <Row label={M.customer} value={current.customerName ?? M.customer} />
        <Row label={M.phone} value={current.contactPhone || M.noPhone} />
        <Row label={M.unit} value={unitCode} />
        {current.unitType?.name ? <Row label={M.unitType} value={current.unitType.name} /> : null}
        {current.reservation?.requestedMonths ? (
          <Row
            label={M.rentalDuration}
            value={`${current.reservation.requestedMonths} ${M.months}`}
          />
        ) : null}
        <Row label={M.time} value={scheduledAt} />
      </Card>

      {(flow.appointment.isPending ||
        flow.tasks.isPending ||
        (verified && flow.history.isPending)) && (
        <View className="py-4">
          <ActivityIndicator color="#065f46" accessibilityLabel={M.loading} />
        </View>
      )}
      {flow.error && (
        <>
          <Notice error>{staffError(flow.error)}</Notice>
          <Button variant="outline" label={M.retry} onPress={() => void flow.refresh()} />
        </>
      )}

      {missingInspectionTask && <Notice error>{M.inspectionTaskUnavailable}</Notice>}

      {!done && flow.appointment.isSuccess && !verified && (
        <Card title={M.verify}>
          <Text className="mb-4 font-body text-[13px] leading-6 text-muted">
            {M.lookupRequired}
          </Text>
          <View className="mb-4 gap-3 rounded-control bg-customer-canvas p-3">
            <VerificationRow
              label={M.bookingValid}
              value={M.status[current.status] ?? current.status}
              passed={current.status === "CONFIRMED"}
            />
            <VerificationRow
              label={M.paymentRequirement}
              value={M.paymentStatuses[current.paymentStatus ?? ""] ?? M.paymentUnknown}
              passed={current.paymentStatus === "SUCCEEDED"}
            />
            <VerificationRow
              label={M.unit}
              value={unitCode}
              passed={Boolean(current.assignedUnit)}
            />
          </View>
          {!canProceed && reasons.length > 0 && (
            <Notice>{reasons.map((reason) => M.reasons[reason] ?? reason).join(" ")}</Notice>
          )}
          <Button
            label={M.verify}
            disabled={!canProceed || !flow.task || flow.busy}
            loading={flow.begin.isPending}
            onPress={() =>
              flow.begin.mutate(undefined, {
                onSuccess: () => onNotify("success", M.checkInVerifiedSuccess),
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        </Card>
      )}

      {!done && verified && flow.history.isSuccess && !flow.record && (
        <Card title={M.inspect}>
          <Text className="mb-4 font-body text-[13px] leading-6 text-muted">
            {M.inspectionHint}
          </Text>
          {!current.assignedUnit && <Notice error>{M.inspectionUnitRequired}</Notice>}
          <Button
            label={M.inspect}
            loading={flow.start.isPending}
            disabled={!current.assignedUnit || flow.busy}
            onPress={() =>
              flow.start.mutate(current.assignedUnit?.physicalUnitId ?? "", {
                onSuccess: () => onNotify("success", M.inspectionStartedSuccess),
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        </Card>
      )}

      {flow.record && !done && (
        <InspectionEditor
          key={flow.record.id}
          record={flow.record}
          busy={flow.busy}
          onPhoto={(camera) =>
            flow.photo.mutate(camera, {
              onSuccess: (result) => {
                if (result) onNotify("success", M.evidenceAddedSuccess);
              },
              onError: (error) => onNotify("error", staffError(error)),
            })
          }
          onRemovePhoto={(id) =>
            flow.removePhoto.mutate(id, {
              onSuccess: () => onNotify("success", M.evidenceRemovedSuccess),
              onError: (error) => onNotify("error", staffError(error)),
            })
          }
          onSave={(input) =>
            flow.save.mutate(input, {
              onSuccess: () =>
                onNotify(
                  "success",
                  input.status === "PASSED" ? M.inspectionPassedSuccess : M.inspectionDraftSuccess,
                ),
              onError: (error) => onNotify("error", staffError(error)),
            })
          }
        />
      )}

      {done && flow.record ? (
        <InspectionEditor
          key={`result:${flow.record.id}`}
          record={flow.record}
          busy={false}
          onPhoto={() => undefined}
          onRemovePhoto={() => undefined}
          onSave={() => undefined}
        />
      ) : null}

      {!done && flow.record?.status === "PASSED" && (
        <Card title={M.handover}>
          <Text className="mb-4 font-body text-[13px] leading-6 text-muted">{M.handoverHint}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: received, disabled: flow.busy }}
            disabled={flow.busy}
            onPress={() => setReceived((value) => !value)}
            className="mb-4 min-h-12 flex-row items-center gap-3 rounded-control border border-outline-variant bg-surface p-3"
          >
            <View
              className={`h-6 w-6 items-center justify-center rounded-md border ${received ? "border-primary bg-primary" : "border-outline-variant bg-surface"}`}
            >
              <Text className="font-body-bold text-white">{received ? "✓" : ""}</Text>
            </View>
            <Text className="flex-1 font-body-medium text-[13px] leading-5 text-ink">
              {M.received}
            </Text>
          </Pressable>
          <Button
            label={M.handover}
            loading={flow.handover.isPending}
            disabled={!received || flow.busy}
            onPress={() =>
              flow.handover.mutate(undefined, {
                onSuccess: () => onNotify("success", M.handoverSuccess),
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        </Card>
      )}

      {done && (
        <Card>
          <Notice>{M.handedOver}</Notice>
          <Row label={M.customer} value={current.customerName ?? M.customer} />
          <Row label={M.unit} value={unitCode} />
          <Row label={M.time} value={scheduledAt} />
          {onBack ? <Button variant="outline" label={M.back} onPress={onBack} /> : null}
        </Card>
      )}
    </View>
  );
}

function StaffFlowProgress({ stage, done }: { stage: number; done: boolean }) {
  const steps = [M.stepPrepare, M.stepVerify, M.stepInspect, M.stepHandover];
  return (
    <View className="mb-4 flex-row rounded-card border border-outline-variant bg-surface p-2">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = done || number < stage;
        const active = !done && number === stage;
        return (
          <View key={label} className="min-w-0 flex-1 items-center gap-1 px-0.5 py-1">
            <View
              className={`h-7 w-7 items-center justify-center rounded-lg ${complete ? "bg-success" : active ? "bg-primary" : "bg-neutral-soft"}`}
            >
              <Text
                className={`font-body-bold text-[11px] ${complete || active ? "text-primary-foreground" : "text-muted"}`}
              >
                {complete ? "✓" : number.toString().padStart(2, "0")}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              className={`text-center font-body-medium text-[9px] leading-3 ${active ? "text-primary" : complete ? "text-success" : "text-muted"}`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function VerificationRow({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`h-5 w-5 items-center justify-center rounded-full ${passed ? "bg-success-soft" : "bg-warning-soft"}`}
      >
        <Text
          className={`font-body-bold text-[11px] ${passed ? "text-success" : "text-warning-strong"}`}
        >
          {passed ? "✓" : "!"}
        </Text>
      </View>
      <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2">
        <Text className="shrink font-body text-[12px] leading-5 text-muted">{label}</Text>
        <Text className="min-w-0 shrink font-body-semibold text-[12px] leading-5 text-ink">
          {value}
        </Text>
      </View>
    </View>
  );
}
function InspectionEditor({
  record,
  busy,
  onSave,
  onPhoto,
  onRemovePhoto,
}: {
  record: InspectionRecord;
  busy: boolean;
  onSave: (input: UpdateInspectionInput) => void;
  onPhoto: (camera: boolean) => void;
  onRemovePhoto: (id: string) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [results, setResults] = useState<HandoverChecklistItemResult[]>(() =>
    Array.isArray(record.checklist.results)
      ? record.checklist.results.flatMap((item) => {
          const parsed = HandoverChecklistItemResultSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [],
  );
  const [notes, setNotes] = useState(record.notes ?? "");
  const [condition, setCondition] = useState<"GOOD" | "MINOR_DAMAGE" | "MAJOR_DAMAGE">(
    record.condition ?? "GOOD",
  );
  const locked = record.status === "PASSED" || record.status === "FAILED";
  const selectedPhoto = record.evidence[photoIndex];
  useEffect(() => {
    setPhotoIndex((current) => Math.min(current, Math.max(0, record.evidence.length - 1)));
  }, [record.evidence.length]);
  const canPass =
    HandoverChecklistCompletionSchema.safeParse(results).success && condition !== "MAJOR_DAMAGE";
  const input = (status: "IN_PROGRESS" | "PASSED"): UpdateInspectionInput => ({
    status,
    condition,
    notes,
    checklist: { ...record.checklist, results },
  });
  return (
    <Card title={M.checklist}>
      {HANDOVER_CHECKLIST_ITEMS.map((item) => (
        <View key={item.code} className="mb-5 rounded-xl bg-slate-50 p-3">
          <Text className="mb-3 font-semibold leading-6 text-slate-800">{item.label}</Text>
          <View className="flex-row gap-2">
            {(["PASS", "FAIL"] as const).map((result) => {
              const selected =
                results.find((entry) => entry.itemCode === item.code)?.result === result;
              return (
                <Pressable
                  key={result}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label}: ${result === "PASS" ? M.pass : M.fail}`}
                  accessibilityState={{ checked: selected, disabled: locked || busy }}
                  disabled={locked || busy}
                  onPress={() =>
                    setResults((previous) => [
                      ...previous.filter((entry) => entry.itemCode !== item.code),
                      {
                        itemCode: item.code,
                        resultType: "PASS_FAIL",
                        result,
                        note: previous.find((entry) => entry.itemCode === item.code)?.note ?? null,
                        photos:
                          previous.find((entry) => entry.itemCode === item.code)?.photos ?? [],
                      },
                    ])
                  }
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${selected ? (result === "PASS" ? "border-primary bg-primary" : "border-danger-strong bg-danger-strong") : "border-outline-variant bg-customer-canvas"}`}
                >
                  <Text
                    className={`font-semibold ${selected ? "text-primary-foreground" : "text-muted"}`}
                  >
                    {result === "PASS" ? M.pass : M.fail}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Text className="mb-2 font-semibold text-slate-900">{M.condition}</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: condition === value, disabled: locked || busy }}
            disabled={locked || busy}
            onPress={() => setCondition(value)}
            className={`min-h-11 justify-center rounded-lg border px-3 ${condition === value ? "border-emerald-700 bg-emerald-50" : "border-slate-200"}`}
          >
            <Text className="text-sm text-slate-700">
              {value === "GOOD" ? M.good : value === "MINOR_DAMAGE" ? M.minor : M.major}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={M.notes}
        multiline
        maxLength={4000}
        editable={!locked && !busy}
        value={notes}
        onChangeText={setNotes}
      />
      <View className="mb-4 rounded-xl border border-outline-variant bg-customer-canvas p-3">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text className="font-body-semibold text-label text-ink">{M.photos}</Text>
          <Text className="font-body-medium text-label text-muted">
            {record.evidence.length}/{INSPECTION_PHOTO_MAX_COUNT}
          </Text>
        </View>
        {selectedPhoto && (
          <View key={selectedPhoto.id}>
            <MobilePhoto label={M.photos} source={{ uri: selectedPhoto.url }} tall previewable />
            {record.evidence.length > 1 && (
              <View className="mb-3 flex-row items-center justify-between gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={M.previousPhoto}
                  accessibilityState={{ disabled: photoIndex === 0 }}
                  disabled={photoIndex === 0}
                  onPress={() => setPhotoIndex((current) => Math.max(0, current - 1))}
                  className={`min-h-10 flex-row items-center gap-1 rounded-lg px-2 ${photoIndex === 0 ? "opacity-40" : "active:bg-primary-soft"}`}
                >
                  <Icon as={ChevronLeft} size={18} className="text-primary" />
                  <Text className="font-body-semibold text-[12px] text-primary">
                    {M.previousPhoto}
                  </Text>
                </Pressable>
                <Text className="font-body-semibold text-[12px] text-muted">
                  {photoIndex + 1}/{record.evidence.length}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={M.nextPhoto}
                  accessibilityState={{ disabled: photoIndex === record.evidence.length - 1 }}
                  disabled={photoIndex === record.evidence.length - 1}
                  onPress={() =>
                    setPhotoIndex((current) => Math.min(record.evidence.length - 1, current + 1))
                  }
                  className={`min-h-10 flex-row items-center gap-1 rounded-lg px-2 ${photoIndex === record.evidence.length - 1 ? "opacity-40" : "active:bg-primary-soft"}`}
                >
                  <Text className="font-body-semibold text-[12px] text-primary">{M.nextPhoto}</Text>
                  <Icon as={ChevronRight} size={18} className="text-primary" />
                </Pressable>
              </View>
            )}
            {!locked && (
              <Button
                danger
                label={M.removePhoto}
                disabled={busy}
                onPress={() => onRemovePhoto(selectedPhoto.id)}
              />
            )}
          </View>
        )}
        {!locked && (
          <>
            <Button
              secondary
              label={M.addPhoto}
              disabled={busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
              onPress={() => onPhoto(false)}
            />
            <Button
              secondary
              label={M.takePhoto}
              disabled={busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
              onPress={() => onPhoto(true)}
            />
          </>
        )}
      </View>
      {!locked && (
        <>
          <Button
            label={M.saveDraft}
            secondary
            disabled={busy}
            onPress={() => onSave(input("IN_PROGRESS"))}
          />
          <Button
            label={M.savePassed}
            disabled={busy || !canPass}
            onPress={() => onSave(input("PASSED"))}
          />
        </>
      )}
    </Card>
  );
}
