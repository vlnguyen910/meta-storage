import type { MobileDemoSession, MobileWorkspace } from "@metastorage/contracts";

interface DemoAccount extends MobileDemoSession {
  password: string;
  verified: boolean;
}
export interface DemoDatabase extends Omit<MobileWorkspace, "session"> {
  version: 1;
  accounts: DemoAccount[];
  sessionId: string | null;
  recoveryRequestedAtByEmail?: Record<string, string>;
}
