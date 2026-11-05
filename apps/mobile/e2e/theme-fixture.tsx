// Standalone Metro entry for component checks; never imported by the app.
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CalendarField } from "../src/components/ui/calendar-field";
import { ChoiceTabs } from "../src/components/ui/choice-tabs";
import { Button, Card, Field, Heading, Notice, Row } from "../src/components/ui/mobile-ui";
import { ScreenFrame } from "../src/components/ui/screen-frame";
import { StatusPill, WorkspaceHeader, WorkspaceTabs } from "../src/components/ui/workspace-ui";
import { MOBILE_FONTS } from "../src/theme/fonts";
import "../global.css";

function ThemeFixture() {
  const [loaded, error] = useFonts(MOBILE_FONTS);
  const [action, setAction] = useState("");
  const [name, setName] = useState("");
  const [tab, setTab] = useState("home");
  const [choice, setChoice] = useState("personal");
  const [day, setDay] = useState("2026-11-05");
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ScreenFrame>
        <WorkspaceHeader
          name="Nguyễn Minh Anh"
          subtitle="Không gian lưu trữ của bạn"
          onHome={() => setAction("Trang chủ")}
          onLogout={() => setAction("Đăng xuất")}
          onNotifications={() => setAction("Thông báo")}
        />
        <ScrollView contentContainerClassName="grow p-4" keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-3xl">
            <Heading>Không gian lưu trữ của bạn</Heading>
            <Card title="Thao tác">
              <Button label="Đặt kho" onPress={() => setAction("Đã chọn đặt kho")} />
              <Button
                variant="secondary"
                label="Xem lịch hẹn"
                onPress={() => setAction("Lịch hẹn")}
              />
              <Button secondary label="Xem chi tiết" onPress={() => setAction("Chi tiết")} />
              <Button variant="ghost" label="Quay lại" onPress={() => setAction("Quay lại")} />
              <Button danger label="Hủy đặt kho" onPress={() => setAction("Đã hủy")} />
              <Button
                disabled
                label="Chưa chọn cơ sở"
                onPress={() => setAction("Không được gọi")}
              />
              <Button loading label="Đang thanh toán" onPress={() => setAction("Không được gọi")} />
              <Button
                label="Xem thông tin đặt kho và lịch hẹn nhận bàn giao tại cơ sở"
                onPress={() => setAction("Nội dung dài")}
              />
              {action ? <Notice>{action}</Notice> : null}
            </Card>
            <Card title="Thông tin khách hàng">
              <Field
                label="Họ và tên"
                placeholder="Nhập họ và tên"
                value={name}
                onChangeText={setName}
                hint="Tên trên giấy tờ tùy thân"
              />
              <Field
                label="Email"
                value="khong-hop-le"
                error="Vui lòng nhập địa chỉ email hợp lệ."
              />
              <Field label="Mã khách hàng" value="KH-001" editable={false} />
              <Row label="Giá thuê mỗi tháng" value="1.250.000 đ" />
              <Row label="Địa chỉ cơ sở" value="123 Nguyễn Thị Minh Khai, Thành phố Hồ Chí Minh" />
            </Card>
            <ChoiceTabs
              options={[
                { value: "personal", label: "Kho cá nhân" },
                { value: "business", label: "Kho doanh nghiệp" },
              ]}
              value={choice}
              onChange={setChoice}
            />
            <ChoiceTabs
              disabled
              options={[{ value: "locked", label: "Không thể chọn" }]}
              value="locked"
              onChange={() => setAction("Không được gọi")}
            />
            <Card title="Trạng thái">
              <View className="flex-row flex-wrap gap-2">
                <StatusPill tone="green" label="Đã xác nhận" />
                <StatusPill tone="amber" label="Chờ thanh toán" />
                <StatusPill tone="red" label="Quá hạn" />
                <StatusPill tone="blue" label="Đang xử lý" />
                <StatusPill label="Bản nháp" />
              </View>
            </Card>
            <Notice>Đặt kho của bạn đã được ghi nhận.</Notice>
            <Notice error>Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.</Notice>
            <CalendarField
              label="Ngày nhận kho"
              minDate="2026-11-01"
              value={day}
              onChange={setDay}
            />
          </View>
        </ScrollView>
        <WorkspaceTabs
          tabs={[
            { key: "home", label: "Trang chủ", icon: "⌂" },
            { key: "catalog", label: "Tìm kho", icon: "⌕" },
            { key: "rentals", label: "Kho của tôi", icon: "▦" },
            { key: "transactions", label: "Giao dịch", icon: "▤" },
            { key: "support", label: "Hỗ trợ", icon: "?" },
          ]}
          selected={tab}
          onSelect={setTab}
        />
      </ScreenFrame>
    </SafeAreaProvider>
  );
}

registerRootComponent(ThemeFixture);
