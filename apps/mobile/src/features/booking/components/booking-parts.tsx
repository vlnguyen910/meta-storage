import { ArrowLeft, Check, Warehouse, X } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import type {
  BookingFrameProps,
  BookingSummaryProps,
  UnitChoiceProps,
} from "../../../common/booking.types";
import { Button, Card, Icon, IconButton, Notice, Row, ScreenFrame } from "../../../components/ui";
import { MobilePhoto } from "../../../components/ui/mobile-photo";
import { money } from "../../../components/ui/mobile-ui";
import { FacilitySummary } from "../../customer-home/components/facility-card";
import { BOOKING as M } from "../booking.messages";

export function BookingFrame({
  state: s,
  children,
  onClose,
  onNext,
  nextLabel,
  nextDisabled,
}: BookingFrameProps) {
  return (
    <ScreenFrame className="bg-customer-canvas">
      <View className="flex-row items-center gap-2 px-4 py-2">
        <IconButton
          icon={s.step === 4 ? X : ArrowLeft}
          label={s.step === 4 ? M.close : M.back}
          disabled={s.busy}
          onPress={() => (s.step > 0 && s.step < 3 && !s.paymentUncertain ? s.back() : onClose())}
        />
        <Text
          accessibilityRole="header"
          aria-level={1}
          className="flex-1 font-body-bold text-[18px] leading-6 text-primary"
        >
          {s.step === 3 ? M.paymentTitle : s.step === 4 ? M.receipt : M.title}
        </Text>
      </View>
      <View className="mx-auto mb-3 w-full max-w-3xl flex-row px-4">
        {M.steps.map((label, index) => (
          <View key={label} className="flex-1 items-center gap-1">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full ${index <= s.step ? "bg-primary" : "bg-customer-subtle"}`}
            >
              {index < s.step ? (
                <Icon as={Check} size={16} className="text-white" />
              ) : (
                <Text
                  className={`font-body-bold text-[12px] ${index === s.step ? "text-white" : "text-muted"}`}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              className={`font-body-medium text-[10px] ${index <= s.step ? "text-primary" : "text-muted"}`}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          key={s.step}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-4 pb-5"
        >
          <View className="mx-auto w-full max-w-3xl">
            {s.error ? <Notice error>{s.error}</Notice> : null}
            {s.feedback ? <Notice>{s.feedback}</Notice> : null}
            {children}
          </View>
        </ScrollView>
        {onNext && nextLabel ? (
          <View className="border-t border-line bg-surface px-4 py-3">
            <View className="mx-auto w-full max-w-3xl">
              {s.step < 2 && s.unit ? (
                <Text className="mb-2 font-body-semibold text-label text-primary">
                  {money(s.unit.monthlyPrice * (s.step === 1 ? s.values.durationMonths : 1))}{" "}
                  {s.step === 0 ? M.perMonth : M.estimate}
                </Text>
              ) : null}
              <Button
                label={nextLabel}
                onPress={onNext}
                loading={s.busy}
                disabled={nextDisabled}
                inline
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

export function BookingSummary({ state: s, showFacility = true }: BookingSummaryProps) {
  return (
    <Card compact outlined>
      <View className="flex-row items-center gap-3">
        <View className="relative w-[64px] shrink-0">
          <MobilePhoto
            flush
            aspectRatio={1}
            label={M.illustration}
            source={require("../../../../assets/facilities/discovery1.jpg")}
          />
          <Text className="absolute bottom-0 left-0 bg-primary-dark/80 px-1 font-body text-[9px] text-white">
            {M.illustration}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-1 font-body-bold text-body leading-6 text-primary">
            {s.unit?.name ?? M.unit}
          </Text>
          {showFacility ? (
            <FacilitySummary compact name={s.facility.name} address={s.facility.address} />
          ) : null}
          {s.unit ? (
            <Text className="mt-1 font-body text-[12px] text-customer-muted">
              {s.unit.sizeLabel} · {s.unit.lengthM} × {s.unit.widthM} × {s.unit.heightM} m
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export function BookingCosts({ state: s }: BookingSummaryProps) {
  const d = s.draft;
  if (!d) return null;
  return (
    <Card title={M.costs} compact outlined>
      <Row label={M.rate} value={`${money(d.monthlyRateSnapshot)} ${M.perMonth}`} />
      <Row label={`${M.rent} (${d.requestedMonths} ${M.month})`} value={money(d.rentalFeeAmount)} />
      <Row label={M.deposit} value={money(d.depositAmount)} />
      <View className="mt-2 rounded-control bg-primary-soft p-3">
        <Text className="font-body text-label text-primary">{M.total}</Text>
        <Text className="font-body-bold text-title text-primary">{money(d.totalAmount)}</Text>
      </View>
    </Card>
  );
}

export function UnitChoice({ unit, selected, onSelect }: UnitChoiceProps) {
  return (
    <Card compact outlined>
      <View className="mb-3 flex-row gap-3">
        <View className="relative w-[80px] shrink-0">
          <MobilePhoto
            flush
            aspectRatio={1}
            label={M.illustration}
            source={require("../../../../assets/facilities/discovery3.jpg")}
          />
          <Text className="absolute bottom-0 left-0 bg-primary-dark/80 px-1 font-body text-[9px] text-white">
            {M.illustration}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-body-bold text-body leading-6 text-primary">{unit.name}</Text>
          <Text className="font-body text-[12px] leading-5 text-customer-muted">
            {unit.sizeLabel}
          </Text>
          <Text className="font-body text-[12px] leading-5 text-customer-muted">
            {unit.lengthM} × {unit.widthM} × {unit.heightM} m
          </Text>
          <Text className="font-body-bold text-body text-primary">
            {money(unit.monthlyPrice)} <Text className="font-body text-[11px]">{M.perMonth}</Text>
          </Text>
        </View>
      </View>
      <Button
        label={selected ? M.selected : M.chooseUnit}
        variant={selected ? "primary" : "outline"}
        leadingIcon={
          <Icon
            as={selected ? Check : Warehouse}
            size={16}
            className={selected ? "text-white" : "text-primary"}
          />
        }
        accessibilityState={{ selected }}
        onPress={onSelect}
        compact
        inline
      />
    </Card>
  );
}
