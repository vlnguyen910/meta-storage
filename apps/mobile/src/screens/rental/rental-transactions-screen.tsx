import { ArrowDownWideNarrow } from "lucide-react-native";
import { FlatList, Text, View } from "react-native";
import type { MyStorageScreenProps } from "../../common/my-storage.types";
import { ActionLink, Card, ChoiceTabs, Notice } from "../../components/ui";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { TransactionRow } from "../../features/my-storage/components/transaction-row";
import { MY_STORAGE as M } from "../../features/my-storage/my-storage.messages";
export function RentalTransactionsScreen({ state: s }: MyStorageScreenProps) {
  return (
    <FlatList
      data={s.visibleTransactions}
      keyExtractor={(item) => item.payment.id}
      className="flex-1"
      contentContainerClassName="grow px-4 pb-5"
      refreshing={s.refreshing && !s.transactionLoading}
      onRefresh={() => void s.refresh()}
      ListHeaderComponent={
        <View className="mx-auto w-full max-w-3xl">
          <ChoiceTabs
            value={s.filter}
            onChange={s.setFilter}
            options={[
              { value: "all", label: M.all, count: s.transactionCount ?? M.unknown },
              { value: "succeeded", label: M.succeeded, count: s.successCount ?? M.unknown },
            ]}
          />
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="min-w-0 flex-1 font-body text-[12px] leading-5 text-muted">
              {M.transactionScope}
            </Text>
            <ActionLink
              label={s.oldest ? M.oldest : M.latest}
              icon={ArrowDownWideNarrow}
              onPress={s.toggleSort}
            />
          </View>
          <QueryFeedback
            pending={s.transactionLoading}
            error={s.transactionError}
            errorMessage={M.partialTransactions}
            retry={() => void s.refresh()}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View className="mx-auto w-full max-w-3xl">
          <Card compact outlined flush>
            <TransactionRow
              transaction={item}
              onPress={() => s.setSelection({ kind: "payment", transaction: item })}
            />
          </Card>
        </View>
      )}
      ListEmptyComponent={
        !s.transactionLoading && !s.transactionError ? (
          <View className="mx-auto w-full max-w-3xl">
            <Notice>{M.emptyTransactions}</Notice>
          </View>
        ) : null
      }
    />
  );
}
