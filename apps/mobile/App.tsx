import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator, DemoNavigator } from "./src/navigation/app-navigator";
import { MOBILE_FONTS } from "./src/theme/fonts";
import "./global.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

export default function App() {
  const [fontsLoaded, fontError] = useFonts(MOBILE_FONTS);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {process.env.EXPO_PUBLIC_API_MODE === "demo" ? <DemoNavigator /> : <AppNavigator />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
