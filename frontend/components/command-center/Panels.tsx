"use client";
import { useMemo } from "react";
import NumberTicker from "@/components/effects/NumberTicker";
import { useStreamedText } from "@/hooks/useStreamedText";
import { STATUS_COLOR } from "@/lib/colors";
import { SERVICE_LABEL } from "@/lib/mock";
import { RUNS } from "@/lib/fixtures";
import { useFlowStore } from "@/store/flowguardStore";

const BASE_P95 = RUNS.base.baseline.p95_ms;

export function Block({ title, aside, children, className = "" }: { title: string; aside?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border-t border-rule py-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[12.5px] font-semibold text-ink">{title}</h2>
        {aside && <span className="text-[11px] text-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Live checkout health: errors cost the most, extra latency costs up to 40 points. */
export function ResilienceScore() {
  const c = useFlowStore((s) => s.checkout);
  const health = Math.round(100 * (1 - Math.min(1, c.error_rate / 0.5)) * (1 - 0.4 * Math.min(1, Math.max(0, c.p95_ms / BASE_P95 - 1) / 3)));
  const color = health >= 80 ? STATUS_COLOR.healthy : health >= 50 ? STATUS_COLOR.degraded : STATUS_COLOR.critical;
  return (
    <Block title="Checkout health" aside="live, out of 100">
      <div className="flex items-end gap-6">
        <NumberTicker value={health} className="text-[64px] font-light leading-none" />
        <div className="mb-1 space-y-0.5 text-[12px] text-mute">
          <div><span className="num text-ink">{c.p95_ms}</span> ms p95</div>
          <div><span className="num text-ink">{(c.error_rate * 100).toFixed(1)}%</span> errors</div>
        </div>
      </div>
      <div className="mt-3 h-px w-full bg-rule"><div className="h-px transition-all duration-700" style={{ width: `${health}%`, background: color }} /></div>
    </Block>
  );
}

export function RootCause() {
  const a = useFlowStore((s) => s.analysis);
  return (
    <Block title="Likely origin" aside="confidence estimate">
      {!a ? (
        <p className="text-[12.5px] text-mute">No anomaly. Start a fault and the origin appears within a second or two.</p>
      ) : (
        <ul className="space-y-3">
          {a.root_cause.slice(0, 3).map((c, i) => (
            <li key={c.node}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className={i === 0 ? "font-semibold text-ink" : "text-ink/70"}>{SERVICE_LABEL[c.node]}</span>
                <span className="num text-mute">{Math.round(c.confidence * 100)}%</span>
              </div>
              <div className="mt-1 h-px bg-rule"><div className="h-px bg-forest transition-all duration-700" style={{ width: `${c.confidence * 100}%` }} /></div>
              {i === 0 && <p className="mt-1.5 text-[11.5px] text-mute">{c.evidence.join(". ")}.</p>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function CascadePath() {
  const a = useFlowStore((s) => s.analysis);
  const nodes = useFlowStore((s) => s.nodes);
  return (
    <Block title="Cascade path" aside={a ? `${a.blast_radius.total} services in the blast radius` : undefined}>
      {!a ? <p className="text-[12.5px] text-mute">Nothing is spreading.</p> : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px]">
          {a.propagation_path.map((n, i) => (
            <span key={n} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[nodes[n]?.status ?? "degraded"] }} />{SERVICE_LABEL[n]}</span>
              {i < a.propagation_path.length - 1 && <span className="text-mute">→</span>}
            </span>
          ))}
        </div>
      )}
    </Block>
  );
}

/** Deterministic brief built only from the evidence on screen (the fallback in Section 9 of the brief). */
export function IncidentCommander() {
  const a = useFlowStore((s) => s.analysis);
  const c = useFlowStore((s) => s.checkout);
  const scenario = useFlowStore((s) => s.scenario);
  const text = useMemo(() => {
    if (!a || !scenario) return "";
    const top = a.root_cause[0];
    const label = { db_latency: "Database latency rose", service_down: "Inventory stopped responding", traffic_spike: "Traffic rose sharply" }[scenario];
    return `What happened: ${label}. Checkout is now at ${c.p95_ms} ms p95 with ${(c.error_rate * 100).toFixed(1)}% errors.\n\nLikely origin: ${SERVICE_LABEL[top.node]} (confidence estimate ${Math.round(top.confidence * 100)}%). ${top.evidence.join(". ")}.\n\nBlast radius: ${a.blast_radius.total} services. Path: ${a.propagation_path.map((n) => SERVICE_LABEL[n]).join(" to ")}.\n\nRecommended: review timeout, retry and fallback settings on the edges into ${SERVICE_LABEL[top.node]}; run the PR check before the next release.`;
  }, [a, c, scenario]);
  const { shown, done } = useStreamedText(text, 60);
  return (
    <Block title="Incident commander" aside={text ? "template brief" : undefined}>
      {!text ? <p className="text-[12.5px] text-mute">A written brief appears here when something breaks.</p> : (
        <p className={`whitespace-pre-line text-[12.5px] leading-relaxed text-ink/85 ${done ? "" : "caret"}`}>{shown}</p>
      )}
    </Block>
  );
}
