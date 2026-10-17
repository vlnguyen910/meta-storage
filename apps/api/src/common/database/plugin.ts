import { db, queryClient } from "@metastorage/database";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const databasePluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", db);

  fastify.addHook("onClose", async (_instance) => {
    fastify.log.info("Closing PostgreSQL connection pool...");
    await queryClient.end();
  });

  fastify.log.info("Connecting to PostgreSQL...");
  try {
    await queryClient`SELECT 1`;
    fastify.log.info("PostgreSQL connection established");
  } catch (error) {
    fastify.log.error("PostgreSQL connection failed");
    throw error;
  }
};

export const databasePlugin = fp(databasePluginAsync, {
  name: "database-plugin",
});
