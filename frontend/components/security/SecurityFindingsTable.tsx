"use client";
import React, { useState } from "react";
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, FileCode, Wrench } from "lucide-react";
import type { SecurityFinding, SecuritySeverity } from "@/lib/types";

interface Props {
  findings: SecurityFinding[];
  className?: string;
}

export default function SecurityFindingsTable({ findings, className = "" }: Props) {
  const [filterSev, setFilterSev] = useState<string>("all");

  if (!findings || findings.length === 0) {
    return (
      <div className={`glass rounded-2xl p-6 text-center ${className}`}>
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-white/90">Zero Security Flaws Detected</h4>
        <p className="mt-1 text-xs text-mute">
          All executed static scanners (secrets, SAST, dependencies) completed without blocking security findings.
        </p>
      </div>
    );
  }

  const sevBadge = (sev: SecuritySeverity) => {
    switch (sev) {
      case "critical":
        return <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-400 uppercase">Critical</span>;
      case "high":
        return <span className="rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">High</span>;
      case "medium":
        return <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">Medium</span>;
      case "low":
        return <span className="rounded bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[10px] font-bold text-blue-400 uppercase">Low</span>;
      case "info":
      default:
        return <span className="rounded bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-bold text-mute uppercase">Info</span>;
    }
  };

  const filtered = filterSev === "all" ? findings : findings.filter((f) => f.severity === filterSev);

  return (
    <div className={`glass rounded-2xl p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-rule">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white/90">
            Security Findings ({findings.length})
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-mute mr-1 text-[11px]">Filter:</span>
          {["all", "critical", "high", "medium", "low"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSev(s)}
              className={`rounded px-2 py-0.5 text-[10.5px] capitalize font-medium transition-all ${
                filterSev === s
                  ? "bg-forest/20 text-forest border border-forest/40"
                  : "text-mute hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 divide-y divide-rule">
        {filtered.map((f) => (
          <div key={f.id} className="py-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {sevBadge(f.severity)}
                <span className="font-mono text-xs text-mute">{f.rule_id}</span>
                <span className="font-semibold text-xs text-white/90">{f.title}</span>
              </div>
              <span className="font-mono text-[11px] rounded bg-white/5 px-2 py-0.5 text-mute border border-white/10">
                scanner: {f.scanner}
              </span>
            </div>

            <p className="text-xs text-mute leading-relaxed">{f.explanation}</p>

            {f.file_path && (
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400/90">
                <FileCode className="h-3.5 w-3.5 text-cyan-400" />
                <span>
                  {f.file_path}
                  {f.line_number ? `:${f.line_number}` : ""}
                </span>
                {f.is_new && (
                  <span className="rounded bg-rose-500/10 text-rose-400 px-1.5 py-0.2 text-[9.5px] border border-rose-500/20">
                    new in this PR
                  </span>
                )}
              </div>
            )}

            {f.raw_snippet && (
              <pre className="mt-1.5 rounded-lg bg-[#070b09] border border-white/10 p-2.5 font-mono text-[11px] text-mute overflow-x-auto">
                <code>{f.raw_snippet}</code>
              </pre>
            )}

            <div className="flex items-start gap-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-2.5 text-[11.5px] text-emerald-300">
              <Wrench className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Remediation:</strong> {f.remediation}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
