import { CalendarDays, Warehouse } from "lucide-react-native";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import type { HomeScreenProps } from "../common/customer-home.types";
import { Button, Notice, SearchField, SectionHeading } from "../components/ui";
import { AppointmentCard } from "../features/customer-home/components/appointment-card";
import { FacilityCard } from "../features/customer-home/components/facility-card";
import { QueryFeedback } from "../features/customer-home/components/query-feedback";
import { SummaryTile } from "../features/customer-home/components/summary-tile";
import { CUSTOMER_HOME as M } from "../features/customer-home/customer-home.messages";
import { useCustomerHome } from "../features/customer-home/use-customer-home";

export function HomeScreen({
  owner,
  onAppointments,
  onAppointment,
  onSearch,
  onBook,
  onStorage,
}: HomeScreenProps) {
  const state = useCustomerHome(owner);
  const today = state.todayAppointment;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="grow px-4 pb-4 pt-1"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={() => void state.refresh()} />
      }
    >
      <View className="mx-auto w-full max-w-3xl">
        <View className="mb-5 rounded-card bg-primary-dark p-5">
          <Text
            accessibilityRole="header"
            aria-level={1}
            className="mb-3 font-body-bold text-body leading-6 text-primary-foreground"
          >
            {M.searchTitle}
          </Text>
          <SearchField
            inverse
            label={M.searchLabel}
            placeholder={M.search}
            value={state.search}
            onChangeText={state.setSearch}
            onSubmit={onSearch}
            trailing={
              <Button label={M.find} compact inline onPress={() => onSearch(state.search.trim())} />
            }
          />
        </View>
        <View className="flex-row gap-3">
          <SummaryTile
            title={M.rentals}
            value={state.rentalCount}
            caption={M.activeUnits}
            icon={Warehouse}
            actionLabel={M.view}
            onPress={onStorage}
          />
          <SummaryTile
            title={M.upcoming}
            value={state.appointments.isSuccess ? String(state.todayCount) : "—"}
            caption={M.today}
            icon={CalendarDays}
            warning
            actionLabel={
              today?.slotStart
                ? `${today.slotStart.slice(0, 5)} · ${today.scheduledDate.slice(8, 10)}/${today.scheduledDate.slice(5, 7)}`
                : M.all
            }
            onPress={() => (today ? onAppointment(today.id) : onAppointments())}
          />
        </View>
        <QueryFeedback
          pending={state.rentals.isPending}
          error={state.rentals.isError}
          retry={() => void state.rentals.refetch()}
        />
        <SectionHeading
          title={M.nextCheckIn}
          actionLabel={`${M.all} (${state.appointments.data?.length ?? "—"})`}
          onAction={onAppointments}
        />
        <QueryFeedback
          pending={state.appointments.isPending}
          error={state.appointments.isError}
          retry={() => void state.appointments.refetch()}
        />
        {state.next ? (
          <AppointmentCard
            appointment={state.next}
            onPress={() => onAppointment(state.next?.id ?? "")}
          />
        ) : state.appointments.isSuccess ? (
          <Notice>{M.emptyUpcoming}</Notice>
        ) : null}
        <SectionHeading title={M.facilities} actionLabel={M.all} onAction={() => onSearch("")} />
        <QueryFeedback
          pending={state.facilities.isPending}
          error={state.facilities.isError}
          retry={() => void state.facilities.refetch()}
        />
        {state.facilities.isSuccess && !state.facilities.data.items.length ? (
          <Notice>{M.emptyFacilities}</Notice>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {state.facilities.data?.items.map((facility, index) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                illustration={index}
                onPress={() => onBook(facility)}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}
