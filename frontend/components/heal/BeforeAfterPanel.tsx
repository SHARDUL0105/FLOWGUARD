"use client";
import ResilienceGauge from "@/components/score/ResilienceGauge";
import type { AnalyzeResponse, HealResponse } from "@/lib/types";

const LABEL = { db_latency: "Database latency", service_down: "Service down", traffic_spike: "Traffic spike" } as const;

/** Two gauges (PR vs patched) and per-scenario error bars. */
export default function BeforeAfterPanel({ before, after, pr, healed }: { before: number; after: number; pr: AnalyzeResponse["per_scenario"]; healed: HealResponse["per_scenario_after"] }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-around gap-6">
        <div className="text-center"><ResilienceGauge value={before} size={170} label="This PR" duration={0.01} /></div>
        <span className="text-[28px] text-mute">→</span>
        <div className="text-center"><ResilienceGauge value={after} from={before} size={170} label="With Auto-Fix" duration={2.2} /></div>
      </div>
      <div className="mt-6 space-y-3 border-t border-rule pt-5">
        {pr.map((p, i) => {
          const h = healed.find((x) => x.scenario === p.scenario) ?? healed[i];
          const row = (e: number, color: string) => <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1.5, Math.min(100, e * 100))}%`, background: color, transition: "width 1.2s" }} />;
          return (
            <div key={p.scenario} className="grid items-center gap-3 text-[12px] md:grid-cols-[130px_1fr_90px]">
              <span>{LABEL[p.scenario]}</span>
              <div className="space-y-1">{row(p.pr.error_rate, "#D94B45")}{row(h?.error_rate ?? 0, "#218B6A")}</div>
              <span className="num text-right text-mute">{(p.pr.error_rate * 100).toFixed(1)}% → {((h?.error_rate ?? 0) * 100).toFixed(1)}%</span>
            </div>
          );
        })}
        <p className="text-[11px] text-mute">Error rate per scenario: red is this PR, green is the patched config.</p>
      </div>
    </div>
  );
}
