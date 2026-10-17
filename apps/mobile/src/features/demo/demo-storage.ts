import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { DEMO_MESSAGES as m } from "./demo.messages";
import type { DemoDatabase } from "./demo.types";
import { secureStoreChunks } from "./demo-storage-codec";

const key = "storex.mobile.demo.v1";
// SecureStore values are chunked; a revision pointer is published only after all writes succeed.
export async function readDemoStorage(): Promise<DemoDatabase | null> {
  if (Platform.OS === "web") {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
  const revision = await SecureStore.getItemAsync(key);
  if (!revision) return null;
  const count = Number(await SecureStore.getItemAsync(`${key}.${revision}.count`));
  if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error(m.storage);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}.${revision}.${i}`);
    if (chunk === null) throw new Error(m.storage);
    chunks.push(chunk);
  }
  return JSON.parse(chunks.join(""));
}
export async function writeDemoStorage(database: DemoDatabase): Promise<void> {
  const value = JSON.stringify(database);
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  const previous = await SecureStore.getItemAsync(key);
  const revision = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const chunks = secureStoreChunks(value);
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(`${key}.${revision}.${i}`, chunks[i]);
  }
  await SecureStore.setItemAsync(`${key}.${revision}.count`, String(chunks.length));
  await SecureStore.setItemAsync(key, revision);
  if (previous) {
    const count = Number(await SecureStore.getItemAsync(`${key}.${previous}.count`));
    // Old revisions are housekeeping; failure here must not turn a committed mutation into failure.
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}.${previous}.${i}`).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(`${key}.${previous}.count`).catch(() => undefined);
  }
}
