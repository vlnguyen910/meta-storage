import { FlatList, View } from "react-native";
import type { RentalHistoryScreenProps } from "../../common/my-storage.types";
import { Notice, SectionHeading } from "../../components/ui";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { RentalCard } from "../../features/my-storage/components/rental-card";
import { MY_STORAGE as M } from "../../features/my-storage/my-storage.messages";
export function RentalHistoryScreen({ state: s, onRebook }: RentalHistoryScreenProps) {
  return (
    <FlatList
      data={s.history.data ?? []}
      keyExtractor={(r) => r.id}
      contentContainerClassName="grow px-4 pb-5"
      refreshing={s.history.isRefetching}
      onRefresh={() => void s.history.refetch()}
      ListHeaderComponent={
        <View className="mx-auto w-full max-w-3xl">
          <SectionHeading
            title={`${M.historyHeading}${s.history.isSuccess ? ` (${s.history.data.length})` : ""}`}
          />
          <QueryFeedback
            pending={s.history.isPending}
            error={s.history.isError}
            retry={() => void s.history.refetch()}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View className="mx-auto w-full max-w-3xl">
          <RentalCard
            rental={item}
            now={s.now}
            onDetails={() => s.showRental(item.id)}
            onRebook={() => onRebook(item.facility, item.unitType.id)}
          />
        </View>
      )}
      ListEmptyComponent={
        s.history.isSuccess ? (
          <View className="mx-auto w-full max-w-3xl">
            <Notice>{M.emptyHistory}</Notice>
          </View>
        ) : null
      }
    />
  );
}
