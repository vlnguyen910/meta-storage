import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { WEB_BASE_URL } from "../../lib/runtime-config";
import type { CheckoutSession } from "./customer-api.types";

const privateFiles = new Set<string>();
const privateDirectory = () => new FileSystem.Directory(FileSystem.Paths.cache, "customer-private");
export async function openCustomerCheckout(session: CheckoutSession) {
  const target = new URL("/payments/mobile-checkout", WEB_BASE_URL);
  target.hash = encodeURIComponent(JSON.stringify(session));
  await WebBrowser.openBrowserAsync(target.toString());
}
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
export async function sharePrivateFile(bytes: Uint8Array, name: string, mimeType: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const directory = privateDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = new FileSystem.File(directory, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  file.create({ overwrite: true });
  file.write(bytes);
  privateFiles.add(file.uri);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType });
}
export function clearPrivateFiles() {
  for (const uri of privateFiles) {
    try {
      new FileSystem.File(uri).delete();
    } catch {
      /* Cache may already have been evicted. */
    }
  }
  privateFiles.clear();
  if (Platform.OS !== "web") {
    try {
      const directory = privateDirectory();
      if (directory.exists) directory.delete();
    } catch {
      /* OS cache eviction may precede sign-out. */
    }
  }
}

// Idempotency identifiers are unique command names, not authentication credentials.
export function customerCommandId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
