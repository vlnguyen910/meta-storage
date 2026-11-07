import { ArrowDownWideNarrow, History, SlidersHorizontal } from "lucide-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import type { FacilitySearchScreenProps } from "../../common/customer-home.types";
import {
  ActionLink,
  Button,
  Field,
  Icon,
  IconButton,
  Notice,
  SearchField,
} from "../../components/ui";
import { FacilityCard } from "../../features/customer-home/components/facility-card";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { CUSTOMER_HOME as M } from "../../features/customer-home/customer-home.messages";

export function FacilitySearchScreen({ state, onBook }: FacilitySearchScreenProps) {
  return (
    <FlatList
      data={state.items}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="grow px-4 pb-5"
      refreshing={state.query.isRefetching && !state.query.isFetchingNextPage}
      onRefresh={() => void state.query.refetch()}
      ListHeaderComponent={
        <View className="mx-auto w-full max-w-3xl">
          <SearchField
            label={M.searchLabel}
            value={state.search}
            onChangeText={state.changeSearch}
            placeholder={M.searchPlaceholder}
            onSubmit={state.submit}
            trailing={
              <IconButton
                icon={SlidersHorizontal}
                label={M.filters}
                onPress={state.toggleFilters}
              />
            }
          />
          {state.filterOpen ? (
            <View className="mb-3 rounded-card border border-outline-variant bg-surface p-4">
              <Field
                label={M.city}
                placeholder={M.cityPlaceholder}
                value={state.city}
                onChangeText={state.setCity}
                maxLength={200}
              />
              <Button label={M.applyFilters} onPress={state.applyCity} compact inline />
            </View>
          ) : null}
          {state.history.length ? (
            <View className="mb-3">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Icon as={History} size={16} className="text-customer-muted" />
                  <Text className="font-body-semibold text-[12px] text-customer-muted">
                    {M.recentSearches}
                  </Text>
                </View>
                <ActionLink label={M.clearHistory} onPress={state.clearHistory} />
              </View>
              <View className="flex-row flex-wrap gap-2">
                {state.history.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={value}
                    onPress={() => state.submit(value)}
                    className="min-h-touch max-w-full flex-row items-center gap-2 rounded-full bg-customer-subtle px-3 web:focus-visible:outline-2 web:focus-visible:outline-ring"
                  >
                    <Icon as={History} size={14} className="text-customer-muted" />
                    <Text
                      numberOfLines={1}
                      className="shrink font-body-medium text-[12px] text-ink"
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <ActionLink label={M.clearFilters} onPress={state.reset} />
            {state.filters.city ? (
              <Text className="font-body-medium text-[12px] text-primary">
                {state.filters.city}
              </Text>
            ) : null}
          </View>
          <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
            <Text
              accessibilityRole="header"
              aria-level={2}
              className="font-body-bold text-[18px] text-primary"
            >
              {state.query.data ? M.foundFacilities(state.total) : M.facilities}
            </Text>
            <ActionLink
              label={state.filters.sort === "price" ? M.sortPrice : M.sortName}
              onPress={state.toggleSort}
              icon={ArrowDownWideNarrow}
            />
          </View>
          <QueryFeedback
            pending={state.query.isPending}
            error={state.query.isError}
            retry={() => void state.query.refetch()}
          />
        </View>
      }
      renderItem={({ item, index }) => (
        <View className="mx-auto w-full max-w-3xl">
          <FacilityCard
            variant="result"
            facility={item}
            illustration={index}
            onPress={() => onBook(item)}
          />
        </View>
      )}
      ListEmptyComponent={
        state.query.isSuccess ? (
          <View className="mx-auto w-full max-w-3xl">
            <Notice>{M.searchEmpty}</Notice>
          </View>
        ) : null
      }
      ListFooterComponent={
        state.query.hasNextPage ? (
          <View className="mx-auto w-full max-w-3xl">
            <Button
              label={M.loadMore}
              loading={state.query.isFetchingNextPage}
              variant="outline"
              onPress={() => void state.query.fetchNextPage()}
            />
          </View>
        ) : null
      }
    />
  );
}
