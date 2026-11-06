import { ArrowRight, MapPin } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { FacilityCardProps, FacilitySummaryProps } from "../../../common/customer-home.types";
import { Button, Card, Icon } from "../../../components/ui";
import { MobilePhoto } from "../../../components/ui/mobile-photo";
import { money } from "../../../components/ui/mobile-ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";

const illustrations = [
  require("../../../../assets/facilities/illustration1.jpg"),
  require("../../../../assets/facilities/illustration2.jpg"),
];

const discoveryIllustrations = [
  require("../../../../assets/facilities/discovery1.jpg"),
  require("../../../../assets/facilities/discovery2.jpg"),
  require("../../../../assets/facilities/discovery3.jpg"),
  require("../../../../assets/facilities/discovery4.jpg"),
  require("../../../../assets/facilities/discovery5.jpg"),
];

export function FacilitySummary({ name, address, compact = false }: FacilitySummaryProps) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text className={`font-body-bold leading-5 text-ink ${compact ? "text-label" : "text-body"}`}>
        {name ?? M.unknownFacility}
      </Text>
      {address ? (
        <Text className="font-body text-[12px] leading-4 text-customer-muted">{address}</Text>
      ) : null}
    </View>
  );
}

export function FacilityCard({
  facility,
  illustration,
  onPress,
  variant = "rail",
}: FacilityCardProps) {
  const result = variant === "result";
  const photos = result ? discoveryIllustrations : illustrations;
  const content = (
    <Card outlined flush>
      <View>
        <MobilePhoto
          source={photos[illustration % photos.length]}
          label={M.illustration}
          aspectRatio={result ? 2.2 : 1.7}
          flush
        />
        <View className="absolute bottom-2 right-2 rounded-[4px] bg-surface px-2 py-1">
          <Text className="font-body-medium text-[10px] text-ink">{M.illustration}</Text>
        </View>
      </View>
      <View className={result ? "p-4" : "p-3"}>
        <Text
          numberOfLines={result ? undefined : 1}
          className={`mb-1 font-body-bold text-ink ${result ? "text-[20px] leading-7" : "text-[12px] leading-5"}`}
        >
          {facility.name}
        </Text>
        <View className="mb-2 flex-row items-start gap-1">
          {result ? <Icon as={MapPin} size={14} className="mt-1 text-customer-muted" /> : null}
          <Text
            numberOfLines={result ? undefined : 1}
            className={`shrink font-body text-customer-muted ${result ? "text-[12px] leading-5" : "text-[11px] leading-4"}`}
          >
            {facility.address}
          </Text>
        </View>
        <View
          className={`flex-row items-center gap-3 border-t border-line pt-2 ${result ? "justify-between" : "flex-wrap"}`}
        >
          <View
            className={
              result
                ? "min-w-0 flex-1 gap-1"
                : "min-w-0 flex-1 flex-row flex-wrap items-baseline justify-between gap-1"
            }
          >
            <Text className="font-body text-[10px] text-customer-muted">
              {result ? M.referencePrice : M.fromPrice}
            </Text>
            <Text
              className={`font-body-bold text-primary ${result ? "text-body leading-6" : "text-[12px]"}`}
            >
              {facility.startingMonthlyPrice == null
                ? M.noPrice
                : `${result ? `${M.priceFrom} ` : ""}${money(facility.startingMonthlyPrice)}`}
              {facility.startingMonthlyPrice == null ? null : (
                <Text className="font-body text-[10px] text-customer-muted">
                  {result ? ` ${M.perFullMonth}` : M.perMonth}
                </Text>
              )}
            </Text>
          </View>
          {result ? (
            <Button
              label={M.viewAndBook}
              compact
              inline
              onPress={onPress}
              trailingIcon={<Icon as={ArrowRight} size={16} className="text-primary-foreground" />}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
  return result ? (
    <View className="w-full">{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${M.selectFacility}: ${facility.name}`}
      onPress={onPress}
      className="w-[232px] rounded-card active:opacity-80 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
    >
      {content}
    </Pressable>
  );
}
