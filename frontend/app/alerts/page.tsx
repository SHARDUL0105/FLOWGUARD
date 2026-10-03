"use client";
import { useMemo, useState } from "react";
import SiteNav from "@/components/layout/SiteNav";
import ChaosButtons from "@/components/sim/ChaosButtons";
import { STATUS_COLOR } from "@/lib/colors";
import { SERVICE_LABEL, healthySeed } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/store/flowguardStore";

type Sev = "critical" | "degraded" | "recovered";
interface Alert { id: string; when: string; service: string; sev: Sev; title: string; detail: string; impact: string; action: string; live?: boolean }

const BASELINE = healthySeed().nodes;
const ACTIONS: Record<string, [string, string]> = {
  database: ["Everything downstream waits on it. Checkout is at risk.", "Check query latency and connection limits; confirm timeouts on the edges into Database."],
  inventory: ["Orders cannot confirm stock. The fallback serves cached stock.", "Check the breaker on order → inventory and the Inventory error rate."],
  payment: ["Payments queue up. The pay-later fallback absorbs some of it.", "Check Payment capacity and the order → payment timeout."],
  order: ["Checkout is slower for every customer.", "Look at Order's calls to Inventory and Payment first."],
  gateway: ["Requests are being rejected before they reach Order.", "Check upstream timeouts; restore Order before touching the Gateway."],
  frontend: ["Customers see failed checkouts.", "Follow the cascade path to the origin rather than fixing the Frontend."],
};
const SEED: Alert[] = [
  { id: "s1", when: "14 min ago", service: "Database", sev: "critical", title: "Latency spike detected", detail: "Database response time increased 3.2x above baseline.", impact: ACTIONS.database[0], action: ACTIONS.database[1] },
  { id: "s2", when: "2 h ago", service: "Payment", sev: "degraded", title: "Payment is saturating", detail: "Utilization reached 100% during a 2.0x traffic spike.", impact: ACTIONS.payment[0], action: ACTIONS.payment[1] },
  { id: "s3", when: "Yesterday", service: "Inventory", sev: "recovered", title: "Inventory timeouts cleared", detail: "Response time is back within 1.5x of baseline for 5 consecutive ticks.", impact: "No customer impact. The fallback held.", action: "None needed." },
];
const TABS: ("all" | Sev)[] = ["all", "critical", "degraded", "recovered"];

export default function AlertsPage() {
  const events = useFlowStore((s) => s.events);
  const nodes = useFlowStore((s) => s.nodes);
  const [tab, setTab] = useState<"all" | Sev>("all");

  const live = useMemo<Alert[]>(() => events.map((e) => {
    const n = nodes[e.node], ratio = n ? n.p95_ms / BASELINE[e.node].p95_ms : 1;
    const [impact, action] = ACTIONS[e.node];
    const failing = n && n.error_rate > 0.02;
    return {
      id: `${e.t}-${e.node}`, when: `t+${e.t}s in this simulation`, service: SERVICE_LABEL[e.node], sev: (n?.status === "critical" ? "critical" : "degraded") as Sev, live: true,
      title: failing ? "Requests are failing" : "Latency spike detected",
      detail: failing ? `${SERVICE_LABEL[e.node]} error rate is ${((n?.error_rate ?? 0) * 100).toFixed(0)}%.` : `${SERVICE_LABEL[e.node]} response time is ${ratio.toFixed(1)}x above baseline.`, impact, action,
    };
  }), [events, nodes]);

  const all = [...live, ...SEED];
  const shown = all.filter((a) => tab === "all" || a.sev === tab);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1000px] px-6 pb-24 pt-14 md:px-10">
        <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">Alerts</h1>
        <p className="mt-4 text-[15px] text-mute">What broke, how bad it is, and what to do first.</p>
        <div className="mt-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex gap-1 text-[13px]">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 capitalize transition-colors", tab === t ? "bg-forest text-paper" : "text-mute hover:text-ink")}>
                {t} <span className="num ml-1 text-[11px] opacity-70">{t === "all" ? all.length : all.filter((a) => a.sev === t).length}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-mute">Trigger live alerts <ChaosButtons /></div>
        </div>
        <div className="mt-8">
          {shown.length === 0 && <p className="border-t border-rule py-8 text-[14px] text-mute">Nothing here.</p>}
          {shown.map((a) => (
            <article key={a.id} className="grid gap-x-8 gap-y-3 border-t border-rule py-7 md:grid-cols-[170px_1fr]">
              <div className="text-[12px] text-mute">
                <div className="flex items-center gap-2 text-[13px] font-medium capitalize" style={{ color: a.sev === "recovered" ? STATUS_COLOR.healthy : STATUS_COLOR[a.sev] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: a.sev === "recovered" ? STATUS_COLOR.healthy : STATUS_COLOR[a.sev] }} />{a.sev}
                </div>
                <div className="mt-1">{a.when}</div>
                <div className="mt-0.5 text-ink/70">{a.service}</div>
              </div>
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight">{a.title}</h2>
                <p className="mt-1 text-[14px] text-ink/80">{a.detail}</p>
                <dl className="mt-4 grid gap-4 text-[12.5px] md:grid-cols-2">
                  <div><dt className="text-mute">Impact</dt><dd className="mt-0.5 leading-snug">{a.impact}</dd></div>
                  <div><dt className="text-mute">Recommended action</dt><dd className="mt-0.5 leading-snug">{a.action}</dd></div>
                </dl>
              </div>
            </article>
          ))}
          <div className="border-t border-rule" />
        </div>
      </main>
    </div>
  );
}
