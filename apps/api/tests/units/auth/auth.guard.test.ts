import { expect, spyOn, test } from "bun:test";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../../../src/modules/auth/auth";
import { requireAuth, requireRole } from "../../../src/modules/auth/auth.guard";

test("composed guards resolve a session once per request and still check every role", async () => {
  const lookup = spyOn(auth.api, "getSession").mockResolvedValue({
    user: { id: "staff", role: "FACILITY_STAFF", status: "ACTIVE" },
    session: { id: "session" },
  } as never);
  const request = { headers: {} } as FastifyRequest;
  const reply = {} as FastifyReply;
  try {
    await requireAuth(request, reply);
    await requireRole("FACILITY_STAFF")(request, reply);
    await expect(requireRole("FACILITY_MANAGER")(request, reply)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    await requireAuth({ headers: {} } as FastifyRequest, reply);
    expect(lookup).toHaveBeenCalledTimes(2);
  } finally {
    lookup.mockRestore();
  }
});

test("failed authentication is never cached", async () => {
  const lookup = spyOn(auth.api, "getSession").mockResolvedValue(null);
  const request = { headers: {} } as FastifyRequest;
  try {
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(requireAuth(request, {} as FastifyReply)).rejects.toMatchObject({
        statusCode: 401,
      });
    expect(lookup).toHaveBeenCalledTimes(2);
  } finally {
    lookup.mockRestore();
  }
});
