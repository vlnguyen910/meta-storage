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
import { facilityContextPlugin } from "./modules/facilities/facilities.guard";
import { facilitiesRoutes } from "./modules/facilities/facilities.routes";
import { facilityTasksRoutes } from "./modules/facility-tasks/facility-tasks.routes";
import {
  facilityWorkspaceRoutes,
  supportWithdrawalRoutes,
} from "./modules/facility-workspace/facility-workspace.routes";
import { inspectionsRoutes } from "./modules/inspections/inspections.routes";
import { lifecycleNotificationsRoutes } from "./modules/notifications/lifecycle-notifications.routes";
import { notificationsPlugin } from "./modules/notifications/notifications.plugin";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { pricingRoutes } from "./modules/pricing/pricing.routes";
import { renewalsRoutes } from "./modules/renewals/renewals.routes";
import { rentalChargesRoutes } from "./modules/rental-charges/rental-charges.routes";
import { rentalLifecycleSettingsRoutes } from "./modules/rental-lifecycle-settings/rental-lifecycle-settings.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { returnsRoutes } from "./modules/returns/returns.routes";
import { storageUnitsRoutes } from "./modules/storage-units/storage-units.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { systemSettingsRoutes } from "./modules/system-settings/system-settings.routes";
import { unitTypesRoutes } from "./modules/unit-types/unit-types.routes";
import { userActivityPlugin } from "./modules/user-history/user-activity.plugin";
import { userHistoryRoutes } from "./modules/user-history/user-history.routes";
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
  app.register(userActivityPlugin);
  app.register(notificationsPlugin);
  app.register(facilityContextPlugin);
  app.register(swaggerPlugin);

  // System & Feature Routes
  app.register(healthPlugin, { prefix: "/api" });
  app.register(usersRoutes, { prefix: "/api/users" });
  app.register(userHistoryRoutes, { prefix: "/api/admin" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(facilitiesRoutes, { prefix: "/api/facilities" });
  app.register(unitTypesRoutes, { prefix: "/api/unit-types" });
  app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
  app.register(rentalsRoutes, { prefix: "/api/rentals" });
  app.register(rentalChargesRoutes, { prefix: "/api" });
  app.register(renewalsRoutes, { prefix: "/api" });
  app.register(bookingsRoutes, { prefix: "/api" });
  app.register(checkInsRoutes, { prefix: "/api" });
  app.register(inspectionsRoutes, { prefix: "/api" });
  app.register(paymentsRoutes, { prefix: "/api" });
  app.register(pricingRoutes, { prefix: "/api/business-rules" });
  app.register(reportsRoutes, { prefix: "/api/reports" });
  app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
  app.register(storageUnitsRoutes, { prefix: "/api/units" });
  app.register(returnsRoutes, { prefix: "/api" });
  app.register(rentalLifecycleSettingsRoutes, { prefix: "/api" });
  app.register(systemSettingsRoutes, { prefix: "/api" });
  app.register(supportRoutes, { prefix: "/api/support" });
  app.register(facilityWorkspaceRoutes, { prefix: "/api/facility-workspace" });
  app.register(supportWithdrawalRoutes, { prefix: "/api/support" });
  return app;
}
