"use client";

import React, { useState, useEffect } from "react";
import { getTenant, getTenantInfo, getUserEmail, KNOWN_TENANTS, setTenant, signOut } from "@/lib/tenant";
import { api } from "@/lib/api";
import { X, Check, Shield, User, Building, Lock, LogOut, Sparkles } from "lucide-react";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [activeTab, setActiveTab] = useState<"quick" | "credentials">("quick");
  const [currentTenantId, setCurrentTenantId] = useState<string>(DEFAULT_TENANT_STATE());
  const [userEmail, setUserEmail] = useState<string>("");
  const [tenantsList, setTenantsList] = useState(KNOWN_TENANTS);

  // Form fields for credentials login
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("demo");
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  function DEFAULT_TENANT_STATE() {
    return typeof window !== "undefined" ? getTenant() : "demo";
  }

  useEffect(() => {
    if (isOpen) {
      const t = getTenant();
      const email = getUserEmail();
      setCurrentTenantId(t);
      setSelectedTenant(t);
      setUserEmail(email || "");
      setFormEmail(email || "");
      
      // Fetch tenants from backend if live
      api.tenants().then((res) => {
        if (res && res.length > 0) {
          setTenantsList(res);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentInfo = getTenantInfo(currentTenantId);

  const handleSelectTenant = (id: string, name: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const email = formEmail || `${id}_user@flowguard.io`;
      setTenant(id, email);
      setCurrentTenantId(id);
      setUserEmail(email);
      setIsLoading(false);
      setSuccessMsg(`Signed in as ${name}`);
      setTimeout(() => {
        setSuccessMsg("");
        onClose();
      }, 1000);
    }, 400);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail) return;
    setIsLoading(true);
    setTimeout(() => {
      setTenant(selectedTenant, formEmail);
      setCurrentTenantId(selectedTenant);
      setUserEmail(formEmail);
      setIsLoading(false);
      setSuccessMsg(`Welcome back, ${formEmail.split("@")[0]}!`);
      setTimeout(() => {
        setSuccessMsg("");
        onClose();
      }, 1000);
    }, 600);
  };

  const handleSignOut = () => {
    signOut();
    setCurrentTenantId("demo");
    setUserEmail("");
    setSuccessMsg("Signed out successfully");
    setTimeout(() => {
      setSuccessMsg("");
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c120e] text-paper shadow-2xl">
        {/* Header decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-forest via-emerald-400 to-teal-500" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Brand Header */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/20 text-forest border border-forest/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">FLOWGUARD Auth</h3>
              <p className="text-xs text-white/60">Organization Sign-In & Tenant Access</p>
            </div>
          </div>

          {/* Active Session Status */}
          {userEmail && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-forest/30 bg-forest/10 p-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="font-semibold text-white">{userEmail}</p>
                  <p className="text-white/60">Active Tenant: <span className="text-emerald-400 font-medium">{currentInfo.name}</span> ({currentInfo.plan})</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/20"
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-5 flex rounded-lg bg-white/5 p-1 text-xs">
            <button
              onClick={() => setActiveTab("quick")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                activeTab === "quick" ? "bg-forest text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Quick Tenant Switcher
            </button>
            <button
              onClick={() => setActiveTab("credentials")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                activeTab === "credentials" ? "bg-forest text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Credentials Login
            </button>
          </div>

          {/* Notifications */}
          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-3 text-xs text-emerald-300">
              <Check className="h-4 w-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Switcher Tab */}
          {activeTab === "quick" && (
            <div className="space-y-2.5">
              <p className="text-xs text-white/50 mb-2">Select an organization tenant to access its telemetry & PR checks:</p>
              {tenantsList.map((t) => {
                const isCurrent = t.tenant_id === currentTenantId;
                return (
                  <button
                    key={t.tenant_id}
                    onClick={() => handleSelectTenant(t.tenant_id, t.name)}
                    disabled={isLoading}
                    className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isCurrent
                        ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-forest/40 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Building className={`h-4 w-4 ${isCurrent ? "text-emerald-400" : "text-white/50"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{t.name}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/70 uppercase">
                            {t.tenant_id}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/50">Plan: {t.plan.toUpperCase()}</span>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-white/40 group-hover:text-white">Switch →</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Credentials Login Tab */}
          {activeTab === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Email Address</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="email"
                    required
                    placeholder="user@organization.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:border-forest focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:border-forest focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Target Tenant Organization</label>
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-forest focus:outline-none"
                >
                  {tenantsList.map((t) => (
                    <option key={t.tenant_id} value={t.tenant_id} className="bg-[#0c120e] text-white">
                      {t.name} ({t.tenant_id})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Sign In to Organization</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-white/10 pt-4 text-center">
            <p className="text-[11px] text-white/40">
              Connected to MongoDB Atlas multi-tenant store.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
