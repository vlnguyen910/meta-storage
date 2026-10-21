import { z } from "zod";
import { ENV_MESSAGES } from "./env.messages";
import { PROVIDER_ENV_MESSAGES } from "./provider-env.messages";

const optionalCredential = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();
export const providerEnvSchema = z
  .object({
    GOOGLE_CLIENT_ID: optionalCredential,
    GOOGLE_CLIENT_SECRET: optionalCredential,
    CLOUDINARY_CLOUD_NAME: z.string().trim().min(1, ENV_MESSAGES.required("CLOUDINARY_CLOUD_NAME")),
    CLOUDINARY_API_KEY: z.string().trim().min(1, ENV_MESSAGES.required("CLOUDINARY_API_KEY")),
    CLOUDINARY_API_SECRET: z.string().trim().min(1, ENV_MESSAGES.required("CLOUDINARY_API_SECRET")),
  })
  .superRefine((values, ctx) => {
    const google = [values.GOOGLE_CLIENT_ID, values.GOOGLE_CLIENT_SECRET];
    if (google.some(Boolean) && !google.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: PROVIDER_ENV_MESSAGES.googleCredentials,
      });
    }
  });
