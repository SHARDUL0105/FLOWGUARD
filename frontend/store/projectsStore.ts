"use client";
import { create } from "zustand";
import { SEED_PROJECTS, slugify } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { api } from "@/lib/api";

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  fetchProjects: () => Promise<void>;
  addProject: (name: string, source: string) => Promise<Project>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: true,
  fetchProjects: async () => {
    set({ loading: true });
    try {
      const data = await api.listProjects();
      if (data && data.length > 0) {
        // Map the backend structure to the frontend Project structure
        const mapped = data.map((d) => ({
          slug: d.project_id,
          name: d.name || "Unnamed Project",
          env: d.environment || "Production-like",
          source: d.source || "System Data",
          score: d.score ?? 84,
          services: d.services ?? 6,
          alerts: d.alerts ?? 0,
          lastSim: d.last_sim || "No simulation yet",
          trend: d.trend || [84, 84, 84, 84, 84, 84, 84],
          sims: d.sims || [],
        }));
        set({ projects: mapped, loading: false });
        return;
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    }
    // Fallback if failed or empty
    set({ projects: SEED_PROJECTS, loading: false });
  },
  addProject: async (name, source) => {
    let slug = slugify(name);
    if (get().projects.some((p) => p.slug === slug)) slug = `${slug}-${get().projects.length + 1}`;
    const p: Project = {
      slug, name, env: "Production-like", source, score: 84, services: 6, alerts: 0, lastSim: "No simulation yet",
      trend: [84, 84, 84, 84, 84, 84, 84], sims: [],
    };
    
    try {
      // Optimistic UI update
      set((s) => ({ projects: [p, ...s.projects] }));
      
      // Save to backend
      await api.createProject({
        project_id: slug,
        name,
        environment: p.env,
        source,
        score: p.score,
        services: p.services,
        alerts: p.alerts,
        last_sim: p.lastSim,
        trend: p.trend,
        sims: p.sims
      });
    } catch (e) {
      console.error("Failed to save project to backend:", e);
    }
    
    return p;
  },
}));
