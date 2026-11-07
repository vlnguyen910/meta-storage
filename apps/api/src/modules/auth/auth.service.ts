import type { SessionUser } from "@metastorage/contracts";
import { ConflictError, UnauthorizedError } from "../../common/errors/app-error";
import { toUserDto } from "../users/users.dto";
import { auth } from "./auth";
import { AUTH_MESSAGES } from "./auth.messages";
import type { AuthRepository } from "./auth.repository";

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async assertEmailCanRegister(email: string): Promise<void> {
    if (await this.authRepository.findUserByEmail(email)) {
      throw new ConflictError(AUTH_MESSAGES.accountRecovery);
    }
  }

  async getSessionUser(userId: string): Promise<SessionUser> {
    const user = await this.authRepository.findSessionUserById(userId);
    if (!user) throw new UnauthorizedError(AUTH_MESSAGES.loginRequired);
    return { ...toUserDto(user), assignedFacilityId: user.assignedFacilityId };
  }

  async hashPassword(password: string): Promise<string> {
    return (await auth.$context).password.hash(password);
  }
}
