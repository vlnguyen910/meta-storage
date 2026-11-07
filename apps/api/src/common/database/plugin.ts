import { type Database, db, queryClient } from "@storex/database";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

const databasePluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", db);

  fastify.addHook("onClose", async (_instance) => {
    fastify.log.info("Closing PostgreSQL connection pool...");
    await queryClient.end();
  });
};

export const databasePlugin = fp(databasePluginAsync, {
  name: "database-plugin",
});
