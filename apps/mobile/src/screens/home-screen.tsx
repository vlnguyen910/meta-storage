import { CalendarDays, Warehouse } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import type { HomeScreenProps } from "../common/customer-home.types";
import { Button, Card, Icon, Notice, SearchField } from "../components/ui";
import { MobilePhoto } from "../components/ui/mobile-photo";
import { money } from "../components/ui/mobile-ui";
import { AppointmentCard } from "../features/customer-home/components/appointment-card";
import { QueryFeedback } from "../features/customer-home/components/query-feedback";
import { CUSTOMER_HOME as M } from "../features/customer-home/customer-home.messages";
import { useCustomerHome } from "../features/customer-home/use-customer-home";

const illustrations = [
  require("../../assets/facilities/illustration1.jpg"),
  require("../../assets/facilities/illustration2.jpg"),
];

export function HomeScreen({ owner, onAppointments, onAppointment }: HomeScreenProps) {
  const state = useCustomerHome(owner);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (state.submittedSearch && state.facilities.dataUpdatedAt)
      scroll.current?.scrollToEnd({ animated: true });
  }, [state.submittedSearch, state.facilities.dataUpdatedAt]);
  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="grow px-4 py-5"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={() => void state.refresh()} />
      }
    >
      <View className="mx-auto w-full max-w-3xl">
        <View className="mb-4 rounded-card bg-primary p-4">
          <Text
            accessibilityRole="header"
            aria-level={1}
            className="mb-3 font-body-bold text-[18px] leading-7 text-primary-foreground"
          >
            {M.searchTitle}
          </Text>
          <View className="flex-row items-start gap-2">
            <View className="min-w-0 flex-1">
              <SearchField
                label={M.searchLabel}
                placeholder={M.search}
                value={state.search}
                onChangeText={state.setSearch}
                onSubmit={() => void state.find()}
              />
            </View>
            <Button label={M.find} variant="outline" onPress={() => void state.find()} />
          </View>
        </View>
        {state.error ? <Notice error>{state.error}</Notice> : null}
        <View className="flex-row gap-3">
          <View className="min-w-0 flex-1">
            <Card compact>
              <View className="flex-row items-center justify-between gap-1">
                <Text className="shrink font-body text-[12px] text-muted">{M.rentals}</Text>
                <Icon as={Warehouse} size={16} className="text-primary" />
              </View>
              <View className="mt-2 flex-row flex-wrap items-center gap-1">
                <Text className="font-body-bold text-title text-primary">{state.rentalCount}</Text>
                <Text className="font-body text-[12px] text-muted">{M.activeUnits}</Text>
              </View>
              <Button
                label={M.view}
                variant="ghost"
                onPress={() => void state.openWeb("/customer/storage")}
              />
            </Card>
          </View>
          <View className="min-w-0 flex-1">
            <Card compact>
              <View className="flex-row items-center justify-between gap-1">
                <Text className="shrink font-body text-[12px] text-muted">{M.upcoming}</Text>
                <Icon as={CalendarDays} size={16} className="text-warning-strong" />
              </View>
              <View className="mt-2 flex-row flex-wrap items-center gap-1">
                <Text className="font-body-bold text-title text-warning-strong">
                  {state.appointments.isSuccess ? state.todayCount : "—"}
                </Text>
                <Text className="font-body text-[12px] text-muted">{M.today}</Text>
              </View>
              <Button label={M.all} variant="ghost" onPress={onAppointments} />
            </Card>
          </View>
        </View>
        <QueryFeedback
          pending={state.rentals.isPending}
          error={state.rentals.isError}
          retry={() => void state.rentals.refetch()}
        />
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text accessibilityRole="header" className="shrink font-body-bold text-body text-ink">
            {M.nextCheckIn}
          </Text>
          <Button
            label={`${M.all} (${state.appointments.data?.length ?? "—"})`}
            variant="ghost"
            onPress={onAppointments}
          />
        </View>
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
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="mb-4 font-body-bold text-[18px] text-ink"
        >
          {M.facilities}
        </Text>
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
              <View key={facility.id} className="w-[256px]">
                <Card>
                  <MobilePhoto
                    label={M.illustration}
                    source={illustrations[index % illustrations.length]}
                  />
                  <Text className="mb-2 font-body text-[10px] text-muted">{M.illustration}</Text>
                  <Text
                    accessibilityRole="header"
                    className="mb-2 font-body-bold text-body leading-6 text-ink"
                  >
                    {facility.name}
                  </Text>
                  <Text className="mb-3 font-body text-label leading-6 text-muted">
                    {facility.address}
                  </Text>
                  <Text className="mb-3 font-body-semibold text-label leading-6 text-primary">
                    {facility.startingMonthlyPrice == null
                      ? M.noPrice
                      : `${M.fromPrice} ${money(facility.startingMonthlyPrice)} ${M.perMonth}`}
                  </Text>
                  <Button
                    label={M.selectFacility}
                    hint={M.web}
                    variant="outline"
                    onPress={() =>
                      void state.openWeb(
                        `/customer/booking/new?facilityId=${encodeURIComponent(facility.id)}&new=1`,
                      )
                    }
                  />
                </Card>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}
