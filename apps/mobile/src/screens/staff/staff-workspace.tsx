import { formatReference } from "@metastorage/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, Clock3, DoorOpen, Warehouse } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import type {
  StaffSelection,
  StaffWorkFilters,
  StaffWorkspaceProps,
} from "../../common/staff-api.types";
import { staffWorkDate, staffWorkGroup, staffWorkScheduledAt } from "../../common/staff-work.utils";
import { facilityDay } from "../../components/ui/calendar-field";
import { Icon } from "../../components/ui/icon";
import { Button, Card, dateTime, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { ScreenFrame } from "../../components/ui/screen-frame";
import { StatusPill } from "../../components/ui/workspace-ui";
import { STAFF_API_UI as M } from "../../features/staff-api/staff-api.messages";
import {
  staffError,
  useStaffTaskAction,
  useStaffWorkspace,
} from "../../features/staff-api/use-staff-workspace";
import { NotificationScreen } from "../notifications/notification-screen";
import { StaffCheckInView } from "./staff-check-in-view";
import { StaffStatusTabs, StaffWorkFiltersBar } from "./staff-work-filters";
import { StaffWorkspaceHeader } from "./staff-workspace-header";

type FeedbackKind = "success" | "error";

export function StaffWorkspace({ owner, name, onHome, onLogout }: StaffWorkspaceProps) {
  const [filters, setFilters] = useState<StaffWorkFilters>({
    group: "pending",
    kind: "all",
    search: "",
    date: "",
  });
  const [selection, setSelection] = useState<StaffSelection | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; message: string } | null>(null);
  const work = useStaffWorkspace(owner, filters);
  const client = useQueryClient();
  const scroll = useRef<ScrollView>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((kind: FeedbackKind, message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ kind, message });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  }, []);
  const selectionId = notifications
    ? "notifications"
    : selection?.kind === "appointment"
      ? selection.appointment.id
      : selection?.task.id;
  const previousRoute = useRef(selectionId);
  const back = () => {
    setSelection(null);
    setNotifications(false);
  };
  useEffect(() => {
    if (previousRoute.current !== selectionId) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      previousRoute.current = selectionId;
    }
  }, [selectionId]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!selection && !notifications) {
        if (onHome) {
          onHome();
          return true;
        }
        return false;
      }
      setSelection(null);
      setNotifications(false);
      return true;
    });
    return () => listener.remove();
  }, [selection, notifications, onHome]);
  useEffect(
    () => () => {
      void client.cancelQueries({ predicate: (query) => query.queryKey.includes(owner) });
      client.removeQueries({ predicate: (query) => query.queryKey.includes(owner) });
    },
    [client, owner],
  );
  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );
  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StaffWorkspaceHeader
          name={name}
          subtitle={work.facility?.facilityName ?? M.role}
          onHome={onHome}
          onNotifications={() => setNotifications(true)}
          onBack={selection || notifications ? back : undefined}
          onLogout={onLogout}
        />
        {feedback ? (
          <View pointerEvents="none" className="absolute left-4 right-4 top-16 z-50">
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className={`flex-row items-start gap-2 rounded-xl border px-4 py-3 shadow-soft ${feedback.kind === "success" ? "border-success-line bg-success-soft" : "border-danger-line bg-danger-soft"}`}
            >
              <Text
                className={`font-body-bold text-[15px] ${feedback.kind === "success" ? "text-success" : "text-danger-strong"}`}
              >
                {feedback.kind === "success" ? "✓" : "!"}
              </Text>
              <Text
                className={`min-w-0 flex-1 font-body-semibold text-[13px] leading-5 ${feedback.kind === "success" ? "text-success" : "text-danger-strong"}`}
              >
                {feedback.message}
              </Text>
            </View>
          </View>
        ) : null}
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-4 py-4 sm:px-6"
          refreshControl={
            <RefreshControl
              refreshing={work.refreshing}
              onRefresh={() => {
                void work.refresh();
              }}
              tintColor="#165f4d"
            />
          }
        >
          <View className="mx-auto w-full max-w-xl">
            {notifications ? (
              <NotificationScreen owner={owner} />
            ) : selection ? (
              selection.kind === "appointment" ? (
                <StaffCheckInView
                  key={selection.appointment.id}
                  owner={owner}
                  appointment={selection.appointment}
                  onBack={() => setSelection(null)}
                  onNotify={notify}
                />
              ) : (
                <StaffTaskView
                  key={selection.task.id}
                  owner={owner}
                  selection={selection}
                  onNotify={notify}
                />
              )
            ) : (
              <>
                <View className="mb-3">
                  <Text
                    accessibilityRole="header"
                    aria-level={Platform.OS === "web" ? 1 : undefined}
                    className="font-body-bold text-[23px] leading-8 text-ink"
                  >
                    {M.title}
                  </Text>
                  <Text className="mt-0.5 font-body text-[12px] leading-5 text-muted">
                    {filters.date
                      ? new Intl.DateTimeFormat("vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh",
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        }).format(new Date(`${filters.date}T12:00:00+07:00`))
                      : M.allDates}
                  </Text>
                </View>
                <StaffStatusTabs
                  value={filters.group}
                  counts={work.pending || work.error || work.hasMore ? undefined : work.counts}
                  onChange={(group) => setFilters((f) => ({ ...f, group }))}
                />
                <StaffWorkFiltersBar filters={filters} onChange={setFilters} />
                {filters.group === "closed" && (
                  <Text className="mb-3 font-body text-[12px] leading-5 text-muted">
                    {M.closedHint}
                  </Text>
                )}
                {work.pending && (
                  <ActivityIndicator accessibilityLabel={M.loading} color="#165f4d" />
                )}
                {work.error && (
                  <>
                    <Notice error>{staffError(work.error)}</Notice>
                    <Button
                      secondary
                      label={M.retry}
                      onPress={() => {
                        void work.refresh();
                      }}
                    />
                  </>
                )}
                {work.assignments.isSuccess && !work.facility && <Notice>{M.noFacility}</Notice>}
                {!work.pending && !work.error && work.facility && !work.items.length && (
                  <Card title={M.empty}>
                    <Text className="text-sm leading-6 text-slate-500">{M.emptyHint}</Text>
                  </Card>
                )}
                {work.items.map((item) => (
                  <StaffWorkCard
                    key={
                      item.kind === "appointment"
                        ? `booking:${item.appointment.id}`
                        : `task:${item.task.id}`
                    }
                    item={item}
                    onOpen={() => setSelection(item)}
                  />
                ))}
                {!work.pending && !work.error && work.facility && (
                  <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2.5">
                    <Text className="font-body text-[12px] leading-5 text-muted">
                      {M.showingWork(
                        work.items.length,
                        work.pending || work.error || work.hasMore
                          ? undefined
                          : work.counts[filters.group],
                      )}
                    </Text>
                    {work.tasks.hasNextPage ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: work.tasks.isFetchingNextPage,
                          busy: work.tasks.isFetchingNextPage,
                        }}
                        disabled={work.tasks.isFetchingNextPage}
                        onPress={() => void work.more()}
                        className="min-h-touch flex-row items-center gap-1 rounded-lg px-2 active:bg-primary-soft"
                      >
                        <Text className="font-body-semibold text-[12px] text-primary">
                          {work.tasks.isFetchingNextPage ? M.loadingShort : M.more}
                        </Text>
                        <Icon as={ArrowRight} size={14} className="text-primary" />
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}
function StaffWorkCard({ item, onOpen }: { item: StaffSelection; onOpen: () => void }) {
  const appointment = item.kind === "appointment" ? item.appointment : null;
  const booking = appointment
    ? {
        status: appointment.status,
        contactName: appointment.customerName,
        bookingCode: formatReference(
          appointment.reservationId ?? appointment.id,
          appointment.reservationId ? "BK" : "LH",
        ),
        assignedUnit: appointment.assignedUnit,
        handoverStage: appointment.handoverStage,
        slotStart: appointment.slotStart,
        slotEnd: appointment.slotEnd,
      }
    : null;
  const task = item.kind === "task" ? item.task : null;
  const status = booking?.status ?? task?.status ?? "";
  const group = staffWorkGroup(item);
  const done = group === "done";
  const closed = group === "closed";
  const action =
    done || closed
      ? M.view
      : booking
        ? booking.handoverStage === "READY_HANDOVER"
          ? M.continueHandover
          : booking.handoverStage === "INSPECTING"
            ? M.continueInspection
            : M.checkIn
        : task?.status === "IN_PROGRESS"
          ? M.continueTask
          : M.open;
  const scheduledAt = staffWorkScheduledAt(item);
  const statusLabel =
    booking?.status === "CONFIRMED" && booking.handoverStage === "INSPECTING"
      ? M.status.INSPECTING
      : booking?.status === "CONFIRMED" && booking.handoverStage === "READY_HANDOVER"
        ? M.readyHandover
        : (M.status[status] ?? status);
  const timeLabel = booking
    ? [booking.slotStart, booking.slotEnd]
        .filter(Boolean)
        .map((time) => time?.slice(0, 5))
        .join(" – ") || M.noTime
    : task?.assignedAt
      ? dateTime(task.assignedAt)
      : M.noTime;
  const date = scheduledAt ?? task?.assignedAt;
  const dateLabel = date
    ? staffWorkDate(date) === facilityDay()
      ? M.today
      : new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(date))
    : "";
  const statusTone = done
    ? "green"
    : closed
      ? status === "CANCELLED" || status === "NO_SHOW"
        ? "red"
        : "neutral"
      : booking
        ? booking.handoverStage === "INSPECTING"
          ? "blue"
          : booking.handoverStage === "READY_HANDOVER"
            ? "amber"
            : booking.status === "CONFIRMED"
              ? "green"
              : "amber"
        : task?.status === "IN_PROGRESS"
          ? "blue"
          : "amber";
  const accent = done
    ? "border-l-success-line"
    : closed
      ? "border-l-outline-variant"
      : booking
        ? "border-l-warning-line"
        : "border-l-info-line";
  const TaskIcon = booking
    ? DoorOpen
    : task?.type === "UNIT_INSPECTION"
      ? ClipboardCheck
      : Warehouse;
  return (
    <View
      className={`mb-3 rounded-xl border border-outline-variant border-l-4 bg-surface p-3.5 shadow-soft ${accent}`}
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary-soft">
            <Icon as={TaskIcon} size={17} className="text-primary" />
          </View>
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 font-body-semibold text-[10px] uppercase tracking-wide text-primary"
          >
            {booking ? M.checkInHandover : M.type[task?.type ?? ""]}
          </Text>
        </View>
        <StatusPill label={statusLabel} tone={statusTone} compact />
      </View>
      <Text numberOfLines={1} className="font-body-bold text-[15px] leading-6 text-ink">
        {booking?.contactName ?? task?.description ?? M.type[task?.type ?? ""]}
      </Text>
      <View className="mt-2 flex-row rounded-lg bg-customer-canvas p-2.5">
        <View className="min-w-0 flex-1 pr-2">
          <Text className="mb-0.5 font-body text-[10px] leading-4 text-muted">
            {booking ? M.locationBooking : M.taskDetails}
          </Text>
          <Text numberOfLines={1} className="font-body-semibold text-[12px] leading-5 text-ink">
            {booking?.assignedUnit?.physicalUnitCode ??
              (booking ? M.noUnit : M.type[task?.type ?? ""])}
          </Text>
          <Text numberOfLines={1} className="font-body text-[10px] leading-4 text-muted">
            {booking?.bookingCode ?? task?.assignerName ?? ""}
          </Text>
        </View>
        <View className="min-w-0 flex-1 border-l border-outline-variant pl-2">
          <Text className="mb-0.5 font-body text-[10px] leading-4 text-muted">
            {booking ? M.appointmentTime : M.assignedAt}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon as={Clock3} size={12} className="text-primary" />
            <Text numberOfLines={1} className="font-body-semibold text-[12px] leading-5 text-ink">
              {timeLabel}
            </Text>
          </View>
          <Text numberOfLines={1} className="font-body text-[10px] leading-4 text-primary">
            {booking ? dateLabel : task?.assignedAt ? dateLabel || M.assignedAt : M.noTime}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onOpen}
        className={`mt-2.5 min-h-10 flex-row items-center justify-center gap-2 rounded-lg px-3 ${done || closed ? "border border-outline-variant bg-surface active:bg-primary-soft" : "bg-primary active:bg-primary-dark"}`}
      >
        <Text
          className={`font-body-semibold text-[12px] ${done || closed ? "text-primary" : "text-primary-foreground"}`}
        >
          {action}
        </Text>
        <Icon
          as={ArrowRight}
          size={15}
          className={done || closed ? "text-primary" : "text-primary-foreground"}
        />
      </Pressable>
    </View>
  );
}

function StaffTaskView({
  owner,
  selection,
  onNotify,
}: {
  owner: string;
  selection: Extract<StaffSelection, { kind: "task" }>;
  onNotify: (kind: FeedbackKind, message: string) => void;
}) {
  const [task, setTask] = useState(selection.task);
  const update = useStaffTaskAction(owner, task);
  return (
    <>
      <Heading>{M.type[task.type] ?? M.tasks}</Heading>
      <Card>
        <StatusPill
          label={M.status[task.status] ?? task.status}
          tone={task.status === "COMPLETED" ? "green" : "blue"}
        />
        <Text className="my-5 text-base leading-7 text-slate-700">
          {task.description || M.type[task.type]}
        </Text>
        <Row label={M.manager} value={task.assignerName} />
        <Row label={M.assignedAt} value={dateTime(task.assignedAt)} />
        {task.status === "ASSIGNED" && (
          <Button
            label={M.startTask}
            disabled={update.isPending}
            loading={update.isPending}
            onPress={() =>
              update.mutate("IN_PROGRESS", {
                onSuccess: (next) => {
                  setTask(next);
                  onNotify("success", M.taskStartedSuccess);
                },
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        )}
        {task.status === "IN_PROGRESS" && (
          <Button
            label={M.completeTask}
            disabled={update.isPending}
            loading={update.isPending}
            onPress={() =>
              update.mutate("COMPLETED", {
                onSuccess: (next) => {
                  setTask(next);
                  onNotify("success", M.taskCompletedSuccess);
                },
                onError: (error) => onNotify("error", staffError(error)),
              })
            }
          />
        )}
        {update.error && <Notice error>{staffError(update.error)}</Notice>}
      </Card>
    </>
  );
}
