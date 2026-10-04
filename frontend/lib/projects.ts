import { RUNS } from "./fixtures";

export interface Project {
  slug: string; name: string; env: string; source: string;
  score: number; services: number; alerts: number; lastSim: string;
  trend: number[]; sims: { name: string; when: string; result: string }[];
}

// Demo workspace. Scores for the first project come straight from the recorded engine run.
export const SEED_PROJECTS: Project[] = [
  {
    slug: "checkout-platform", name: "Checkout Platform", env: "Production-like", source: "Simulated environment",
    score: RUNS.base.score, services: 6, alerts: 2, lastSim: "Database slowdown, 14 min ago",
    trend: [78, 80, 79, 83, 82, 84, 84],
    sims: [
      { name: "Database slowdown (3.0x)", when: "14 min ago", result: "p95 628 ms, 0.4% errors" },
      { name: "Traffic spike (2.0x)", when: "2 h ago", result: "p95 2018 ms, 2.8% errors" },
      { name: "Inventory down", when: "Yesterday", result: "Fallback held, 0% errors" },
    ],
  },
  {
    slug: "payments-api", name: "Payments API", env: "Staging", source: "Demo data",
    score: 71, services: 4, alerts: 1, lastSim: "Traffic spike, yesterday",
    trend: [64, 66, 69, 68, 70, 71, 71],
    sims: [{ name: "Traffic spike (2.0x)", when: "Yesterday", result: "Payment saturates at 1.8x" }],
  },
  {
    slug: "e-commerce-platform", name: "E-Commerce Platform", env: "Production-like", source: "Demo data",
    score: 90, services: 9, alerts: 0, lastSim: "Inventory down, 3 days ago",
    trend: [86, 87, 88, 88, 89, 90, 90],
    sims: [{ name: "Inventory down", when: "3 days ago", result: "Fallback held, 0% errors" }],
  },
];

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
