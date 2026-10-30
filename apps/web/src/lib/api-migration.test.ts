import { createMetastorageApiClient } from "@metastorage/api-client";
import axios, { type AxiosRequestConfig } from "axios";
import { expect, it } from "vitest";

it("finds an assigned task beyond the first page without calling a retired detail route", async () => {
  const requests: AxiosRequestConfig[] = [];
  const http = axios.create({
    adapter: async (config) => {
      requests.push(config);
      const offset = config.params.offset;
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          success: true,
          data: {
            items: offset
              ? [{ id: "target" }]
              : Array.from({ length: 100 }, (_, n) => ({ id: `task-${n}` })),
            offset,
            limit: 100,
            total: 101,
          },
        },
      };
    },
  });
  const api = createMetastorageApiClient(http, "better-auth");
  expect((await api.flow5.tasks.findMine("target"))?.id).toBe("target");
  expect(requests.map((r) => [r.method, r.url, r.params.offset])).toEqual([
    ["get", "/facility-tasks/my", 0],
    ["get", "/facility-tasks/my", 100],
  ]);
  expect(api).not.toHaveProperty("rentalDocuments");
  expect(api).not.toHaveProperty("facilityWorkspace");
  for (const method of ["messages", "reply", "image", "uploadImage"])
    expect(api.support).not.toHaveProperty(method);
});
