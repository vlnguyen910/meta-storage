import type { SupportTicketDto } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { CalendarDays, ChevronRight, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button, ChoiceTabs, Field, Icon, Notice } from "../../components/ui";
import { dateTime } from "../../components/ui/mobile-ui";
import { ThemedActivityIndicator } from "../../components/ui/native-styles";
import { StatusPill } from "../../components/ui/workspace-ui";
import { useCustomerTickets } from "../../features/customer-api/customer-api.hooks";
import { SUPPORT_LIST as M } from "../../features/customer-api/customer-support-list.messages";
import { customerError } from "../../features/customer-api/use-customer-ticket";

type TicketFilter = "ALL" | SupportTicketDto["status"];
const filters: { value: TicketFilter; label: string }[] = [
  { value: "ALL", label: M.all },
  { value: "OPEN", label: M.received },
  { value: "IN_PROGRESS", label: M.inProgress },
  { value: "CLOSED", label: M.closed },
];
const categories: Record<SupportTicketDto["category"], string> = M.categories;

function statusTone(status: SupportTicketDto["status"]) {
  if (status === "OPEN") return "amber";
  if (status === "IN_PROGRESS") return "blue";
  return "neutral";
}

function TicketListCard({ ticket, onPress }: { ticket: SupportTicketDto; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${M.openTicket}: ${ticket.subject}`}
      onPress={onPress}
      className="mb-3 gap-3 rounded-card border border-outline-variant bg-surface p-4 active:bg-primary-soft web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-ring"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-body-semibold text-[11px] tracking-wide text-muted">
          {formatReference(ticket.id, "SP")}
        </Text>
        <StatusPill label={M.statuses[ticket.status]} tone={statusTone(ticket.status)} compact />
      </View>
      <View className="gap-1">
        <Text className="font-body-bold text-[15px] leading-6 text-ink">{ticket.subject}</Text>
        <Text className="font-body-medium text-[12px] leading-5 text-muted">
          {categories[ticket.category]}
        </Text>
      </View>
      <View className="flex-row items-center justify-between gap-2 border-t border-line pt-3">
        <View className="flex-row items-center gap-1.5">
          <Icon as={CalendarDays} size={14} className="text-muted" />
          <Text className="font-body text-[12px] leading-5 text-muted">
            {dateTime(ticket.createdAt)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-body-semibold text-[12px] text-primary">{M.openTicket}</Text>
          <Icon as={ChevronRight} size={15} className="text-primary" />
        </View>
      </View>
    </Pressable>
  );
}

export function CustomerSupportListScreen({
  owner,
  onCreate,
  onTicket,
}: {
  owner: string;
  onCreate: () => void;
  onTicket: (id: string) => void;
}) {
  const [filter, setFilter] = useState<TicketFilter>("ALL");
  const [search, setSearch] = useState("");
  const tickets = useCustomerTickets(owner, filter === "ALL" ? undefined : filter);
  const items = tickets.data?.pages.flatMap((page) => page.items) ?? [];
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return items;
    return items.filter((ticket) =>
      [
        ticket.subject,
        ticket.description,
        categories[ticket.category],
        formatReference(ticket.id, "SP"),
      ]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle),
    );
  }, [items, search]);

  return (
    <ScrollView
      accessibilityLabel={M.title}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={tickets.isRefetching && !tickets.isFetchingNextPage}
          onRefresh={() => void tickets.refetch()}
          tintColor="#165f4d"
        />
      }
      contentContainerClassName="grow bg-surface px-4 pb-6 pt-3"
    >
      <View className="mx-auto w-full max-w-3xl">
        <Text className="mb-1 font-body text-[13px] leading-5 text-muted">{M.subtitle}</Text>
        <Button
          label={M.create}
          onPress={onCreate}
          inline
          leadingIcon={<Icon as={Plus} size={18} className="text-primary-foreground" />}
        />
        <Field
          label={M.searchLabel}
          value={search}
          onChangeText={setSearch}
          placeholder={M.searchPlaceholder}
          outlined
          autoCapitalize="none"
        />
        <ChoiceTabs options={filters} value={filter} onChange={setFilter} />
        {tickets.isPending ? (
          <View className="py-10">
            <ThemedActivityIndicator accessibilityLabel={M.loading} className="text-primary" />
          </View>
        ) : tickets.isError ? (
          <View className="mt-2">
            <Notice error>{customerError(tickets.error)}</Notice>
            <Button label={M.retry} variant="outline" onPress={() => void tickets.refetch()} />
          </View>
        ) : visibleItems.length ? (
          <>
            {visibleItems.map((ticket) => (
              <TicketListCard key={ticket.id} ticket={ticket} onPress={() => onTicket(ticket.id)} />
            ))}
            {tickets.hasNextPage && (
              <Button
                label={M.loadMore}
                variant="outline"
                loading={tickets.isFetchingNextPage}
                onPress={() => void tickets.fetchNextPage()}
              />
            )}
          </>
        ) : (
          <View className="mt-2 items-center gap-2 rounded-card border border-outline-variant bg-customer-canvas px-5 py-8">
            <Text className="text-center font-body-semibold text-[15px] leading-6 text-ink">
              {search.trim() ? M.noSearchResults : M.emptyTitle}
            </Text>
            <Text className="text-center font-body text-[13px] leading-6 text-muted">
              {search.trim() ? M.noSearchHint : M.emptyHint}
            </Text>
            {search.trim() && tickets.hasNextPage ? (
              <Button
                label={M.loadMore}
                variant="outline"
                loading={tickets.isFetchingNextPage}
                onPress={() => void tickets.fetchNextPage()}
              />
            ) : null}
            {!search.trim() && (
              <Pressable
                accessibilityRole="button"
                onPress={onCreate}
                className="mt-2 min-h-touch flex-row items-center gap-2 rounded-control bg-primary px-4 py-2 active:bg-primary-dark"
              >
                <Icon as={Plus} size={16} className="text-primary-foreground" />
                <Text className="font-body-semibold text-[13px] text-primary-foreground">
                  {M.create}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
