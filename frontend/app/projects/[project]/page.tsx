"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import MiniGraph from "@/components/graph/MiniGraph";
import SiteNav from "@/components/layout/SiteNav";
import { Trend } from "@/components/projects/Trend";
import { Button } from "@/components/ui/button";
import { useProjectsStore } from "@/store/projectsStore";

export default function ProjectOverview() {
  const { project } = useParams<{ project: string }>();
  const p = useProjectsStore((s) => s.projects.find((x) => x.slug === project));

  if (!p) {
    return (
      <div className="min-h-screen bg-paper"><SiteNav />
        <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10">
          <h1 className="text-[40px] font-light tracking-tight">Project not found</h1>
          <p className="mt-3 max-w-[460px] text-[14px] text-mute">Projects live in memory in this prototype, so a page refresh clears any you connected.</p>
          <Button href="/projects" className="mt-8">Back to projects</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-12 md:px-10">
        <Link href="/projects" className="text-[12.5px] text-mute hover:text-forest">All projects</Link>
        <div className="mt-6 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h1 className="text-[clamp(40px,6vw,84px)] font-light leading-none tracking-tight">{p.name}</h1>
            <p className="mt-3 text-[13px] text-mute">{p.env}, {p.source}</p>
          </div>
          <div className="flex gap-3"><Button href="/command-center">Open Command Center</Button><Button href="/simulations" variant="outline">Run Simulation</Button></div>
        </div>

        <div className="mt-14 grid gap-px border border-rule bg-rule md:grid-cols-4">
          {[["Resilience score", String(p.score)], ["Services", String(p.services)], ["Current alerts", String(p.alerts)], ["Last simulation", p.lastSim]].map(([k, v], i) => (
            <div key={k} className="bg-paper p-6">
              <div className="text-[12px] text-mute">{k}</div>
              <div className={i === 3 ? "mt-2 text-[15px] leading-snug" : "num mt-1 text-[48px] font-light leading-none"}>{v}</div>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="text-[13px] font-semibold">Dependency graph</h2>
          <div className="mt-4 border-y border-rule py-8"><MiniGraph statuses={p.alerts ? { database: "degraded" } : {}} /></div>
        </section>

        <div className="mt-16 grid gap-14 md:grid-cols-2">
          <section>
            <h2 className="text-[13px] font-semibold">Reliability trend</h2>
            <p className="mb-2 text-[12px] text-mute">Resilience score, last 7 days</p>
            <Trend values={p.trend} />
          </section>
          <section>
            <h2 className="text-[13px] font-semibold">Recent simulations</h2>
            <div className="mt-3">
              {p.sims.length === 0 && <p className="border-t border-rule py-4 text-[13px] text-mute">None yet. Run one to get a baseline.</p>}
              {p.sims.map((s) => (
                <div key={s.name} className="grid grid-cols-[1fr_auto] gap-4 border-t border-rule py-4 text-[13px]">
                  <div><div className="font-medium">{s.name}</div><div className="mt-0.5 text-mute">{s.result}</div></div>
                  <div className="text-[12px] text-mute">{s.when}</div>
                </div>
              ))}
              <div className="border-t border-rule" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
