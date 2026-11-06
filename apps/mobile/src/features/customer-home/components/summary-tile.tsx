import { ArrowRight } from "lucide-react-native";
import { Text, View } from "react-native";
import type { SummaryTileProps } from "../../../common/customer-home.types";
import { ActionLink, Card, Icon } from "../../../components/ui";

export function SummaryTile({
  title,
  value,
  caption,
  actionLabel,
  icon,
  onPress,
  warning = false,
}: SummaryTileProps) {
  return (
    <View className="min-w-0 flex-1">
      <Card compact outlined>
        <View className="mb-1 flex-row items-center justify-between gap-1">
          <Text className="shrink font-body-medium text-[10px] uppercase leading-4 text-customer-muted">
            {title}
          </Text>
          <View
            className={`h-7 w-7 items-center justify-center rounded-[6px] ${warning ? "bg-warning-soft" : "bg-primary-soft"}`}
          >
            <Icon
              as={icon}
              size={18}
              className={warning ? "text-warning-strong" : "text-primary"}
            />
          </View>
        </View>
        <View className="mb-1 flex-row flex-wrap items-baseline gap-1">
          <Text
            className={`font-body-bold text-title leading-7 ${warning ? "text-warning-strong" : "text-primary"}`}
          >
            {value}
          </Text>
          <Text className="font-body text-[12px] leading-5 text-ink">{caption}</Text>
        </View>
        <View className="border-t border-line">
          <ActionLink label={actionLabel} onPress={onPress} icon={ArrowRight} warning={warning} />
        </View>
      </Card>
    </View>
  );
}
