"use client";
import { useEffect, useState } from "react";
import DemoModeToggle from "./DemoModeToggle";
import { useFlowStore } from "@/store/flowguardStore";
import { useProjectsStore } from "@/store/projectsStore";

/** Command-center header: project selector, title, system status pill, Live/Replay toggle. */
export default function TopBar() {
  const incident = useFlowStore((s) => Object.values(s.nodes).some((n) => n.status !== "healthy"));
  const loadProjectTopology = useFlowStore((s) => s.loadProjectTopology);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const { projects, fetchProjects } = useProjectsStore();
  const [selected, setSelected] = useState<string>("checkout-platform");

  useEffect(() => {
    fetchProjects();
    const handleTenantChange = () => fetchProjects();
    window.addEventListener("fg-tenant-change", handleTenantChange);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange);
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
    loadProjectTopology(id);
  };

  const projectOptions = [
    { value: "checkout-platform", label: "Checkout Platform" },
    ...projects.filter((p) => p.slug !== "checkout-platform").map((p) => ({ value: p.slug, label: p.name })),
  ];

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-3 md:px-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-mute">Project:</span>
          <div className="relative">
            <select
              value={selected}
              onChange={(e) => handleSelect(e.target.value)}
              className="appearance-none glass rounded-full pl-3 pr-7 py-0.5 text-[12px] font-medium cursor-pointer outline-none focus:ring-1 focus:ring-forest"
            >
              {projectOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-mute text-[9px]">▼</span>
          </div>
        </div>
        <h1 className="text-[28px] font-semibold leading-none tracking-tight">Command center</h1>
      </div>
      <div className="flex items-center gap-5">
        <DemoModeToggle />
        <span className={`flex items-center gap-2 text-[12.5px] ${incident ? "text-crit" : "text-ok"}`}>
          <span className={`h-2 w-2 rounded-full ${incident ? "animate-pulse bg-crit" : "bg-ok"}`} />
          {incident ? "Incident in progress" : "All services steady"}
        </span>
      </div>
    </div>
  );
}
