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
import { env } from "./config/env";
import { authPlugin } from "./modules/auth/auth.guard";
import { authRoutes } from "./modules/auth/auth.routes";
import { bookingsRoutes } from "./modules/bookings/bookings.routes";
import { checkInsRoutes } from "./modules/check-ins/check-ins.routes";
import { contractsRoutes } from "./modules/contracts/contracts.routes";
import { facilityContextPlugin } from "./modules/facilities/facilities.guard";
import { facilitiesRoutes } from "./modules/facilities/facilities.routes";
import { guestRentalAccessRoutes } from "./modules/guest-rental-access/guest-rental-access.routes";
import { inspectionsRoutes } from "./modules/inspections/inspections.routes";
import { lifecycleNotificationsRoutes } from "./modules/notifications/lifecycle-notifications.routes";
import { notificationsPlugin } from "./modules/notifications/notifications.plugin";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { pricingRoutes } from "./modules/pricing/pricing.routes";
import { rentalLifecycleSettingsRoutes } from "./modules/rental-lifecycle-settings/rental-lifecycle-settings.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { returnsRoutes } from "./modules/returns/returns.routes";
import { storageUnitsRoutes } from "./modules/storage-units/storage-units.routes";
import { systemSettingsRoutes } from "./modules/system-settings/system-settings.routes";
import { usersRoutes } from "./modules/users/users.routes";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: loggerConfig,
    trustProxy: env.TRUSTED_PROXY_CIDRS,
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
  app.register(lifecycleNotificationsRoutes, { prefix: "/api" });
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
  app.register(guestRentalAccessRoutes, { prefix: "/api" });
  app.register(checkInsRoutes, { prefix: "/api" });
  app.register(inspectionsRoutes, { prefix: "/api" });
  app.register(paymentsRoutes, { prefix: "/api" });
  app.register(pricingRoutes, { prefix: "/api/business-rules" });
  app.register(reportsRoutes, { prefix: "/api/reports" });
  app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
  app.register(storageUnitsRoutes, { prefix: "/api/units" });
  app.register(contractsRoutes, { prefix: "/api" });
  app.register(returnsRoutes, { prefix: "/api" });
  app.register(rentalLifecycleSettingsRoutes, { prefix: "/api" });
  app.register(systemSettingsRoutes, { prefix: "/api" });
  return app;
}
