"use client";
import { create } from "zustand";
import { SEED_PROJECTS, slugify } from "@/lib/projects";
import type { Project } from "@/lib/projects";

interface ProjectsState {
  projects: Project[];
  addProject: (name: string, source: string) => Project;
}

// In-memory for the prototype; a real backend would own this list.
export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: SEED_PROJECTS,
  addProject: (name, source) => {
    let slug = slugify(name);
    if (get().projects.some((p) => p.slug === slug)) slug = `${slug}-${get().projects.length + 1}`;
    const p: Project = {
      slug, name, env: "Production-like", source, score: 84, services: 6, alerts: 0, lastSim: "No simulation yet",
      trend: [84, 84, 84, 84, 84, 84, 84], sims: [],
    };
    set((s) => ({ projects: [p, ...s.projects] }));
    return p;
  },
}));
