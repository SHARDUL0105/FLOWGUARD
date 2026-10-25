"use client";
import React from "react";
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Terminal } from "lucide-react";
import type { ScannerMetadata } from "@/lib/types";

interface Props {
  scanners: ScannerMetadata[];
  className?: string;
}

export default function ScannerHealthPanel({ scanners, className = "" }: Props) {
  if (!scanners || scanners.length === 0) return null;

  const renderStatus = (s: ScannerMetadata) => {
    switch (s.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            Skipped
          </span>
        );
      case "unavailable":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-[11px] font-medium text-mute border border-white/10">
            <HelpCircle className="h-3 w-3" />
            Unavailable
          </span>
        );
    }
  };

  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-forest" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mute">
            Security Scanners Execution Status
          </h3>
        </div>
        <span className="text-[11px] text-mute font-mono">
          {scanners.filter((s) => s.status === "completed").length} / {scanners.length} completed
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {scanners.map((s) => (
          <div
            key={s.scanner}
            className="rounded-xl border border-white/5 bg-black/20 p-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-white/90 capitalize">
                {s.scanner.replace("-", " ")}
              </span>
              {renderStatus(s)}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-mute">
              <span>Findings: <strong className="font-mono text-white/80">{s.findings_count}</strong></span>
              {s.duration_ms !== undefined && (
                <span className="font-mono text-[10px] text-white/50">{s.duration_ms.toFixed(1)}ms</span>
              )}
            </div>

            {s.error_message && (
              <p className="mt-1.5 text-[10.5px] text-white/60 line-clamp-1" title={s.error_message}>
                {s.error_message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
