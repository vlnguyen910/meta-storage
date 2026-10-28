import { SUPPORT_CATEGORIES } from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { Alert, Platform, Text, View } from "react-native";
import {
  Button,
  Card,
  dateTime,
  Field,
  Heading,
  money,
  Notice,
  Row,
} from "../../components/ui/mobile-ui";
import {
  useCustomerBooking,
  useCustomerBookings,
  useCustomerCatalog,
  useCustomerCheckout,
  useCustomerPayment,
  useCustomerRental,
  useCustomerRentals,
  useCustomerSupportForm,
  useCustomerTickets,
  useCustomerTypes,
} from "./customer-api.hooks";
import type { CustomerNavigation } from "./customer-api.types";
import { openCustomerCheckout } from "./customer-native";
import { customerError, useCustomerTicket } from "./use-customer-ticket";

export function QueryNotice({
  query,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
}) {
  return query.isPending ? (
    <Notice>{M.loading}</Notice>
  ) : query.isError ? (
    <>
      <Notice error>{customerError(query.error)}</Notice>
      <Button label={M.retry} onPress={() => void query.refetch()} />
    </>
  ) : null;
}
function QrCode({ value }: { value: string }) {
  const matrix = useMemo(
    () => QRCode.create(value, { errorCorrectionLevel: "M" }).modules,
    [value],
  );
  const rows = Array.from({ length: matrix.size }, (_, y) => ({
    y,
    cells: Array.from({ length: matrix.size }, (_, x) => ({ x, dark: matrix.get(y, x) })),
  }));
  return (
    <View
      accessible
      accessibilityLabel={M.qr}
      className="my-4 self-center border-8 border-white bg-white"
    >
      {rows.map((row) => (
        <View key={row.y} className="flex-row">
          {row.cells.map((cell) => (
            <View
              key={cell.x}
              style={{ width: 4, height: 4, backgroundColor: cell.dark ? "#000" : "#fff" }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
function FacilityTypes({ id, go }: { id: string; go: CustomerNavigation }) {
  const query = useCustomerTypes(id);
  return (
    <>
      <QueryNotice query={query} />
      {query.data?.pages.flat().map((t) => (
        <Card key={t.id} title={t.name}>
          <Text className="mb-3">
            {t.sizeLabel} · {t.lengthM} × {t.widthM} × {t.heightM} m
          </Text>
          <Row label={M.monthlyRate} value={money(t.monthlyPrice)} />
          <Row label={M.availability} value={M.unknown} />
          <Button
            label={M.newBooking}
            onPress={() => go({ screen: "checkout", facilityId: id, unitTypeId: t.id })}
          />
        </Card>
      ))}
      {query.hasNextPage && (
        <Button
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function CustomerCatalogScreen({ go }: { go: CustomerNavigation }) {
  const query = useCustomerCatalog();
  const [selected, setSelected] = useState<string>();
  return (
    <>
      <Heading>{M.facility}</Heading>
      <QueryNotice query={query} />
      {query.data?.pages.flat().map((f) => (
        <Card title={f.name} key={f.id}>
          <Text className="mb-3">{f.address}</Text>
          <Button
            label={M.choose}
            secondary
            onPress={() => setSelected(selected === f.id ? undefined : f.id)}
          />
          {selected === f.id && <FacilityTypes id={f.id} go={go} />}
        </Card>
      ))}
      {query.hasNextPage && (
        <Button
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function CustomerHomeScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const query = useCustomerBookings(owner);
  const rentals = useCustomerRentals(owner, "current");
  return (
    <>
      <Heading>{M.dashboard}</Heading>
      <Button label={M.newBooking} onPress={() => go({ screen: "catalog" })} />
      <Card title={M.recent}>
        <QueryNotice query={query} />
        {query.data?.pages[0]?.items.slice(0, 3).map((b) => (
          <Button
            secondary
            key={b.id}
            label={`${b.bookingCode ?? b.id} · ${b.status} · ${dateTime(b.checkInSlotStart)}`}
            onPress={() => go({ screen: "booking", id: b.id })}
          />
        ))}
        {query.data?.pages[0]?.items.length === 0 && <Text>{M.empty}</Text>}
      </Card>
      <Card title={M.storage}>
        <QueryNotice query={rentals} />
        {rentals.data?.pages[0]?.items.slice(0, 3).map((r) => (
          <Button
            secondary
            key={r.id}
            label={`${r.facility.name} · ${r.storageUnit?.code ?? r.unitType.name}`}
            onPress={() => go({ screen: "rental", id: r.id })}
          />
        ))}
      </Card>
    </>
  );
}
export function CustomerBookingsScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const query = useCustomerBookings(owner);
  return (
    <>
      <Heading>{M.bookings}</Heading>
      <QueryNotice query={query} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((b) => (
          <Card title={b.bookingCode ?? b.id} key={b.id}>
            <Text>
              {b.facility.name} · {b.unitType.name}
            </Text>
            <Row label={M.paymentStatus} value={b.paymentStatus} />
            <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
            <Text>{b.status}</Text>
            <Button label={M.choose} onPress={() => go({ screen: "booking", id: b.id })} />
          </Card>
        ))}
      {query.data?.pages[0]?.items.length === 0 && <Text>{M.empty}</Text>}
      {query.hasNextPage && (
        <Button
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function CustomerBookingScreen({
  owner,
  id,
  go,
}: {
  owner: string;
  id: string;
  go: CustomerNavigation;
}) {
  const { query, cancel } = useCustomerBooking(owner, id);
  const b = query.data;
  return (
    <>
      <QueryNotice query={query} />
      {b && (
        <>
          <Heading>{b.bookingCode ?? b.id}</Heading>
          <Card title={b.facility.name}>
            <Text>{b.facility.address}</Text>
            <Text>{b.status}</Text>
            <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
            <Row label={M.assigned} value={b.assignedUnit?.code ?? M.noUnit} />
            <Row label={M.handover} value={b.handoverStage} />
            <Row label={M.initialRent} value={money(b.pricing.rentalFeeAmount)} />
            <Row label={M.deposit} value={money(b.pricing.depositAmount)} />
            <Row label={M.total} value={money(b.pricing.totalAmount)} />
            <Row label={M.paymentStatus} value={b.paymentStatus} />
            {b.confirmation ? <QrCode value={b.confirmation.qrUrl} /> : <Text>{M.noQr}</Text>}
            {b.rentalId && (
              <Button
                label={M.viewRental}
                onPress={() => {
                  if (b.rentalId) go({ screen: "rental", id: b.rentalId });
                }}
              />
            )}
            {b.status === "CONFIRMED" && (
              <Button
                danger
                label={M.cancel}
                disabled={cancel.isPending}
                onPress={() => {
                  if (Platform.OS === "web") {
                    if (window.confirm(M.cancelConfirm)) cancel.mutate();
                  } else
                    Alert.alert(M.cancel, M.cancelConfirm, [
                      { text: M.back },
                      { text: M.cancel, onPress: () => cancel.mutate() },
                    ]);
                }}
              />
            )}
            {cancel.isError && <Notice error>{customerError(cancel.error)}</Notice>}
            <Button
              label={M.newTicket}
              secondary
              onPress={() => go({ screen: "support-new", bookingId: id })}
            />
          </Card>
        </>
      )}
    </>
  );
}
export function CustomerCheckoutScreen({
  owner,
  facilityId,
  unitTypeId,
  go,
}: {
  owner: string;
  facilityId: string;
  unitTypeId: string;
  go: CustomerNavigation;
}) {
  const state = useCustomerCheckout(owner, facilityId, unitTypeId, go);
  return (
    <>
      <Heading>{M.newBooking}</Heading>
      <QueryNotice query={state.slots} />
      <Controller
        control={state.form.control}
        name="checkInDate"
        render={({ field, fieldState }) => (
          <Field
            label={M.checkInDate}
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            placeholder="YYYY-MM-DD"
          />
        )}
      />
      <Controller
        control={state.form.control}
        name="durationMonths"
        render={({ field, fieldState }) => (
          <Field
            label={M.months}
            value={String(field.value)}
            onChangeText={(v) => field.onChange(Number(v))}
            keyboardType="number-pad"
            error={fieldState.error?.message}
          />
        )}
      />
      <Text className="mb-3 font-bold">{M.slot}</Text>
      {state.slots.data?.map((s) => (
        <Button
          secondary
          key={s.id}
          label={`${state.form.watch("checkInSlotId") === s.id ? "✓ " : ""}${s.name} ${s.startTime}–${s.endTime}`}
          onPress={() => state.form.setValue("checkInSlotId", s.id)}
        />
      ))}
      <Text className="mb-3">
        {M.availability}:{" "}
        {state.availability.isError
          ? M.unknown
          : state.availability.data
            ? state.availability.data.availableCount === 0
              ? M.unavailable
              : M.available(state.availability.data.availableCount)
            : M.unknown}
      </Text>
      {state.availability.isError && (
        <Notice error>{customerError(state.availability.error)}</Notice>
      )}
      <Text className="mb-3">{M.snapshot}</Text>
      <Button
        label={M.choose}
        disabled={state.prepare.isPending}
        onPress={() => void state.form.handleSubmit((v) => state.prepare.mutate(v))()}
      />
      {state.prepare.isError && <Notice error>{customerError(state.prepare.error)}</Notice>}
      {state.draft && (
        <Card title={M.payment}>
          <Row label={M.monthlyRate} value={money(state.draft.pricing.monthlyRateSnapshot)} />
          <Row label={M.initialRent} value={money(state.draft.pricing.rentalFeeAmount)} />
          <Row label={M.deposit} value={money(state.draft.pricing.depositAmount)} />
          <Row label={M.total} value={money(state.draft.pricing.totalAmount)} />
          <Controller
            control={state.paymentForm.control}
            name="contactPhone"
            render={({ field, fieldState }) => (
              <Field
                label={M.contactPhone}
                value={field.value ?? ""}
                onChangeText={(value) => field.onChange(value || undefined)}
                keyboardType="phone-pad"
                error={fieldState.error?.message}
              />
            )}
          />
          <Button
            label={M.payment}
            disabled={state.pay.isPending}
            onPress={() =>
              void state.paymentForm.handleSubmit((input) =>
                state.pay.mutate(input.contactPhone ?? ""),
              )()
            }
          />
          {state.pay.isError && <Notice error>{customerError(state.pay.error)}</Notice>}
        </Card>
      )}
    </>
  );
}
export function CustomerPaymentScreen({
  owner,
  id,
  bookingId,
  go,
}: {
  owner: string;
  id: string;
  bookingId?: string;
  go: CustomerNavigation;
}) {
  const query = useCustomerPayment(owner, id);
  const open = useMutation({ mutationFn: openCustomerCheckout });
  const p = query.data;
  const confirmation = p?.confirmation;
  const expired = Boolean(
    p?.transferInstructions && Date.parse(p.transferInstructions.expiresAt) <= Date.now(),
  );
  return (
    <>
      <Heading>{M.payment}</Heading>
      <QueryNotice query={query} />
      {p && (
        <Card title={p.paymentCode ?? undefined}>
          <Row label={M.paymentStatus} value={p.status} />
          {p.status === "PENDING" && <Notice>{M.paymentPending}</Notice>}
          {p.status === "FAILED" && <Notice error>{M.paymentFailed}</Notice>}
          {p.checkoutUrl && p.checkoutFormFields && p.status === "PENDING" && !expired && (
            <Button
              label={M.openCheckout}
              disabled={open.isPending}
              onPress={() => {
                if (p.checkoutUrl && p.checkoutFormFields)
                  open.mutate({
                    checkoutUrl: p.checkoutUrl,
                    checkoutFormFields: p.checkoutFormFields,
                  });
              }}
            />
          )}
          {confirmation && (
            <>
              <QrCode value={confirmation.qrUrl} />
              <Button
                label={M.booking}
                onPress={() => go({ screen: "booking", id: confirmation.bookingId })}
              />
            </>
          )}
          {bookingId && (
            <Button
              secondary
              label={M.newTicket}
              onPress={() => go({ screen: "support-new", bookingId, paymentId: id })}
            />
          )}
        </Card>
      )}
      {p && (p.status === "FAILED" || expired || (p.status === "PENDING" && !p.checkoutUrl)) && (
        <>
          <Notice>{p.status === "FAILED" ? M.paymentFailed : M.paymentExpired}</Notice>
          <Button
            label={M.retry}
            disabled={query.restart.isPending}
            onPress={() =>
              query.restart.mutate(undefined, {
                onSuccess: (draft) => {
                  if (draft)
                    go({
                      screen: "checkout",
                      facilityId: draft.facilityId,
                      unitTypeId: draft.unitTypeId,
                    });
                  else go({ screen: "rentals" });
                },
              })
            }
          />
        </>
      )}
      <Button
        label={M.checkPayment}
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {open.isError && <Notice error>{customerError(open.error)}</Notice>}
      {query.restart.isError && <Notice error>{customerError(query.restart.error)}</Notice>}
      <Button label={M.storage} secondary onPress={() => go({ screen: "rentals" })} />
    </>
  );
}
export function CustomerRentalsScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const [view, setView] = useState<"current" | "history">("current");
  const query = useCustomerRentals(owner, view);
  return (
    <>
      <Heading>{M.storage}</Heading>
      <View className="mb-3 flex-row gap-3">
        <Button secondary label={M.current} onPress={() => setView("current")} />
        <Button secondary label={M.history} onPress={() => setView("history")} />
      </View>
      <QueryNotice query={query} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((r) => (
          <Card key={r.id} title={`${r.facility.name} · ${r.storageUnit?.code ?? r.unitType.name}`}>
            <Text>{r.status}</Text>
            <Row label={M.oldEnd} value={dateTime(r.endAt)} />
            <Button label={M.choose} onPress={() => go({ screen: "rental", id: r.id })} />
          </Card>
        ))}
      {query.data?.pages[0]?.items.length === 0 && <Text>{M.empty}</Text>}
      {query.hasNextPage && (
        <Button
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function CustomerRentalScreen({
  owner,
  id,
  go,
}: {
  owner: string;
  id: string;
  go: CustomerNavigation;
}) {
  const state = useCustomerRental(owner, id),
    r = state.rental.data;
  return (
    <>
      <QueryNotice query={state.rental} />
      {r && (
        <>
          <Heading>{`${r.facility.name} · ${r.storageUnit?.code ?? r.unitType.name}`}</Heading>
          <Card title={M.storage}>
            <Text>{r.status}</Text>
            <Row label={M.oldEnd} value={dateTime(r.endAt)} />
            <Button
              label={M.newTicket}
              secondary
              onPress={() => go({ screen: "support-new", bookingId: r.bookingId })}
            />
          </Card>
          <Card title={M.transactions}>
            <QueryNotice query={state.payments} />
            {state.payments.data?.map((p) => (
              <Card key={p.id} title={p.paymentCode ?? undefined}>
                <Text>{p.status}</Text>
                <Text>{money(p.totalAmount)}</Text>
                <Button
                  label={M.newTicket}
                  secondary
                  onPress={() =>
                    go({ screen: "support-new", bookingId: r.bookingId, paymentId: p.id })
                  }
                />
              </Card>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
export function CustomerSupportScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const query = useCustomerTickets(owner);
  return (
    <>
      <Heading>{M.support}</Heading>
      <Button label={M.newTicket} onPress={() => go({ screen: "support-new" })} />
      <QueryNotice query={query} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((t) => (
          <Button
            secondary
            key={t.id}
            label={`${t.subject} · ${t.status}`}
            onPress={() => go({ screen: "ticket", id: t.id })}
          />
        ))}
      {query.hasNextPage && (
        <Button
          label={M.more}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function CustomerSupportNewScreen({
  owner,
  go,
  bookingId,
  paymentId,
}: {
  owner: string;
  go: CustomerNavigation;
  bookingId?: string;
  paymentId?: string;
}) {
  const state = useCustomerSupportForm(owner, go, bookingId, paymentId);
  const category = state.form.watch("category");
  return (
    <>
      <Heading>{M.newTicket}</Heading>
      <Text className="mb-3 font-bold">{M.category}</Text>
      {SUPPORT_CATEGORIES.map((c) => (
        <Button
          secondary
          key={c}
          label={`${category === c ? "✓ " : ""}${M.categories[c]}`}
          onPress={() => {
            state.form.setValue("category", c);
            state.form.setValue("bookingId", "");
            state.form.setValue("paymentId", undefined);
          }}
        />
      ))}
      <QueryNotice query={state.contexts} />
      <Text className="mb-3 font-bold">{M.booking}</Text>
      {state.contexts.data?.pages
        .flatMap((p) => p.items)
        .map((b) => (
          <Button
            key={b.id}
            secondary
            label={`${state.form.watch("bookingId") === b.id ? "✓ " : ""}${b.bookingCode ?? b.id} · ${b.facility.name}`}
            onPress={() => {
              state.form.setValue("bookingId", b.id);
              state.form.setValue("paymentId", undefined);
            }}
          />
        ))}
      {state.contexts.hasNextPage && (
        <Button label={M.more} onPress={() => void state.contexts.fetchNextPage()} />
      )}
      {category === "PAYMENT" && state.form.watch("bookingId") && (
        <>
          <Text className="mb-3 font-bold">{M.optionalPayment}</Text>
          <QueryNotice query={state.attempts} />
          {state.attempts.data?.pages
            .flatMap((p) => p.items)
            .map((p) => (
              <Button
                key={p.id}
                secondary
                label={`${state.form.watch("paymentId") === p.id ? "✓ " : ""}${p.paymentCode} · ${p.status}`}
                onPress={() =>
                  state.form.setValue(
                    "paymentId",
                    state.form.watch("paymentId") === p.id ? undefined : p.id,
                  )
                }
              />
            ))}
          {state.attempts.hasNextPage && (
            <Button label={M.more} onPress={() => void state.attempts.fetchNextPage()} />
          )}
        </>
      )}
      <Controller
        control={state.form.control}
        name="subject"
        render={({ field, fieldState }) => (
          <Field
            label={M.subject}
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            maxLength={200}
          />
        )}
      />
      <Controller
        control={state.form.control}
        name="content"
        render={({ field, fieldState }) => (
          <Field
            label={M.content}
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            multiline
            maxLength={5000}
          />
        )}
      />
      <Button
        label={M.save}
        disabled={state.create.isPending}
        onPress={() => void state.submit()}
      />
      {state.create.isError && <Notice error>{customerError(state.create.error)}</Notice>}
    </>
  );
}
export function CustomerTicketScreen({ owner, id }: { owner: string; id: string }) {
  const state = useCustomerTicket(owner, id);
  const ticket = state.detail.data?.ticket;
  const busy = state.reply.isPending || state.upload.isPending;
  return (
    <>
      <QueryNotice query={state.detail} />
      {ticket && (
        <>
          <Heading>{ticket.subject}</Heading>
          <Text className="mb-3">{ticket.status}</Text>
          {state.notice && <Notice error>{state.notice}</Notice>}
          <QueryNotice query={state.messages} />
          {!ticket.closedAt && (
            <>
              <Button
                label={M.chooseImage}
                secondary
                disabled={busy}
                onPress={() => state.pick.mutate()}
              />
              <Text className="mb-4">{state.image?.filename ?? M.imageHelp}</Text>
            </>
          )}
          {state.messages.data?.pages
            .flatMap((p) => p.items)
            .map((message) => (
              <Card key={message.id} title={message.authorName}>
                <Text className="mb-3">{message.content}</Text>
                <Text className="mb-3">{dateTime(message.createdAt)}</Text>
                {message.attachments.map((a) => (
                  <Button
                    key={a.id}
                    secondary
                    label={a.filename}
                    onPress={() =>
                      state.openImage.mutate({
                        imageId: a.id,
                        filename: a.filename,
                        mimeType: a.mimeType,
                      })
                    }
                  />
                ))}
                {!ticket.closedAt && message.authorRole === "CUSTOMER" && (
                  <Button
                    label={M.image}
                    secondary
                    disabled={!state.image || busy}
                    onPress={() => state.upload.mutate(message.id)}
                  />
                )}
              </Card>
            ))}
          {state.messages.hasNextPage && (
            <Button label={M.more} onPress={() => void state.messages.fetchNextPage()} />
          )}
          {ticket.closedAt ? (
            <Notice>{M.closed}</Notice>
          ) : (
            <>
              <Field
                label={M.content}
                value={state.content}
                onChangeText={state.setContent}
                multiline
                maxLength={5000}
              />
              <Button
                label={M.reply}
                disabled={!state.content.trim() || busy}
                onPress={() => state.reply.mutate()}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
