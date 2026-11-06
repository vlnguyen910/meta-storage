import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { FlatList, Platform, Pressable, Text, View } from "react-native";
import type { AppointmentsScreenProps } from "../../common/customer-home.types";
import { formatAppointmentDate, vietnamDate } from "../../common/customer-home.utils";
import { Button, ChoiceTabs, Icon, IconButton, Notice, SectionHeading } from "../../components/ui";
import { AppointmentCard } from "../../features/customer-home/components/appointment-card";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { CUSTOMER_HOME as M } from "../../features/customer-home/customer-home.messages";
import { useAppointmentList } from "../../features/customer-home/use-customer-home";

export function AppointmentsScreen({
  owner,
  onAppointment,
  onUnavailable,
}: AppointmentsScreenProps) {
  const state = useAppointmentList(owner);
  return (
    <>
      <FlatList
        data={state.visible}
        keyExtractor={(a) => a.id}
        contentContainerClassName="grow px-4 py-4"
        refreshing={state.query.isRefetching}
        onRefresh={() => void state.query.refetch()}
        ListHeaderComponent={
          <View className="mx-auto w-full max-w-3xl">
            <ChoiceTabs
              value={state.filter}
              onChange={state.setFilter}
              options={(
                [
                  ["all", M.all],
                  ["upcoming", M.upcomingTab],
                  ["completed", M.completedTab],
                  ["closed", M.closedTab],
                ] as const
              ).map(([value, label]) => ({ value, label: `${label} (${state.counts[value]})` }))}
            />
            {state.facilities.length > 1 ? (
              <ChoiceTabs
                value={state.facility}
                onChange={state.setFacility}
                options={[
                  { value: "", label: M.allFacilities },
                  ...state.facilities.map(([value, label]) => ({ value, label })),
                ]}
              />
            ) : null}
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-body-bold text-body text-primary">
                {formatAppointmentDate(state.week)}
              </Text>
              <View className="flex-row items-center">
                <IconButton
                  icon={ChevronLeft}
                  label={M.previousWeek}
                  onPress={() => state.moveWeek(-1)}
                />
                <Button label={M.thisWeek} variant="ghost" onPress={state.resetWeek} />
                <IconButton
                  icon={ChevronRight}
                  label={M.nextWeek}
                  onPress={() => state.moveWeek(1)}
                />
              </View>
            </View>
            <View className="mb-6 flex-row gap-1">
              {state.days.map((date, index) => (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={formatAppointmentDate(date)}
                  accessibilityState={
                    Platform.OS === "web" ? undefined : { selected: state.day === date }
                  }
                  aria-pressed={state.day === date}
                  onPress={() => state.setDay(state.day === date ? undefined : date)}
                  className={`min-h-[72px] min-w-touch flex-1 items-center justify-center gap-1 rounded-control web:focus-visible:outline-2 web:focus-visible:outline-ring ${state.day === date ? "bg-primary" : date === vietnamDate(state.now) ? "bg-primary-soft" : "bg-surface"}`}
                >
                  <Text
                    className={`font-body text-[10px] ${state.day === date ? "text-primary-foreground" : "text-primary"}`}
                  >
                    {M.weekdays[index]}
                  </Text>
                  <Text
                    className={`font-body-bold text-body ${state.day === date ? "text-primary-foreground" : "text-primary"}`}
                  >
                    {date.slice(-2)}
                  </Text>
                  <View
                    className={`h-1 w-1 rounded-full ${state.query.data?.some((a) => a.scheduledDate === date) ? (state.day === date ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`}
                  />
                </Pressable>
              ))}
            </View>
            <SectionHeading title={`${M.weekAppointments} · ${state.visible.length}`} />
            <QueryFeedback
              pending={state.query.isPending}
              error={state.query.isError}
              retry={() => void state.query.refetch()}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-auto w-full max-w-3xl">
            <AppointmentCard
              variant="list"
              appointment={item}
              onPress={() => onAppointment(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          state.query.isSuccess ? (
            <View className="mx-auto w-full max-w-3xl">
              <Notice>{M.emptyAppointments}</Notice>
            </View>
          ) : null
        }
      />
      <View className="border-t border-line bg-surface px-4 py-3">
        <View className="mx-auto w-full max-w-3xl">
          <Button
            label={M.newAppointment}
            leadingIcon={<Icon as={Plus} className="text-primary-foreground" />}
            onPress={onUnavailable}
          />
        </View>
      </View>
    </>
  );
}
