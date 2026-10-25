"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import BeforeAfterPanel from "@/components/heal/BeforeAfterPanel";
import DiffViewer from "@/components/heal/DiffViewer";
import VerifiedBadge from "@/components/heal/VerifiedBadge";
import SiteNav from "@/components/layout/SiteNav";
import ScoreDelta from "@/components/score/ScoreDelta";
import CombinedDecisionBadge from "@/components/security/CombinedDecisionBadge";
import ScannerHealthPanel from "@/components/security/ScannerHealthPanel";
import SecurityFindingsTable from "@/components/security/SecurityFindingsTable";
import AutoFixSecurityRevalidationPanel from "@/components/security/AutoFixSecurityRevalidationPanel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Source } from "@/lib/api";
import { SERVICE_LABEL } from "@/lib/mock";
import type {
  AnalyzeResponse,
  CombinedVerificationResult,
  HealResponse,
  PRListItem,
  SecurityScanReport,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Activity, Terminal, ShieldCheck, ShieldAlert, Cpu } from "lucide-react";

const SC_LABEL = {
  db_latency: "Database latency",
  service_down: "Service down",
  traffic_spike: "Traffic spike",
} as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const FALLBACK_META: Record<number, PRListItem> = {
  12: { id: 12, title: "Refactor inventory client", author: "dev-a", status: "open" },
  13: { id: 13, title: "Update README and logging", author: "dev-b", status: "open" },
  21: { id: 21, title: "Add payment gateway webhook handler", author: "dev-security", status: "open" },
  22: { id: 22, title: "Unbounded retry client with credentials", author: "dev-security", status: "open" },
};

export default function PRReport({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [meta, setMeta] = useState<PRListItem | undefined>(FALLBACK_META[id]);
  const [a, setA] = useState<AnalyzeResponse | null>(null);
  const [sec, setSec] = useState<SecurityScanReport | null>(null);
  const [comb, setComb] = useState<CombinedVerificationResult | null>(null);
  const [src, setSrc] = useState<Source>("fixture");
  const [heal, setHeal] = useState<HealResponse | null>(null);
  const [stage, setStage] = useState<"idle" | "running" | "diff" | "gauge" | "verified">("idle");

  useEffect(() => {
    setA(null);
    setSec(null);
    setComb(null);
    setHeal(null);
    setStage("idle");

    api.prList()
      .then((l) => setMeta(l.find((p) => p.id === id) ?? FALLBACK_META[id]))
      .catch(() => {});

    Promise.all([
      api.analyzePR(id),
      api.analyzeSecurityPR(id),
      api.combinedVerification(id),
      new Promise((r) => setTimeout(r, 600)),
    ])
      .then(([rA, rSec, rComb]) => {
        setA(rA.data);
        setSec(rSec.data);
        setComb(rComb.data);
        setSrc(rA.source);
      })
      .catch(() => {});
  }, [id]);

  const runFix = async () => {
    setStage("running");
    const r = await api.healPR(id);
    setHeal(r.data);
    setStage("diff");
    setTimeout(() => setStage("gauge"), 2000);
    setTimeout(() => setStage("verified"), 4200);
  };

  const risky = !!a && a.verdict !== "pass";

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1100px] px-6 pb-28 pt-12 md:px-10">
        <Link href="/pull-requests" className="text-[12.5px] text-mute hover:text-forest">
          ← All pull requests
        </Link>

        {/* Demo Quadrant Quick Switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-2.5 text-xs">
          <span className="text-mute font-medium px-2">Decision Matrix Scenarios:</span>
          <Link
            href="/pull-requests/13"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              id === 13
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-mute hover:text-white"
            }`}
          >
            PR 13 (Pass / Pass)
          </Link>
          <Link
            href="/pull-requests/21"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              id === 21
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : "text-mute hover:text-white"
            }`}
          >
            PR 21 (Pass / Fail)
          </Link>
          <Link
            href="/pull-requests/12"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              id === 12
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-mute hover:text-white"
            }`}
          >
            PR 12 (Fail / Pass)
          </Link>
          <Link
            href="/pull-requests/22"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              id === 22
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "text-mute hover:text-white"
            }`}
          >
            PR 22 (Fail / Fail)
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="num text-[12px] text-mute">
              PR #{id}
              {meta ? `, ${meta.author}` : ""}
            </div>
            <h1 className="mt-1 text-[clamp(28px,4vw,48px)] font-light leading-tight tracking-tight">
              {meta?.title ?? `Pull request #${id}`}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/command-center"
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/40 bg-forest/10 px-3.5 py-2 text-xs font-semibold text-forest hover:bg-forest/20 transition-all shadow-sm"
            >
              <Activity className="h-3.5 w-3.5 text-forest" />
              <span>Simulate in Command Center →</span>
            </Link>
          </div>
        </div>

        {/* Phase 4 & 9 Unified Decision Matrix Banner */}
        {comb && (
          <div className="mt-8">
            <CombinedDecisionBadge combined={comb} />
          </div>
        )}

        {!a ? (
          <p className="mt-12 border-t border-rule pt-6 text-[14px] text-mute">
            Executing independent resilience simulation and static security scanners…
          </p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
            {/* ─── SECTION 1: RELIABILITY PIPELINE ─── */}
            <div className="mt-10 border-t border-rule pt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-mute">
                  Pipeline 1: Resilience & Fault Tolerance
                </h2>
                <span className="font-mono text-xs text-mute">Engine: Sim (seed=7)</span>
              </div>
              <ScoreDelta from={a.score_base} to={a.score_pr} caption={risky ? "Regression" : "No change"} />
            </div>

            {!risky ? (
              <p className="mt-6 rounded-xl border border-white/5 bg-black/20 p-4 text-[13.5px] text-mute">
                This pull request changes no edge configuration. Resilience score remains at baseline (
                {a.score_base}/100) and zero resilience regressions were identified.
              </p>
            ) : (
              <>
                <section className="mt-8 border-t border-rule pt-6">
                  <h3 className="text-[13px] font-semibold">Resilience Findings</h3>
                  {a.findings.map((f) => (
                    <div key={f.rule} className="grid gap-1 border-b border-rule py-3.5 md:grid-cols-[190px_1fr]">
                      <div className="num text-[12px]">
                        <span className={f.severity === "high" ? "text-crit" : "text-warn"}>{f.severity}</span>{" "}
                        <span className="text-mute">{f.rule}</span>
                      </div>
                      <div className="text-[13px]">
                        {f.message} <span className="num text-[12px] text-mute">{f.evidence}</span>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="mt-8 grid gap-8 md:grid-cols-2">
                  <div>
                    <h3 className="text-[13px] font-semibold">Cascade path</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                      {a.cascade_path.map((n, i) => (
                        <motion.span
                          key={n}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.25 }}
                          className="flex items-center gap-2"
                        >
                          {SERVICE_LABEL[n] ?? n}
                          {i < a.cascade_path.length - 1 && <span className="text-mute">→</span>}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold">Per scenario (p95, errors)</h3>
                    <table className="mt-3 w-full text-[12.5px]">
                      <thead>
                        <tr className="text-left text-mute">
                          <th className="pb-1 font-normal">Scenario</th>
                          <th className="pb-1 font-normal">Base</th>
                          <th className="pb-1 font-normal">This PR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.per_scenario.map((p) => (
                          <tr key={p.scenario} className="border-t border-rule">
                            <td className="py-1.5">{SC_LABEL[p.scenario]}</td>
                            <td className="num">
                              {p.base.p95_ms} ms, {pct(p.base.error_rate)}
                            </td>
                            <td
                              className={cn(
                                "num",
                                p.pr.error_rate > p.base.error_rate + 0.05 && "text-crit"
                              )}
                            >
                              {p.pr.p95_ms} ms, {pct(p.pr.error_rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* ─── SECTION 2: INDEPENDENT SECURITY PIPELINE (Phases 2, 3, 10, 11) ─── */}
            <section className="mt-12 border-t border-rule pt-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {sec?.policy.verdict === "PASS" ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  )}
                  <div>
                    <h2 className="text-sm font-semibold tracking-wider uppercase text-mute">
                      Pipeline 2: Independent Security Analysis
                    </h2>
                    <p className="text-[11.5px] text-mute">
                      Static secret detection, SAST, and dependency auditing run without executing untrusted PR code.
                    </p>
                  </div>
                </div>

                {sec && (
                  <span
                    className={`rounded-md border px-2.5 py-1 text-xs font-bold font-mono uppercase ${
                      sec.policy.verdict === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : sec.policy.verdict === "FAIL"
                        ? "bg-red-500/20 text-red-400 border-red-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    Security: {sec.policy.verdict}
                  </span>
                )}
              </div>

              {/* Individual Scanner Execution Health */}
              {sec && <ScannerHealthPanel scanners={sec.scanners} />}

              {/* Normalized Security Findings Table with Redacted Secrets */}
              {sec && <SecurityFindingsTable findings={sec.findings} />}
            </section>

            {/* Change Under Review */}
            <section className="mt-10 border-t border-rule pt-6">
              <h3 className="text-[13px] font-semibold">Change under review (Diff)</h3>
              <pre className="num glass mt-3 overflow-x-auto rounded-xl p-5 text-[12px] leading-relaxed text-mute">
                {a.diff || "No diff available for this pull request."}
              </pre>
            </section>

            {/* CI/CD Pipeline Execution Box (Dual Gates) */}
            <section className="mt-10">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="h-4 w-4 text-forest" />
                <h3 className="text-[13px] font-semibold">
                  CI/CD Pipeline Verification (Simulated GitHub Action)
                </h3>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#070b09] p-4 font-mono text-[11.5px] leading-relaxed text-paper/80 shadow-lg">
                <div className="flex items-center gap-1.5 pb-3 border-b border-white/10 text-[10px] text-mute">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-2">github-actions / pr-verification (pull_request: #{id})</span>
                </div>
                <div className="pt-3 space-y-1">
                  <p className="text-white/60">$ flowguard-ci verify --pr {id} --enforce-security</p>
                  <p className="text-cyan-400">[JOB 1: RELIABILITY] Running headless fault simulations...</p>
                  <p className={risky ? "text-red-400" : "text-emerald-400"}>
                    {risky
                      ? `   ✗ Resilience regressed to ${a.score_pr}/100 (Threshold: 80/100).`
                      : `   ✓ Resilience score ${a.score_pr}/100 meets baseline.`}
                  </p>
                  <p className="text-cyan-400 mt-2">[JOB 2: SECURITY] Running static secret and SAST scanners...</p>
                  <p
                    className={
                      sec?.policy.verdict === "PASS"
                        ? "text-emerald-400"
                        : "text-red-400 font-bold"
                    }
                  >
                    {sec?.policy.verdict === "PASS"
                      ? "   ✓ Security scan clean (0 blocking findings, 0 exposed secrets)."
                      : `   ✗ Security policy FAILED: ${sec?.policy.blocking_findings_count ?? 1} blocking vulnerability(ies) detected.`}
                  </p>
                  <p className="text-white/80 font-bold pt-1">
                    [FINAL GATE DECISION]: {comb?.combined_status ?? (risky ? "BLOCKED_RELIABILITY" : "ELIGIBLE_FOR_REVIEW")}
                  </p>
                </div>
              </div>
            </section>

            {/* ─── SECTION 3: AUTO-FIX & SECURITY REVALIDATION ─── */}
            <section className="mt-12 border-t border-rule pt-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-mute">
                    Verified Auto-Fix & Security Revalidation
                  </h3>
                  <p className="text-xs text-mute mt-0.5">
                    Generates resilience patch and re-scans for security regressions before human sign-off.
                  </p>
                </div>
                <span className="flex items-center gap-1 font-mono text-[10.5px] text-white/50">
                  <Cpu className="h-3 w-3" />
                  <span>Simulation Mode</span>
                </span>
              </div>

              {stage === "idle" && (
                <Button onClick={runFix} className="bg-forest hover:bg-forest/90 text-white">
                  Run Verified Auto-Fix & Revalidation
                </Button>
              )}

              {stage === "running" && (
                <p className="text-[14px] text-mute animate-pulse">
                  Generating patch, executing chaos simulation, and re-running security scanners against patched snapshot…
                </p>
              )}

              {heal && stage !== "idle" && stage !== "running" && (
                <div className="space-y-8">
                  <DiffViewer diff={heal.patch_diff} />

                  {/* Dual Gate Revalidation Result */}
                  <AutoFixSecurityRevalidationPanel heal={heal} />

                  {(stage === "gauge" || stage === "verified") && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6 }}
                      className="space-y-6"
                    >
                      <ScoreDelta
                        from={heal.score_before}
                        to={heal.score_after}
                        size="md"
                        caption={heal.gate === "accepted" ? "Resilience: Accepted" : "Resilience: Rejected"}
                      />
                      <BeforeAfterPanel
                        before={heal.score_before}
                        after={heal.score_after}
                        pr={a.per_scenario}
                        healed={heal.per_scenario_after}
                      />
                      {heal.gate === "accepted" && stage === "verified" && (
                        <VerifiedBadge faults={heal.verified_under} />
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </section>
          </motion.div>
        )}
      </main>
    </div>
  );
}
