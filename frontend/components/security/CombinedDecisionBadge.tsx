"use client";
import React from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, AlertOctagon, Clock, ShieldCheck, Lock } from "lucide-react";
import type { CombinedGateStatus, CombinedVerificationResult } from "@/lib/types";

interface Props {
  combined: CombinedVerificationResult | null;
  className?: string;
}

export default function CombinedDecisionBadge({ combined, className = "" }: Props) {
  if (!combined) return null;

  const status = combined.combined_status;

  const configMap: Record<
    CombinedGateStatus,
    {
      title: string;
      sub: string;
      badgeColor: string;
      borderColor: string;
      bgColor: string;
      textColor: string;
      icon: React.ReactNode;
    }
  > = {
    ELIGIBLE_FOR_REVIEW: {
      title: "ELIGIBLE FOR REVIEW",
      sub: "Both reliability and security passed. Human review sign-off required before merge (Automatic merge not authorized).",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-950/20",
      textColor: "text-emerald-400",
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
    },
    BLOCKED_SECURITY: {
      title: "BLOCKED BY SECURITY POLICY",
      sub: "Blocking security vulnerability detected. Resilience score cannot cancel out or override security violations.",
      badgeColor: "bg-red-500/20 text-red-400 border-red-500/40",
      borderColor: "border-red-500/30",
      bgColor: "bg-red-950/20",
      textColor: "text-red-400",
      icon: <ShieldAlert className="h-6 w-6 text-red-400" />,
    },
    BLOCKED_RELIABILITY: {
      title: "BLOCKED BY RELIABILITY REGRESSION",
      sub: "Resilience score dropped below baseline under fault scenarios. Auto-Fix or edge remediation required.",
      badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/40",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-950/20",
      textColor: "text-amber-400",
      icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
    },
    BLOCKED_BOTH: {
      title: "BLOCKED BY BOTH GATES (DUAL FAILURE)",
      sub: "Both resilience simulation regressed and blocking security vulnerabilities were identified.",
      badgeColor: "bg-rose-500/20 text-rose-400 border-rose-500/40",
      borderColor: "border-rose-500/30",
      bgColor: "bg-rose-950/20",
      textColor: "text-rose-400",
      icon: <AlertOctagon className="h-6 w-6 text-rose-400" />,
    },
    BLOCKED_CHECKS_INCOMPLETE: {
      title: "BLOCKED: CHECKS INCOMPLETE",
      sub: "One or more required scanners or simulations failed or timed out. Incomplete checks can never pass.",
      badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
      borderColor: "border-yellow-500/30",
      bgColor: "bg-yellow-950/20",
      textColor: "text-yellow-400",
      icon: <Clock className="h-6 w-6 text-yellow-400" />,
    },
  };

  const cfg = configMap[status] ?? configMap.BLOCKED_CHECKS_INCOMPLETE;

  return (
    <div
      className={`rounded-2xl border ${cfg.borderColor} ${cfg.bgColor} p-6 shadow-md transition-all ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 rounded-xl border border-white/10 bg-black/40 p-2.5">
            {cfg.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-mute">
                Unified Gate Decision Matrix
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.badgeColor}`}
              >
                {status}
              </span>
            </div>
            <h3 className={`mt-1 text-lg font-semibold tracking-tight ${cfg.textColor}`}>
              {cfg.title}
            </h3>
            <p className="mt-1 text-xs text-mute max-w-[700px] leading-relaxed">
              {cfg.sub}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-mute">Resilience Score:</span>
            <span className="font-mono text-sm font-bold text-white">
              {combined.reliability.score} / {combined.reliability.score_base}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-mute">Security Status:</span>
            <span
              className={`font-mono text-xs font-bold ${
                combined.security.status === "PASS"
                  ? "text-emerald-400"
                  : combined.security.status === "FAIL"
                  ? "text-red-400"
                  : "text-amber-400"
              }`}
            >
              {combined.security.status}
              {combined.security.blocking_findings_count > 0 &&
                ` (${combined.security.blocking_findings_count} blocking)`}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-mute">
            <Lock className="h-3 w-3" />
            <span>Automatic Merge: <strong>Disabled</strong></span>
          </div>
        </div>
      </div>

      {combined.machine_readable_reasons && combined.machine_readable_reasons.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="text-[10.5px] font-medium text-mute mb-1.5">Machine-Readable Decision Tokens:</div>
          <div className="flex flex-wrap gap-1.5">
            {combined.machine_readable_reasons.map((token, i) => (
              <span
                key={i}
                className="font-mono text-[10.5px] rounded bg-black/40 border border-white/10 px-2 py-0.5 text-white/80"
              >
                {token}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
