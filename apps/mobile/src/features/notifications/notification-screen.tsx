import { useInfiniteQuery } from "@tanstack/react-query";
import { Text } from "react-native";
import { Button, Card, dateTime, Heading } from "../../components/ui/mobile-ui";
import { api } from "../../lib/api";
import { QueryNotice } from "../customer-api/query-notice";
import { MOBILE_NOTIFICATIONS as M } from "./notifications.messages";

export function NotificationScreen({ owner }: { owner: string }) {
  const query = useInfiniteQuery({
    queryKey: ["mobile-inbox", owner],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.inbox(pageParam, signal),
    getNextPageParam: (page, pages) => (page.length === 20 ? pages.length * 20 : undefined),
    refetchInterval: 30000,
  });
  const items = query.data?.pages.flat() ?? [];
  return (
    <>
      <Heading>{M.title}</Heading>
      <Text className="mb-5 text-sm leading-6 text-slate-500">{M.description}</Text>
      <Button
        secondary
        label={M.refresh}
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      />
      <QueryNotice query={query} />
      {query.isSuccess && !items.length && (
        <Card title={M.empty}>
          <Text className="text-sm leading-6 text-slate-500">{M.emptyDescription}</Text>
        </Card>
      )}
      {items.map((item) => (
        <Card key={item.id} title={item.subject}>
          <Text className="mb-4 text-sm leading-6 text-slate-600">{item.body}</Text>
          <Text className="text-xs text-slate-400">{dateTime(item.occurredAt)}</Text>
        </Card>
      ))}
      {query.hasNextPage && (
        <Button
          secondary
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        />
      )}
    </>
  );
}
