"use client";
import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Cpu } from "lucide-react";
import type { HealResponse } from "@/lib/types";

interface Props {
  heal: HealResponse;
  className?: string;
}

export default function AutoFixSecurityRevalidationPanel({ heal, className = "" }: Props) {
  const reval = heal.security_revalidation;
  const isAccepted = heal.gate === "accepted";
  const postCombined = heal.combined_status ?? (isAccepted ? "ELIGIBLE_FOR_REVIEW" : "BLOCKED_SECURITY");

  return (
    <div className={`glass rounded-2xl p-6 border ${isAccepted ? "border-emerald-500/30" : "border-red-500/30"} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-rule">
        <div className="flex items-center gap-2.5">
          {isAccepted ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-red-400" />
          )}
          <div>
            <h4 className="text-sm font-semibold text-white/95">
              Auto-Fix Dual Gate Revalidation Result
            </h4>
            <p className="text-[11px] text-mute">
              Re-evaluates both resilience fault simulation and static security scanning on the patched revision.
            </p>
          </div>
        </div>

        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${
            isAccepted
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              : "bg-red-500/20 text-red-400 border-red-500/40"
          }`}
        >
          Gate: {heal.gate}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-center">
          <div className="text-[11px] text-mute">Resilience Recovery</div>
          <div className="mt-1 font-mono text-base font-bold text-white">
            {heal.score_before} → {heal.score_after} <span className="text-emerald-400 text-xs">/100</span>
          </div>
          <span className="text-[10px] text-emerald-400/90 font-medium">Rules A, B, C Verified</span>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-center">
          <div className="text-[11px] text-mute">Security Policy Verdict</div>
          <div
            className={`mt-1 font-mono text-base font-bold ${
              reval?.policy_verdict === "PASS"
                ? "text-emerald-400"
                : reval?.policy_verdict === "FAIL"
                ? "text-red-400"
                : "text-amber-400"
            }`}
          >
            {reval?.policy_verdict ?? (isAccepted ? "PASS" : "FAIL")}
          </div>
          <span className="text-[10px] text-mute">
            {reval?.blocking_remaining_count ?? 0} remaining blocking flaws
          </span>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-center">
          <div className="text-[11px] text-mute">Combined Post-Fix Status</div>
          <div className="mt-1 font-mono text-xs font-bold text-white uppercase truncate" title={postCombined}>
            {postCombined}
          </div>
          <span className="text-[10px] text-mute">
            {postCombined === "ELIGIBLE_FOR_REVIEW" ? "Ready for Human Sign-off" : "Merge Blocked"}
          </span>
        </div>
      </div>

      {reval && (
        <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3 text-xs flex flex-wrap items-center justify-around gap-2 text-mute">
          <span>Resolved Vulnerabilities: <strong className="text-emerald-400">{reval.resolved_count}</strong></span>
          <span>•</span>
          <span>Introduced Vulnerabilities: <strong className={reval.introduced_count > 0 ? "text-red-400" : "text-white"}>{reval.introduced_count}</strong></span>
          <span>•</span>
          <span>Remaining Vulnerabilities: <strong className={reval.remaining_count > 0 ? "text-amber-400" : "text-white"}>{reval.remaining_count}</strong></span>
        </div>
      )}

      {heal.reason && (
        <div className="mt-4 rounded-xl bg-red-950/20 border border-red-500/20 p-3 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong>Rejection Reason:</strong> {heal.reason}
          </div>
        </div>
      )}

      {heal.revision_id && (
        <div className="mt-3 flex items-center justify-between text-[10.5px] text-mute font-mono border-t border-white/5 pt-2">
          <span>Revision ID: {heal.revision_id}</span>
          <span className="flex items-center gap-1 text-white/50">
            <Cpu className="h-3 w-3" />
            <span>Simulated Auto-Fix Patch</span>
          </span>
        </div>
      )}
    </div>
  );
}
