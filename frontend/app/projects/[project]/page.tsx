"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CustomTopologyPreview from "@/components/graph/CustomTopologyPreview";
import MiniGraph from "@/components/graph/MiniGraph";
import SiteNav from "@/components/layout/SiteNav";
import { Trend } from "@/components/projects/Trend";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useProjectsStore } from "@/store/projectsStore";

export default function ProjectOverview() {
  const { project } = useParams<{ project: string }>();
  const { projects, loading, fetchProjects } = useProjectsStore();
  const p = projects.find((x) => x.slug === project);
  const [customTopology, setCustomTopology] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [topoLoading, setTopoLoading] = useState(true);

  useEffect(() => {
    fetchProjects();

    // Re-fetch when tenant changes
    const handleTenantChange = () => fetchProjects();
    window.addEventListener("fg-tenant-change", handleTenantChange);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange);
  }, []);

  // Load custom topology for this project
  useEffect(() => {
    if (!project) return;
    setTopoLoading(true);
    api.getTopology(project)
      .then(t => { setCustomTopology(t && t.nodes?.length ? t : null); })
      .catch(() => setCustomTopology(null))
      .finally(() => setTopoLoading(false));
  }, [project]);

  if (loading && !p) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen"><SiteNav />
        <main className="mx-auto max-w-[1200px] px-6 py-24 md:px-10">
          <h1 className="text-[40px] font-light tracking-tight">Project not found</h1>
          <p className="mt-3 max-w-[460px] text-[14px] text-mute">The project you're looking for doesn't exist in the current organization.</p>
          <Button href="/projects" className="mt-8">Back to projects</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-12 md:px-10">
        <Link href="/projects" className="text-[12.5px] text-mute hover:text-forest">← All projects</Link>
        <div className="mt-6 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h1 className="text-[clamp(40px,6vw,84px)] font-light leading-none tracking-tight">{p.name}</h1>
            <p className="mt-3 text-[13px] text-mute">{p.env}, {p.source}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/command-center">Open Command Center</Button>
            <Button href="/simulations" variant="outline">Run Simulation</Button>
            <Button href={`/projects/${project}/topology`} variant="outline">Edit Topology</Button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {[["Resilience score", String(p.score)], ["Services", String(p.services)], ["Current alerts", String(p.alerts)], ["Last simulation", p.lastSim]].map(([k, v], i) => (
            <div key={k} className="glass rounded-2xl p-6">
              <div className="text-[12px] text-mute">{k}</div>
              <div className={i === 3 ? "mt-2 text-[15px] leading-snug" : "num mt-1 text-[48px] font-light leading-none"}>{v}</div>
            </div>
          ))}
        </div>

        {/* Topology section — shows custom topology if saved, otherwise default MiniGraph */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-semibold">Dependency graph</h2>
              {customTopology && (
                <span className="rounded-full border border-forest/30 bg-mint/50 px-2 py-0.5 text-[10px] font-medium text-forest">
                  Custom · {customTopology.nodes.length} nodes
                </span>
              )}
            </div>
            <Link href={`/projects/${project}/topology`} className="text-[12px] text-forest underline underline-offset-4">
              {customTopology ? "Edit topology →" : "Build topology →"}
            </Link>
          </div>

          <div className="border-y border-rule py-8">
            {topoLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              </div>
            ) : customTopology ? (
              <CustomTopologyPreview nodes={customTopology.nodes} edges={customTopology.edges} />
            ) : (
              <div>
                <MiniGraph statuses={p.alerts ? { database: "degraded" } : {}} />
                <p className="mt-4 text-center text-[12px] text-mute">
                  Showing default checkout topology.{" "}
                  <Link href={`/projects/${project}/topology`} className="text-forest underline underline-offset-2">
                    Build a custom topology for this project →
                  </Link>
                </p>
              </div>
            )}
          </div>
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
