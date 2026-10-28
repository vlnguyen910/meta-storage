import { SUPPORT_CATEGORIES } from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import QRCode from "qrcode";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { Alert, Platform, Pressable, Text, View } from "react-native";
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
  useCustomerAllTransactions,
  useCustomerBooking,
  useCustomerBookings,
  useCustomerCatalog,
  useCustomerCheckout,
  useCustomerNotifications,
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
  const [search, setSearch] = useState("");

  const facilities = query.data?.pages.flat() ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return facilities;
    const term = search.toLowerCase();
    return facilities.filter(
      (f) => f.name.toLowerCase().includes(term) || f.address.toLowerCase().includes(term),
    );
  }, [facilities, search]);

  return (
    <>
      <Heading>{M.facility}</Heading>
      <Notice>Chọn cơ sở và xem danh mục loại kho có sẵn với giá niêm yết minh bạch.</Notice>
      <Field
        label="Tìm kiếm cơ sở kho"
        placeholder="Nhập tên cơ sở hoặc khu vực (Cầu Giấy, Nam Từ Liêm...)"
        value={search}
        onChangeText={setSearch}
      />
      <QueryNotice query={query} />
      {filtered.length === 0 && !query.isPending && (
        <Card>
          <Text className="text-center text-sm text-[#52635A]">Không tìm thấy cơ sở phù hợp.</Text>
        </Card>
      )}
      {filtered.map((f) => (
        <Card title={f.name} key={f.id}>
          <Text className="mb-3 text-sm text-[#52635A]">{f.address}</Text>
          <Button
            label={selected === f.id ? "Thu gọn loại kho" : "Xem các loại kho"}
            secondary={selected !== f.id}
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

  const bookingsList = query.data?.pages.flatMap((p) => p.items) ?? [];
  const rentalsList = rentals.data?.pages.flatMap((p) => p.items) ?? [];

  const upcomingBooking = bookingsList.find((b) => b.status === "CONFIRMED");
  const activeRental = rentalsList.find((r) => r.status === "ACTIVE");

  return (
    <>
      <View className="mb-4">
        <Text className="text-xs font-bold uppercase tracking-wider text-[#125345]">
          storeX Workspace
        </Text>
        <Heading>Tổng quan</Heading>
      </View>

      {/* 3 Quick Stat Cards */}
      <View className="mb-4 flex-row gap-2">
        <View className="flex-1 rounded-[6px] border border-[#BFCAC4] bg-white p-3 shadow-xs">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-[#52635A]">
            Kho đang thuê
          </Text>
          <Text className="mt-1 text-2xl font-black text-[#125345]">{rentalsList.length}</Text>
        </View>
        <View className="flex-1 rounded-[6px] border border-[#BFCAC4] bg-white p-3 shadow-xs">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-[#52635A]">
            Chờ nhận kho
          </Text>
          <Text className="mt-1 text-2xl font-black text-amber-700">
            {bookingsList.filter((b) => b.status === "CONFIRMED").length}
          </Text>
        </View>
        <View className="flex-1 rounded-[6px] border border-[#BFCAC4] bg-white p-3 shadow-xs">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-[#52635A]">
            Đã thanh toán
          </Text>
          <Text className="mt-1 text-2xl font-black text-slate-800">
            {bookingsList.filter((b) => b.paymentStatus === "SUCCEEDED").length}
          </Text>
        </View>
      </View>

      {/* Quick Action Buttons Grid */}
      <Card title="Thao tác nhanh">
        <View className="gap-2">
          <Button label="🏢 Tìm & Đặt kho lưu trữ mới" onPress={() => go({ screen: "catalog" })} />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button secondary label="📦 Kho của tôi" onPress={() => go({ screen: "rentals" })} />
            </View>
            <View className="flex-1">
              <Button secondary label="📑 Đơn đặt chỗ" onPress={() => go({ screen: "bookings" })} />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                secondary
                label="💳 Lịch sử giao dịch"
                onPress={() => go({ screen: "transactions" })}
              />
            </View>
            <View className="flex-1">
              <Button
                secondary
                label="🔔 Hộp thông báo"
                onPress={() => go({ screen: "notifications" })}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Upcoming Check-in Card (with QR Fast Access) */}
      {upcomingBooking && (
        <Card title="Lịch hẹn nhận kho sắp tới">
          <Notice>✓ Đơn đã xác nhận - Hãy đến cơ sở đúng slot hẹn để nhân viên bàn giao kho</Notice>
          <Row label="Mã booking" value={upcomingBooking.bookingCode ?? upcomingBooking.id} />
          <Row label="Cơ sở" value={upcomingBooking.facility.name} />
          <Row label="Slot check-in" value={dateTime(upcomingBooking.checkInSlotStart)} />
          <Button
            label="📱 Mở mã QR Check-in nhận kho"
            onPress={() => go({ screen: "booking", id: upcomingBooking.id })}
          />
        </Card>
      )}

      {/* Active Rental Card */}
      {activeRental && (
        <Card title="Kho đang sử dụng">
          <Row label="Cơ sở" value={activeRental.facility.name} />
          <Row
            label="Mã kho"
            value={activeRental.physicalUnit?.code ?? activeRental.unitType.name}
          />
          <Row label="Hạn kết thúc" value={dateTime(activeRental.expectedEndAt)} />
          <Button
            secondary
            label="Xem chi tiết & Gia hạn kho"
            onPress={() => go({ screen: "rental", id: activeRental.id })}
          />
        </Card>
      )}

      {/* Empty State Help */}
      {rentalsList.length === 0 && bookingsList.length === 0 && !query.isPending && (
        <Card title="Chào mừng bạn đến với storeX!">
          <Text className="mb-3 text-sm leading-5 text-[#52635A]">
            Bạn chưa có đơn đặt kho nào. Hãy khám phá mạng lưới cơ sở kho thông minh và đặt kho chỉ
            với vài thao tác.
          </Text>
          <Button label="Khám phá cơ sở kho ngay" onPress={() => go({ screen: "catalog" })} />
        </Card>
      )}
    </>
  );
}

export function CustomerBookingsScreen({ owner, go }: { owner: string; go: CustomerNavigation }) {
  const query = useCustomerBookings(owner);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((b) => b.status === filter);
  }, [items, filter]);

  return (
    <>
      <Heading>{M.bookings}</Heading>
      <Notice>Quản lý các lượt đặt chỗ, xem slot hẹn và lấy mã QR nhận kho.</Notice>

      {/* Status Filter Pills */}
      <View className="mb-4 flex-row flex-wrap gap-1.5">
        {[
          { id: "ALL", label: `Tất cả (${items.length})` },
          {
            id: "CONFIRMED",
            label: `Chờ nhận kho (${items.filter((i) => i.status === "CONFIRMED").length})`,
          },
          {
            id: "CHECKED_IN",
            label: `Đã nhận kho (${items.filter((i) => i.status === "CHECKED_IN").length})`,
          },
          {
            id: "CANCELLED",
            label: `Đã hủy (${items.filter((i) => i.status === "CANCELLED").length})`,
          },
        ].map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 border ${
              filter === f.id ? "bg-[#125345] border-[#125345]" : "bg-white border-[#BFCAC4]"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === f.id ? "text-white" : "text-[#52635A]"
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <QueryNotice query={query} />
      {filtered.length === 0 && !query.isPending && (
        <Card>
          <Text className="text-center text-sm text-[#52635A]">{M.empty}</Text>
        </Card>
      )}
      {filtered.map((b) => (
        <Card title={b.bookingCode ?? b.id} key={b.id}>
          <Notice>
            {b.status === "CONFIRMED"
              ? "✓ Chờ nhận kho · Xuất trình QR"
              : b.status === "CHECKED_IN"
                ? "✓ Đã nhận kho thành công"
                : b.status === "CANCELLED"
                  ? "Đã hủy đơn"
                  : b.status}
          </Notice>
          <Row label="Cơ sở" value={b.facility.name} />
          <Row label="Loại kho" value={b.unitType.name} />
          <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
          <Row
            label={M.paymentStatus}
            value={b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : b.paymentStatus}
          />
          <Button
            label="Xem chi tiết & Mã QR"
            onPress={() => go({ screen: "booking", id: b.id })}
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

          {/* QR Code Card for Check-in */}
          {b.status === "CONFIRMED" && (
            <Card title="Mã QR Check-in">
              <Text className="mb-2 text-center text-xs text-[#52635A]">
                Xuất trình mã này cho nhân viên tại cơ sở khi bạn đến nhận kho
              </Text>
              {b.confirmation ? (
                <QrCode value={b.confirmation.qrUrl} />
              ) : (
                <QrCode value={`metastorage-booking:${b.bookingCode ?? b.id}`} />
              )}
              <Text className="text-center font-bold text-[#125345]">{b.bookingCode}</Text>
            </Card>
          )}

          <Card title={b.facility.name}>
            <Text className="mb-2 text-sm text-[#52635A]">{b.facility.address}</Text>
            <Notice>
              {b.status === "CONFIRMED"
                ? "✓ Đã xác nhận · Chờ đến giờ nhận kho"
                : b.status === "CHECKED_IN"
                  ? "✓ Đã hoàn tất nhận kho"
                  : b.status}
            </Notice>
            <Row label={M.appointment} value={dateTime(b.checkInSlotStart)} />
            <Row label="Kho chỉ định" value={b.assignedUnit?.code ?? "Đang phân kho"} />
            <Row label="Giai đoạn bàn giao" value={b.handoverStage} />
            <Row label={M.initialRent} value={money(b.pricing.rentalFeeAmount)} />
            <Row label={M.deposit} value={money(b.pricing.depositAmount)} />
            <Row label={M.total} value={money(b.pricing.totalAmount)} />
            <Row
              label="Thanh toán"
              value={b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán đủ" : b.paymentStatus}
            />

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
          {p.chargeId && <Text>{M.renewalWaiting}</Text>}
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
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Heading>{M.storage}</Heading>
      <Notice>Danh sách các kho bạn đang thuê và lịch sử thuê kho tại các cơ sở.</Notice>
      <View className="mb-4 flex-row gap-2">
        <Pressable
          onPress={() => setView("current")}
          className={`flex-1 rounded-[6px] py-2.5 items-center border ${
            view === "current" ? "bg-[#125345] border-[#125345]" : "bg-white border-[#BFCAC4]"
          }`}
        >
          <Text
            className={`font-semibold text-sm ${
              view === "current" ? "text-white" : "text-[#52635A]"
            }`}
          >
            Đang thuê
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView("history")}
          className={`flex-1 rounded-[6px] py-2.5 items-center border ${
            view === "history" ? "bg-[#125345] border-[#125345]" : "bg-white border-[#BFCAC4]"
          }`}
        >
          <Text
            className={`font-semibold text-sm ${
              view === "history" ? "text-white" : "text-[#52635A]"
            }`}
          >
            Lịch sử đã trả
          </Text>
        </Pressable>
      </View>
      <QueryNotice query={query} />
      {items.length === 0 && !query.isPending && (
        <Card>
          <Text className="text-center text-sm text-[#52635A]">{M.empty}</Text>
        </Card>
      )}
      {items.map((r) => (
        <Card key={r.id} title={`${r.facility.name} · ${r.physicalUnit?.code ?? r.unitType.name}`}>
          <Notice>
            {r.status === "ACTIVE"
              ? "✓ Đang hoạt động"
              : r.status === "OVERDUE"
                ? "⚠ Quá hạn thuê"
                : r.status === "CLOSED"
                  ? "Đã đóng hợp đồng"
                  : r.status}
          </Notice>
          <Row label="Ngày bắt đầu" value={dateTime(r.startAt)} />
          <Row label="Hạn kết thúc" value={dateTime(r.expectedEndAt)} />
          <Button
            label="Xem chi tiết & Gia hạn"
            onPress={() => go({ screen: "rental", id: r.id })}
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
export function CustomerRentalScreen({
  owner,
  id,
  go,
}: {
  owner: string;
  id: string;
  go: CustomerNavigation;
}) {
  const state = useCustomerRental(owner, id, go);
  const r = state.rental.data;
  const renewal = state.renewal.data;
  return (
    <>
      <QueryNotice query={state.rental} />
      {r && (
        <>
          <Heading>{`${r.facility.name} · ${r.physicalUnit?.code ?? r.unitType.name}`}</Heading>
          <Card title={M.storage}>
            <Notice>
              {r.status === "ACTIVE"
                ? "✓ Hợp đồng đang hoạt động"
                : r.status === "OVERDUE"
                  ? "⚠ Đã quá hạn lưu kho - Hãy gia hạn hoặc liên hệ cơ sở"
                  : r.status}
            </Notice>
            <Row label="Cơ sở" value={r.facility.name} />
            <Row label="Địa chỉ" value={r.facility.address} />
            <Row label="Kho chỉ định" value={r.physicalUnit?.code ?? r.unitType.name} />
            <Row label="Ngày bắt đầu" value={dateTime(r.startAt)} />
            <Row label={M.oldEnd} value={dateTime(r.expectedEndAt)} />
            <Button
              label={M.newTicket}
              secondary
              onPress={() => go({ screen: "support-new", bookingId: r.bookingId })}
            />
            <Button
              label={M.returnStorage}
              secondary
              onPress={() => {
                if (process.env.EXPO_PUBLIC_WEB_BASE_URL)
                  void WebBrowser.openBrowserAsync(
                    `${process.env.EXPO_PUBLIC_WEB_BASE_URL}/customer/storage/${id}/return`,
                  );
              }}
            />
          </Card>
          <Card title={M.renewal}>
            <Text className="mb-2 text-xs font-semibold text-[#52635A]">
              Chọn nhanh số tháng gia hạn:
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {[1, 3, 6, 12].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    state.quoteForm.setValue("months", m);
                    state.quote.mutate(m);
                  }}
                  className="rounded-full border border-[#125345] bg-[#E8F3EF] px-3.5 py-1.5"
                >
                  <Text className="text-xs font-semibold text-[#125345]">+{m} tháng</Text>
                </Pressable>
              ))}
            </View>
            <Controller
              control={state.quoteForm.control}
              name="months"
              render={({ field, fieldState }) => (
                <Field
                  label={M.months}
                  value={String(field.value)}
                  onChangeText={(value) => field.onChange(Number(value))}
                  keyboardType="number-pad"
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button
              label={M.quote}
              disabled={state.quote.isPending}
              onPress={() =>
                void state.quoteForm.handleSubmit((input) => state.quote.mutate(input.months))()
              }
            />
            {renewal && (
              <>
                <Text>{renewal.status}</Text>
                <Row
                  label={M.oldEnd}
                  value={new Date(renewal.oldEndAt).toLocaleString("vi-VN", {
                    timeZone: renewal.timezone,
                  })}
                />
                <Row
                  label={M.newEnd}
                  value={new Date(renewal.newEndAt).toLocaleString("vi-VN", {
                    timeZone: renewal.timezone,
                  })}
                />
                <Row label={M.total} value={money(renewal.amount)} />
                <Row
                  label={M.expires}
                  value={new Date(renewal.expiresAt).toLocaleString("vi-VN", {
                    timeZone: renewal.timezone,
                  })}
                />
                <Text className="mb-4">{renewal.terms}</Text>
                {renewal.failureReason && <Notice error>{renewal.failureReason}</Notice>}
                {renewal.status === "QUOTED" && (
                  <Button
                    label={M.accept}
                    disabled={state.accept.isPending}
                    onPress={() => state.accept.mutate()}
                  />
                )}
                {renewal.status === "AWAITING_PAYMENT" && renewal.chargeId && (
                  <Button
                    label={M.payment}
                    disabled={state.pay.isPending}
                    onPress={() => {
                      if (renewal.chargeId) state.pay.mutate(renewal.chargeId);
                    }}
                  />
                )}
                <Notice>
                  {renewal.status === "APPLIED" ? M.renewalApplied : M.renewalWaiting}
                </Notice>
              </>
            )}
            <QueryNotice query={state.history} />
            {state.history.data?.pages.flat().map((q) => (
              <Button
                key={q.id}
                secondary
                label={`${q.status} · ${money(q.amount)} · ${new Date(q.newEndAt).toLocaleString("vi-VN", { timeZone: q.timezone })}`}
                onPress={() => void state.selectRenewal(q.id)}
              />
            ))}
            {state.history.hasNextPage && (
              <Button label={M.more} onPress={() => void state.history.fetchNextPage()} />
            )}
          </Card>
          <Card title={M.charges}>
            <QueryNotice query={state.charges} />
            <Controller
              control={state.disputeForm.control}
              name="reason"
              render={({ field, fieldState }) => (
                <Field
                  label={M.reason}
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  error={fieldState.error?.message}
                />
              )}
            />
            {state.charges.data?.pages
              .flatMap((page) => page.items)
              .map((c) => (
                <Card key={c.id} title={M.source[c.source]}>
                  <Text>
                    {c.status} · {c.evidence}
                  </Text>
                  <Row label={M.outstanding} value={money(c.outstandingAmount)} />
                  <Row label={M.dueDate} value={c.dueDate ?? M.noDueDate} />
                  {c.status === "OPEN" && (
                    <Button
                      label={M.payment}
                      disabled={state.pay.isPending}
                      onPress={() => state.pay.mutate(c.id)}
                    />
                  )}
                  {c.status === "OPEN" && c.source === "EXTRA" && (
                    <Button
                      label={M.dispute}
                      secondary
                      disabled={state.dispute.isPending}
                      onPress={() =>
                        void state.disputeForm.handleSubmit((input) =>
                          state.dispute.mutate({ chargeId: c.id, reason: input.reason }),
                        )()
                      }
                    />
                  )}
                </Card>
              ))}
            {state.charges.hasNextPage && (
              <Button
                secondary
                label={M.more}
                disabled={state.charges.isFetchingNextPage}
                onPress={() => void state.charges.fetchNextPage()}
              />
            )}
          </Card>
          <Card title={M.transactions}>
            <QueryNotice query={state.payments} />
            {state.payments.data?.map((p) => (
              <Card key={p.id} title={p.paymentCode ?? undefined}>
                <Text>
                  {M.source[p.source ?? "BOOKING"]} · {p.status}
                </Text>
                <Text>{money(p.totalAmount)}</Text>
                {p.refundAmount && <Row label={M.refund} value={money(p.refundAmount)} />}
                {p.chargeRefunds?.map((f) => (
                  <Row key={f.id} label={M.refund} value={money(f.amount)} />
                ))}
                {p.returnRefunds.map((f) => (
                  <Row key={f.id} label={M.refund} value={money(f.amount)} />
                ))}
                <Button
                  secondary
                  label={M.newTicket}
                  onPress={() =>
                    go({ screen: "support-new", bookingId: r.bookingId, paymentId: p.id })
                  }
                />
              </Card>
            ))}
          </Card>
          <Card title={M.documents}>
            <QueryNotice query={state.documents} />
            {state.documents.data?.map((d) => (
              <Button
                key={d.id}
                label={`${M.documents} · ${d.version}`}
                disabled={state.document.isPending}
                onPress={() => state.document.mutate(d.id)}
              />
            ))}
          </Card>
        </>
      )}
      {Object.entries({
        quote: state.quote,
        accept: state.accept,
        pay: state.pay,
        dispute: state.dispute,
        document: state.document,
      }).map(
        ([key, q]) =>
          q.isError && (
            <Notice error key={key}>
              {customerError(q.error)}
            </Notice>
          ),
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

export function CustomerTransactionsScreen({
  owner,
  go,
}: {
  owner: string;
  go: CustomerNavigation;
}) {
  const { transactions, isPending, refetch } = useCustomerAllTransactions(owner);
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return transactions;
    if (filter === "EXTRA")
      return transactions.filter(
        (t) => t.payment.source === "EXTRA" || t.payment.source === "RETURN_DEBT",
      );
    return transactions.filter((t) => (t.payment.source ?? "BOOKING") === filter);
  }, [transactions, filter]);

  return (
    <>
      <Heading>Lịch sử giao dịch</Heading>
      <Notice>Toàn bộ lịch sử các khoản thanh toán tiền thuê, cọc và gia hạn của bạn.</Notice>
      {/* Filters: ALL, BOOKING, RENEWAL, CHARGE */}
      <View className="mb-4 flex-row flex-wrap gap-1.5">
        {[
          { id: "ALL", label: `Tất cả (${transactions.length})` },
          {
            id: "BOOKING",
            label: `Đặt kho (${transactions.filter((t) => (t.payment.source ?? "BOOKING") === "BOOKING").length})`,
          },
          {
            id: "RENEWAL",
            label: `Gia hạn (${transactions.filter((t) => t.payment.source === "RENEWAL").length})`,
          },
          {
            id: "EXTRA",
            label: `Phí khác (${transactions.filter((t) => t.payment.source === "EXTRA" || t.payment.source === "RETURN_DEBT").length})`,
          },
        ].map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 border ${
              filter === f.id ? "bg-[#125345] border-[#125345]" : "bg-white border-[#BFCAC4]"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === f.id ? "text-white" : "text-[#52635A]"
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {isPending && <Notice>{M.loading}</Notice>}
      {!isPending && filtered.length === 0 && (
        <Card>
          <Text className="text-center text-sm text-[#52635A]">Chưa có giao dịch nào.</Text>
        </Card>
      )}
      {filtered.map(({ rental, payment }) => (
        <Card
          key={payment.id}
          title={payment.paymentCode ? `Mã: ${payment.paymentCode}` : payment.id}
        >
          <Row
            label="Kho"
            value={`${rental.facility.name} · ${rental.physicalUnit?.code ?? rental.unitType.name}`}
          />
          <Row
            label="Loại giao dịch"
            value={M.source[payment.source ?? "BOOKING"] ?? payment.source ?? "Đặt kho"}
          />
          <Row label="Số tiền" value={money(payment.totalAmount)} />
          <Row label="Thời gian" value={dateTime(payment.paidAt ?? payment.createdAt)} />
          <Row label="Trạng thái" value={payment.status} />
          {payment.refundAmount && <Row label={M.refund} value={money(payment.refundAmount)} />}
          <Button
            secondary
            label="Yêu cầu hỗ trợ về khoản này"
            onPress={() =>
              go({
                screen: "support-new",
                bookingId: rental.bookingId,
                paymentId: payment.id,
              })
            }
          />
        </Card>
      ))}
      <Button secondary label="Tải lại danh sách" onPress={() => void refetch()} />
    </>
  );
}

export function CustomerNotificationsScreen({ go }: { go: CustomerNavigation }) {
  const query = useCustomerNotifications();
  const items = query.data?.pages.flat() ?? [];

  return (
    <>
      <Heading>Hộp thư thông báo</Heading>
      <Notice>
        Cập nhật tự động về lịch hẹn check-in, thanh toán và vòng đời thuê kho của bạn.
      </Notice>
      <QueryNotice query={query} />
      {!query.isPending && items.length === 0 && (
        <Card>
          <Text className="text-center text-sm text-[#52635A]">
            Bạn không có thông báo nào mới.
          </Text>
        </Card>
      )}
      {items.map((item) => (
        <Card key={item.id} title={item.subject || "Thông báo hệ thống"}>
          <Text className="mb-2 text-sm leading-5 text-[#131B2E]">{item.body}</Text>
          <Row label="Thời gian" value={dateTime(item.occurredAt)} />
          {item.bookingId && (
            <Button
              secondary
              label="Xem chi tiết đơn"
              onPress={() => go({ screen: "booking", id: item.bookingId })}
            />
          )}
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
