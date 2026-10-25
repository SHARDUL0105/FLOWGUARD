"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import MiniGraph from "@/components/graph/MiniGraph";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { useProjectsStore } from "@/store/projectsStore";
import { isPlatformOwner, getTenant } from "@/lib/tenant";
import { Lock, Trash2 } from "lucide-react";
import DeleteProjectModal from "@/components/projects/DeleteProjectModal";
import type { Project } from "@/lib/projects";

export default function ProjectsPage() {
  const { projects, loading, fetchProjects, deleteProject } = useProjectsStore();
  const [mounted, setMounted] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchProjects();
    
    // Also re-fetch when tenant changes
    const handleTenantChange = () => fetchProjects();
    window.addEventListener("fg-tenant-change", handleTenantChange);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange);
  }, []);

  const isSuperAdmin = mounted && isPlatformOwner() && getTenant() === "flowguard";

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete.slug);
    setProjectToDelete(null);
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-14 md:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">Projects</h1>
            <p className="mt-4 text-[15px] text-mute">Monitor and manage tenant microservice systems.</p>
          </div>
          {!isSuperAdmin && <Button href="/projects/connect">+ Connect project</Button>}
        </div>

        {/* Super Admin Restricted View */}
        {isSuperAdmin ? (
          <div className="mt-16 glass rounded-3xl p-10 border border-emerald-500/30 text-center max-w-2xl mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-5">
              <Lock className="h-7 w-7" />
            </div>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-mono text-emerald-400 border border-emerald-500/40 uppercase">
              Zero-Knowledge Boundary Active
            </span>
            <h2 className="mt-4 text-2xl font-bold text-ink">
              Customer Projects are Isolated & Encrypted
            </h2>
            <p className="mt-3 text-xs text-mute leading-relaxed max-w-lg mx-auto">
              FLOWGUARD Super Admins have no permissions to browse, open, or edit tenant proprietary projects or topologies. To inspect platform-level telemetry, quota metrics, and tenant organizations, use Master Control.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/admin" className="rounded-xl bg-forest px-5 py-2.5 text-xs font-bold text-paper hover:bg-forest/90 transition-all">
                Go to Master Control (/admin) →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-16 grid gap-5 md:grid-cols-2">
            {projects.map((p) => (
              <div key={p.slug} className="glass glass-hover group relative rounded-2xl p-7 flex flex-col justify-between">
                <Link href={`/projects/${p.slug}`} className="block">
                  <div className="flex items-start justify-between pr-8">
                    <div>
                      <h2 className="text-[22px] font-semibold tracking-tight group-hover:text-forest transition-colors">{p.name}</h2>
                      <p className="mt-0.5 text-[12px] text-mute">{p.env}, {p.source}</p>
                    </div>
                    <div className="text-right">
                      <div className="num text-[44px] font-light leading-none">{p.score}</div>
                      <div className="mt-1 text-[11px] text-mute">resilience</div>
                    </div>
                  </div>
                  <div className="my-6 opacity-80 transition-opacity group-hover:opacity-100">
                    <MiniGraph labels={false} particles={false} statuses={p.alerts ? { database: "degraded" } : {}} />
                  </div>
                </Link>

                {/* Delete button positioned nicely */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setProjectToDelete(p);
                  }}
                  title={`Delete ${p.name}`}
                  className="absolute right-5 top-5 p-2 rounded-xl text-mute/50 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <dl className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-4 text-[12px]">
                  <div>
                    <dt className="text-mute">Services</dt>
                    <dd className="num mt-0.5 text-[15px]">{p.services}</dd>
                  </div>
                  <div>
                    <dt className="text-mute">Active alerts</dt>
                    <dd className={`num mt-0.5 text-[15px] ${p.alerts ? "text-warn" : ""}`}>{p.alerts}</dd>
                  </div>
                  <div>
                    <dt className="text-mute">Last simulation</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-tight">{p.lastSim}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal with "delete <project_name>" gate */}
      <DeleteProjectModal
        isOpen={Boolean(projectToDelete)}
        projectName={projectToDelete?.name || ""}
        projectSlug={projectToDelete?.slug || ""}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
