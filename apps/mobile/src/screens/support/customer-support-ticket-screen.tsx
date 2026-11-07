import { formatReference } from "@metastorage/shared";
import { CalendarDays, CheckCircle2 } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Icon, Notice, StatusPill } from "../../components/ui";
import { dateTime } from "../../components/ui/mobile-ui";
import { ThemedActivityIndicator } from "../../components/ui/native-styles";
import { customerError, useCustomerTicket } from "../../features/customer-api/use-customer-ticket";
import { CUSTOMER_SUPPORT as M } from "../../features/support/support.messages";

export interface CustomerSupportTicketScreenProps {
  readonly owner: string;
  readonly id: string;
  readonly created: boolean;
}

export function CustomerSupportTicketScreen({
  owner,
  id,
  created,
}: CustomerSupportTicketScreenProps) {
  const query = useCustomerTicket(owner, id);
  const ticket = query.data?.ticket;
  const messages = query.data?.messages.items ?? [];
  const tone =
    ticket?.status === "OPEN" ? "green" : ticket?.status === "IN_PROGRESS" ? "amber" : "neutral";

  return (
    <ScrollView
      accessibilityLabel={M.ticketTitle}
      contentContainerClassName="grow bg-customer-canvas px-4 pb-6 pt-3"
    >
      <View className="mx-auto w-full max-w-3xl">
        {created ? <Notice>{M.createdNotice}</Notice> : null}
        {query.isPending ? (
          <ThemedActivityIndicator accessibilityLabel={M.loading} className="my-8 text-primary" />
        ) : query.isError ? (
          <>
            <Notice error>{customerError(query.error) || M.ticketLoadError}</Notice>
            <Button label={M.retry} variant="outline" onPress={() => void query.refetch()} />
          </>
        ) : ticket ? (
          <>
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-body-semibold text-[12px] tracking-wide text-muted">
                {M.ticketCode}: {formatReference(ticket.id, "SP")}
              </Text>
              <StatusPill label={M.ticketStatus[ticket.status]} tone={tone} />
            </View>
            <Card title={ticket.subject} compact outlined>
              <View className="mb-3 flex-row items-center gap-2">
                <Icon as={CheckCircle2} size={17} className="text-primary" />
                <Text className="font-body-semibold text-[13px] text-primary">
                  {M.categories[ticket.category]}
                </Text>
              </View>
              <View className="mb-3 flex-row items-center gap-2 border-b border-line pb-3">
                <Icon as={CalendarDays} size={15} className="text-muted" />
                <Text className="font-body text-[12px] leading-5 text-customer-muted">
                  {M.submittedAt}: {dateTime(ticket.createdAt)}
                </Text>
              </View>
              <Text className="mb-2 font-body-semibold text-label text-ink">{M.description}</Text>
              <Text selectable className="font-body text-[14px] leading-6 text-ink">
                {ticket.description}
              </Text>
            </Card>
            <Notice>{M.responseHint}</Notice>
            <Card title={M.messages} compact outlined>
              {messages.length ? (
                <View className="gap-3">
                  {messages.map((message) => (
                    <View key={message.id} className="rounded-control bg-customer-subtle p-3">
                      <View className="mb-1 flex-row flex-wrap items-center justify-between gap-2">
                        <Text className="font-body-semibold text-[12px] text-ink">
                          {message.authorName}
                        </Text>
                        <Text className="font-body text-[10px] text-muted">
                          {dateTime(message.createdAt)}
                        </Text>
                      </View>
                      <Text className="font-body text-label leading-6 text-ink">
                        {message.content}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="font-body text-[13px] leading-6 text-muted">{M.noMessages}</Text>
              )}
            </Card>
          </>
        ) : (
          <Notice error>{M.ticketLoadError}</Notice>
        )}
      </View>
    </ScrollView>
  );
}
