import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Icon, Notice, SearchField } from "../../components/ui";
import { dateTime, money } from "../../components/ui/mobile-ui";
import { CUSTOMER_MOBILE_UI as UI } from "../../features/customer-api/customer-ui.messages";
import { QueryFeedback } from "../../features/customer-home/components/query-feedback";
import { CUSTOMER_SUPPORT as M } from "../../features/support/support.messages";
import {
  type CustomerSupportCategory,
  useSupportRequest,
} from "../../features/support/use-support-request";

const categories: readonly { value: CustomerSupportCategory; label: string }[] = [
  { value: "UNIT", label: M.categories.UNIT },
  { value: "LOCK", label: M.categories.LOCK },
  { value: "ACCESS_CODE", label: M.categories.ACCESS_CODE },
  { value: "STORED_ITEMS", label: M.categories.STORED_ITEMS },
  { value: "PAYMENT", label: M.categories.PAYMENT },
];
export interface CustomerSupportRequestScreenProps {
  readonly owner: string;
  readonly reservationId?: string;
  readonly paymentId?: string;
  readonly onCreated: (ticketId: string) => void;
}

export function CustomerSupportRequestScreen({
  owner,
  reservationId,
  paymentId,
  onCreated,
}: CustomerSupportRequestScreenProps) {
  const state = useSupportRequest(owner, onCreated, reservationId, paymentId);
  const [picker, setPicker] = useState<"category" | "context" | "payment" | null>(null);
  const contextError = state.form.formState.errors.reservationId?.message;
  const selectedContext = state.selectedContext;

  return (
    <ScrollView
      accessibilityLabel={M.title}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="grow bg-customer-canvas px-4 pb-6 pt-3"
    >
      <View className="mx-auto w-full max-w-3xl">
        <Text className="mb-4 font-body text-[14px] leading-6 text-muted">{M.intro}</Text>

        <Card title={M.category} compact outlined>
          <Button
            label={M.categories[state.category]}
            variant="outline"
            disabled={state.create.isPending}
            accessibilityState={{ expanded: picker === "category" }}
            trailingIcon={
              <Icon
                as={picker === "category" ? ChevronUp : ChevronDown}
                size={18}
                className="text-primary"
              />
            }
            onPress={() => setPicker(picker === "category" ? null : "category")}
          />
          {picker === "category" ? (
            <View className="gap-1 rounded-control border border-outline-variant bg-surface p-2">
              {categories.map((option) => (
                <Button
                  key={option.value}
                  label={option.label}
                  variant={state.category === option.value ? "soft" : "ghost"}
                  accessibilityState={{ selected: state.category === option.value }}
                  disabled={state.create.isPending}
                  onPress={() => {
                    state.changeCategory(option.value);
                    setPicker(null);
                  }}
                />
              ))}
            </View>
          ) : null}
        </Card>

        <Card title={M.context} compact outlined>
          <Text className="mb-3 font-body text-[12px] leading-5 text-muted">{M.contextHint}</Text>
          <Button
            label={
              selectedContext
                ? `${selectedContext.unitType.name}${selectedContext.storageUnitCode ? ` · ${selectedContext.storageUnitCode}` : ""} · ${selectedContext.facility.name}`
                : state.selectedReservationId
                  ? M.selectedContext
                  : M.chooseContext
            }
            variant="outline"
            disabled={state.create.isPending}
            accessibilityLabel={M.chooseContext}
            accessibilityState={{ expanded: picker === "context" }}
            trailingIcon={
              <Icon
                as={picker === "context" ? ChevronUp : ChevronDown}
                size={18}
                className="text-primary"
              />
            }
            onPress={() => setPicker(picker === "context" ? null : "context")}
          />
          {picker === "context" ? (
            <View className="rounded-control border border-outline-variant bg-surface p-3">
              <View className="flex-row items-start gap-2">
                <View className="min-w-0 flex-1">
                  <SearchField
                    label={M.searchContext}
                    value={state.search}
                    onChangeText={(value) => {
                      state.setSearch(value);
                      if (!value.trim()) state.setSubmittedSearch("");
                    }}
                    placeholder={M.searchContext}
                    onSubmit={state.setSubmittedSearch}
                    disabled={state.create.isPending}
                  />
                </View>
                <Button
                  label={M.searchAction}
                  compact
                  disabled={state.create.isPending}
                  onPress={() => state.setSubmittedSearch(state.search)}
                />
              </View>
              <QueryFeedback
                pending={state.contexts.isPending}
                error={state.contexts.isError}
                errorMessage={M.contextLoadError}
                retry={() => void state.contexts.refetch()}
              />
              <View className="gap-2">
                {state.contextItems.map((context) => {
                  const selected = context.id === state.selectedReservationId;
                  return (
                    <Pressable
                      key={context.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${context.unitType.name}, ${context.facility.name}${context.storageUnitCode ? `, ${context.storageUnitCode}` : ""}`}
                      accessibilityState={{ selected, disabled: state.create.isPending }}
                      disabled={state.create.isPending}
                      onPress={() => {
                        state.selectContext(context);
                        setPicker(null);
                      }}
                      className={`rounded-control border p-3 web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring ${selected ? "border-primary bg-primary-soft" : "border-outline-variant bg-surface active:bg-customer-subtle"} ${state.create.isPending ? "opacity-55" : ""}`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1 gap-1">
                          <Text className="font-body-semibold text-label leading-6 text-ink">
                            {context.unitType.name}
                            {context.storageUnitCode ? ` · ${context.storageUnitCode}` : ""}
                          </Text>
                          <Text className="font-body text-[12px] leading-5 text-muted">
                            {context.facility.name}
                          </Text>
                          <Text className="font-body text-[11px] leading-5 text-customer-muted">
                            {context.startAt && context.endAt
                              ? `${M.rentalPeriod}: ${dateTime(context.startAt)} – ${dateTime(context.endAt)}`
                              : M.periodUnavailable}
                          </Text>
                        </View>
                        {selected ? <Icon as={Check} size={18} className="text-primary" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {state.contexts.isSuccess && !state.contextItems.length ? (
                <Notice>{state.search.trim() ? M.noSearchMatches : M.contextEmptyHint}</Notice>
              ) : null}
              {state.contexts.hasNextPage ? (
                <Button
                  label={M.loadMore}
                  variant="outline"
                  loading={state.contexts.isFetchingNextPage}
                  disabled={state.create.isPending}
                  onPress={() => void state.contexts.fetchNextPage()}
                />
              ) : null}
            </View>
          ) : null}
          {contextError ? <Notice error>{M.contextRequired}</Notice> : null}
        </Card>

        {state.category === "PAYMENT" && state.selectedReservationId ? (
          <Card title={M.optionalPayment} compact outlined>
            <Text className="mb-3 font-body text-[12px] leading-5 text-muted">{M.paymentHint}</Text>
            <Button
              label={
                state.selectedPayment
                  ? `${state.selectedPayment.paymentCode ?? M.paymentReference} · ${money(state.selectedPayment.amount)}`
                  : state.selectedPaymentId
                    ? M.selectedPayment
                    : M.noSpecificPayment
              }
              variant="outline"
              disabled={state.create.isPending}
              accessibilityLabel={M.optionalPayment}
              accessibilityState={{ expanded: picker === "payment" }}
              trailingIcon={
                <Icon
                  as={picker === "payment" ? ChevronUp : ChevronDown}
                  size={18}
                  className="text-primary"
                />
              }
              onPress={() => setPicker(picker === "payment" ? null : "payment")}
            />
            {picker === "payment" ? (
              <View className="rounded-control border border-outline-variant bg-surface p-3">
                <QueryFeedback
                  pending={state.payments.isPending}
                  error={state.payments.isError}
                  errorMessage={M.paymentLoadError}
                  retry={() => void state.payments.refetch()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: !state.selectedPaymentId,
                    disabled: state.create.isPending,
                  }}
                  disabled={state.create.isPending}
                  onPress={() => {
                    state.selectPayment();
                    setPicker(null);
                  }}
                  className={`mb-2 min-h-touch flex-row items-center justify-between gap-2 rounded-control border px-3 py-2 ${!state.selectedPaymentId ? "border-primary bg-primary-soft" : "border-outline-variant bg-surface"} ${state.create.isPending ? "opacity-55" : ""}`}
                >
                  <Text className="font-body-medium text-label text-ink">
                    {M.noSpecificPayment}
                  </Text>
                  {!state.selectedPaymentId ? (
                    <Icon as={Check} size={17} className="text-primary" />
                  ) : null}
                </Pressable>
                {state.paymentItems.map((payment) => {
                  const selected = payment.id === state.selectedPaymentId;
                  return (
                    <Pressable
                      key={payment.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${payment.paymentCode ?? UI.status[payment.status] ?? payment.status}, ${money(payment.amount)}`}
                      accessibilityState={{ selected, disabled: state.create.isPending }}
                      disabled={state.create.isPending}
                      onPress={() => {
                        state.selectPayment(payment);
                        setPicker(null);
                      }}
                      className={`mb-2 min-h-touch flex-row items-center justify-between gap-3 rounded-control border px-3 py-2 ${selected ? "border-primary bg-primary-soft" : "border-outline-variant bg-surface"}`}
                    >
                      <View className="min-w-0 flex-1">
                        <Text className="font-body-semibold text-label text-ink">
                          {payment.paymentCode ?? M.paymentReference}
                        </Text>
                        <Text className="font-body text-[11px] leading-5 text-muted">
                          {M.paymentStatuses[payment.status] ?? payment.status} ·{" "}
                          {dateTime(payment.createdAt)}
                        </Text>
                      </View>
                      <Text className="font-body-semibold text-label text-primary">
                        {money(payment.amount)}
                      </Text>
                      {selected ? <Icon as={Check} size={17} className="text-primary" /> : null}
                    </Pressable>
                  );
                })}
                {state.payments.isSuccess && !state.paymentItems.length ? (
                  <Text className="font-body text-[12px] leading-5 text-muted">
                    {M.paymentContextEmpty}
                  </Text>
                ) : null}
                {state.payments.hasNextPage ? (
                  <Button
                    label={M.loadMorePayments}
                    variant="outline"
                    loading={state.payments.isFetchingNextPage}
                    disabled={state.create.isPending}
                    onPress={() => void state.payments.fetchNextPage()}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card title={M.requestDetails} compact outlined>
          <Controller
            control={state.form.control}
            name="subject"
            render={({ field, fieldState }) => (
              <Field
                outlined
                label={M.subject}
                value={field.value}
                onChangeText={(value) => {
                  field.onChange(value);
                  state.create.reset();
                }}
                onBlur={field.onBlur}
                placeholder={M.subjectPlaceholder}
                hint={M.subjectHint}
                error={fieldState.error?.message}
                maxLength={200}
                editable={!state.create.isPending}
              />
            )}
          />
          <Controller
            control={state.form.control}
            name="content"
            render={({ field, fieldState }) => (
              <Field
                outlined
                label={M.content}
                value={field.value}
                onChangeText={(value) => {
                  field.onChange(value);
                  state.create.reset();
                }}
                onBlur={field.onBlur}
                placeholder={M.contentPlaceholder}
                hint={M.contentHint}
                error={fieldState.error?.message}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={5000}
                editable={!state.create.isPending}
              />
            )}
          />
          {state.create.isError ? <Notice error>{M.submitError}</Notice> : null}
          <Button
            label={M.submit}
            loading={state.create.isPending}
            onPress={() => void state.submit()}
            leadingIcon={<Icon as={Check} size={18} className="text-white" />}
          />
        </Card>
      </View>
    </ScrollView>
  );
}
