// Exercises native verification callbacks in the web renderer without an OS mail app.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthNavigator, DemoNavigator } from "../src/navigation/app-navigator";
import { MOBILE_FONTS } from "../src/theme/fonts";
import "../global.css";

const client = new QueryClient();
function AuthenticationFixture() {
  const [loaded, error] = useFonts(MOBILE_FONTS);
  if (!loaded && !error) return null;
  const params = new URLSearchParams(window.location.search);
  const callbackUrl = params.get("callback") ?? undefined;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        {params.has("demo") ? <DemoNavigator /> : <AuthNavigator callbackUrl={callbackUrl} />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
registerRootComponent(AuthenticationFixture);
