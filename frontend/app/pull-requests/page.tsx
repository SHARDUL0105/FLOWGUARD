"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import NumberTicker from "@/components/effects/NumberTicker";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { RUNS } from "@/lib/fixtures";
import { cn } from "@/lib/utils";

const PRS = [
  { id: 12, title: "Refactor inventory client", author: "dev-a" },
  { id: 13, title: "Update README and logging", author: "dev-b" },
];
const SC_LABEL = { db_latency: "Database latency", service_down: "Service down", traffic_spike: "Traffic spike" } as const;
const FINDINGS = [
  { rule: "R1_TIMEOUT", sev: "high", msg: "No effective timeout on order → inventory. Callers can hang until the gateway gives up.", ev: "timeout_ms: null" },
  { rule: "R2_RETRY_STORM", sev: "high", msg: "4 retries without backoff multiply load on a struggling dependency.", ev: "retries: 4" },
  { rule: "R3_NO_FALLBACK", sev: "medium", msg: "No circuit breaker or fallback on order → inventory.", ev: "breaker: false, fallback: false" },
];
const PATH = ["Database", "Inventory", "Order", "Gateway", "Frontend"];
const PATCH = ["@@ order → inventory @@", "- timeout_ms: null", "- retries: 4", "- circuit_breaker: false", "- fallback: false", "+ timeout_ms: 700", "+ retries: 1", "+ circuit_breaker: true", "+ fallback: true"];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function comment() {
  const rows = RUNS.pr12.per.map((p, i) => `| ${SC_LABEL[p.scenario]} | ${RUNS.base.per[i].p95_ms} ms / ${pct(RUNS.base.per[i].error_rate)} | ${p.p95_ms} ms / ${pct(p.error_rate)} |`).join("\n");
  return `### FLOWGUARD Resilience Check\n**Regression.** Resilience ${RUNS.base.score} → ${RUNS.pr12.score}\n\n| Scenario | Base (p95 / errors) | This PR |\n|---|---|---|\n${rows}\n\nTop finding: ${FINDINGS[0].msg}\nCascade: ${PATH.join(" → ")}\n\nSuggested fix: restore timeout_ms 700, bound retries to 1, re-enable breaker and fallback.`;
}

export default function PullRequestsPage() {
  const [id, setId] = useState(12);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [heal, setHeal] = useState<"idle" | "diff" | "gauge" | "verified">("idle");

  const pick = (n: number) => { setId(n); setPhase("idle"); setHeal("idle"); };
  const analyze = () => { setPhase("analyzing"); setTimeout(() => setPhase("done"), 1400); };
  const runFix = () => { setHeal("diff"); setTimeout(() => setHeal("gauge"), 1800); setTimeout(() => setHeal("verified"), 3600); };
  const risky = id === 12;
  const score = risky ? RUNS.pr12.score : RUNS.base.score;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-28 pt-14 md:px-10">
        <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">Pull requests</h1>
        <p className="mt-4 max-w-[520px] text-[15px] text-mute">Every change is replayed against the same three faults before it merges.</p>

        <div className="mt-14 grid gap-14 md:grid-cols-[3fr_8fr]">
          <nav aria-label="Pull requests" className="h-fit">
            {PRS.map((p) => (
              <button key={p.id} onClick={() => pick(p.id)} className={cn("block w-full border-t border-rule px-1 py-4 text-left transition-colors", id === p.id ? "glass rounded-lg" : "hover:bg-surface/40 rounded-lg")}>
                <div className="num text-[11.5px] text-mute">#{p.id}, {p.author}</div>
                <div className="mt-0.5 text-[15px] font-medium leading-snug">{p.title}</div>
              </button>
            ))}
            <div className="border-t border-rule" />
          </nav>

          <section>
            <div className="flex items-end justify-between gap-6">
              <div>
                <div className="num text-[12px] text-mute">PR #{id}</div>
                <h2 className="mt-1 text-[28px] font-semibold tracking-tight">{PRS.find((p) => p.id === id)?.title}</h2>
              </div>
              {phase === "idle" && <Button onClick={analyze}>Analyze PR</Button>}
            </div>

            {phase === "analyzing" && <p className="mt-10 border-t border-rule pt-6 text-[14px] text-mute">Replaying database latency, service down and traffic spike…</p>}

            {phase === "done" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
                <div className="mt-10 flex items-end gap-6 border-t border-rule pt-8">
                  <div className="num flex items-baseline gap-4 text-[clamp(64px,10vw,128px)] font-extralight leading-none">
                    <span className="text-mute/60">{RUNS.base.score}</span><span className="text-mute/60">→</span>
                    <span style={{ color: risky ? "#D94B45" : "#218B6A" }}><NumberTicker value={score} /></span>
                  </div>
                  <div className="mb-2 text-[13px] font-medium" style={{ color: risky ? "#D94B45" : "#218B6A" }}>{risky ? "Regression" : "No change"}</div>
                </div>

                {!risky ? (
                  <p className="mt-8 border-t border-rule pt-6 text-[14px] text-mute">This pull request changes no edge configuration. The score is unchanged and there are no findings.</p>
                ) : (
                  <>
                    <div className="mt-10 border-t border-rule pt-6">
                      <h3 className="text-[13px] font-semibold">Findings</h3>
                      {FINDINGS.map((f) => (
                        <div key={f.rule} className="grid gap-1 border-b border-rule py-4 md:grid-cols-[170px_1fr]">
                          <div className="num text-[12px]"><span className={f.sev === "high" ? "text-crit" : "text-warn"}>{f.sev}</span> <span className="text-mute">{f.rule}</span></div>
                          <div className="text-[13.5px]">{f.msg} <span className="num text-[12px] text-mute">{f.ev}</span></div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-10 grid gap-10 md:grid-cols-2">
                      <div>
                        <h3 className="text-[13px] font-semibold">Cascade path</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">{PATH.map((n, i) => <span key={n} className="flex items-center gap-2">{n}{i < PATH.length - 1 && <span className="text-mute">→</span>}</span>)}</div>
                        <p className="mt-2 text-[12px] text-mute">Affected: Inventory, Order, Gateway, Frontend. Checkout at risk.</p>
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold">Per scenario (p95, errors)</h3>
                        <table className="mt-3 w-full text-[12.5px]">
                          <thead><tr className="text-left text-mute"><th className="pb-1 font-normal">Scenario</th><th className="pb-1 font-normal">Base</th><th className="pb-1 font-normal">This PR</th></tr></thead>
                          <tbody>
                            {RUNS.pr12.per.map((p, i) => (
                              <tr key={p.scenario} className="border-t border-rule"><td className="py-1.5">{SC_LABEL[p.scenario]}</td><td className="num">{RUNS.base.per[i].p95_ms} ms, {pct(RUNS.base.per[i].error_rate)}</td><td className={cn("num", p.error_rate > RUNS.base.per[i].error_rate + 0.05 && "text-crit")}>{p.p95_ms} ms, {pct(p.error_rate)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-10">
                      <h3 className="text-[13px] font-semibold">Comment posted to the pull request</h3>
                      <pre className="num mt-3 overflow-x-auto whitespace-pre-wrap glass rounded-xl p-5 text-[12px] leading-relaxed">{comment()}</pre>
                    </div>

                    <div className="mt-12 border-t border-rule pt-8">
                      {heal === "idle" && <Button onClick={runFix}>Run Verified Auto-Fix</Button>}
                      <AnimatePresence>
                        {heal !== "idle" && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                            <h3 className="text-[13px] font-semibold">Generated patch</h3>
                            <pre className="num mt-3 glass rounded-xl p-5 text-[12.5px] leading-6">{PATCH.map((l, i) => <div key={i} className={l.startsWith("+") ? "bg-ok/10 text-ok" : l.startsWith("-") ? "bg-crit/10 text-crit" : "text-mute"}>{l}</div>)}</pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {(heal === "gauge" || heal === "verified") && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="mt-10 flex flex-wrap items-end gap-8">
                          <div className="num flex items-baseline gap-4 text-[clamp(56px,8vw,104px)] font-extralight leading-none"><span className="text-crit/70">{RUNS.pr12.score}</span><span className="text-mute/60">→</span><NumberTicker value={RUNS.healed.score} className="text-ok" /></div>
                          {heal === "verified" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="mb-3 rounded-xl border border-ok/40 bg-mint/70 px-4 py-3 backdrop-blur-md text-[13px] text-forest">
                              <div className="font-semibold">Verified under 3 faults</div>
                              <div className="mt-0.5 text-[12px]">Database latency, Service down, Traffic spike. Patch accepted.</div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
