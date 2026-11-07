import Constants from "expo-constants";
import { Platform } from "react-native";

// Expo Go runs on another device; localhost there points to that device.
const hostUri = Constants.expoConfig?.hostUri;
const developmentHost =
  Platform.OS !== "web" && hostUri ? new URL(`http://${hostUri}`).hostname : "localhost";
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${developmentHost}:4000/api`
).replace(/\/$/, "");
export const WEB_BASE_URL = (
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? `http://${developmentHost}:3000`
).replace(/\/$/, "");
