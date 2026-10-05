"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Block } from "@/components/command-center/Panels";
import { useStreamedText } from "@/hooks/useStreamedText";
import { api } from "@/lib/api";
import { SERVICE_LABEL } from "@/lib/mock";
import { useFlowStore } from "@/store/flowguardStore";

/** Deterministic brief from the evidence on screen (last link of the fallback chain). */
function templateBrief(a: NonNullable<ReturnType<typeof useFlowStore.getState>["analysis"]>, c: { p95_ms: number; error_rate: number }, scenario: string) {
  const top = a.root_cause[0];
  const label = ({ db_latency: "Database latency rose", service_down: "Inventory stopped responding", traffic_spike: "Traffic rose sharply" } as Record<string, string>)[scenario] ?? "An anomaly started";
  return `**What happened**\n${label}. Checkout is at ${c.p95_ms} ms p95 with ${(c.error_rate * 100).toFixed(1)}% errors.\n\n**Likely origin**\n${SERVICE_LABEL[top.node]} (confidence estimate ${Math.round(top.confidence * 100)}%). ${top.evidence.join(". ")}.\n\n**Blast radius**\n${a.blast_radius.total} services. Path: ${a.propagation_path.map((n) => SERVICE_LABEL[n]).join(" to ")}.\n\n**Recommended actions**\n- Review timeout, retry and fallback settings on edges into ${SERVICE_LABEL[top.node]}.\n- Run the PR check before the next release.`;
}

function render(text: string) {
  return text.split("\n").map((line, i) => {
    const h = line.match(/^\*\*(.+)\*\*$/);
    if (h) return <div key={i} className="mt-2 font-semibold text-ink first:mt-0">{h[1]}</div>;
    return <div key={i} className="min-h-[1em]">{line.split(/(\d+(?:\.\d+)?)/).map((p, j) => (/^\d/.test(p) ? <span key={j} className="num text-forest">{p}</span> : p))}</div>;
  });
}

/** Streams the incident brief from /api/brief (LLM -> template -> fixture on the server); local template if the backend is off. */
export default function IncidentCommander() {
  const a = useFlowStore((s) => s.analysis);
  const c = useFlowStore((s) => s.checkout);
  const scenario = useFlowStore((s) => s.scenario);
  const runId = useFlowStore((s) => s.runId);
  const [brief, setBrief] = useState<{ text: string; source: string } | null>(null);
  const asked = useRef(-1);

  useEffect(() => { if (!a) { setBrief(null); asked.current = -1; } }, [a]);
  useEffect(() => {
    if (!a || !scenario || asked.current === runId) return;
    asked.current = runId;
    const local = { text: templateBrief(a, c, scenario), source: "template" };
    setBrief(local); // Display local brief immediately so UI is never stuck
    let live = true;
    api.brief({ scenario }).then((r) => {
      if (live && r?.text) setBrief(r);
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, scenario, runId]);

  const text = useMemo(() => brief?.text ?? "", [brief]);
  const { shown, done } = useStreamedText(text, 90);
  const badge = brief ? ({ llm: "LLM", template: "template", fixture: "fixture" } as Record<string, string>)[brief.source] ?? brief.source : undefined;
  return (
    <Block title="Incident commander" aside={badge}>
      {!a ? <p className="text-[12.5px] text-mute">A written brief appears here when something breaks.</p>
        : !text ? <p className="text-[12.5px] text-mute caret">Writing the brief</p>
        : <div className={`text-[12.5px] leading-relaxed text-ink/85 ${done ? "" : "caret"}`}>{render(shown)}</div>}
    </Block>
  );
}
