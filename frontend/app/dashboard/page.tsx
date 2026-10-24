"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { getTenant, getTenantInfo, getUserEmail, getUserRole, getCompanyUsers, UserProfile } from "@/lib/tenant";
import { useProjectsStore } from "@/store/projectsStore";
import { 
  Building, 
  Users, 
  FolderGit2, 
  ShieldCheck, 
  Plus, 
  Activity, 
  Mail, 
  UserCheck, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import MiniGraph from "@/components/graph/MiniGraph";
import NumberTicker from "@/components/effects/NumberTicker";

export default function UserDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [tenantId, setTenantId] = useState("demo");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"company_admin" | "company_engineer">("company_engineer");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const { projects, fetchProjects } = useProjectsStore();

  useEffect(() => {
    setMounted(true);
    const t = getTenant();
    setTenantId(t);
    setUserEmail(getUserEmail());
    setUsers(getCompanyUsers(t));
    fetchProjects();

    const handleTenantChange = (e: CustomEvent) => {
      const newTenant = e.detail?.tenantId || getTenant();
      setTenantId(newTenant);
      setUserEmail(e.detail?.email !== undefined ? e.detail.email : getUserEmail());
      setUsers(getCompanyUsers(newTenant));
      fetchProjects();
    };

    window.addEventListener("fg-tenant-change", handleTenantChange as EventListener);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange as EventListener);
  }, []);

  const info = getTenantInfo(tenantId);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const newUser: UserProfile = {
      id: `u-${Date.now()}`,
      name: inviteEmail.split("@")[0].replace(/[._]/g, " "),
      email: inviteEmail,
      role: inviteRole,
      tenant_id: tenantId,
      lastActive: "Invited",
    };
    setUsers([newUser, ...users]);
    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setInviteEmail("");
      setInviteOpen(false);
    }, 1200);
  };

  const avgResilience = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.score || 84), 0) / projects.length)
    : info.healthScore || 84;

  const totalAlerts = projects.reduce((acc, p) => acc + (p.alerts || 0), 0);

  return (
    <div className="min-h-screen pb-24">
      <SiteNav />

      <main className="mx-auto max-w-[1240px] px-6 pt-8 md:px-10">
        {/* Company Header Banner */}
        <div className="glass rounded-3xl p-8 mb-10 border border-white/10 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-forest/15 blur-3xl" />
          
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/20 text-forest border border-forest/30">
                  <Building className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-ink">{info.name}</h1>
                    <span className="rounded-full border border-forest/40 bg-forest/10 px-2.5 py-0.5 text-xs font-semibold uppercase text-forest">
                      {info.plan} Tier
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mute">
                    Tenant ID: <code className="text-ink font-mono">{tenantId}</code> · Logged in as:{" "}
                    <span className="text-ink font-medium">{userEmail || "Engineer"}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button href="/projects/connect">+ Register Microservice</Button>
              <Button href="/command-center" variant="outline">
                <Activity className="h-4 w-4 mr-2 text-forest" />
                Live Command Center
              </Button>
            </div>
          </div>

          {/* Quick KPI Strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-rule pt-6 sm:grid-cols-4">
            <div className="glass rounded-2xl p-4">
              <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Resilience Average</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="num text-3xl font-light text-forest">
                  <NumberTicker value={avgResilience} />
                </span>
                <span className="text-[11px] text-mute">/ 100</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Managed Services</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="num text-3xl font-light text-ink">
                  <NumberTicker value={projects.reduce((acc, p) => acc + (p.services || 6), 0)} />
                </span>
                <span className="text-[11px] text-mute">nodes</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Active Alerts</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`num text-3xl font-light ${totalAlerts > 0 ? "text-warn" : "text-forest"}`}>
                  <NumberTicker value={totalAlerts} />
                </span>
                <span className="text-[11px] text-mute">anomalies</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Simulation Quota</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="num text-3xl font-light text-ink">
                  <NumberTicker value={info.simulationsCount || 42} />
                </span>
                <span className="text-[11px] text-mute">/ 500 mo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Projects & Team Management */}
        <div className="grid gap-10 lg:grid-cols-[65fr_35fr]">
          {/* Left Column: Projects Hub */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-forest" />
                <h2 className="text-xl font-bold tracking-tight">Active Microservices & Architectures</h2>
              </div>
              <Link href="/projects" className="text-xs text-forest hover:underline">
                View all ({projects.length}) →
              </Link>
            </div>

            <div className="space-y-4">
              {projects.map((p) => (
                <div key={p.slug} className="glass rounded-2xl p-6 border border-rule transition-all hover:border-forest/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/projects/${p.slug}`} className="text-lg font-semibold text-ink hover:text-forest transition-colors">
                          {p.name}
                        </Link>
                        <span className="rounded bg-surface/60 px-2 py-0.5 text-[10px] text-mute border border-rule">
                          {p.env}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-mute">{p.source}</p>
                    </div>

                    <div className="text-right">
                      <div className="num text-2xl font-light text-forest">{p.score}</div>
                      <div className="text-[10px] text-mute">resilience</div>
                    </div>
                  </div>

                  <div className="my-4 h-24 overflow-hidden rounded-xl bg-surface/30 p-2">
                    <MiniGraph labels={false} particles={false} statuses={p.alerts ? { database: "degraded" } : {}} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 text-xs">
                    <div className="text-mute">
                      Last simulation: <span className="text-ink font-medium">{p.lastSim}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/projects/${p.slug}/topology`} className="text-forest hover:underline">
                        Edit Topology
                      </Link>
                      <span className="text-mute">·</span>
                      <Link href="/simulations" className="text-ink hover:text-forest">
                        Run Fault Test
                      </Link>
                      <span className="text-mute">·</span>
                      <Link href={`/projects/${p.slug}`} className="text-ink font-medium hover:text-forest">
                        Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Team Governance & Organization Roster */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-forest" />
                <h2 className="text-xl font-bold tracking-tight">Team Members</h2>
              </div>
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-forest/30 bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Invite
              </button>
            </div>

            {/* Invite Modal / Expandable Card */}
            {inviteOpen && (
              <form onSubmit={handleInviteSubmit} className="glass rounded-2xl p-5 mb-5 border border-forest/40 bg-forest/5 animate-in fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-forest">Invite Engineer to {info.name}</h4>
                  <button type="button" onClick={() => setInviteOpen(false)} className="text-xs text-mute hover:text-ink">Cancel</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-mute block mb-1">Company Email</label>
                    <input
                      type="email"
                      required
                      placeholder="engineer@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full rounded-lg glass border border-rule px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-forest text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-mute block mb-1">Role Permission</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full rounded-lg glass border border-rule px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-forest text-ink"
                    >
                      <option value="company_engineer">Engineer (Run Tests, Simulate, Edit Topology)</option>
                      <option value="company_admin">Admin (Manage Team, Billing, Projects)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-forest py-2 text-xs font-semibold text-paper hover:bg-emerald-600 transition-colors"
                  >
                    {inviteSuccess ? "✓ Invitation Sent!" : "Send Invite"}
                  </button>
                </div>
              </form>
            )}

            {/* User List Table */}
            <div className="glass rounded-2xl border border-rule overflow-hidden">
              <div className="divide-y divide-rule">
                {users.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/15 text-forest font-semibold text-xs border border-forest/20">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-ink">{u.name}</div>
                        <div className="text-[11px] text-mute">{u.email}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                        u.role === "company_admin" ? "bg-amber-500/15 text-amber-500 border border-amber-500/30" : "bg-forest/15 text-forest border border-forest/30"
                      }`}>
                        {u.role === "company_admin" ? "Admin" : "Engineer"}
                      </span>
                      <div className="text-[10px] text-mute mt-0.5">{u.lastActive}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick SRE Guide Card */}
            <div className="glass rounded-2xl p-5 mt-6 border border-rule">
              <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-forest" />
                Reliability Best Practice
              </h4>
              <p className="mt-2 text-xs text-mute leading-relaxed">
                Connect your GitHub repository in CI/CD to automatically run FLOWGUARD resilience scans against every Pull Request before deploying to {info.name}.
              </p>
              <Link href="/docs" className="mt-3 inline-flex items-center gap-1 text-xs text-forest hover:underline">
                <span>View CI/CD documentation</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
