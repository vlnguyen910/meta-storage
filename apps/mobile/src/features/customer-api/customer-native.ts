import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export async function saveCustomerCommand<T>(ownerId: string, operation: string, value: T) {
  const key = `customer-${ownerId}-${operation}`;
  if (Platform.OS === "web") sessionStorage.setItem(key, JSON.stringify(value));
  else await SecureStore.setItemAsync(key, JSON.stringify(value));
}
export async function readCustomerCommand<T>(
  ownerId: string,
  operation: string,
): Promise<T | null> {
  const key = `customer-${ownerId}-${operation}`;
  const text =
    Platform.OS === "web" ? sessionStorage.getItem(key) : await SecureStore.getItemAsync(key);
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}
export async function clearCustomerCommand(ownerId: string, operation: string) {
  const key = `customer-${ownerId}-${operation}`;
  if (Platform.OS === "web") sessionStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
// Idempotency identifiers are unique command names, not authentication credentials.
export function customerCommandId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
