import type { AppointmentRecordDto } from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  type HandoverChecklistItemResult,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
  type InspectionRecord,
  ReturnChecklistCompletionSchema,
  type UpdateInspectionInput,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { Banknote, Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "../../components/ui/icon";
import { MobilePhoto } from "../../components/ui/mobile-photo";
import { Button, Card, dateTime, Field, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { StatusPill } from "../../components/ui/workspace-ui";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
import { staffError, useStaffReturn } from "../../features/staff-api/use-staff-workspace";

type Violation = { code: string; note: string };
type Condition = NonNullable<InspectionRecord["condition"]>;

export function StaffReturnView({
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
  const flow = useStaffReturn(owner, appointment.id);
  const current = flow.appointment.data ?? appointment;
  const record = flow.record;
  const [results, setResults] = useState<HandoverChecklistItemResult[]>([]);
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [notes, setNotes] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const hydratedRecordId = useRef<string | null>(null);

  useEffect(() => {
    if (!record || hydratedRecordId.current === record.id) return;
    hydratedRecordId.current = record.id;
    setResults(
      Array.isArray(record.checklist.results)
        ? record.checklist.results.flatMap((item) => {
            const parsed = HandoverChecklistItemResultSchema.safeParse(item);
            return parsed.success ? [parsed.data] : [];
          })
        : [],
    );
    setCondition(record.condition ?? "GOOD");
    setNotes(record.notes ?? "");
    setViolations(
      record.returnContext?.fees.map(({ code, note }) => ({ code, note: note ?? "" })) ?? [],
    );
    setSettlementConfirmed(false);
  }, [record]);

  const scheduledAt = dateTime(`${current.scheduledDate}T${current.slotStart ?? "00:00:00"}+07:00`);
  const returnContext = record?.returnContext;
  const availableFees =
    record?.status === "PASSED" ? (returnContext?.fees ?? []) : (returnContext?.penalties ?? []);
  const selectedFees = availableFees.filter((fee) =>
    violations.some((item) => item.code === fee.code),
  );
  const feeTotal = selectedFees.reduce((sum, fee) => sum + fee.amount, 0);
  const depositAmount = returnContext?.depositAmount ?? 0;
  const refundAmount = Math.max(0, depositAmount - feeTotal);
  const debtAmount = Math.max(0, feeTotal - depositAmount);
  const checklistComplete = ReturnChecklistCompletionSchema.safeParse(results).success;
  const canFinalize =
    Boolean(returnContext) && checklistComplete && Boolean(condition) && settlementConfirmed;
  const locked = record?.status === "PASSED";
  const selectedPhoto = record?.evidence[photoIndex];

  const previousCountRef = useRef(record?.evidence.length ?? 0);
  useEffect(() => {
    const currentLength = record?.evidence.length ?? 0;
    if (currentLength > previousCountRef.current) {
      setPhotoIndex(currentLength - 1);
    } else {
      setPhotoIndex((currentIndex) => Math.min(currentIndex, Math.max(0, currentLength - 1)));
    }
    previousCountRef.current = currentLength;
  }, [record?.evidence.length]);

  function setChecklistResult(code: string, result: "PASS" | "FAIL") {
    setResults((previous) => [
      ...previous.filter((item) => item.itemCode !== code),
      {
        itemCode: code,
        resultType: "PASS_FAIL",
        result,
        note: previous.find((item) => item.itemCode === code)?.note ?? null,
        photos: previous.find((item) => item.itemCode === code)?.photos ?? [],
      },
    ]);
  }

  function save(status: "IN_PROGRESS" | "PASSED") {
    if (!record || !returnContext) return;
    const input: UpdateInspectionInput = {
      status,
      condition,
      notes,
      checklist: { ...record.checklist, results },
      policyVersion: returnContext.policyVersion,
      violations,
      ...(status === "PASSED"
        ? {
            settlement: {
              confirmed: true as const,
              deductionAmount: feeTotal,
              ...(refundAmount > 0
                ? {
                    refund: {
                      method: "CASH" as const,
                    },
                  }
                : {}),
            },
          }
        : {}),
    };
    flow.save.mutate(input, {
      onSuccess: () => onNotify("success", status === "PASSED" ? M.returnFinalized : M.returnSaved),
      onError: (error) => onNotify("error", staffError(error)),
    });
  }

  if (current.appointmentType !== "CHECK_OUT") return <Notice error>{M.returnLoadError}</Notice>;

  return (
    <View>
      <View className="mb-4">
        <Heading>{`${M.inspectReturn} · ${formatReference(current.rentalId ?? current.id, current.rentalId ? "KT" : "LH")}`}</Heading>
        <Text className="mt-1 font-body text-[12px] leading-5 text-muted">{scheduledAt}</Text>
      </View>
      {flow.error ? (
        <View className="mb-3">
          <Notice error>{staffError(flow.error)}</Notice>
          <Button variant="outline" label={M.retry} onPress={() => void flow.refresh()} />
        </View>
      ) : null}

      <Card title={M.returnAppointment}>
        <View className="mb-3 flex-row flex-wrap gap-2">
          <StatusPill
            label={
              current.status === "CONFIRMED"
                ? M.returnConfirmed
                : current.status === "COMPLETED"
                  ? M.returnDone
                  : current.status === "SCHEDULED"
                    ? M.returnAwaitingManager
                    : (M.status[current.status] ?? current.status)
            }
            tone={
              current.status === "COMPLETED"
                ? "green"
                : current.status === "CANCELLED"
                  ? "red"
                  : "blue"
            }
          />
          {record ? (
            <StatusPill
              label={M.status[record.status] ?? record.status}
              tone={
                record.status === "PASSED" ? "green" : record.status === "FAILED" ? "red" : "blue"
              }
            />
          ) : null}
        </View>
        <Row label={M.customer} value={current.customerName ?? M.customer} />
        <Row label={M.phone} value={current.contactPhone || M.noPhone} />
        <Row label={M.returnUnitCode} value={record?.unitCode ?? M.unitPendingInspection} />
        <Row label={M.time} value={scheduledAt} />
      </Card>

      {(flow.appointment.isPending || flow.tasks.isPending || flow.history.isPending) && (
        <View className="py-4">
          <ActivityIndicator color="#065f46" accessibilityLabel={M.loading} />
        </View>
      )}

      {!record && flow.appointment.isSuccess && flow.tasks.isSuccess && (
        <Card title={M.returnReady}>
          <Text className="mb-4 font-body text-[13px] leading-6 text-muted">
            {M.returnStartHint}
          </Text>
          {!flow.task ? <Notice error>{M.inspectionTaskUnavailable}</Notice> : null}
          {current.status !== "CONFIRMED" ? <Notice>{M.returnAwaitingManager}</Notice> : null}
          <Button
            label={M.returnStart}
            loading={flow.start.isPending}
            disabled={!flow.task || current.status !== "CONFIRMED" || flow.busy}
            onPress={() =>
              flow.start.mutate(undefined, {
                onSuccess: () => onNotify("success", M.inspectionStartedSuccess),
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        </Card>
      )}

      {record && returnContext && (
        <>
          <Card title={M.returnCheck}>
            {HANDOVER_CHECKLIST_ITEMS.map((item) => {
              const selected = results.find((result) => result.itemCode === item.code);
              return (
                <View key={item.code} className="mb-4 rounded-xl bg-slate-50 p-3">
                  <Text className="mb-3 font-body-semibold text-[13px] leading-5 text-ink">
                    {item.label}
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${item.label}: ${M.pass}`}
                      accessibilityState={{
                        checked: selected?.result === "PASS",
                        disabled: locked || flow.busy,
                      }}
                      disabled={locked || flow.busy}
                      onPress={() => {
                        if (selected?.result === "PASS") {
                          setResults((previous) =>
                            previous.filter((entry) => entry.itemCode !== item.code),
                          );
                        } else {
                          setChecklistResult(item.code, "PASS");
                        }
                      }}
                      className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${selected?.result === "PASS" ? "border-primary bg-primary" : "border-outline-variant bg-surface"}`}
                    >
                      <Text
                        className={`font-semibold ${selected?.result === "PASS" ? "text-primary-foreground" : "text-muted"}`}
                      >
                        {M.pass}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Text className="mb-2 font-body-semibold text-label text-ink">
              {M.returnConditionLabel}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: condition === value,
                    disabled: locked || flow.busy,
                  }}
                  disabled={locked || flow.busy}
                  onPress={() => {
                    setCondition(value);
                    setSettlementConfirmed(false);
                  }}
                  className={`min-h-11 justify-center rounded-lg border px-3 ${condition === value ? "border-primary bg-primary-soft" : "border-outline-variant bg-surface"}`}
                >
                  <Text className="font-body-medium text-[12px] text-ink">
                    {value === "GOOD" ? M.good : value === "MINOR_DAMAGE" ? M.minor : M.major}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={M.inspectionNotes}
              multiline
              maxLength={4000}
              editable={!locked && !flow.busy}
              value={notes}
              onChangeText={setNotes}
            />
          </Card>

          <Card title={M.returnEvidence}>
            <Text className="mb-3 font-body text-[12px] text-muted">
              {record.evidence.length}/{INSPECTION_PHOTO_MAX_COUNT}
            </Text>
            {selectedPhoto ? (
              <View className="mb-3">
                <MobilePhoto
                  label={M.returnEvidence}
                  source={{ uri: selectedPhoto.url }}
                  tall
                  previewable
                />
                {record.evidence.length > 1 ? (
                  <View className="my-2 flex-row justify-between">
                    <Button
                      variant="outline"
                      label={M.previousPhoto}
                      disabled={photoIndex === 0 || flow.busy}
                      onPress={() => setPhotoIndex((value) => Math.max(0, value - 1))}
                    />
                    <Button
                      variant="outline"
                      label={M.nextPhoto}
                      disabled={photoIndex >= record.evidence.length - 1 || flow.busy}
                      onPress={() =>
                        setPhotoIndex((value) => Math.min(record.evidence.length - 1, value + 1))
                      }
                    />
                  </View>
                ) : null}
                {!locked ? (
                  <Button
                    danger
                    label={M.removePhoto}
                    disabled={flow.busy}
                    onPress={() =>
                      flow.removePhoto.mutate(selectedPhoto.id, {
                        onSuccess: () => onNotify("success", M.evidenceRemovedSuccess),
                        onError: (error) => onNotify("error", staffError(error)),
                      })
                    }
                  />
                ) : null}
              </View>
            ) : (
              <Text className="mb-3 font-body text-[12px] text-muted">{M.returnNoEvidence}</Text>
            )}
            {!locked ? (
              <>
                <Button
                  secondary
                  label={M.addPhoto}
                  disabled={flow.busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
                  onPress={() =>
                    flow.photo.mutate(false, {
                      onSuccess: (result) => result && onNotify("success", M.evidenceAddedSuccess),
                      onError: (error) => onNotify("error", staffError(error)),
                    })
                  }
                />
                <Button
                  secondary
                  label={M.takePhoto}
                  disabled={flow.busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
                  onPress={() =>
                    flow.photo.mutate(true, {
                      onSuccess: (result) => result && onNotify("success", M.evidenceAddedSuccess),
                      onError: (error) => onNotify("error", staffError(error)),
                    })
                  }
                />
              </>
            ) : null}
          </Card>

          <Card title={M.returnContext}>
            <Row label={M.returnDeposit} value={`${depositAmount.toLocaleString("vi-VN")} đ`} />
            {returnContext.checkIn ? (
              <Row
                label={M.checkInCondition}
                value={conditionLabelText(returnContext.checkIn.condition)}
              />
            ) : (
              <Text className="font-body text-[12px] leading-5 text-muted">
                {M.noCheckInRecord}
              </Text>
            )}
          </Card>

          <Card title={M.returnFees}>
            {availableFees.length ? (
              availableFees.map((fee) => {
                const selected = violations.find((item) => item.code === fee.code);
                return (
                  <View
                    key={fee.code}
                    className="mb-3 rounded-xl border border-outline-variant p-3"
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: Boolean(selected),
                        disabled: locked || flow.busy,
                      }}
                      disabled={locked || flow.busy}
                      onPress={() => {
                        setSettlementConfirmed(false);
                        setViolations((previous) =>
                          selected
                            ? previous.filter((item) => item.code !== fee.code)
                            : [...previous, { code: fee.code, note: "" }],
                        );
                      }}
                      className="min-h-11 flex-row items-center justify-between gap-2"
                    >
                      <View className="flex-1 flex-row items-center gap-2">
                        <View
                          className={`h-5 w-5 items-center justify-center rounded border ${selected ? "border-primary bg-primary" : "border-outline-variant bg-surface"}`}
                        >
                          {selected ? (
                            <Icon as={Check} size={14} className="text-primary-foreground" />
                          ) : null}
                        </View>
                        <Text className="flex-1 font-body-semibold text-[13px] text-ink">
                          {fee.name}
                        </Text>
                      </View>
                      <Text className="font-body-bold text-[13px] text-ink">
                        {fee.amount.toLocaleString("vi-VN")} đ
                      </Text>
                    </Pressable>
                    {selected ? (
                      <Field
                        label={M.returnFeeNote}
                        value={selected.note}
                        maxLength={1000}
                        editable={!locked && !flow.busy}
                        onChangeText={(note) => {
                          setSettlementConfirmed(false);
                          setViolations((previous) =>
                            previous.map((item) =>
                              item.code === fee.code ? { ...item, note } : item,
                            ),
                          );
                        }}
                      />
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text className="font-body text-[12px] text-muted">{M.returnNoFees}</Text>
            )}
            <Row label={M.returnEstimate} value={`${refundAmount.toLocaleString("vi-VN")} đ`} />
          </Card>

          {!locked ? (
            <Card title={M.settlement}>
              <Row label={M.totalDeductions} value={`${feeTotal.toLocaleString("vi-VN")} đ`} />
              <Row label={M.outstandingDebt} value={`${debtAmount.toLocaleString("vi-VN")} đ`} />
              {refundAmount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={flow.busy}
                  onPress={() => setSettlementConfirmed((value) => !value)}
                  className={`mb-3 min-h-12 flex-row items-center justify-center gap-2 rounded-control border p-3 ${
                    settlementConfirmed
                      ? "border-primary bg-primary-soft"
                      : "border-primary bg-primary"
                  }`}
                >
                  <Icon
                    as={settlementConfirmed ? Check : Banknote}
                    size={16}
                    className={settlementConfirmed ? "text-primary" : "text-primary-foreground"}
                  />
                  <Text
                    className={`font-body-bold text-[13px] ${
                      settlementConfirmed ? "text-primary" : "text-primary-foreground"
                    }`}
                  >
                    {settlementConfirmed
                      ? M.returnRefundRecorded(refundAmount.toLocaleString("vi-VN"))
                      : M.returnRecordRefund(refundAmount.toLocaleString("vi-VN"))}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: settlementConfirmed, disabled: flow.busy }}
                  disabled={flow.busy}
                  onPress={() => setSettlementConfirmed((value) => !value)}
                  className="mb-3 min-h-12 flex-row items-center gap-3 rounded-control border border-outline-variant p-3"
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded border ${settlementConfirmed ? "border-primary bg-primary" : "border-outline-variant bg-surface"}`}
                  >
                    {settlementConfirmed ? (
                      <Icon as={Check} size={14} className="text-primary-foreground" />
                    ) : null}
                  </View>
                  <Text className="flex-1 font-body-medium text-[12px] leading-5 text-ink">
                    {M.settlementConfirmed}
                  </Text>
                </Pressable>
              )}
              <Button
                variant="outline"
                label={M.returnSave}
                disabled={flow.busy}
                loading={flow.save.isPending}
                onPress={() => save("IN_PROGRESS")}
              />
              <Button
                label={M.returnFinalize}
                disabled={!canFinalize || flow.busy}
                loading={flow.save.isPending}
                onPress={() => save("PASSED")}
              />
            </Card>
          ) : (
            <Card>
              <Notice>{M.returnFinalized}</Notice>
              {onBack ? <Button variant="outline" label={M.back} onPress={onBack} /> : null}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

function conditionLabelText(condition: InspectionRecord["condition"]) {
  if (condition === "GOOD") return M.good;
  if (condition === "MINOR_DAMAGE") return M.minor;
  if (condition === "MAJOR_DAMAGE") return M.major;
  return M.returnMissing;
}
