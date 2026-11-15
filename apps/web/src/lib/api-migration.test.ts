import { createMetastorageApiClient } from "@metastorage/api-client";
import axios, { type AxiosRequestConfig } from "axios";
import { expect, it } from "vitest";

it("loads an assigned task with one authorized detail request", async () => {
  const requests: AxiosRequestConfig[] = [];
  const http = axios.create({
    adapter: async (config) => {
      requests.push(config);
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          success: true,
          data: { id: "target" },
        },
      };
    },
  });
  const api = createMetastorageApiClient(http, "better-auth");
  expect((await api.flow5.tasks.getMine("target")).id).toBe("target");
  expect(requests.map((r) => [r.method, r.url])).toEqual([["get", "/facility-tasks/my/target"]]);
  expect(api).not.toHaveProperty("rentalDocuments");
  expect(api).not.toHaveProperty("facilityWorkspace");
  for (const method of ["messages", "reply", "image", "uploadImage"])
    expect(api.support).not.toHaveProperty(method);
});
