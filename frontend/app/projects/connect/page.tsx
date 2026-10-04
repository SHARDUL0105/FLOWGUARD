"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectsStore } from "@/store/projectsStore";

const OPTIONS = [
  { id: "github", title: "Connect GitHub repository", hint: "Reads service configs and timeouts from your repo." },
  { id: "config", title: "Upload configuration", hint: "A YAML or JSON file describing timeouts, retries and breakers." },
  { id: "map", title: "Import service map", hint: "A list of services and who calls whom." },
  { id: "demo", title: "Use demo project", hint: "The six-service checkout system used throughout FLOWGUARD." },
] as const;
type OptId = (typeof OPTIONS)[number]["id"];

const STAGES = ["Connecting", "Discovering services", "Building dependency graph", "Calibrating baseline", "FLOWGUARD ready"];

export default function ConnectPage() {
  const router = useRouter();
  const addProject = useProjectsStore((s) => s.addProject);
  const [opt, setOpt] = useState<OptId>("demo");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [file, setFile] = useState("");
  const [stage, setStage] = useState(-1);
  const [slug, setSlug] = useState<string | null>(null);

  const running = stage >= 0;
  useEffect(() => {
    if (!running || stage >= STAGES.length - 1) return;
    const id = setTimeout(() => setStage((s) => s + 1), 1100);
    return () => clearTimeout(id);
  }, [stage, running]);

  const start = () => {
    const label = name.trim() || (opt === "github" && repo.trim() ? repo.trim().split("/").pop() || "Imported project" : opt === "demo" ? "Demo checkout" : "Imported project");
    const src = opt === "github" ? `GitHub: ${repo || "repository"}` : opt === "config" ? `Config: ${file || "file"}` : opt === "map" ? "Service map" : "Demo data";
    setSlug(addProject(label, src).slug);
    setStage(0);
  };
  const ready = stage === STAGES.length - 1;
  const canStart = opt === "demo" || opt === "map" || (opt === "github" && repo.trim().length > 3) || (opt === "config" && file);

  return (
    <div className="min-h-screen bg-paper">
      <SiteNav />
      <main className="mx-auto grid max-w-[1200px] gap-16 px-6 pb-24 pt-14 md:grid-cols-[5fr_6fr] md:px-10">
        <div>
          <h1 className="text-[clamp(40px,6vw,80px)] font-light leading-none tracking-tight">Connect a project</h1>
          <p className="mt-5 max-w-[420px] text-[14px] leading-relaxed text-mute">Bring a system in and FLOWGUARD maps its services, builds the dependency graph and learns what normal looks like.</p>
          <p className="mt-6 max-w-[420px] border-l-2 border-warn pl-3 text-[12px] leading-relaxed text-mute">Prototype note: discovery runs on the demo topology for every option. Real import needs the backend and OpenTelemetry traces.</p>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {!running ? (
              <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <div role="radiogroup" aria-label="Import method">
                  {OPTIONS.map((o) => (
                    <button key={o.id} role="radio" aria-checked={opt === o.id} onClick={() => setOpt(o.id)} className={cn("block w-full border-t border-rule py-5 text-left transition-colors", opt === o.id ? "bg-ivory/60" : "hover:bg-ivory/30")}>
                      <div className="flex items-center justify-between px-1"><span className="text-[17px] font-semibold tracking-tight">{o.title}</span><span className={cn("h-3 w-3 rounded-full border", opt === o.id ? "border-forest bg-forest" : "border-ink/30")} /></div>
                      <p className="mt-1 px-1 text-[12.5px] text-mute">{o.hint}</p>
                    </button>
                  ))}
                  <div className="border-t border-rule" />
                </div>
                <div className="mt-6 space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name (optional)" className="w-full border-b border-ink/20 bg-transparent py-2 text-[14px] outline-none placeholder:text-mute/70 focus:border-forest" />
                  {opt === "github" && <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="github.com/acme/checkout" className="w-full border-b border-ink/20 bg-transparent py-2 text-[14px] outline-none placeholder:text-mute/70 focus:border-forest" />}
                  {opt === "config" && (
                    <label className="block cursor-pointer border border-dashed border-ink/25 p-4 text-[13px] text-mute hover:border-forest">
                      {file || "Choose a .yaml or .json file"}
                      <input type="file" accept=".yaml,.yml,.json" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
                    </label>
                  )}
                </div>
                <Button onClick={start} disabled={!canStart} className="mt-8">Connect</Button>
              </motion.div>
            ) : (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <ol>
                  {STAGES.map((s, i) => {
                    const done = i < stage || ready, active = i === stage && !ready;
                    return (
                      <li key={s} className="flex items-center gap-4 border-t border-rule py-5">
                        <span className="relative flex h-3 w-3 items-center justify-center">
                          <span className={cn("h-2.5 w-2.5 rounded-full border transition-colors duration-500", done ? "border-forest bg-forest" : active ? "border-forest" : "border-ink/20")} />
                          {active && <span className="absolute h-2.5 w-2.5 animate-ping rounded-full border border-forest" />}
                        </span>
                        <span className={cn("text-[19px] tracking-tight transition-opacity duration-500", i <= stage ? "opacity-100" : "opacity-30", i === STAGES.length - 1 && ready && "font-semibold text-forest")}>{s}</span>
                      </li>
                    );
                  })}
                  <li className="border-t border-rule" />
                </ol>
                {ready && slug && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="mt-8 flex gap-3">
                    <Button onClick={() => router.push(`/projects/${slug}`)}>Open project</Button>
                    <Button href="/projects" variant="outline">All projects</Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
