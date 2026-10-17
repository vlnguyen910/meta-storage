import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildDemoBookings,
  type CheckInReadiness,
  type DemoBooking,
  findDemoBooking,
} from "../features/check-in/check-in-demo";

const readinessMeta: Record<
  CheckInReadiness,
  { label: string; background: string; text: string; icon: string }
> = {
  READY: {
    label: "Có thể check-in",
    background: "bg-emerald-100",
    text: "text-emerald-800",
    icon: "✓",
  },
  TOO_EARLY: {
    label: "Chưa tới giờ",
    background: "bg-blue-100",
    text: "text-blue-800",
    icon: "◷",
  },
  NO_SHOW: {
    label: "Không đến (NO_SHOW)",
    background: "bg-rose-100",
    text: "text-rose-800",
    icon: "!",
  },
};

const formatMoney = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(value);

function StatusPill({ readiness }: { readiness: CheckInReadiness }) {
  const meta = readinessMeta[readiness];
  return (
    <View className={`flex-row items-center self-start rounded-full px-3 py-1 ${meta.background}`}>
      <Text className={`mr-1 text-xs font-bold ${meta.text}`}>{meta.icon}</Text>
      <Text className={`text-xs font-bold ${meta.text}`}>{meta.label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between border-b border-slate-100 py-3">
      <Text className="mr-4 flex-1 text-sm text-slate-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-slate-900">{value}</Text>
    </View>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <View className="flex-row items-center py-2">
      <View
        className={`mr-3 h-6 w-6 items-center justify-center rounded-full ${passed ? "bg-emerald-100" : "bg-rose-100"}`}
      >
        <Text className={`font-bold ${passed ? "text-emerald-700" : "text-rose-700"}`}>
          {passed ? "✓" : "×"}
        </Text>
      </View>
      <Text className="flex-1 text-sm text-slate-700">{label}</Text>
    </View>
  );
}

function BookingResult({
  booking,
  verified,
  onVerify,
}: {
  booking: DemoBooking;
  verified: boolean;
  onVerify: () => void;
}) {
  const isReady = booking.readiness === "READY";

  return (
    <View className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <View className="border-b border-slate-100 p-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Kết quả tra cứu
            </Text>
            <Text className="mt-2 text-2xl font-black text-slate-950">{booking.code}</Text>
            <Text className="mt-1 text-sm text-slate-500">{booking.scenario}</Text>
          </View>
          {verified ? (
            <View className="flex-row items-center self-start rounded-full bg-emerald-100 px-3 py-1">
              <Text className="mr-1 text-xs font-bold text-emerald-800">✓</Text>
              <Text className="text-xs font-bold text-emerald-800">Đã verify</Text>
            </View>
          ) : (
            <StatusPill readiness={booking.readiness} />
          )}
        </View>
        <View className="mt-4 flex-row items-center rounded-2xl bg-slate-50 px-4 py-3">
          <Text className="mr-2 text-lg text-emerald-700">●</Text>
          <Text className="text-sm font-semibold text-slate-700">{booking.status}</Text>
          <Text className="ml-2 text-sm text-slate-500">Booking status</Text>
        </View>
      </View>

      <View className="p-5">
        <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          Thông tin cần đối chiếu
        </Text>
        <InfoRow label="Khách hàng" value={booking.customerName} />
        <InfoRow label="Số điện thoại" value={booking.customerPhone} />
        <InfoRow label="Cơ sở" value={booking.facility} />
        <InfoRow label="Physical unit" value={booking.unitCode ?? "Chưa gán unit"} />
        <InfoRow label="Loại kho" value={`${booking.unitType} · ${booking.unitSize}`} />
      </View>

      <View className="mx-5 rounded-2xl bg-slate-50 p-4">
        <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          Mốc thời gian
        </Text>
        <InfoRow label="Bắt đầu slot" value={formatDateTime(booking.startAt)} />
        <InfoRow label="Kết thúc slot" value={formatDateTime(booking.slotEndAt)} />
        <InfoRow label="Kết thúc grace" value={formatDateTime(booking.graceEndsAt)} />
        <InfoRow label="Kết thúc thuê" value={formatDateTime(booking.rentalEndAt)} />
      </View>

      <View className="p-5">
        <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          Điều kiện check-in
        </Text>
        <CheckRow
          label="Booking đang ở trạng thái CONFIRMED"
          passed={booking.status === "CONFIRMED"}
        />
        <CheckRow label="Payment đã SUCCEEDED" passed={true} />
        <CheckRow label="Đã gán physical unit" passed={Boolean(booking.unitCode)} />
        <CheckRow label="Đang trong thời gian check-in" passed={isReady} />
        {booking.reasons.length > 0 ? (
          <View className="mt-3 rounded-2xl bg-amber-50 p-4">
            <Text className="mb-2 text-sm font-bold text-amber-900">Không thể tiếp tục</Text>
            {booking.reasons.map((reason) => (
              <Text key={reason} className="mb-1 text-sm leading-5 text-amber-800">
                • {reason}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View className="border-t border-slate-100 p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm text-slate-500">Tổng tiền</Text>
          <Text className="text-lg font-black text-slate-950">
            {formatMoney(booking.totalAmount)}
          </Text>
        </View>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm text-slate-500">Tiền cọc</Text>
          <Text className="text-sm font-bold text-slate-700">
            {formatMoney(booking.depositAmount)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          className={`items-center rounded-2xl px-4 py-4 ${isReady && !verified ? "bg-emerald-700" : "bg-slate-200"}`}
          disabled={!isReady || verified}
          onPress={onVerify}
        >
          <Text
            className={`text-base font-black ${isReady && !verified ? "text-white" : "text-slate-500"}`}
          >
            {verified ? "Đã verify booking" : "Xác nhận đủ điều kiện"}
          </Text>
        </Pressable>
        <Text className="mt-3 text-center text-xs leading-5 text-slate-400">
          QR/Booking ID chỉ dùng để tìm booking. Quyền đọc và xác nhận phụ thuộc staff scope.
        </Text>
      </View>
    </View>
  );
}

export function CheckInScreen({ user }: { user: { name: string } }) {
  const bookings = useMemo(() => buildDemoBookings(), []);
  const [query, setQuery] = useState("BK-2026-0001");
  const [selectedBooking, setSelectedBooking] = useState<DemoBooking | null>(bookings[0] ?? null);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function lookup(value = query) {
    const booking = findDemoBooking(value, bookings);
    if (!booking) {
      setSelectedBooking(null);
      setError("Không tìm thấy booking mẫu. Hãy thử BK-2026-0001, BK-2026-0002 hoặc BK-2026-0003.");
      return;
    }

    setQuery(booking.code);
    setSelectedBooking(booking);
    setError(null);
  }

  return (
    <SafeAreaView
      className="flex-1 bg-slate-100"
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#f1f5f9" }}
    >
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View className="pb-10">
          <View className="bg-white px-5 pb-5 pt-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-black uppercase tracking-widest text-emerald-700">
                  metastorage · vận hành
                </Text>
                <Text className="mt-1 text-2xl font-black text-slate-950">Check-in & handover</Text>
              </View>
              <View className="rounded-full bg-emerald-50 px-3 py-2">
                <Text className="text-xs font-bold text-emerald-800">M2 Demo</Text>
              </View>
            </View>
            <Text className="mt-3 text-sm leading-5 text-slate-500">
              {user.name} · metastorage Sài Gòn Central
            </Text>
          </View>

          <View className="px-5 pt-5">
            <View className="rounded-3xl bg-emerald-900 p-5">
              <Text className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                Bước 1 · Tìm booking
              </Text>
              <Text className="mt-2 text-xl font-black text-white">
                Quét QR hoặc nhập Booking Code
              </Text>
              <Text className="mt-2 text-sm leading-5 text-emerald-100">
                Dùng mã để xác định đúng booking trước khi đối chiếu khách và physical unit.
              </Text>
              <View className="mt-4 flex-row">
                <TextInput
                  autoCapitalize="characters"
                  className="mr-2 flex-1 rounded-2xl bg-white px-4 py-3 text-base font-semibold text-slate-900"
                  onChangeText={(value) => {
                    setQuery(value);
                    setError(null);
                  }}
                  onSubmitEditing={() => lookup()}
                  placeholder="BK-2026-0001"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="search"
                  value={query}
                />
                <Pressable
                  accessibilityRole="button"
                  className="items-center justify-center rounded-2xl bg-emerald-300 px-4"
                  onPress={() => lookup()}
                >
                  <Text className="font-black text-emerald-950">Tìm</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                className="mt-3 items-center rounded-2xl border border-emerald-500 px-4 py-3"
                onPress={() => lookup("BK-2026-0001")}
              >
                <Text className="font-bold text-emerald-100">Quét QR · dùng mã mẫu</Text>
              </Pressable>
            </View>

            <Text className="mb-3 mt-6 text-xs font-black uppercase tracking-widest text-slate-400">
              Chọn kịch bản để test
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bookings.map((booking) => {
                const active = selectedBooking?.code === booking.code;
                return (
                  <Pressable
                    key={booking.code}
                    className={`mr-2 rounded-full border px-4 py-3 ${active ? "border-emerald-700 bg-emerald-700" : "border-slate-200 bg-white"}`}
                    onPress={() => lookup(booking.code)}
                  >
                    <Text
                      className={`text-xs font-bold ${active ? "text-white" : "text-slate-700"}`}
                    >
                      {booking.code.slice(-4)} · {readinessMeta[booking.readiness].label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? (
              <View className="mt-4 rounded-2xl bg-rose-50 p-4">
                <Text className="text-sm font-semibold leading-5 text-rose-800">{error}</Text>
              </View>
            ) : null}

            {selectedBooking ? (
              <BookingResult
                booking={selectedBooking}
                onVerify={() => setVerifiedCode(selectedBooking.code)}
                verified={verifiedCode === selectedBooking.code}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
