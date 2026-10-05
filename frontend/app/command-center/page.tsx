"use client";
import Link from "next/link";
import { ResilienceScore } from "@/components/command-center/Panels";
import CascadePath from "@/components/incident/CascadePath";
import IncidentCommander from "@/components/incident/IncidentCommander";
import RootCauseRadar from "@/components/incident/RootCauseRadar";
import WhatIfSlider from "@/components/sim/WhatIfSlider";
import TopBar from "@/components/layout/TopBar";
import FlowGraph from "@/components/graph/FlowGraph";
import SiteNav from "@/components/layout/SiteNav";
import StatusTicker from "@/components/layout/StatusTicker";
import ChaosButtons from "@/components/sim/ChaosButtons";

export default function CommandCenter() {
  return (
    <div className="flex h-screen flex-col">
      <SiteNav />
      <TopBar />
      <main className="grid min-h-0 flex-1 gap-0 border-t border-rule md:grid-cols-[68fr_32fr]">
        <section className="glass relative min-h-[360px] rounded-none border-y-0 border-l-0"><FlowGraph /></section>
        <aside className="min-h-0 overflow-y-auto bg-surface/20 px-6 pb-4 backdrop-blur-sm">
          <ResilienceScore />
          <RootCauseRadar />
          <CascadePath />
          <IncidentCommander />
          <WhatIfSlider />
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
