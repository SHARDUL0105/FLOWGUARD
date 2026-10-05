"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import BeforeAfterPanel from "@/components/heal/BeforeAfterPanel";
import DiffViewer from "@/components/heal/DiffViewer";
import VerifiedBadge from "@/components/heal/VerifiedBadge";
import SiteNav from "@/components/layout/SiteNav";
import ScoreDelta from "@/components/score/ScoreDelta";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Source } from "@/lib/api";
import { SERVICE_LABEL } from "@/lib/mock";
import type { AnalyzeResponse, HealResponse, PRListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SC_LABEL = { db_latency: "Database latency", service_down: "Service down", traffic_spike: "Traffic spike" } as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const FALLBACK_META: Record<number, PRListItem> = {
  12: { id: 12, title: "Refactor inventory client", author: "dev-a", status: "open" },
  13: { id: 13, title: "Update README and logging", author: "dev-b", status: "open" },
};

export default function PRReport({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [meta, setMeta] = useState<PRListItem | undefined>(FALLBACK_META[id]);
  const [a, setA] = useState<AnalyzeResponse | null>(null);
  const [src, setSrc] = useState<Source>("fixture");
  const [heal, setHeal] = useState<HealResponse | null>(null);
  const [stage, setStage] = useState<"idle" | "running" | "diff" | "gauge" | "verified">("idle");

  useEffect(() => {
    setA(null); setHeal(null); setStage("idle");
    api.prList().then((l) => setMeta(l.find((p) => p.id === id) ?? FALLBACK_META[id])).catch(() => {});
    Promise.all([api.analyzePR(id), new Promise((r) => setTimeout(r, 900))]).then(([r]) => { setA(r.data); setSrc(r.source); }).catch(() => {});
  }, [id]);

  const runFix = async () => {
    setStage("running");
    const r = await api.healPR(id);
    setHeal(r.data);
    setStage("diff");
    setTimeout(() => setStage("gauge"), 2200);
    setTimeout(() => setStage("verified"), 4600);
  };
  const risky = !!a && a.verdict !== "pass";

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1100px] px-6 pb-28 pt-12 md:px-10">
        <Link href="/pull-requests" className="text-[12.5px] text-mute hover:text-forest">← All pull requests</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="num text-[12px] text-mute">PR #{id}{meta ? `, ${meta.author}` : ""}</div>
            <h1 className="mt-1 text-[clamp(30px,4.5vw,52px)] font-light leading-tight tracking-tight">{meta?.title ?? `Pull request #${id}`}</h1>
          </div>
          <span className="text-[11.5px] text-mute">{a ? (src === "live" ? "Computed by the engine just now" : "Recorded engine output (backend offline)") : ""}</span>
        </div>

        {!a ? (
          <p className="mt-12 border-t border-rule pt-6 text-[14px] text-mute">Replaying database latency, service down and traffic spike against this change…</p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
            <div className="mt-10 border-t border-rule pt-8">
              <ScoreDelta from={a.score_base} to={a.score_pr} caption={risky ? "Regression" : "No change"} />
            </div>

            {!risky ? (
              <p className="mt-8 border-t border-rule pt-6 text-[14px] text-mute">This pull request changes no edge configuration. The score is unchanged and there are no findings.</p>
            ) : (
              <>
                <section className="mt-10 border-t border-rule pt-6">
                  <h2 className="text-[13px] font-semibold">Findings</h2>
                  {a.findings.map((f) => (
                    <div key={f.rule} className="grid gap-1 border-b border-rule py-4 md:grid-cols-[190px_1fr]">
                      <div className="num text-[12px]"><span className={f.severity === "high" ? "text-crit" : "text-warn"}>{f.severity}</span> <span className="text-mute">{f.rule}</span></div>
                      <div className="text-[13.5px]">{f.message} <span className="num text-[12px] text-mute">{f.evidence}</span></div>
                    </div>
                  ))}
                </section>

                <section className="mt-10 grid gap-10 md:grid-cols-2">
                  <div>
                    <h2 className="text-[13px] font-semibold">Cascade path</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                      {a.cascade_path.map((n, i) => (
                        <motion.span key={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.25 }} className="flex items-center gap-2">
                          {SERVICE_LABEL[n] ?? n}{i < a.cascade_path.length - 1 && <span className="text-mute">→</span>}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold">Per scenario (p95, errors)</h2>
                    <table className="mt-3 w-full text-[12.5px]">
                      <thead><tr className="text-left text-mute"><th className="pb-1 font-normal">Scenario</th><th className="pb-1 font-normal">Base</th><th className="pb-1 font-normal">This PR</th></tr></thead>
                      <tbody>
                        {a.per_scenario.map((p) => (
                          <tr key={p.scenario} className="border-t border-rule">
                            <td className="py-1.5">{SC_LABEL[p.scenario]}</td>
                            <td className="num">{p.base.p95_ms} ms, {pct(p.base.error_rate)}</td>
                            <td className={cn("num", p.pr.error_rate > p.base.error_rate + 0.05 && "text-crit")}>{p.pr.p95_ms} ms, {pct(p.pr.error_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="mt-10">
                  <h2 className="text-[13px] font-semibold">Change under review</h2>
                  <pre className="num glass mt-3 overflow-x-auto rounded-xl p-5 text-[12px] leading-relaxed text-mute">{a.diff}</pre>
                </section>

                <section className="mt-10">
                  <h2 className="text-[13px] font-semibold">Comment posted to the pull request</h2>
                  <pre className="num glass mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl p-5 text-[12px] leading-relaxed">{a.comment}</pre>
                </section>

                <section className="mt-12 border-t border-rule pt-8">
                  {stage === "idle" && <Button onClick={runFix}>Run Verified Auto-Fix</Button>}
                  {stage === "running" && <p className="text-[14px] text-mute">Generating a patch and re-running all three faults against it…</p>}
                  {heal && stage !== "idle" && stage !== "running" && (
                    <div className="space-y-10">
                      <DiffViewer diff={heal.patch_diff} />
                      {(stage === "gauge" || stage === "verified") && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="space-y-6">
                          <ScoreDelta from={heal.score_before} to={heal.score_after} size="md" caption={heal.gate === "accepted" ? "Gate: accepted" : "Gate: rejected"} />
                          <BeforeAfterPanel before={heal.score_before} after={heal.score_after} pr={a.per_scenario} healed={heal.per_scenario_after} />
                          {heal.gate === "accepted" && stage === "verified" && <VerifiedBadge faults={heal.verified_under} />}
                          {heal.gate === "rejected" && <p className="border-l-2 border-crit pl-3 text-[13px]">Patch rejected: {heal.reason}</p>}
                        </motion.div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
