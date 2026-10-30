import { useState } from "react";
import { Text } from "react-native";
import { ChoiceTabs } from "../../components/ui/choice-tabs";
import { Button, Card, dateTime, Field, Heading, money, Row } from "../../components/ui/mobile-ui";
import { StatusPill } from "../../components/ui/workspace-ui";
import type { CustomerNavigation } from "./customer-api.types";
import { CUSTOMER_MOBILE_UI as M } from "./customer-ui.messages";
import { QueryNotice } from "./query-notice";
import { useCustomerTransactions } from "./use-customer-transactions";

export function CustomerTransactionsScreen({
  owner,
  go,
}: {
  owner: string;
  go: CustomerNavigation;
}) {
  const query = useCustomerTransactions(owner);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const items = query.items.filter(
    ({ rental, payment }) =>
      (status === "all" || payment.status === status) &&
      `${rental.bookingCode} ${rental.facility.name} ${payment.paymentCode ?? ""}`
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      <Heading>{M.transactions}</Heading>
      <Text className="mb-5 text-sm leading-6 text-slate-500">{M.transactionsDescription}</Text>
      <Field label={M.transactionSearch} value={search} onChangeText={setSearch} />
      <ChoiceTabs
        options={[
          { value: "all", label: M.all },
          ...["SUCCEEDED", "PENDING", "REFUNDED", "FAILED"].map((s) => ({
            value: s,
            label: M.status[s] ?? s,
          })),
        ]}
        value={status}
        onChange={setStatus}
      />
      <QueryNotice query={query} />
      {!query.isPending && !query.isError && !items.length && (
        <Card title={M.emptyTransactions}>
          <Text className="text-sm text-slate-500">{M.emptyTransactionsHint}</Text>
        </Card>
      )}
      {items.map(({ rental, payment }) => (
        <Card key={payment.id} title={payment.paymentCode ?? rental.bookingCode}>
          <StatusPill
            label={M.status[payment.status] ?? payment.status}
            tone={
              payment.status === "SUCCEEDED"
                ? "green"
                : payment.status === "FAILED"
                  ? "red"
                  : "amber"
            }
          />
          <Text className="my-3 text-2xl font-bold text-slate-900">
            {money(payment.totalAmount)}
          </Text>
          <Row label={M.facility} value={rental.facility.name} />
          <Row label={M.transactionTime} value={dateTime(payment.paidAt ?? payment.createdAt)} />
          {payment.refundAmount && <Row label={M.refund} value={money(payment.refundAmount)} />}
          <Button
            secondary
            label={M.viewRental}
            onPress={() => go({ screen: "rental", id: rental.id })}
          />
          <Button
            secondary
            label={M.paymentSupport}
            onPress={() =>
              go({
                screen: "support-new",
                reservationId: rental.reservationId ?? undefined,
                paymentId: payment.id,
              })
            }
          />
        </Card>
      ))}
      {query.hasNextPage && (
        <Button
          secondary
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => {
            void query.more();
          }}
        />
      )}
    </>
  );
}
