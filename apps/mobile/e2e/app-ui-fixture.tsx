// Isolated component preview. Product screens never import this entry.
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { Bell, CircleHelp, ReceiptText } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  AppHeader,
  BottomTabs,
  Button,
  Card,
  type CustomerTab,
  Heading,
  IconButton,
  ListItem,
  Notice,
  ScreenFrame,
  SearchField,
} from "../src/components/ui";
import { MOBILE_FONTS } from "../src/theme/fonts";
import "../global.css";

function AppUiFixture() {
  const [loaded, error] = useFonts(MOBILE_FONTS);
  const [tab, setTab] = useState<CustomerTab>("home");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState(false);
  const [feedback, setFeedback] = useState("Chọn thao tác để xem kết quả.");
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ScreenFrame>
        <AppHeader
          onHome={() => {
            setTab("home");
            setDetails(false);
            setFeedback("Đã mở Home");
          }}
          onNotifications={() => setFeedback("Đã mở thông báo")}
          onBack={
            details
              ? () => {
                  setDetails(false);
                  setFeedback("Đã quay lại");
                }
              : undefined
          }
        />
        <ScrollView contentContainerClassName="grow px-4 py-6" keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-3xl">
            <Heading>Tìm không gian phù hợp</Heading>
            <SearchField
              label="Tìm cơ sở kho"
              placeholder="Tên cơ sở hoặc địa chỉ"
              value={search}
              onChangeText={setSearch}
              onSubmit={(value) => setFeedback(`Tìm: ${value}`)}
            />
            <Button label="Tìm kho" onPress={() => setFeedback(`Tìm: ${search.trim()}`)} />
            <Button
              variant="outline"
              label="Xem chi tiết"
              onPress={() => {
                setDetails(true);
                setFeedback("Đã mở chi tiết");
              }}
            />
            <View testID="foundation-feedback" className="mt-3">
              <Notice>{feedback}</Notice>
            </View>
            <Card title="Tài khoản và hỗ trợ">
              <ListItem
                icon={CircleHelp}
                label="Yêu cầu hỗ trợ"
                description="Tạo và theo dõi yêu cầu của bạn"
                onPress={() => setFeedback("Đã mở yêu cầu hỗ trợ")}
              />
              <ListItem
                icon={ReceiptText}
                label="Lịch sử thanh toán"
                description="Tra cứu thanh toán và hoàn tiền của các kỳ thuê hiện tại và trước đây"
                onPress={() => setFeedback("Đã mở lịch sử thanh toán")}
              />
            </Card>
            <Card title="Trạng thái không khả dụng">
              <SearchField
                label="Tìm kiếm đang tắt"
                value="Hồ Chí Minh"
                onChangeText={() => setFeedback("Không được gọi")}
                disabled
              />
              <IconButton
                icon={Bell}
                label="Thông báo đang tắt"
                onPress={() => setFeedback("Không được gọi")}
                disabled
              />
            </Card>
          </View>
        </ScrollView>
        <BottomTabs
          selected={tab}
          onSelect={(value) => {
            setTab(value);
            setFeedback(`Tab: ${value}`);
          }}
        />
      </ScreenFrame>
    </SafeAreaProvider>
  );
}

registerRootComponent(AppUiFixture);
