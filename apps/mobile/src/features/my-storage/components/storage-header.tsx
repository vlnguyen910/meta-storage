import { Plus } from "lucide-react-native";
import { Text, View } from "react-native";
import type { StorageHeaderProps } from "../../../common/my-storage.types";
import { Button, ChoiceTabs, Icon } from "../../../components/ui";
import { MY_STORAGE as M } from "../my-storage.messages";
export function StorageHeader({ state, view, onView, onBook }: StorageHeaderProps) {
  return (
    <View className="mx-auto w-full max-w-3xl px-4 pt-1">
      <View className="mb-4 flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0">
          <Text className="font-body-medium text-[10px] uppercase leading-5 text-customer-muted">
            {M.eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            aria-level={1}
            className="font-body-bold text-title leading-8 text-primary"
          >
            {M.title}
          </Text>
        </View>
        <Button
          label={M.add}
          leadingIcon={<Icon as={Plus} size={16} className="text-white" />}
          onPress={onBook}
          compact
          inline
        />
      </View>
      <ChoiceTabs
        variant="segmented"
        value={view}
        onChange={onView}
        options={[
          {
            value: "current",
            label: M.current,
            count: state.current.isSuccess ? state.current.data.length : M.unknown,
          },
          {
            value: "history",
            label: M.history,
            count: state.history.isSuccess ? state.history.data.length : M.unknown,
          },
          {
            value: "transactions",
            label: M.transactions,
            count: state.transactionCount ?? M.unknown,
          },
        ]}
      />
    </View>
  );
}
