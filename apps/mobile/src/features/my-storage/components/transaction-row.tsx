import { Text, View } from "react-native";
import type { TransactionRowProps } from "../../../common/my-storage.types";
import { storageMoney } from "../../../common/my-storage.utils";
import { ActionLink, StatusPill } from "../../../components/ui";
import { dateTime } from "../../../components/ui/mobile-ui";
import { MY_STORAGE as M } from "../my-storage.messages";
export function TransactionRow({
  transaction: { rental: r, payment: p },
  onPress,
}: TransactionRowProps) {
  return (
    <View className="bg-surface px-4 py-4">
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
          <Text selectable className="shrink font-body-bold text-[12px] text-ink">
            {p.paymentCode ?? p.id}
          </Text>
          <StatusPill
            compact
            label={M.paymentStatuses[p.status]}
            tone={
              p.status === "SUCCEEDED"
                ? "green"
                : p.status === "FAILED"
                  ? "red"
                  : p.status === "REFUND_PENDING" || p.status === "PENDING"
                    ? "amber"
                    : "neutral"
            }
          />
        </View>
        <Text className="font-body-bold text-label text-primary">
          {storageMoney(p.totalAmount, p.currency)}
        </Text>
      </View>
      <Text className="mb-1 font-body text-label leading-6 text-ink">
        {r.unitType.name} ({r.unitType.sizeLabel}) · {r.storageUnit?.code ?? M.unassigned}
      </Text>
      <Text className="font-body text-[12px] leading-5 text-muted">
        {M.paymentTypes[p.type]} · {p.provider === "sepay" ? M.sepay : (p.provider ?? M.unknown)}
      </Text>
      <View className="mt-2 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-body text-[12px] text-muted">
          {dateTime(p.paidAt ?? p.createdAt)}
        </Text>
        <ActionLink label={M.paymentDetails} onPress={onPress} />
      </View>
    </View>
  );
}
