"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/layout/SiteNav";
import AdminSignInModal from "@/components/auth/AdminSignInModal";
import { api } from "@/lib/api";
import {
  KNOWN_TENANTS,
  TenantInfo,
  getCompanyUsers,
  UserProfile,
  setTenant,
  isPlatformOwner,
  getUserEmail,
  getUserName,
  TEAM_CODEX_SUPER_ADMINS,
} from "@/lib/tenant";
import { 
  ShieldAlert, 
  Building2, 
  Users, 
  Server, 
  Cpu, 
  Activity, 
  ExternalLink, 
  Search, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  X,
  Layers,
  Sparkles,
  Lock,
  KeyRound,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import NumberTicker from "@/components/effects/NumberTicker";

export default function PlatformOwnerAdminPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [tenants, setTenants] = useState<TenantInfo[]>(KNOWN_TENANTS);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [inspectUsers, setInspectUsers] = useState<UserProfile[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeGrants, setActiveGrants] = useState<Record<string, { expires_at: number; remaining_seconds: number }>>({});
  const [emergencySession, setEmergencySession] = useState<{
    tenant: TenantInfo;
    projects: any[];
    loading: boolean;
    error?: string;
  } | null>(null);

  const fetchGrants = async () => {
    try {
      const res = await api.listActiveGrants();
      if (res && res.grants) {
        setActiveGrants(res.grants);
      } else {
        setActiveGrants({});
      }
    } catch {
      setActiveGrants({});
    }
  };

  useEffect(() => {
    fetchGrants();
    const interval = setInterval(fetchGrants, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenEmergencySession = async (t: TenantInfo) => {
    setEmergencySession({ tenant: t, projects: [], loading: true });
    try {
      const projs = await api.listProjects(t.tenant_id);
      setEmergencySession({ tenant: t, projects: projs, loading: false });
    } catch (err: any) {
      setEmergencySession({
        tenant: t,
        projects: [],
        loading: false,
        error: err?.message || "Failed to load tenant projects.",
      });
    }
  };

  const checkAuth = () => {
    const authorized = isPlatformOwner();
    setIsAuthorized(authorized);
    setCurrentUser(getUserName() || getUserEmail() || "");
  };

  useEffect(() => {
    setMounted(true);
    checkAuth();
    window.addEventListener("fg-tenant-change", checkAuth);
    return () => window.removeEventListener("fg-tenant-change", checkAuth);
  }, []);

  const handleInspect = (t: TenantInfo) => {
    setSelectedTenant(t);
    setInspectUsers(getCompanyUsers(t.tenant_id));
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.tenant_id.toLowerCase().includes(search.toLowerCase())
  );

  const totalCompanies = tenants.length;
  const totalServices = tenants.reduce((acc, t) => acc + (t.servicesCount || 6), 0);
  const totalSimulations = tenants.reduce((acc, t) => acc + (t.simulationsCount || 20), 0);
  const avgHealth = Math.round(tenants.reduce((acc, t) => acc + (t.healthScore || 84), 0) / tenants.length);

  if (!mounted) {
    return (
      <div className="min-h-screen pb-28">
        <SiteNav />
        <main className="mx-auto max-w-[1240px] px-6 pt-16 md:px-10 flex flex-col items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-3 text-mute text-xs glass rounded-2xl px-6 py-4 border border-rule">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span>Validating Code Apex cryptographic clearance...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <SiteNav />

      <main className="mx-auto max-w-[1240px] px-6 pt-8 md:px-10">
        {/* If user is NOT one of the 4 Super Admins, show Access Denied Security Gate */}
        {!isAuthorized ? (
          <div className="glass rounded-3xl p-10 border border-amber-500/30 text-center max-w-2xl mx-auto my-12 bg-gradient-to-b from-amber-500/10 to-surface/40">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-6">
              <Lock className="h-8 w-8" />
            </div>
            
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-mono text-amber-300 border border-amber-500/40 uppercase">
              RBAC Policy 403 Forbidden
            </span>

            <h1 className="mt-4 text-2xl font-extrabold text-ink sm:text-3xl">
              Super Admin Clearance Required
            </h1>
            
            <p className="mt-3 text-sm text-mute leading-relaxed">
              Master Control is cryptographically locked. Super Admin governance is strictly restricted to the 
              <strong className="text-amber-400"> 4 official members of Team CodeX (Code Apex 2026)</strong>.
            </p>

            {/* List of 4 authorized team members */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80 mb-3">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                Only the following 4 personas hold Platform Owner clearance:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {TEAM_CODEX_SUPER_ADMINS.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 border border-white/5">
                    <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-ink">{m.name}</div>
                      <div className="text-[10px] text-mute font-mono">{m.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs font-bold text-black shadow-lg hover:brightness-110 transition-all"
              >
                <KeyRound className="h-4 w-4" />
                Authenticate as Team CodeX Super Admin
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl border border-rule glass px-5 py-3 text-xs font-medium text-mute hover:text-ink transition-colors"
              >
                Back to Company Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED SUPER ADMIN CONTENT */
          <div>
            {/* Super-Admin Platform Banner */}
            <div className="glass rounded-3xl p-8 mb-8 border border-amber-500/30 relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-surface/40 to-forest/10 mt-2">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-6 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-0.5 text-[11px] font-semibold text-amber-400">
                      <ShieldCheck className="h-3 w-3" />
                      Team CodeX Governance Portal
                    </span>
                    <span className="text-xs text-mute font-mono">Logged in as {currentUser}</span>
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                    Ecosystem Master Control
                  </h1>
                  <p className="mt-1 text-sm text-mute">
                    Supervisory view of all organizations using FLOWGUARD, tenant quotas, and macro health.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 rounded-xl glass border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Master Cluster Active (100% Uptime)
                  </span>
                </div>
              </div>

              {/* Platform Macro KPIs */}
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-rule pt-6 sm:grid-cols-4">
                <div className="glass rounded-2xl p-4">
                  <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Active Organizations</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-3xl font-light text-ink">
                      <NumberTicker value={totalCompanies} />
                    </span>
                    <span className="text-[11px] text-forest font-medium">+100% MoM</span>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Monitored Services</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-3xl font-light text-ink">
                      <NumberTicker value={totalServices} />
                    </span>
                    <span className="text-[11px] text-mute">microservices</span>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Chaos Simulations</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-3xl font-light text-forest">
                      <NumberTicker value={totalSimulations} />
                    </span>
                    <span className="text-[11px] text-mute">executions</span>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="text-[11px] text-mute uppercase tracking-wider font-semibold">Ecosystem Resilience</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-3xl font-light text-forest">
                      <NumberTicker value={avgHealth} />
                    </span>
                    <span className="text-[11px] text-mute">/ 100 avg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Team CodeX Super Admin Authority Board */}
            <div className="glass rounded-2xl border border-rule p-5 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-ink">Authorized Team CodeX Super Admins (4 Person Limit)</h3>
                </div>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/30">
                  Code Apex 2026
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TEAM_CODEX_SUPER_ADMINS.map((admin) => (
                  <div key={admin.id} className="rounded-xl border border-white/5 bg-surface/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-ink">{admin.name}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-[10px] text-forest font-medium">{admin.title}</p>
                    <p className="text-[10px] text-mute font-mono mt-1">{admin.email}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Tenant Access Grants Banner */}
            {Object.keys(activeGrants).length > 0 && (
              <div className="glass rounded-2xl border border-amber-500/50 bg-amber-500/10 p-5 mb-6 animate-in fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <ShieldAlert className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-amber-300">Active Emergency Access Authorization</h4>
                        <span className="rounded-full bg-amber-500/25 px-2.5 py-0.5 text-[10px] font-mono text-amber-200 border border-amber-500/40 font-bold animate-pulse">
                          LIVE GRANT
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/80 mt-1">
                        The following tenant(s) have granted Team CodeX temporary emergency access to resolve an incident or anomaly.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(activeGrants).map(([tid, info]) => {
                      const tenantObj = KNOWN_TENANTS.find((k) => k.tenant_id === tid) || {
                        tenant_id: tid,
                        name: tid,
                        plan: "custom",
                      };
                      return (
                        <div key={tid} className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (typeof document !== "undefined") {
                                document.cookie = `fg-emergency-tenant=${tid}; path=/; max-age=7200`;
                              }
                              if (typeof window !== "undefined") {
                                window.localStorage.setItem("fg-tenant", tid);
                              }
                              window.location.href = "/projects";
                            }}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-black shadow-lg hover:brightness-110 transition-all animate-pulse"
                            title="Directly enter tenant projects and workspace"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Enter {tenantObj.name} Workspace ({Math.ceil(info.remaining_seconds / 60)}m)</span>
                          </button>
                          <button
                            onClick={() => handleOpenEmergencySession(tenantObj)}
                            className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-surface/50 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all"
                            title="Quick diagnostics preview modal"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>Quick Diagnostics</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Search & Companies Ledger Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-forest" />
                  Client Companies & Organizations
                </h2>
                <p className="text-xs text-mute">All tenants deployed on FLOWGUARD infrastructure</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-mute" />
                <input
                  type="text"
                  placeholder="Search by company or tenant id..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="glass rounded-xl border border-rule pl-9 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-forest text-ink w-64"
                />
              </div>
            </div>

            {/* Organizations Table */}
            <div className="glass rounded-2xl border border-rule overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface/50 border-b border-rule text-mute uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-6">Company / Organization</th>
                    <th className="py-3.5 px-4">Subscription Plan</th>
                    <th className="py-3.5 px-4 text-center">Services</th>
                    <th className="py-3.5 px-4 text-center">Simulations Run</th>
                    <th className="py-3.5 px-4 text-center">Resilience Health</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filteredTenants.map((t) => (
                    <tr key={t.tenant_id} className="hover:bg-surface/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-ink text-sm">{t.name}</div>
                        <div className="text-[11px] text-mute font-mono">tenant: {t.tenant_id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          t.plan === "enterprise" ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" :
                          t.plan === "pro" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                          "bg-forest/15 text-forest border border-forest/30"
                        }`}>
                          {t.plan}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-medium text-ink">
                        {t.servicesCount || 6} nodes
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="num font-semibold text-ink">{t.simulationsCount || 20}</span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="num font-semibold text-forest text-sm">
                          {t.healthScore || 84}
                        </span>
                        <span className="text-[10px] text-mute">/100</span>
                      </td>

                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleInspect(t)}
                          className="rounded-lg border border-forest/30 bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/20 transition-colors"
                        >
                          Inspect Audit
                        </button>
                        {activeGrants[t.tenant_id] ? (
                          <>
                            <button
                              onClick={() => {
                                if (typeof document !== "undefined") {
                                  document.cookie = `fg-emergency-tenant=${t.tenant_id}; path=/; max-age=7200`;
                                }
                                if (typeof window !== "undefined") {
                                  window.localStorage.setItem("fg-tenant", t.tenant_id);
                                }
                                window.location.href = "/projects";
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-bold text-black shadow-md hover:brightness-110 transition-all animate-pulse"
                              title="Enter full tenant workspace directly"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Enter Workspace ({Math.ceil(activeGrants[t.tenant_id].remaining_seconds / 60)}m)
                            </button>
                            <button
                              onClick={() => handleOpenEmergencySession(t)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all"
                              title="View project dossiers and quick diagnostics"
                            >
                              <ShieldAlert className="h-3 w-3 text-amber-400" />
                              Diagnostics
                            </button>
                          </>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rule glass px-2.5 py-1.5 text-[11px] font-mono text-mute"
                            title="Zero-Knowledge Privacy: Super Admins cannot access customer projects without tenant emergency authorization"
                          >
                            <Lock className="h-3 w-3 text-emerald-400" />
                            Private Boundary
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Company Deep-Dive Inspection Modal */}
            {selectedTenant && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
                <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#0c120e] text-white p-8 shadow-2xl">
                  {/* Top accent gradient bar */}
                  <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-forest via-emerald-400 to-amber-500" />

                  <button
                    onClick={() => setSelectedTenant(null)}
                    className="absolute right-6 top-6 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/20 text-emerald-400 border border-forest/40">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedTenant.name} Audit Dossier</h3>
                      <p className="text-xs text-white/60">
                        Tenant ID: <span className="font-mono text-emerald-400 font-semibold">{selectedTenant.tenant_id}</span> · Plan: <span className="uppercase text-amber-400 font-semibold">{selectedTenant.plan}</span>
                      </p>
                    </div>
                  </div>

                  {/* Tenant Specific Stats Grid with High Contrast & Dark Theme Alignment */}
                  <div className="grid grid-cols-3 gap-3.5 mb-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-emerald-500/30">
                      <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Resilience</div>
                      <div className="num text-2xl font-bold text-white mt-1">
                        {selectedTenant.healthScore || 84}<span className="text-xs font-normal text-white/40"> / 100</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-emerald-500/30">
                      <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Microservices</div>
                      <div className="num text-2xl font-bold text-white mt-1">
                        {selectedTenant.servicesCount || 6} <span className="text-xs font-normal text-white/40">nodes</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-emerald-500/30">
                      <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Monthly Runs</div>
                      <div className="num text-2xl font-bold text-white mt-1">
                        {selectedTenant.simulationsCount || 20} <span className="text-xs font-normal text-white/40">sims</span>
                      </div>
                    </div>
                  </div>

                  {/* Registered Team Members under this Tenant */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/80 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    Authorized Users under {selectedTenant.name} ({inspectUsers.length})
                  </h4>
                  <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10 max-h-52 overflow-y-auto mb-6">
                    {inspectUsers.map((u) => (
                      <div key={u.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-white/[0.03] transition-colors">
                        <div>
                          <div className="font-semibold text-white text-sm">{u.name}</div>
                          <div className="text-white/60 text-xs font-mono">{u.email}</div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-mono font-medium text-emerald-300 uppercase">
                            {u.role.replace("company_", "")}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>Zero-Knowledge: Topologies & code diffs remain private to {selectedTenant.name}.</span>
                    </div>
                    <button
                      onClick={() => setSelectedTenant(null)}
                      className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                    >
                      Close Dossier
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Incident Diagnostics Modal */}
            {emergencySession && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-500/40 bg-[#0d1310] text-white p-8 shadow-2xl">
                  {/* Top accent amber bar */}
                  <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />

                  <button
                    onClick={() => setEmergencySession(null)}
                    className="absolute right-6 top-6 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">
                          Emergency Incident Workspace: {emergencySession.tenant.name}
                        </h3>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/40 font-bold uppercase">
                          Authorized Window
                        </span>
                      </div>
                      <p className="text-xs text-amber-300/80 mt-0.5">
                        Tenant granted temporary elevation. Team CodeX may inspect customer topologies & execute diagnostic simulations.
                      </p>
                    </div>
                  </div>

                  {emergencySession.loading ? (
                    <div className="flex items-center justify-center py-12 text-xs text-white/60 gap-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                      <span>Loading customer project dossiers under temporary authorization...</span>
                    </div>
                  ) : emergencySession.error ? (
                    <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300">
                      {emergencySession.error}
                    </div>
                  ) : emergencySession.projects.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-xs text-white/60">
                      <p className="font-semibold text-white/80">No active projects found for this tenant.</p>
                      <p className="mt-1">The tenant has not registered microservice topologies yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {emergencySession.projects.map((proj: any) => (
                        <div
                          key={proj.slug || proj.name}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-amber-500/30 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{proj.name}</span>
                              <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/70">
                                {proj.slug}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-white/60 mt-1">
                              <span>Services: <strong className="text-white">{proj.services || 6}</strong></span>
                              <span>Score: <strong className="text-emerald-400">{proj.score || 85}/100</strong></span>
                              {proj.last_sim && (
                                <span className="font-mono text-[11px] text-white/40">{proj.last_sim}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`http://localhost:3000/projects/${proj.slug}`}
                              target="_blank"
                              className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all"
                            >
                              <span>View Topology</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
                    <div className="text-xs text-amber-400/80 font-mono flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Access auto-revokes when duration elapses.</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => {
                          if (typeof document !== "undefined") {
                            document.cookie = `fg-emergency-tenant=${emergencySession.tenant.tenant_id}; path=/; max-age=7200`;
                          }
                          if (typeof window !== "undefined") {
                            window.localStorage.setItem("fg-tenant", emergencySession.tenant.tenant_id);
                          }
                          window.location.href = "/projects";
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-black shadow-lg hover:brightness-110 transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Enter Full Tenant Workspace</span>
                      </button>
                      <button
                        onClick={() => setEmergencySession(null)}
                        className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                      >
                        Close Session
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AdminSignInModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
