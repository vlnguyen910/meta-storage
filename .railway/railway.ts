import { defineRailway, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const migrateBeforeDeploy = "bun run --filter @metastorage/database db:migrate";

  const api = service("api", {
    env: {
      HOST: "0.0.0.0",
      NODE_ENV: "production",
      PORT: "4000",
      RAILWAY_DOCKERFILE_PATH: "/apps/api/Dockerfile",
    },
    healthcheck: "/api/health",
    preDeploy: migrateBeforeDeploy,
  });

  const worker = service("worker", {
    env: {
      NODE_ENV: "production",
      RAILWAY_DOCKERFILE_PATH: "/apps/worker/Dockerfile",
    },
    preDeploy: migrateBeforeDeploy,
  });

  return project(ctx.projectName, {
    resources: [api, worker],
  });
});
