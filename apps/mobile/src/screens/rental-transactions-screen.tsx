import { ArrowDownWideNarrow } from "lucide-react-native";
import { FlatList, Text, View } from "react-native";
import type { MyStorageScreenProps } from "../common/my-storage.types";
import { ActionLink, ChoiceTabs, Notice } from "../components/ui";
import { QueryFeedback } from "../features/customer-home/components/query-feedback";
import { TransactionRow } from "../features/my-storage/components/transaction-row";
import { MY_STORAGE as M } from "../features/my-storage/my-storage.messages";
export function RentalTransactionsScreen({ state: s }: MyStorageScreenProps) {
  return (
    <FlatList
      data={s.visibleTransactions}
      keyExtractor={(item) => item.payment.id}
      contentContainerClassName="grow px-4 pb-5"
      refreshing={s.refreshing && !s.transactionLoading}
      onRefresh={() => void s.refresh()}
      ListHeaderComponent={
        <View className="mx-auto w-full max-w-3xl">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <ChoiceTabs
              value={s.filter}
              onChange={s.setFilter}
              options={[
                { value: "all", label: M.all, count: s.transactionCount ?? M.unknown },
                { value: "succeeded", label: M.succeeded, count: s.successCount ?? M.unknown },
              ]}
            />
            <ActionLink
              label={s.oldest ? M.oldest : M.latest}
              icon={ArrowDownWideNarrow}
              onPress={s.toggleSort}
            />
          </View>
          <Text className="mb-3 font-body text-[12px] leading-5 text-muted">
            {M.transactionScope}
          </Text>
          <QueryFeedback
            pending={s.transactionLoading}
            error={s.transactionError}
            errorMessage={M.partialTransactions}
            retry={() => void s.refresh()}
          />
        </View>
      }
      renderItem={({ item, index }) => (
        <View
          className={`mx-auto w-full max-w-3xl overflow-hidden border-x border-outline-variant ${index === 0 ? "rounded-t-card border-t" : ""} ${index === s.visibleTransactions.length - 1 ? "rounded-b-card" : ""}`}
        >
          <TransactionRow
            transaction={item}
            onPress={() => s.setSelection({ kind: "payment", transaction: item })}
          />
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
