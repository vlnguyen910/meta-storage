import { SUPPORT_CATEGORIES } from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { CalendarField } from "../../components/ui/calendar-field";
import { ChoiceTabs } from "../../components/ui/choice-tabs";
import { MobilePhoto } from "../../components/ui/mobile-photo";
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
import { StatusPill } from "../../components/ui/workspace-ui";
import {
  useCustomerBooking,
  useCustomerBookings,
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
import { CUSTOMER_MOBILE_UI as U } from "./customer-ui.messages";
import { QueryNotice } from "./query-notice";
import { customerError, useCustomerTicket } from "./use-customer-ticket";
import { useMobileCatalog } from "./use-mobile-catalog";

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
  const state = useMobileCatalog();
  if (state.facility)
    return (
      <>
        <Button secondary label={U.backToFacilities} onPress={() => state.setSelected(undefined)} />
        <Heading>{state.facility.name}</Heading>
        <MobilePhoto tall label={U.facility} source={require("../../../assets/landing/8.png")} />
        <Card title={U.facility}>
          <Text className="mb-3 text-sm leading-6 text-slate-600">{state.facility.address}</Text>
          {state.facility.description && (
            <Text className="text-sm leading-6 text-slate-500">{state.facility.description}</Text>
          )}
        </Card>
        <Heading>{U.unitTypes}</Heading>
        <FacilityTypes id={state.facility.id} go={go} />
      </>
    );
  return (
    <>
      <Heading>{U.findFacilities}</Heading>
      <Text className="mb-5 text-sm leading-6 text-slate-500">{U.catalogDescription}</Text>
      <Field label={U.catalogSearch} value={state.search} onChangeText={state.setSearch} />
      <ChoiceTabs
        options={[
          { value: "", label: U.allCities },
          ...["Hồ Chí Minh", "Hà Nội", "Đà Nẵng"].map((city) => ({ value: city, label: city })),
        ]}
        value={state.city}
        onChange={state.setCity}
      />
      <ChoiceTabs
        options={[
          { value: "name", label: U.sortName },
          { value: "price", label: U.sortPrice },
        ]}
        value={state.sort}
        onChange={state.setSort}
      />
      <QueryNotice query={state.query} />
      {state.items.map((facility) => (
        <Card key={facility.id}>
          <MobilePhoto label={U.facility} source={require("../../../assets/landing/8.png")} />
          <Text className="mb-3 text-xl font-bold text-slate-900">{facility.name}</Text>
          <Text className="mb-4 text-sm leading-6 text-slate-500">{facility.address}</Text>
          {facility.price != null && <Row label={M.monthlyRate} value={money(facility.price)} />}
          <Button label={U.detail} onPress={() => state.setSelected(facility.id)} />
        </Card>
      ))}
      {state.query.isSuccess && !state.items.length && <Notice>{M.empty}</Notice>}
      {state.query.hasNextPage && (
        <Button
          label={M.more}
          disabled={state.query.isFetchingNextPage}
          onPress={() => {
            void state.query.fetchNextPage();
          }}
        />
      )}
    </>
  );
}
export function CustomerHomeScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const query = useCustomerBookings(owner);
  const rentals = useCustomerRentals(owner, "current");
  const [tab, setTab] = useState("bookings");
  const bookings = query.data?.pages.flatMap((p) => p.items) ?? [];
  const storages = rentals.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
        {U.portal}
      </Text>
      <Heading>{U.dashboard}</Heading>
      <Text className="mb-5 text-sm leading-6 text-slate-500">{U.dashboardDescription}</Text>
      <Button label={M.newBooking} onPress={() => go({ screen: "catalog" })} />
      <View className="my-4 flex-row flex-wrap">
        {[
          {
            label: U.activeRentals,
            value: rentals.data
              ? `${storages.filter((r) => r.status === "ACTIVE").length}${rentals.hasNextPage ? "+" : ""}`
              : "—",
            route: "rentals",
          },
          {
            label: U.bookings,
            value: query.data
              ? `${bookings.filter((b) => b.status === "CONFIRMED").length}${query.hasNextPage ? "+" : ""}`
              : "—",
            route: "bookings",
          },
          { label: U.facility, value: U.findFacilities, route: "catalog" },
          { label: U.support, value: U.supportHint, route: "support" },
        ].map((card) => (
          <View key={card.route} className="w-1/2 p-1.5">
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                go({ screen: card.route as "rentals" | "bookings" | "catalog" | "support" })
              }
              className="min-h-28 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <Text className="mb-3 text-xs font-semibold text-slate-500">{card.label}</Text>
              <Text className="text-lg font-bold text-emerald-900">{card.value}</Text>
              <Text className="mt-3 text-xs font-semibold text-emerald-700">
                {U.detailAction} →
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
      <ChoiceTabs
        options={[
          { value: "bookings", label: U.appointments },
          { value: "rentals", label: U.activeRentals },
        ]}
        value={tab}
        onChange={setTab}
      />
      <QueryNotice query={tab === "bookings" ? query : rentals} />
      {tab === "bookings"
        ? bookings.slice(0, 5).map((b) => (
            <Card key={b.id} title={b.bookingCode ?? undefined}>
              <StatusPill
                label={U.status[b.status] ?? b.status}
                tone={b.status === "CANCELLED" ? "neutral" : "blue"}
              />
              <Text className="my-3 font-semibold text-slate-700">{b.facility.name}</Text>
              <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
              <Row label={M.paymentStatus} value={U.status[b.paymentStatus] ?? b.paymentStatus} />
              <Button
                secondary
                label={U.qrAction}
                onPress={() => go({ screen: "booking", id: b.id })}
              />
            </Card>
          ))
        : storages.slice(0, 5).map((r) => (
            <Card key={r.id} title={r.storageUnit?.code ?? r.unitType.name}>
              <Text className="mb-3 text-sm text-slate-500">{r.facility.name}</Text>
              <Row label={M.oldEnd} value={dateTime(r.endAt)} />
              <Button
                secondary
                label={U.detailAction}
                onPress={() => go({ screen: "rental", id: r.id })}
              />
            </Card>
          ))}
      {(tab === "bookings"
        ? query.isSuccess && !bookings.length
        : rentals.isSuccess && !storages.length) && (
        <Card title={U.noBookingsOrRentals}>
          <Text className="text-sm leading-6 text-slate-500">{U.noBookingsOrRentalsHint}</Text>
        </Card>
      )}
      <Button
        secondary
        label={U.viewAll}
        onPress={() => go({ screen: tab === "bookings" ? "bookings" : "rentals" })}
      />
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
            <Row label={M.paymentStatus} value={U.status[b.paymentStatus] ?? b.paymentStatus} />
            <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
            <StatusPill label={U.status[b.status] ?? b.status} tone="blue" />
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
            <StatusPill label={U.status[b.status] ?? b.status} tone="blue" />
            <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
            <Row label={M.assigned} value={b.assignedUnit?.code ?? M.noUnit} />
            <Row label={M.handover} value={b.handoverStage} />
            <Row label={M.initialRent} value={money(b.pricing.rentalFeeAmount)} />
            <Row label={M.deposit} value={money(b.pricing.depositAmount)} />
            <Row label={M.total} value={money(b.pricing.totalAmount)} />
            <Row label={M.paymentStatus} value={U.status[b.paymentStatus] ?? b.paymentStatus} />
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
          <CalendarField
            label={M.checkInDate}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
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
  const [tab, setTab] = useState("rentals");
  return (
    <>
      <Heading>{U.storage}</Heading>
      <ChoiceTabs
        options={[
          { value: "rentals", label: U.rentals },
          { value: "bookings", label: U.bookings },
          { value: "history", label: U.history },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "bookings" ? (
        <CustomerBookingsScreen owner={owner} go={go} />
      ) : (
        <RentalList
          key={tab}
          owner={owner}
          go={go}
          view={tab === "history" ? "history" : "current"}
        />
      )}
    </>
  );
}
function RentalList({
  owner,
  go,
  view,
}: {
  owner: string;
  go: CustomerNavigation;
  view: "current" | "history";
}) {
  const query = useCustomerRentals(owner, view);
  return (
    <>
      <QueryNotice query={query} />
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((r) => (
          <Card key={r.id} title={r.storageUnit?.code ?? r.unitType.name}>
            <StatusPill
              label={U.status[r.status] ?? r.status}
              tone={r.status === "ACTIVE" ? "green" : "neutral"}
            />
            <Text className="my-3 text-sm text-slate-600">{r.facility.name}</Text>
            <Row label={M.oldEnd} value={dateTime(r.endAt)} />
            <Button label={M.choose} onPress={() => go({ screen: "rental", id: r.id })} />
          </Card>
        ))}
      {query.data?.pages[0]?.items.length === 0 && <Notice>{M.empty}</Notice>}
      {query.hasNextPage && (
        <Button
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
            <StatusPill label={U.status[r.status] ?? r.status} tone="green" />
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
                <Text>{U.status[p.status] ?? p.status}</Text>
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
