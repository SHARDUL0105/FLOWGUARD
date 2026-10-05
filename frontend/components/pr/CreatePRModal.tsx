"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PRListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Project { slug: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId?: string;
  onCreated: (pr: PRListItem) => void;
}

export default function CreatePRModal({ open, onClose, projects, defaultProjectId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.slug ?? "");
  const [description, setDescription] = useState("");
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form and focus when opened
  useEffect(() => {
    if (open) {
      setTitle(""); setAuthor(""); setDescription(""); setDiff(""); setError("");
      setProjectId(defaultProjectId ?? projects[0]?.slug ?? "");
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open, defaultProjectId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!projectId) { setError("Please select a project."); return; }
    setLoading(true); setError("");
    try {
      const pr = await api.createPR({
        title: title.trim(),
        author: author.trim() || "you",
        project_id: projectId,
        description: description.trim(),
        diff: diff.trim(),
      });
      // api.createPR returns the raw doc; map pr_id → id for PRListItem
      const item: PRListItem = {
        id: (pr as any).pr_id ?? pr.id,
        title: pr.title,
        author: pr.author,
        status: pr.status ?? "open",
        project_id: (pr as any).project_id ?? projectId,
        source: "user",
        description: (pr as any).description,
        diff: (pr as any).diff,
        created_at: (pr as any).created_at,
      };
      onCreated(item);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create PR. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-[560px] glass-strong rounded-2xl p-8 shadow-2xl"
            role="dialog" aria-modal="true" aria-label="Create pull request"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight">New pull request</h2>
                <p className="mt-1 text-[13px] text-mute">FLOWGUARD will replay 3 fault scenarios against it.</p>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-mute hover:text-ink transition-colors" aria-label="Close">✕</button>
            </div>

            <div className="space-y-4">
              {/* Project */}
              <div>
                <label className="block text-[12px] text-mute mb-1">Project</label>
                <div className="relative">
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full appearance-none glass rounded-lg px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-forest cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute text-[10px]">▼</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[12px] text-mute mb-1">PR title <span className="text-crit">*</span></label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Increase payment timeout to 2s"
                  className="w-full glass rounded-lg px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-forest placeholder:text-mute/50"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-[12px] text-mute mb-1">Author</label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="github-username  (default: you)"
                  className="w-full glass rounded-lg px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-forest placeholder:text-mute/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] text-mute mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this change do? (optional)"
                  rows={2}
                  className="w-full glass rounded-lg px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-forest placeholder:text-mute/50 resize-none"
                />
              </div>

              {/* Diff */}
              <div>
                <label className="block text-[12px] text-mute mb-1">Diff / config change <span className="text-mute/50">(optional)</span></label>
                <textarea
                  value={diff}
                  onChange={(e) => setDiff(e.target.value)}
                  placeholder={"--- a/service/config.yaml\n+++ b/service/config.yaml\n@@ ... @@\n- timeout_ms: 500\n+ timeout_ms: 2000"}
                  rows={5}
                  className={cn(
                    "w-full glass rounded-lg px-3 py-2.5 font-mono text-[12px] outline-none focus:ring-1 focus:ring-forest placeholder:text-mute/40 resize-none leading-relaxed",
                  )}
                />
              </div>

              {error && <p className="text-[13px] text-crit">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>
                  {loading ? "Creating…" : "Create PR"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
