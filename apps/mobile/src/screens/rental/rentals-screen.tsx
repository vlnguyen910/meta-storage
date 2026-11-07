import { FlatList, Text, View } from "react-native";
import type { RentalsScreenProps } from "../../common/my-storage.types";
import { Notice, SectionHeading } from "../../components/ui";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { RentalCard } from "../../features/my-storage/components/rental-card";
import { MY_STORAGE as M } from "../../features/my-storage/my-storage.messages";
export function RentalsScreen({ state: s, onUnavailable }: RentalsScreenProps) {
  return (
    <FlatList
      data={s.current.data ?? []}
      keyExtractor={(r) => r.id}
      className="flex-1"
      contentContainerClassName="grow px-4 pb-5"
      refreshing={s.current.isRefetching}
      onRefresh={() => void s.current.refetch()}
      ListHeaderComponent={
        <View className="mx-auto w-full max-w-3xl">
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1">
              <SectionHeading title={M.activeHeading} />
            </View>
            {s.current.isSuccess ? (
              <Text className="mb-2 font-body text-[12px] text-muted">
                {M.units(s.current.data.length)}
              </Text>
            ) : null}
          </View>
          <QueryFeedback
            pending={s.current.isPending}
            error={s.current.isError}
            retry={() => void s.current.refetch()}
          />
        </View>
      }
      renderItem={({ item, index }) => (
        <View className="mx-auto w-full max-w-3xl">
          <RentalCard
            rental={item}
            compact={index > 0}
            now={s.now}
            onDetails={() => s.showRental(item.id)}
            onRenew={onUnavailable}
          />
        </View>
      )}
      ListEmptyComponent={
        s.current.isSuccess ? (
          <View className="mx-auto w-full max-w-3xl">
            <Notice>{M.emptyCurrent}</Notice>
          </View>
        ) : null
      }
    />
  );
}
