import { sql } from "@metastorage/database";
import type { FastifyPluginAsync } from "fastify";
import { successResponse } from "../response/api-response";

export const healthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (_request, reply) => {
    let dbStatus = "unknown";
    let latencyMs = 0;

    try {
      const start = Date.now();
      await fastify.db.execute(sql`SELECT 1`);
      latencyMs = Date.now() - start;
      dbStatus = "connected";
    } catch (err) {
      fastify.log.warn({ err }, "Database ping failed during health check");
      dbStatus = "disconnected";
    }

    return reply.status(200).send(
      successResponse(
        {
          status: "ok",
          uptime: process.uptime(),
          database: {
            status: dbStatus,
            latencyMs,
          },
        },
        "Service is operational",
      ),
    );
  });
};
