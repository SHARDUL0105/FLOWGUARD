"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import NumberTicker from "@/components/effects/NumberTicker";
import SiteNav from "@/components/layout/SiteNav";
import HistoryPanel from "@/components/pr/HistoryPanel";
import CreatePRModal from "@/components/pr/CreatePRModal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { RUNS } from "@/lib/fixtures";
import type { PRListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProjectsStore } from "@/store/projectsStore";

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

// Project slugs used by each demo PR map to project_id in the backend
const PROJECT_LABEL: Record<string, string> = {
  "checkout": "Checkout Platform",
  "payments-api": "Payments API",
  "e-commerce-platform": "E-Commerce Platform",
};

export default function PullRequestsPage() {
  const { projects, fetchProjects } = useProjectsStore();
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [prs, setPrs] = useState<PRListItem[]>([]);
  const [loadingPrs, setLoadingPrs] = useState(true);
  const [id, setId] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [heal, setHeal] = useState<"idle" | "diff" | "gauge" | "verified">("idle");
  const [createOpen, setCreateOpen] = useState(false);

  // Load projects for the selector
  useEffect(() => { fetchProjects(); }, []);

  const loadPRs = () => {
    setLoadingPrs(true);
    const projectId = selectedProject === "all" ? undefined : selectedProject;
    api.prList(projectId).then((list) => {
      setPrs(list);
      if (!list.find((p) => p.id === id)) {
        setId(list[0]?.id ?? null);
        setPhase("idle");
        setHeal("idle");
      }
      setLoadingPrs(false);
    }).catch(() => setLoadingPrs(false));
  };

  // Load PRs whenever project filter changes
  useEffect(() => {
    loadPRs();
  }, [selectedProject]);

  const handleDelete = async (prId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this PR?")) return;
    try {
      await api.deletePR(prId);
      loadPRs();
    } catch (err: any) {
      alert("Failed to delete PR: " + err.message);
    }
  };

  const pick = (n: number) => { setId(n); setPhase("idle"); setHeal("idle"); };
  const analyze = () => { setPhase("analyzing"); setTimeout(() => setPhase("done"), 1400); };
  const runFix = () => { setHeal("diff"); setTimeout(() => setHeal("gauge"), 1800); setTimeout(() => setHeal("verified"), 3600); };
  const currentPR = prs.find((p) => p.id === id);
  // Defaulting everything to PR 12's dummy results for demo purposes if it's not the safe PR
  const risky = id !== 13 && id !== 15;
  const score = risky ? RUNS.pr12.score : RUNS.base.score;

  // Build project options from store + always include "all"
  const projectOptions = [
    { value: "all", label: "All projects" },
    // known demo project IDs
    { value: "checkout", label: "Checkout Platform" },
    ...projects
      .filter((p) => p.slug !== "checkout-platform") // checkout is already listed
      .map((p) => ({ value: p.slug, label: p.name })),
  ];

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-28 pt-14 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">Pull requests</h1>
            <p className="mt-4 max-w-[520px] text-[15px] text-mute">Every change is replayed against the same three faults before it merges.</p>
          </div>

          <div className="flex items-center gap-4 pb-1">
            {/* Project filter */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-mute">Project</span>
              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="appearance-none glass rounded-full pl-4 pr-9 py-2 text-[13px] font-medium cursor-pointer outline-none focus:ring-1 focus:ring-forest"
                >
                  {projectOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute text-[10px]">▼</span>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => setCreateOpen(true)}>+ New PR</Button>
          </div>
        </div>

        <div className="mt-14 grid gap-14 md:grid-cols-[3fr_8fr]">
          <nav aria-label="Pull requests" className="h-fit">
            {loadingPrs && (
              <div className="border-t border-rule py-6">
                <div className="h-4 w-3/4 animate-pulse rounded bg-rule" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-rule" />
              </div>
            )}
            {!loadingPrs && prs.length === 0 && (
              <p className="border-t border-rule py-6 text-[13px] text-mute">No pull requests for this project yet.</p>
            )}
            {prs.map((p) => (
              <button key={p.id} onClick={() => pick(p.id)} className={cn("group block w-full border-t border-rule px-1 py-4 text-left transition-colors", id === p.id ? "glass rounded-lg" : "hover:bg-surface/40 rounded-lg")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="num text-[11.5px] text-mute">#{p.id}, {p.author}</div>
                      {selectedProject === "all" && p.project_id && (
                        <span className="rounded-full border border-forest/30 bg-mint/60 px-2 py-0.5 text-[10px] font-medium text-forest">
                          {PROJECT_LABEL[p.project_id] ?? p.project_id}
                        </span>
                      )}
                      {p.source === "user" && <span className="rounded-full border border-mute/30 bg-surface/60 px-2 py-0.5 text-[10px] font-medium text-mute">User</span>}
                    </div>
                    <div className="mt-0.5 text-[15px] font-medium leading-snug">{p.title}</div>
                  </div>
                  {p.source === "user" && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDelete(p.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-mute hover:text-crit transition-all"
                      title="Delete PR"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
            {!loadingPrs && prs.length > 0 && <div className="border-t border-rule" />}
          </nav>

          <section>
            {!id && !loadingPrs && (
              <p className="border-t border-rule pt-6 text-[14px] text-mute">Select a pull request to begin analysis.</p>
            )}
            {id && currentPR && (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="num text-[12px] text-mute">PR #{id}</div>
                      {currentPR.source === "user" && <span className="rounded-full border border-mute/30 bg-surface/60 px-2 py-0.5 text-[10px] font-medium text-mute">User Created</span>}
                    </div>
                    <h2 className="mt-1 text-[28px] font-semibold tracking-tight">{currentPR.title}</h2>
                    {currentPR.project_id && (
                      <p className="mt-1 text-[12px] text-mute">
                        {PROJECT_LABEL[currentPR.project_id] ?? currentPR.project_id}
                      </p>
                    )}
                    {currentPR.description && (
                      <p className="mt-3 text-[14px] text-mute max-w-[600px] leading-relaxed">{currentPR.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    <Link href={`/pull-requests/${id}`} className="text-[12.5px] text-forest underline underline-offset-4">Open full report</Link>
                    {phase === "idle" && <Button onClick={analyze}>Analyze PR</Button>}
                  </div>
                </div>

                {currentPR.diff && (
                  <div className="mt-8">
                    <h3 className="text-[13px] font-semibold mb-2">Change under review</h3>
                    <pre className="num glass overflow-x-auto rounded-xl p-5 text-[12px] leading-relaxed text-mute">{currentPR.diff}</pre>
                  </div>
                )}

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
              </>
            )}
          </section>
        </div>
        <HistoryPanel />
      </main>
      
      <CreatePRModal 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
        projects={projects.filter(p => p.slug !== "checkout-platform")} // don't allow creating PRs on the read-only demo checkout project
        defaultProjectId={selectedProject !== "all" ? selectedProject : undefined}
        onCreated={(newPr) => {
          // Immediately select the new PR
          if (selectedProject === "all" || selectedProject === newPr.project_id) {
            setPrs((prev) => [newPr, ...prev]);
          } else {
            // Switch to that project to see the new PR
            setSelectedProject(newPr.project_id!);
          }
          pick(newPr.id);
        }} 
      />
    </div>
  );
}

