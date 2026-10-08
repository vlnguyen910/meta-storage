"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { AUTH_MESSAGES } from "./auth.messages";
import type { VerifyEmailState } from "./auth.types";

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const statusParam = searchParams.get("status") as VerifyEmailState | null;
  const emailParam = searchParams.get("email") || "minh.le@example.com";

  const initialStatus: VerifyEmailState = statusParam
    ? statusParam
    : errorParam === "expired"
      ? "expired"
      : errorParam
        ? "failure"
        : "success";

  const [activeState, setActiveState] = useState<VerifyEmailState>(initialStatus);
  const [currentCountdown, setCurrentCountdown] = useState(45);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (activeState !== "pending" || currentCountdown <= 0) return;
    const interval = setInterval(() => {
      setCurrentCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeState, currentCountdown]);

  async function handleResend() {
    if (currentCountdown > 0 || isResending) return;
    setIsResending(true);
    try {
      await api.auth.forgotPassword(emailParam);
    } catch {
      // best-effort
    } finally {
      setIsResending(false);
      setCurrentCountdown(45);
    }
  }

  function handleSwitchState(state: VerifyEmailState) {
    setActiveState(state);
    if (state === "pending") {
      setCurrentCountdown(45);
    }
  }

  return (
    <div className="w-full max-w-[560px] mx-auto">
      {/* State Inspector Control */}
      <div className="w-full mb-4 bg-white rounded-[15px] border border-slate-200 p-2 shadow-xs">
        <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Mô phỏng trạng thái xác thực
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            Route: /verify-email
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleSwitchState("pending")}
            className={`px-2.5 py-1.5 rounded text-left transition-all flex flex-col text-xs font-medium cursor-pointer ${
              activeState === "pending"
                ? "bg-[#165f4d] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>1. Chờ duyệt</span>
            <span className="text-[10px] opacity-80 font-normal">Pending 45s</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchState("success")}
            className={`px-2.5 py-1.5 rounded text-left transition-all flex flex-col text-xs font-medium cursor-pointer ${
              activeState === "success"
                ? "bg-[#165f4d] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>2. Thành công</span>
            <span className="text-[10px] opacity-80 font-normal">Token valid</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchState("expired")}
            className={`px-2.5 py-1.5 rounded text-left transition-all flex flex-col text-xs font-medium cursor-pointer ${
              activeState === "expired"
                ? "bg-[#165f4d] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>3. Hết hạn</span>
            <span className="text-[10px] opacity-80 font-normal">TTL expired</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchState("failure")}
            className={`px-2.5 py-1.5 rounded text-left transition-all flex flex-col text-xs font-medium cursor-pointer ${
              activeState === "failure"
                ? "bg-[#165f4d] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>4. Lỗi mã</span>
            <span className="text-[10px] opacity-80 font-normal">Invalid hash</span>
          </button>
        </div>
      </div>

      {/* Main Operational Card */}
      <div className="w-full bg-white rounded-[15px] border border-slate-200 p-6 sm:p-8 shadow-[0px_1px_2px_0px_rgba(15,23,42,0.05)] transition-all">
        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f3ef] border border-[#c4e2d7] text-[#165f4d] text-xs font-medium mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>{AUTH_MESSAGES.verifyEmailBadge}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {AUTH_MESSAGES.verifyEmailTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {AUTH_MESSAGES.verifyEmailSubtitle}
          </p>
        </div>

        {/* Recipient Context Box */}
        <div className="p-3.5 mb-6 rounded-lg bg-[#f8fafc] border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-600">
              <Mail className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-[11px] text-slate-500 font-medium">
                {AUTH_MESSAGES.recipientEmailLabel}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">{emailParam}</div>
            </div>
          </div>
          <Link
            href={routes.register}
            className="text-[#165f4d] hover:underline text-xs font-semibold shrink-0 pl-2"
          >
            {AUTH_MESSAGES.changeAction}
          </Link>
        </div>

        {/* STATE 1: PENDING */}
        {activeState === "pending" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-[#faf8ff] border border-slate-200">
              <div className="relative w-16 h-16 rounded-2xl bg-[#e8f3ef] border border-[#c4e2d7] flex items-center justify-center text-[#165f4d] mb-4">
                <Mail className="w-9 h-9" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#165f4d] opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#165f4d] border-2 border-white" />
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 mb-1">
                {AUTH_MESSAGES.pendingTitle}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.pendingDescription}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                id="resend-btn"
                disabled={currentCountdown > 0 || isResending}
                onClick={handleResend}
                className={`w-full h-10 px-4 rounded-lg border border-slate-200 text-xs md:text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  currentCountdown > 0
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-80"
                    : "bg-white hover:bg-slate-50 text-slate-800 cursor-pointer"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#165f4d] ${
                    currentCountdown > 0 || isResending ? "animate-spin" : ""
                  }`}
                />
                <span>{AUTH_MESSAGES.resendVerifyEmail}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-900 text-xs font-mono font-medium">
                  {currentCountdown > 0 ? `${currentCountdown}s` : AUTH_MESSAGES.resendReady}
                </span>
              </button>
              <p className="text-xs text-center text-slate-500">
                {AUTH_MESSAGES.checkSpamNote}{" "}
                <span className="text-slate-900 font-medium">{AUTH_MESSAGES.spamFolder}</span>.
              </p>
            </div>
          </div>
        )}

        {/* STATE 2: SUCCESS */}
        {activeState === "success" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0]">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#a7f3d0] flex items-center justify-center text-[#107012] mb-4 shadow-xs">
                <CheckCircle className="w-9 h-9" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#a7f3d0] text-[#107012] text-xs font-semibold mb-2">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{AUTH_MESSAGES.successBadge}</span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 mb-2">
                {AUTH_MESSAGES.successTitle}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.successDescription}
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href={routes.login}
                className="w-full h-10 px-4 rounded-lg bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] text-white text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <span>{AUTH_MESSAGES.continueToLogin}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                <Lock className="w-3.5 h-3.5 text-[#107012]" />
                <span>{AUTH_MESSAGES.sslTls256Note}</span>
              </div>
            </div>
          </div>
        )}

        {/* STATE 3: EXPIRED */}
        {activeState === "expired" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#fde68a] flex items-center justify-center text-[#92400e] mb-4 shadow-xs">
                <Clock className="w-9 h-9" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#fde68a] text-[#92400e] text-xs font-semibold mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{AUTH_MESSAGES.expiredBadge}</span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 mb-2">
                {AUTH_MESSAGES.expiredTitle}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.expiredDescription}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSwitchState("pending")}
                className="w-full h-10 px-4 rounded-lg bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] text-white text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>{AUTH_MESSAGES.resendNewEmail}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchState("pending")}
                className="w-full h-10 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs md:text-sm font-medium flex items-center justify-center transition-all cursor-pointer"
              >
                {AUTH_MESSAGES.backToPending}
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: FAILURE */}
        {activeState === "failure" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#fecaca] flex items-center justify-center text-[#991b1b] mb-4 shadow-xs">
                <AlertTriangle className="w-9 h-9" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#fecaca] text-[#991b1b] text-xs font-semibold mb-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{AUTH_MESSAGES.failureBadge}</span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 mb-2">
                {AUTH_MESSAGES.failureTitle}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.failureDescription}
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
                className="w-full h-10 px-4 rounded-lg bg-[#991b1b] hover:bg-[#7f1d1d] text-white text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>{AUTH_MESSAGES.requestTechSupport}</span>
              </a>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchState("pending")}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs font-medium text-center truncate transition-all cursor-pointer"
                >
                  {AUTH_MESSAGES.retryEnterEmail}
                </button>
                <Link
                  href="/support"
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs font-medium flex items-center justify-center gap-1 transition-all"
                >
                  <span>{AUTH_MESSAGES.helpCenter}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Trust & Verification Footer Inside Card */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#107012]" />
            <span className="font-mono text-[11px]">{AUTH_MESSAGES.clusterInfo}</span>
          </div>
          <div className="text-xs font-medium">
            {AUTH_MESSAGES.sessionPrefix}{" "}
            <span className="font-mono text-[11px] text-slate-700">STX-8492</span>
          </div>
        </div>
      </div>

      {/* Help & Context Links Below Card */}
      <div className="mt-6 text-center space-y-2">
        <p className="text-xs text-slate-500">
          {AUTH_MESSAGES.needHelpNote}{" "}
          <a
            href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
            className="text-[#165f4d] font-semibold hover:underline"
          >
            {AUTH_MESSAGES.hotlineNumber}
          </a>{" "}
          (24/7)
        </p>
        <div className="flex items-center justify-center gap-4 text-slate-500 text-xs">
          <Link href="/guide" className="hover:text-[#165f4d] transition-colors">
            {AUTH_MESSAGES.topNavGuide}
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-[#165f4d] transition-colors">
            {AUTH_MESSAGES.navPrivacy}
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[#165f4d] transition-colors">
            {AUTH_MESSAGES.navTerms}
          </Link>
        </div>
      </div>
    </div>
  );
}
