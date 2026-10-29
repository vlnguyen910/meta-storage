import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
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
import { staffWorkGroup, staffWorkScheduledAt } from "./staff-work.helpers";
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
  const task = item.kind === "task" ? item.task : null;
  const group = staffWorkGroup(item);
  const date = staffWorkScheduledAt(item);
  return (
    <Card title={appointment?.customerName ?? task?.description ?? M.title}>
      <StatusPill
        label={
          M.status[appointment?.status ?? task?.status ?? ""] ??
          appointment?.status ??
          task?.status ??
          ""
        }
        tone={group === "done" ? "green" : "blue"}
      />
      {date && <Row label={M.time} value={dateTime(date)} />}
      {appointment?.contactPhone && <Row label={M.phone} value={appointment.contactPhone} />}
      <Button label={M.open} onPress={onOpen} />
    </Card>
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
