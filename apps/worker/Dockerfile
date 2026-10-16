FROM oven/bun:1.3.14 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN bun install --frozen-lockfile --filter "./apps/worker"

COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
COPY packages/typescript-config ./packages/typescript-config

RUN bun run --filter "./apps/worker" build

RUN rm -rf /app/node_modules && bun install --production --frozen-lockfile --filter "./apps/worker"

FROM oven/bun:1.3.14 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist

USER bun

CMD ["bun", "apps/worker/dist/index.js"]
