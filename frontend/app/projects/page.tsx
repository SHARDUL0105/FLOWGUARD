"use client";
import Link from "next/link";
import MiniGraph from "@/components/graph/MiniGraph";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { useProjectsStore } from "@/store/projectsStore";

export default function ProjectsPage() {
  const projects = useProjectsStore((s) => s.projects);
  return (
    <div className="min-h-screen bg-paper">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-14 md:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">Projects</h1>
            <p className="mt-4 text-[15px] text-mute">Monitor every system from one place.</p>
          </div>
          <Button href="/projects/connect">+ Connect project</Button>
        </div>
        <div className="mt-16 grid gap-px border border-rule bg-rule md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} className="group bg-paper p-7 transition-colors hover:bg-ivory/60">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-tight">{p.name}</h2>
                  <p className="mt-0.5 text-[12px] text-mute">{p.env}, {p.source}</p>
                </div>
                <div className="text-right"><div className="num text-[44px] font-light leading-none">{p.score}</div><div className="mt-1 text-[11px] text-mute">resilience</div></div>
              </div>
              <div className="my-6 opacity-80 transition-opacity group-hover:opacity-100"><MiniGraph labels={false} particles={false} statuses={p.alerts ? { database: "degraded" } : {}} /></div>
              <dl className="grid grid-cols-3 gap-4 border-t border-rule pt-4 text-[12px]">
                <div><dt className="text-mute">Services</dt><dd className="num mt-0.5 text-[15px]">{p.services}</dd></div>
                <div><dt className="text-mute">Active alerts</dt><dd className={`num mt-0.5 text-[15px] ${p.alerts ? "text-warn" : ""}`}>{p.alerts}</dd></div>
                <div><dt className="text-mute">Last simulation</dt><dd className="mt-0.5 text-[12.5px] leading-tight">{p.lastSim}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
