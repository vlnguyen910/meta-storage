import fastifyMongo, { mongodb } from "@fastify/mongodb";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../../config/env";

export const mongoClient = new mongodb.MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5_000,
  timeoutMS: 5_000,
});
export const mongoDatabase = mongoClient.db();

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onClose", async () => {
    await mongoClient.close();
  });
  await mongoClient.connect();
  await fastify.register(fastifyMongo, {
    client: mongoClient,
    database: mongoDatabase.databaseName,
  });
};

export const mongoPlugin = fp(plugin, {
  name: "mongo-plugin",
});
