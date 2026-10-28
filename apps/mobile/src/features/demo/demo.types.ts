import type { MobileDemoSession, MobileWorkspace } from "@metastorage/contracts";

export interface DemoAccount extends MobileDemoSession {
  password: string;
  verified: boolean;
}
export interface DemoDatabase extends Omit<MobileWorkspace, "session"> {
  version: 1;
  accounts: DemoAccount[];
  sessionId: string | null;
  recoveryRequestedAtByEmail?: Record<string, string>;
}
export type ScreenCode =
  | "M-P00"
  | "M-P01"
  | "M-P02"
  | "M-A01"
  | "M-A02"
  | "M-A03"
  | "M-A04"
  | "M-CK01"
  | "M-CK02"
  | "M-CK03"
  | "M-CK04"
  | "M-CK05"
  | "M-C01"
  | "M-C02"
  | "M-C03"
  | "M-C04"
  | "M-C05"
  | "M-C06"
  | "M-C07"
  | "M-FS01"
  | "M-FS02"
  | "M-FS03"
  | "M-FS04"
  | "M-FS05"
  | "M-FS06"
  | "M-FS07"
  | "M-E01"
  | "M-E02";
export interface MobileRoute {
  screen: ScreenCode;
  id?: string;
}
