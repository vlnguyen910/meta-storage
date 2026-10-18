import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { cronPlugin } from "./common/cron/plugin";
import { databasePlugin } from "./common/database/plugin";
import { setupErrorHandler } from "./common/errors/error-handler";
import { loggerConfig } from "./common/logger/logger";
import { mailQueuePlugin } from "./common/mail/plugin";
import { corsPlugin } from "./common/plugins/cors";
import { healthPlugin } from "./common/plugins/health";
import { swaggerPlugin } from "./common/plugins/swagger";
import { redisPlugin } from "./common/redis/plugin";
import { authPlugin } from "./modules/auth/auth.guard";
import { authRoutes } from "./modules/auth/auth.routes";
import { bookingsRoutes } from "./modules/bookings/bookings.routes";
import { checkInsRoutes } from "./modules/check-ins/check-ins.routes";
import { facilityContextPlugin } from "./modules/facilities/facilities.guard";
import { facilitiesRoutes } from "./modules/facilities/facilities.routes";
import { inspectionsRoutes } from "./modules/inspections/inspections.routes";
import { notificationsPlugin } from "./modules/notifications/notifications.plugin";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { pricingRoutes } from "./modules/pricing/pricing.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { storageUnitsRoutes } from "./modules/storage-units/storage-units.routes";
import { usersRoutes } from "./modules/users/users.routes";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: loggerConfig,
  });

  // Zod Type Provider compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Centralized Error Handler
  setupErrorHandler(app);

  // Core Plugins
  app.register(corsPlugin);
  app.register(databasePlugin);
  app.register(cronPlugin);
  app.register(redisPlugin);
  app.register(mailQueuePlugin);
  app.register(authPlugin);
  app.register(notificationsPlugin);
  app.register(facilityContextPlugin);
  app.register(swaggerPlugin);

  // System & Feature Routes
  app.register(healthPlugin, { prefix: "/api" });
  app.register(usersRoutes, { prefix: "/api/users" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(facilitiesRoutes, { prefix: "/api/facilities" });
  app.register(rentalsRoutes, { prefix: "/api/rentals" });
  app.register(bookingsRoutes, { prefix: "/api" });
  app.register(checkInsRoutes, { prefix: "/api" });
  app.register(inspectionsRoutes, { prefix: "/api" });
  app.register(paymentsRoutes, { prefix: "/api" });
  app.register(pricingRoutes, { prefix: "/api/business-rules" });
  app.register(reportsRoutes, { prefix: "/api/reports" });
  app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
  app.register(storageUnitsRoutes, { prefix: "/api/units" });
  return app;
}
