"use client";

import Link from "next/link";
import SiteNav from "@/components/layout/SiteNav";
import { BookOpen, ExternalLink, ShieldCheck, Zap, Cpu, GitPullRequest, Database, Server, ChevronRight, Terminal, Layers } from "lucide-react";

export default function DocsPage() {
  const apiEndpoints = [
    { method: "GET", path: "/api/topology", desc: "Retrieve live service nodes, latency metrics, and dependency edges.", category: "Telemetry" },
    { method: "GET", path: "/api/health", desc: "Check backend operational status and current engine mode (live/replay).", category: "Telemetry" },
    { method: "POST", path: "/api/chaos", desc: "Inject fault scenario (db_latency, service_down, traffic_spike) with severity factor.", category: "Simulation" },
    { method: "POST", path: "/api/reset", desc: "Clear active faults and restore steady-state telemetry across graph.", category: "Simulation" },
    { method: "POST", path: "/api/whatif", desc: "Run predictive what-if simulator to forecast failure propagation blast radius.", category: "Intelligence" },
    { method: "GET", path: "/api/pr", desc: "List pull requests queued for predictive reliability analysis.", category: "Self-Healing" },
    { method: "POST", path: "/api/pr/{id}/analyze", desc: "Perform static & dependency analysis on PR to score systemic risk.", category: "Self-Healing" },
    { method: "POST", path: "/api/pr/{id}/heal", desc: "Generate automated code fix & patch to mitigate detected risk.", category: "Self-Healing" },
    { method: "GET", path: "/api/db/status", desc: "Verify connection status and latency to MongoDB Atlas cluster.", category: "Persistence" },
    { method: "GET", path: "/api/tenants", desc: "List available organization tenants for multi-tenant isolation.", category: "Persistence" },
  ];

  return (
    <div className="min-h-screen bg-[#070b09] text-paper font-sans selection:bg-forest selection:text-white">
      <SiteNav />

      <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        {/* Header Hero */}
        <div className="mb-12 border-b border-white/10 pb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-forest/40 bg-forest/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <BookOpen className="h-3.5 w-3.5" />
            <span>FLOWGUARD Documentation</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Predictive System Reliability Engine
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/70 leading-relaxed">
            Welcome to the official FLOWGUARD documentation. FLOWGUARD models microservice failure propagation,
            forecasts systemic blast radius, and provides automated pull-request self-healing before code hits production.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-emerald-600"
            >
              <span>Open Swagger API Docs</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/command-center"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/10"
            >
              <span>Launch Command Center</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Section 1: Core Architecture */}
        <div className="mb-16">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="h-4 w-4" />
            </div>
            <h2 className="text-2xl font-bold text-white">System Architecture & Service Graph</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Cpu className="h-6 w-6 text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-2">1. Telemetry Topology Graph</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Visualizes live service nodes (<span className="text-emerald-300 font-mono">Frontend → Gateway → Order → Inventory/Payment → Database</span>) with p95 latency tracking and hop dependency edges.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Zap className="h-6 w-6 text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-2">2. Chaos & What-If Simulator</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Injects controlled failure scenarios (database slowdown, service downtime, traffic spikes) to evaluate upstream cascade paths and compute resilience scores.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <GitPullRequest className="h-6 w-6 text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-white mb-2">3. Automated PR Healing</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Analyzes inbound GitHub/GitLab pull requests for architectural risk, generates automated resilience patches, and verifies fixes before deployment.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: REST API Reference */}
        <div className="mb-16">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Terminal className="h-4 w-4" />
              </div>
              <h2 className="text-2xl font-bold text-white">FastAPI REST Endpoints</h2>
            </div>
            <span className="text-xs text-white/50">Base URL: <code className="text-emerald-400">http://localhost:8000</code></span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="divide-y divide-white/10">
              {apiEndpoints.map((ep, idx) => (
                <div key={idx} className="p-4 transition-colors hover:bg-white/5 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    <span
                      className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${
                        ep.method === "GET"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm font-semibold text-white">{ep.path}</code>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="text-xs text-white/70">{ep.desc}</p>
                    <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/60 md:inline">
                      {ep.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Multi-Tenant & Database Persistence */}
        <div className="mb-12 rounded-3xl border border-forest/40 bg-gradient-to-br from-forest/20 via-transparent to-teal-950/30 p-8 backdrop-blur">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">Multi-Tenant Isolation & MongoDB Atlas Integration</h3>
          </div>
          <p className="text-xs text-white/70 leading-relaxed max-w-3xl mb-4">
            FLOWGUARD uses a single-database multi-tenant pattern with tenant-scoped query security. Every read and write payload automatically attaches tenant headers (<code className="text-emerald-300">X-Tenant-ID</code>) and creates optimized compound indexes in MongoDB Atlas (<code className="text-emerald-300">tenant_id + project_id + created_at</code>).
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>MongoDB Atlas Status: Connected & Health Checked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
