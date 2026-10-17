import { buildApp } from "./app";
import { env } from "./config/env";

async function start() {
  const app = buildApp();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info({ signal }, "Received shutdown signal, closing server gracefully...");
      try {
        await app.close();
        app.log.info("Server closed successfully.");
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, "Error during graceful shutdown");
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(
      `metastorage API listening at http://${env.HOST}:${env.PORT} in ${env.NODE_ENV} mode`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
