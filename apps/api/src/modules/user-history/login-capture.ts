import type { LoginCaptureContext, LoginCaptureSession } from "./login-capture.types";
import { describeLoginDevice } from "./login-device";
import type { UserHistoryRepository } from "./user-history.repository";

export async function captureSuccessfulLogin(
  repository: Pick<UserHistoryRepository, "recordLogin">,
  session: LoginCaptureSession,
  context: LoginCaptureContext,
  warn: () => void,
): Promise<void> {
  if (
    context.path !== "/sign-in/email" &&
    context.path !== "/callback/google" &&
    !(context.path === "/callback/:id" && context.providerId === "google")
  )
    return;
  try {
    await repository.recordLogin({
      sessionId: session.id,
      userId: session.userId,
      occurredAt: session.createdAt,
      ...describeLoginDevice(context.headers),
    });
  } catch {
    warn();
  }
}
