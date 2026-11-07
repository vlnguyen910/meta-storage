import type { SupportTicketDto } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import type { LucideIcon } from "lucide-react-native";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  CreditCard,
  Fingerprint,
  Headset,
  Languages,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { CustomerProfileScreenProps } from "../../common/customer-home.types";
import { PROFILE as M } from "../../common/profile.messages";
import { Button, DetailSheet, Field, Icon, Notice } from "../../components/ui";
import { dateTime } from "../../components/ui/mobile-ui";
import { ThemedActivityIndicator } from "../../components/ui/native-styles";
import { useProfileEditor } from "../../features/auth/use-profile-editor";
import { useCustomerTickets } from "../../features/customer-api/customer-api.hooks";
import { useCustomerTicket } from "../../features/customer-api/use-customer-ticket";

const focus =
  "web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring";
const settings = [
  { icon: BellRing, title: M.notifications, hint: M.notificationsHint },
  { icon: CreditCard, title: M.payment, hint: M.paymentHint },
  { icon: Fingerprint, title: M.security, hint: M.securityHint },
  { icon: Languages, title: M.appearance, hint: M.appearanceHint },
  { icon: ShieldCheck, title: M.terms, hint: M.termsHint },
];

function SectionTitle({ icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Icon as={icon} size={20} className="text-primary" />
      <Text
        accessibilityRole="header"
        className="flex-1 font-body-bold text-[15px] leading-6 text-primary"
      >
        {title}
      </Text>
    </View>
  );
}
function Fact({ icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border border-outline-variant bg-surface p-3">
      <Icon as={icon} size={17} className="text-primary" />
      <View className="min-w-0 flex-1">
        <Text className="font-body text-[11px] leading-4 text-muted">{label}</Text>
        <Text
          selectable
          className={`font-body-medium text-[13px] leading-5 ${value ? "text-ink" : "text-muted"}`}
        >
          {value || M.missing}
        </Text>
      </View>
    </View>
  );
}
function TicketCard({ ticket, onPress }: { ticket: SupportTicketDto; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${M.viewSupport}: ${ticket.subject}`}
      onPress={onPress}
      className={`rounded-lg border border-outline-variant bg-surface p-3 active:bg-primary-soft ${focus}`}
    >
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-body-semibold text-[11px] tracking-wide text-muted">
          {formatReference(ticket.id, "SP")}
        </Text>
        <View
          className={`rounded-full px-2 py-1 ${ticket.status === "IN_PROGRESS" ? "bg-warning-soft" : ticket.status === "CLOSED" ? "bg-neutral-soft" : "bg-customer-mint"}`}
        >
          <Text
            className={`font-body-semibold text-[10px] ${ticket.status === "IN_PROGRESS" ? "text-warning-strong" : ticket.status === "CLOSED" ? "text-muted" : "text-primary"}`}
          >
            {M.statuses[ticket.status]}
          </Text>
        </View>
      </View>
      <Text className="font-body-bold text-[14px] leading-6 text-ink">{ticket.subject}</Text>
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <View className="flex-row items-center gap-1">
          <Icon as={CalendarDays} size={14} className="text-muted" />
          <Text className="font-body text-[11px] text-muted">{dateTime(ticket.createdAt)}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-body-semibold text-[12px] text-primary">{M.viewSupport}</Text>
          <Icon as={ChevronRight} size={14} className="text-primary" />
        </View>
      </View>
    </Pressable>
  );
}

export function CustomerProfileScreen({
  user,
  onLogout,
  pending,
  error,
  onUnavailable,
  onCreateSupport,
  onAllSupport,
}: CustomerProfileScreenProps & { onUnavailable: () => void }) {
  const editor = useProfileEditor(user);
  const tickets = useCustomerTickets(user.id);
  const items = tickets.data?.pages.flatMap((page) => page.items) ?? [];
  const [sheet, setSheet] = useState<string | null>(null);
  const detail = useCustomerTicket(user.id, sheet ?? "");
  const initial = user.name.trim().charAt(0).toLocaleUpperCase("vi") || "M";
  return (
    <>
      <ScrollView
        accessibilityLabel={M.title}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow bg-surface px-4 pb-6 pt-3"
      >
        <View className="mx-auto w-full max-w-3xl gap-6">
          <View>
            <SectionTitle icon={UserRound} title={M.profile} />
            <View className="gap-3 rounded-xl border border-outline-variant bg-customer-canvas p-4">
              <View className="flex-row items-center gap-3 border-b border-outline-variant pb-4">
                <View className="size-16 items-center justify-center rounded-2xl border-4 border-customer-mint bg-primary">
                  <Text className="font-body-semibold text-[26px] text-white">{initial}</Text>
                </View>
                <View className="min-w-0 flex-1 gap-1.5">
                  <Text className="font-body-bold text-[18px] leading-6 text-ink">{user.name}</Text>
                </View>
              </View>
              <View className="flex-row flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface p-3">
                <Icon as={Mail} size={17} className="text-primary" />
                <Text
                  selectable
                  className="min-w-0 flex-1 font-body-medium text-[13px] leading-5 text-ink"
                >
                  {user.email || M.missing}
                </Text>
                {user.emailVerified && (
                  <View className="flex-row items-center gap-1 rounded bg-success-soft px-2 py-1">
                    <Icon as={Check} size={12} className="text-success" />
                    <Text className="font-body-semibold text-[10px] text-success">
                      {M.verified}
                    </Text>
                  </View>
                )}
              </View>
              {editor.editing ? (
                <View className="gap-3">
                  <Field
                    outlined
                    label={M.name}
                    value={editor.name}
                    onChangeText={editor.setName}
                    maxLength={150}
                    editable={!editor.save.isPending}
                    error={editor.validation.name}
                    autoComplete="name"
                  />
                  <Field
                    outlined
                    label={M.phone}
                    value={editor.phone}
                    onChangeText={editor.setPhone}
                    maxLength={20}
                    editable={!editor.save.isPending}
                    error={editor.validation.phone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>
              ) : (
                <View className="w-[180px] max-w-full flex-row items-stretch">
                  <Fact icon={Phone} label={M.phone} value={user.phone} />
                </View>
              )}
              {editor.save.isError && <Notice error>{M.saveError}</Notice>}
              {editor.save.isSuccess && !editor.editing && <Notice>{M.saved}</Notice>}
              <Button
                label={editor.editing ? M.save : M.update}
                onPress={editor.submit}
                loading={editor.save.isPending}
                inline
                leadingIcon={<Icon as={UserRound} size={18} className="text-white" />}
              />
            </View>
          </View>

          <View>
            <SectionTitle icon={Headset} title={M.support} />
            <View className="mb-3 gap-3 overflow-hidden rounded-xl bg-primary p-4">
              <View className="flex-row items-center gap-2">
                <Icon as={Headset} size={18} className="text-customer-mint" />
                <Text className="font-body-semibold text-[11px] uppercase tracking-wide text-customer-mint">
                  {M.supportEyebrow}
                </Text>
              </View>
              <Text className="font-body text-[14px] leading-6 text-white">{M.supportHint}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onCreateSupport}
                className={`min-h-control flex-row items-center justify-center gap-2 rounded-lg bg-surface px-3 py-3 active:bg-customer-mint ${focus}`}
              >
                <Icon as={CirclePlus} size={18} className="text-primary" />
                <Text className="shrink font-body-bold text-[13px] text-primary">
                  {M.createSupport}
                </Text>
              </Pressable>
            </View>
            <View className="gap-3 rounded-xl border border-outline-variant bg-customer-canvas p-3">
              <Text
                accessibilityRole="header"
                className="border-b border-outline-variant pb-2 font-body-semibold text-[13px] text-ink"
              >
                {M.recent}
              </Text>
              {tickets.isPending ? (
                <ThemedActivityIndicator accessibilityLabel={M.loading} className="text-primary" />
              ) : tickets.isError ? (
                <>
                  <Notice error>{M.supportError}</Notice>
                  <Button
                    label={M.retry}
                    variant="outline"
                    onPress={() => void tickets.refetch()}
                  />
                </>
              ) : items.length ? (
                items
                  .slice(0, 2)
                  .map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onPress={() => setSheet(ticket.id)}
                    />
                  ))
              ) : (
                <Text className="py-2 font-body text-[13px] leading-6 text-muted">
                  {M.noSupport}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={onAllSupport}
                className={`min-h-touch flex-row items-center justify-center gap-2 rounded-lg bg-customer-subtle px-3 py-2 active:bg-customer-mint ${focus}`}
              >
                <Text className="shrink font-body-semibold text-[12px] text-primary">
                  {M.allSupport}
                </Text>
                <Icon as={ArrowRight} size={16} className="text-primary" />
              </Pressable>
            </View>
          </View>

          <View>
            <SectionTitle icon={ShieldCheck} title={M.settings} />
            <View className="overflow-hidden rounded-xl border border-outline-variant bg-customer-canvas">
              {settings.map((item, index) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  onPress={onUnavailable}
                  className={`min-h-control flex-row items-center gap-3 p-4 active:bg-primary-soft ${index ? "border-t border-outline-variant" : ""} ${focus}`}
                >
                  <View className="size-9 items-center justify-center rounded-lg bg-customer-subtle">
                    <Icon as={item.icon} size={20} className="text-primary" />
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-body-semibold text-[14px] leading-6 text-ink">
                      {item.title}
                    </Text>
                    <Text className="font-body text-[12px] leading-5 text-muted">{item.hint}</Text>
                  </View>
                  <Icon as={ChevronRight} size={17} className="text-muted" />
                </Pressable>
              ))}
            </View>
          </View>
          <View className="gap-3">
            {error && <Notice error>{error}</Notice>}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending, busy: pending }}
              disabled={pending}
              onPress={onLogout}
              className={`min-h-control flex-row items-center justify-center gap-2 rounded-lg border border-danger-line bg-danger-soft/30 px-4 py-3 active:bg-danger-soft ${pending ? "opacity-55" : ""} ${focus}`}
            >
              {pending ? (
                <ThemedActivityIndicator
                  accessibilityLabel={M.logout}
                  className="text-danger-strong"
                />
              ) : (
                <Icon as={LogOut} size={19} className="text-danger-strong" />
              )}
              <Text className="font-body-semibold text-[14px] text-danger-strong">{M.logout}</Text>
            </Pressable>
            <Text className="text-center font-body-medium text-[11px] leading-5 text-muted">
              {M.footer}
            </Text>
          </View>
        </View>
      </ScrollView>
      <DetailSheet
        visible={sheet !== null}
        title={M.supportDetail}
        closeLabel={M.close}
        onClose={() => setSheet(null)}
      >
        <View className="gap-3">
          {detail.isPending ? (
            <ThemedActivityIndicator accessibilityLabel={M.loading} className="text-primary" />
          ) : detail.isError ? (
            <>
              <Notice error>{M.supportError}</Notice>
              <Button label={M.retry} variant="outline" onPress={() => void detail.refetch()} />
            </>
          ) : detail.data ? (
            <>
              <TicketCard ticket={detail.data.ticket} onPress={() => setSheet(null)} />
              <Text
                accessibilityRole="header"
                className="mt-3 font-body-semibold text-label text-ink"
              >
                {M.supportMessages}
              </Text>
              {detail.data.messages.items.length ? (
                detail.data.messages.items.map((message) => (
                  <View
                    key={message.id}
                    className="gap-2 rounded-xl border border-outline-variant bg-surface p-4"
                  >
                    <Text className="font-body text-[14px] leading-6 text-ink">
                      {message.content}
                    </Text>
                    <Text className="font-body text-[11px] text-muted">
                      {dateTime(message.createdAt)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className="font-body text-label text-muted">{M.noMessages}</Text>
              )}
            </>
          ) : null}
        </View>
      </DetailSheet>
    </>
  );
}
