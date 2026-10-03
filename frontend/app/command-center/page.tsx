"use client";
import Link from "next/link";
import { CascadePath, IncidentCommander, ResilienceScore, RootCause } from "@/components/command-center/Panels";
import FlowGraph from "@/components/graph/FlowGraph";
import SiteNav from "@/components/layout/SiteNav";
import StatusTicker from "@/components/layout/StatusTicker";
import ChaosButtons from "@/components/sim/ChaosButtons";
import { useFlowStore } from "@/store/flowguardStore";

export default function CommandCenter() {
  const incident = useFlowStore((s) => Object.values(s.nodes).some((n) => n.status !== "healthy"));
  return (
    <div className="flex h-screen flex-col">
      <SiteNav />
      <div className="flex items-end justify-between px-6 pb-3 md:px-10">
        <div>
          <p className="text-[12px] text-mute">Checkout Platform</p>
          <h1 className="text-[28px] font-semibold leading-none tracking-tight">Command center</h1>
        </div>
        <span className={`flex items-center gap-2 text-[12.5px] ${incident ? "text-crit" : "text-ok"}`}>
          <span className={`h-2 w-2 rounded-full ${incident ? "animate-pulse bg-crit" : "bg-ok"}`} />
          {incident ? "Incident in progress" : "All services steady"}
        </span>
      </div>
      <main className="grid min-h-0 flex-1 gap-0 border-t border-rule md:grid-cols-[68fr_32fr]">
        <section className="glass relative min-h-[360px] rounded-none border-y-0 border-l-0"><FlowGraph /></section>
        <aside className="min-h-0 overflow-y-auto bg-surface/20 px-6 pb-4 backdrop-blur-sm">
          <ResilienceScore />
          <RootCause />
          <CascadePath />
          <IncidentCommander />
        </aside>
      </main>
      <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-none border-x-0 border-b-0 px-6 py-3 md:px-10">
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-mute">Chaos lab</span>
          <ChaosButtons hotkeys />
        </div>
        <Link href="/simulations" className="text-[12.5px] text-forest underline underline-offset-4">Open what-if simulator</Link>
      </div>
      <StatusTicker />
    </div>
  );
}
