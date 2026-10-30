import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { facilityDay } from "../../components/ui/calendar-field";
import { Button, Card, dateTime, Heading, Notice, Row } from "../../components/ui/mobile-ui";
import { ScreenFrame } from "../../components/ui/screen-frame";
import { StatusPill } from "../../components/ui/workspace-ui";
import { authClient } from "../../lib/auth-client";
import { NotificationScreen } from "../notifications/notification-screen";
import { STAFF_API_UI as M } from "./staff-api.messages";
import type { StaffSelection, StaffWorkFilters, StaffWorkspaceProps } from "./staff-api.types";
import { StaffCheckInView } from "./staff-check-in-view";
import { staffWorkDate, staffWorkGroup, staffWorkScheduledAt } from "./staff-work.helpers";
import { StaffStatusTabs, StaffWorkFiltersBar } from "./staff-work-filters";
import { StaffWorkspaceHeader } from "./staff-workspace-header";
import { staffError, useStaffTaskAction, useStaffWorkspace } from "./use-staff-workspace";

export function StaffWorkspace({ owner, name, onHome }: StaffWorkspaceProps) {
  const [filters, setFilters] = useState<StaffWorkFilters>({
    group: "pending",
    kind: "all",
    search: "",
    date: facilityDay(),
  });
  const [selection, setSelection] = useState<StaffSelection | null>(null);
  const [notifications, setNotifications] = useState(false);
  const work = useStaffWorkspace(owner, filters);
  const client = useQueryClient();
  const scroll = useRef<ScrollView>(null);
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
          onLogout={() => {
            void authClient.signOut();
          }}
        />
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-4 py-5 sm:px-6"
          refreshControl={
            <RefreshControl
              refreshing={work.refreshing}
              onRefresh={() => {
                void work.refresh();
              }}
              tintColor="#065f46"
            />
          }
        >
          <View className="mx-auto w-full max-w-3xl">
            {notifications ? (
              <NotificationScreen owner={owner} />
            ) : selection ? (
              selection.kind === "appointment" ? (
                <StaffCheckInView
                  key={selection.appointment.id}
                  owner={owner}
                  appointment={selection.appointment}
                />
              ) : (
                <StaffTaskView key={selection.task.id} owner={owner} selection={selection} />
              )
            ) : (
              <>
                <View className="mb-5">
                  <Text
                    accessibilityRole="header"
                    aria-level={Platform.OS === "web" ? 1 : undefined}
                    className="text-2xl font-bold leading-8 text-slate-900"
                  >
                    {M.title}
                  </Text>
                  <Text className="mt-1 text-sm text-slate-500">
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
                  <Text className="mb-4 text-xs text-slate-500">{M.closedHint}</Text>
                )}
                {work.pending && (
                  <ActivityIndicator accessibilityLabel={M.loading} color="#065f46" />
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
                {work.returnsUnavailable && filters.kind === "return" && (
                  <Notice>{M.returnsUnavailable}</Notice>
                )}
                {!work.pending &&
                  !work.error &&
                  work.facility &&
                  !work.items.length &&
                  !(work.returnsUnavailable && filters.kind === "return") && (
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
                {work.tasks.hasNextPage && (
                  <Button
                    secondary
                    label={M.more}
                    disabled={work.tasks.isFetchingNextPage}
                    onPress={() => {
                      void work.more();
                    }}
                  />
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
        bookingCode: appointment.reservationId ?? appointment.id,
        assignedUnit: appointment.assignedUnit,
        handoverStage: undefined as string | undefined,
      }
    : null;
  const task = item.kind === "task" ? item.task : null;
  const status = booking?.status ?? task?.status ?? "";
  const group = staffWorkGroup(item);
  const done = group === "done",
    closed = group === "closed";
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
  const date = staffWorkScheduledAt(item);
  const activeBooking = booking?.status === "CONFIRMED";
  const statusLabel =
    activeBooking && booking.handoverStage === "INSPECTING"
      ? M.status.INSPECTING
      : activeBooking && booking.handoverStage === "READY_HANDOVER"
        ? M.readyHandover
        : (M.status[status] ?? status);
  const timeLabel = date
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(date))
    : M.noTime;
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
  return (
    <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
            <Text className="text-base font-bold text-emerald-800">{booking ? "↘" : "✓"}</Text>
          </View>
          <Text numberOfLines={1} className="min-w-0 flex-1 text-xs font-semibold text-emerald-800">
            {booking ? M.bookings : M.type[task?.type ?? ""]}
          </Text>
        </View>
        <StatusPill label={statusLabel} tone={done ? "green" : closed ? "neutral" : "blue"} />
      </View>
      <Text numberOfLines={2} className="mb-1 text-base font-bold leading-6 text-slate-900">
        {booking?.contactName ?? task?.description ?? M.type[task?.type ?? ""]}
      </Text>
      {booking && (
        <>
          <Text numberOfLines={1} className="mt-1 text-xs text-slate-500">
            {booking?.bookingCode}
          </Text>
          <Text numberOfLines={1} className="mt-1 text-xs text-slate-600">
            {booking?.assignedUnit?.physicalUnitCode ?? M.noUnit}
          </Text>
        </>
      )}
      <View className="mt-4 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-slate-800">{timeLabel}</Text>
          {!!dateLabel && <Text className="mt-1 text-xs text-slate-500">{dateLabel}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onOpen}
          className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-3 ${done || closed ? "bg-slate-100" : "bg-emerald-900"}`}
        >
          <Text className={`text-xs font-bold ${done || closed ? "text-slate-700" : "text-white"}`}>
            {action}
          </Text>
          <Text className={done || closed ? "text-slate-600" : "text-emerald-100"}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StaffTaskView({
  owner,
  selection,
}: {
  owner: string;
  selection: Extract<StaffSelection, { kind: "task" }>;
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
            onPress={() => update.mutate("IN_PROGRESS", { onSuccess: setTask })}
          />
        )}
        {task.status === "IN_PROGRESS" && (
          <Button
            label={M.completeTask}
            disabled={update.isPending}
            onPress={() => update.mutate("COMPLETED", { onSuccess: setTask })}
          />
        )}
        {update.error && <Notice error>{staffError(update.error)}</Notice>}
        {update.isSuccess && <Notice>{M.updated}</Notice>}
      </Card>
    </>
  );
}
