"use client";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import NumberTicker from "@/components/effects/NumberTicker";
import MiniGraph from "@/components/graph/MiniGraph";
import ChaosButtons from "@/components/sim/ChaosButtons";
import { Button } from "@/components/ui/button";
import { C, TOOLTIP_STYLE } from "@/lib/theme";
import { RUNS, WHATIF } from "@/lib/fixtures";
import { SERVICE_LABEL } from "@/lib/mock";
import { useFlowStore } from "@/store/flowguardStore";
import { useProjectsStore } from "@/store/projectsStore";

const EASE = [0.22, 1, 0.36, 1] as const;

function DrawRule({ className = "" }: { className?: string }) {
  return <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1.2, ease: EASE }} style={{ originX: 0 }} className={`h-px w-full bg-current ${className}`} />;
}

/* ---------- Problem ---------- */
export function ProblemSection() {
  return (
    <section data-nav-tone="dark" className="bg-deep px-6 py-28 text-snow md:px-14">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="max-w-[900px] text-[clamp(36px,6.5vw,96px)] font-light leading-[0.98] tracking-tight">
          Systems rarely fail all at once.
          <br />
          <span className="font-extrabold">Failures propagate.</span>
        </h2>
        <p className="mt-10 max-w-[560px] text-[15px] leading-relaxed text-snow/75">
          A slow database makes inventory and payment time out, which slows orders, which makes the gateway fail. Monitoring shows the red at the end. It does not show where it started.
        </p>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
const CHAPTERS = [
  ["Detect", "Flags the first service that leaves its normal range, tick by tick."],
  ["Understand", "Traces the spread back to a likely origin, stated as a confidence estimate."],
  ["Predict", "Forecasts the impact with a fast analytic model before anything is run."],
  ["Simulate", "Replays real faults against your timeout, retry and breaker settings."],
  ["Recommend", "Proposes a patch and accepts it only if the resilience score measurably improves."],
];
export function HowItWorks() {
  return (
    <section id="platform" className="px-6 py-32 md:px-14">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="max-w-[640px] text-[clamp(28px,3.6vw,52px)] font-light leading-[1.05] tracking-tight">From first symptom to verified fix, in five chapters.</h2>
        <div className="mt-20 grid gap-x-8 gap-y-14 md:grid-cols-5">
          {CHAPTERS.map(([t, d], i) => (
            <div key={t} className="glass glass-hover group rounded-2xl p-5">
              <DrawRule className="text-ink/25 transition-colors group-hover:text-forest" />
              <div className="num mt-4 text-[11px] text-mute">Chapter {i + 1}</div>
              <h3 className="mt-6 text-[26px] font-semibold tracking-tight">{t}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-mute">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Interactive system ---------- */
export function SystemSection() {
  const nodes = useFlowStore((s) => s.nodes);
  const analysis = useFlowStore((s) => s.analysis);
  const statuses = useMemo(() => Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, v.status])), [nodes]);
  const values = useMemo(() => Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, `${v.p95_ms} ms`])), [nodes]);
  const top = analysis?.root_cause[0];
  return (
    <section className="bg-ivory/40 px-6 py-28 md:px-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-[620px] text-[clamp(28px,3.6vw,52px)] font-light leading-[1.05] tracking-tight">Break it yourself. Watch it spread one hop at a time.</h2>
          <ChaosButtons />
        </div>
        <div className="glass mt-14 rounded-2xl px-4 py-10"><MiniGraph statuses={statuses} values={values} /></div>
        <div className="mt-5 flex min-h-[24px] flex-wrap items-center justify-between gap-3 text-[13px]">
          <span className="text-mute">{top ? <>Likely origin: <span className="font-semibold text-ink">{SERVICE_LABEL[top.node]}</span> (confidence estimate {Math.round(top.confidence * 100)}%)</> : "Everything is steady. Pick a fault above."}</span>
          <Link href="/command-center" className="text-forest underline underline-offset-4">Open the full command center</Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Prediction ---------- */
export function PredictionSection() {
  const [sc, setSc] = useState<"db_latency" | "traffic_spike">("db_latency");
  const rows = WHATIF[sc];
  const data = rows.map((r) => ({ factor: r.factor, Forecast: r.predicted.p95_ms, Measured: r.measured.p95_ms }));
  const hi = rows.find((r) => r.factor === 3.0)!;
  return (
    <section className="px-6 py-32 md:px-14">
      <div className="mx-auto grid max-w-[1200px] gap-16 md:grid-cols-[4fr_7fr]">
        <div>
          <h2 className="text-[clamp(28px,3.6vw,52px)] font-light leading-[1.05] tracking-tight">A forecast that admits where it breaks.</h2>
          <p className="mt-6 text-[14px] leading-relaxed text-mute">
            The forecast is a fast steady-state model. It tracks the simulator closely until the system nears saturation, then diverges. At {sc === "db_latency" ? "3.0x database latency" : "3.0x traffic"} it predicts {hi.predicted.p95_ms} ms against {hi.measured.p95_ms} ms measured, and still flags {hi.predicted.risk} risk.
          </p>
          <div className="mt-8 flex gap-2 text-[12.5px]">
            {([["db_latency", "Database latency"], ["traffic_spike", "Traffic"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setSc(id)} className={`rounded-full border px-4 py-1.5 transition-colors ${sc === id ? "border-forest bg-forest text-paper" : "border-ink/20 hover:border-ink"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="h-[340px] w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.rule} vertical={false} />
              <XAxis dataKey="factor" tickFormatter={(v) => `${v}x`} stroke={C.mute} tickLine={false} fontSize={11} />
              <YAxis stroke={C.mute} tickLine={false} axisLine={false} fontSize={11} width={44} unit=" ms" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={3} stroke="#D94B45" strokeDasharray="2 4" />
              <Line type="monotone" dataKey="Forecast" stroke={C.ink} strokeDasharray="5 4" strokeWidth={1.4} dot={false} isAnimationActive animationDuration={1400} />
              <Line type="monotone" dataKey="Measured" stroke={C.forest} strokeWidth={2} dot={{ r: 2.5, fill: C.forest }} isAnimationActive animationDuration={1400} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

/* ---------- Projects ---------- */
export function ProjectsSection() {
  const projects = useProjectsStore((s) => s.projects);
  return (
    <section className="bg-ivory/40 px-6 py-28 md:px-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-end justify-between gap-6">
          <h2 className="max-w-[560px] text-[clamp(28px,3.6vw,52px)] font-light leading-[1.05] tracking-tight">Every system you run, in one quiet list.</h2>
          <Link href="/projects" className="hidden text-[13px] text-forest underline underline-offset-4 md:block">All projects</Link>
        </div>
        <div className="mt-14">
          {projects.slice(0, 3).map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} className="group grid grid-cols-[1fr_auto] glass-hover items-center gap-6 rounded-xl border-t border-ink/10 px-4 py-7 md:grid-cols-[3fr_1fr_1fr_1fr_2fr]">
              <div><div className="text-[22px] font-semibold tracking-tight">{p.name}</div><div className="mt-0.5 text-[12px] text-mute">{p.env}</div></div>
              <div className="num text-[34px] font-light">{p.score}<span className="ml-1 text-[11px] text-mute">score</span></div>
              <div className="hidden text-[13px] text-mute md:block"><span className="num text-ink">{p.services}</span> services</div>
              <div className="hidden text-[13px] md:block"><span className={`num ${p.alerts ? "text-warn" : "text-mute"}`}>{p.alerts}</span> <span className="text-mute">alerts</span></div>
              <div className="hidden text-[12px] text-mute md:block">{p.lastSim}</div>
            </Link>
          ))}
          <div className="border-t border-rule" />
        </div>
      </div>
    </section>
  );
}

/* ---------- Verified auto-fix story ---------- */
const STORY = [
  ["Failure detected", `Pull request #12 pushes the database-slowdown error rate to ${Math.round(RUNS.pr12.per[0].error_rate * 100)}%.`],
  ["Issue identified", "No effective timeout on order → inventory. Four retries multiply the load."],
  ["Patch generated", "Timeout restored, retries bounded, breaker and fallback back on."],
  ["Tests executed", "The same three faults are replayed against the patched config."],
  ["Resilience restored", `Score recovers from ${RUNS.pr12.score} to ${RUNS.healed.score}. The patch is accepted.`],
];
const DIFF = ["- timeout_ms: null", "- retries: 4", "- circuit_breaker: false", "- fallback: false", "+ timeout_ms: 700", "+ retries: 1", "+ circuit_breaker: true", "+ fallback: true"];

export function AutoFix() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s >= STORY.length - 1 ? (clearInterval(id), s) : s + 1)), 2200);
    return () => clearInterval(id);
  }, [inView, run]);
  return (
    <section ref={ref} data-nav-tone="dark" className="bg-deep px-6 py-32 text-snow md:px-14">
      <div className="mx-auto grid max-w-[1200px] gap-16 md:grid-cols-[5fr_6fr]">
        <div>
          <h2 className="text-[clamp(28px,3.6vw,52px)] font-light leading-[1.05] tracking-tight">Fixes that prove themselves before they merge.</h2>
          <ol className="mt-12">
            {STORY.map(([t, d], i) => (
              <li key={t} className={`border-t border-snow/20 py-4 transition-opacity duration-700 ${i <= step ? "opacity-100" : "opacity-30"}`}>
                <div className="flex items-baseline justify-between"><span className="text-[17px] font-semibold">{t}</span><span className="num text-[11px] text-snow/50">{i + 1}/5</span></div>
                {i === step && <p className="mt-1 text-[13px] leading-relaxed text-snow/70">{d}</p>}
              </li>
            ))}
          </ol>
          <button onClick={() => setRun((r) => r + 1)} className="mt-6 text-[12.5px] text-snow/70 underline underline-offset-4 hover:text-snow">Replay</button>
        </div>
        <div className="flex flex-col justify-between border border-snow/20 p-8">
          <div className="flex items-end gap-4">
            <NumberTicker value={step >= 4 ? RUNS.healed.score : RUNS.pr12.score} className="text-[clamp(80px,12vw,160px)] font-extralight leading-none" />
            <div className="mb-3 text-[12px] text-snow/60">resilience score<br />was {RUNS.base.score} before the PR</div>
          </div>
          <div className="mt-8 min-h-[190px] text-[12.5px]">
            {step === 2 && (
              <pre className="num leading-6">{DIFF.map((l) => <div key={l} className={l.startsWith("+") ? "text-[#9FE0C4]" : "text-[#FF8F89]"}>{l}</div>)}</pre>
            )}
            {step >= 3 && (
              <ul className="space-y-2">
                {["Database latency", "Service down", "Traffic spike"].map((n, i) => (
                  <motion.li key={n} initial={{ opacity: 0 }} animate={{ opacity: step === 3 && i > 0 ? 0.5 : 1 }} className="flex justify-between border-b border-snow/15 pb-2">
                    <span>{n}</span><span className="text-[#9FE0C4]">{step >= 4 ? "Verified" : "Running"}</span>
                  </motion.li>
                ))}
              </ul>
            )}
            {step < 2 && <p className="text-snow/50">{step === 0 ? "Regression found in the pull request." : "order → inventory has no timeout."}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */
export function FinalCTA() {
  return (
    <section className="px-6 pb-14 pt-36 md:px-14">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="max-w-[1000px] text-[clamp(40px,8vw,120px)] font-light leading-[0.95] tracking-tight">Your systems don&apos;t have to fail first.</h2>
        <div className="mt-12 flex flex-wrap items-center gap-4"><Button href="/projects/connect">Connect a Project</Button><Button href="/command-center" variant="outline">Enter Command Center</Button></div>
        <div className="mt-28 overflow-hidden"><div className="select-none whitespace-nowrap text-[clamp(60px,17vw,260px)] font-extrabold leading-[0.85] tracking-tighter text-forest">FLOWGUARD.</div></div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-rule pt-5 text-[11.5px] text-mute">
          <span>Validated on a simulated environment. Production path: OpenTelemetry traces and real fault injection.</span>
          <span>Team CodeX, CURIOUSPARC 2026</span>
        </div>
      </div>
    </section>
  );
}
