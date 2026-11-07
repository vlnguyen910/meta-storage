import { CoverImageUploadSchema } from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { MEDIA_ASSET_MESSAGES } from "./media-assets.messages";
import { MediaAssetsRepository } from "./media-assets.repository";
import { MediaAssetsService } from "./media-assets.service";

export const mediaAssetsRoutes: FastifyPluginAsync = async (app) => {
  const service = new MediaAssetsService(new MediaAssetsRepository(app.db));
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/cover-image",
    {
      bodyLimit: 4.5 * 1024 * 1024,
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER", "FACILITY_MANAGER")],
      schema: {
        tags: ["Media Assets"],
        summary: MEDIA_ASSET_MESSAGES.coverUploadSummary,
        body: CoverImageUploadSchema,
      },
    },
    async (request) => successResponse(await service.uploadCoverImage(request.body)),
  );
};
