import {
  createHttpClient,
  createMetastorageApiClient,
  createMobileWorkflowClient,
} from "@metastorage/api-client";
import { type AxiosAdapter, AxiosError, type AxiosResponse } from "axios";
import { DEMO_MESSAGES as m } from "./demo.messages";
import type { DemoDatabase } from "./demo.types";
import { createMobileSeed } from "./demo-seed";
import { handleMobileRequest } from "./demo-service";
import { readDemoStorage, writeDemoStorage } from "./demo-storage";

let database: DemoDatabase | null = null;
let queue: Promise<unknown> = Promise.resolve();
const adapter: AxiosAdapter = (config) => {
  const run = queue.then(async () => {
    if (!database) {
      database = await readDemoStorage();
      if (!database) {
        database = createMobileSeed();
        await writeDemoStorage(database);
      }
    }
    const next = JSON.parse(JSON.stringify(database)) as DemoDatabase;
    const response: AxiosResponse = {
      data: null,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
    try {
      const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      const result = handleMobileRequest(
        next,
        (config.method ?? "get").toUpperCase(),
        config.url ?? "",
        config.method === "get" ? config.params : body,
      );
      if (config.method !== "get") {
        await writeDemoStorage(next);
        database = next;
      }
      response.data = {
        success: true,
        data: result,
        message: m.success,
        timestamp: new Date().toISOString(),
      };
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : m.invalid;
      response.status = message === m.forbidden ? 403 : message === m.missing ? 404 : 409;
      response.statusText = "Demo error";
      response.data = {
        success: false,
        error: { code: response.status, message },
        timestamp: new Date().toISOString(),
      };
      throw new AxiosError(message, "ERR_BAD_RESPONSE", config, undefined, response);
    }
  });
  queue = run.catch(() => undefined);
  return run;
};
const http = createHttpClient({
  baseURL: "https://storex-demo.invalid",
  tokenProvider: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    updateTokens: () => undefined,
    clearSession: () => undefined,
  },
});
http.defaults.adapter = adapter;
export const mobileApi = createMetastorageApiClient(http, "mock");
export const mobileWorkflows = createMobileWorkflowClient(http);
