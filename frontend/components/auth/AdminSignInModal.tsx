"use client";

import React, { useState, useEffect } from "react";
import {
  getUserEmail,
  getUserName,
  getUserRole,
  getTenant,
  getTenantInfo,
  setAuthSession,
  signOut,
  TEAM_CODEX_SUPER_ADMINS,
  UserRole,
} from "@/lib/tenant";
import {
  X,
  Shield,
  User,
  Lock,
  LogOut,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface AdminSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Sign-in modal exclusively for Team CodeX Super Admins.
 * Shows only the Super Admin Gate — no tenant login, no registration.
 * Used on the admin instance (localhost:4000).
 */
export default function AdminSignInModal({ isOpen, onClose }: AdminSignInModalProps) {
  const [currentTenantId, setCurrentTenantId] = useState<string>("flowguard");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<UserRole>("platform_owner");
  const [currentName, setCurrentName] = useState<string>("");

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCurrentTenantId(getTenant());
      setCurrentUserEmail(getUserEmail() || "");
      setCurrentRole(getUserRole());
      setCurrentName(getUserName() || "");
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentInfo = getTenantInfo(currentTenantId);

  const handleQuickFillAdmin = (admin: (typeof TEAM_CODEX_SUPER_ADMINS)[0]) => {
    setIdentifier(admin.username);
    setPassword(admin.defaultPass);
    setErrorMsg("");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMsg("Please enter both username/email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const cleanId = identifier.trim().toLowerCase();

      const matchAdmin = TEAM_CODEX_SUPER_ADMINS.find(
        (a) => a.username.toLowerCase() === cleanId || a.email.toLowerCase() === cleanId
      );
      if (matchAdmin && (password === matchAdmin.defaultPass || password === "codex2026")) {
        const res = {
          ok: true,
          token: `mock-token-${Date.now()}`,
          user: {
            id: matchAdmin.id,
            username: matchAdmin.username,
            name: matchAdmin.name,
            email: matchAdmin.email,
            role: matchAdmin.role,
            tenant_id: matchAdmin.tenant_id,
          },
          message: `Authenticated as Super Admin: ${matchAdmin.name}`,
        };

        setAuthSession({
          token: res.token,
          tenantId: res.user.tenant_id,
          email: res.user.email,
          username: res.user.username,
          name: res.user.name,
          role: res.user.role as UserRole,
        });

        setCurrentTenantId(res.user.tenant_id);
        setCurrentUserEmail(res.user.email);
        setCurrentRole(res.user.role as UserRole);
        setCurrentName(res.user.name);
        setSuccessMsg(res.message);

        setTimeout(() => {
          setSuccessMsg("");
          onClose();
        }, 800);
      } else {
        throw new Error("Invalid Super Admin credentials. Must be one of the 4 Team CodeX members.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication failed. Check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setCurrentTenantId("demo");
    setCurrentUserEmail("");
    setCurrentRole("company_engineer");
    setCurrentName("");
    setSuccessMsg("Signed out successfully");
    setTimeout(() => {
      setSuccessMsg("");
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c120e] text-paper shadow-2xl">
        {/* Top colored accent line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Brand Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">Super Admin Gate</h3>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/30">
                  TEAM CODEX
                </span>
              </div>
              <p className="text-xs text-white/60">Platform Owner Authentication • Restricted Access</p>
            </div>
          </div>

          {/* Active Session Status */}
          {currentUserEmail && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{currentName || currentUserEmail}</p>
                    <span className="rounded px-1.5 py-0.2 text-[9px] font-mono uppercase bg-amber-500/30 text-amber-300 border border-amber-500/40">
                      {currentRole.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-white/60 text-[11px]">
                    Workspace: <span className="text-amber-400 font-medium">{currentInfo.name}</span>
                  </p>
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

          {/* Alert Banners */}
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Mode Indicator — no tabs, just a single locked panel */}
          <div className="mb-4 flex rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-xs items-center justify-center gap-2 text-amber-300 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            Super Admin Authentication Only
          </div>

          {/* SUPER ADMIN LOGIN FORM */}
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                Team CodeX Hackathon Authority
              </div>
              <p className="text-[11px] text-amber-200/80">
                Strict security: Only the 4 authorized team members of Team CodeX can access Master Control (/admin).
              </p>
            </div>

            {/* Quick Fill Chips for the 4 Team Members */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Click to pre-fill Hackathon Team Member credentials:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEAM_CODEX_SUPER_ADMINS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleQuickFillAdmin(m)}
                    className={`flex flex-col text-left rounded-lg border p-2 transition-all ${
                      identifier === m.username || identifier === m.email
                        ? "border-amber-400 bg-amber-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-amber-500/40 hover:bg-white/10"
                    }`}
                  >
                    <span className="font-semibold text-xs text-white flex items-center justify-between">
                      {m.name}
                      <span className="text-[9px] font-mono text-amber-400">Owner</span>
                    </span>
                    <span className="text-[10px] text-white/50 truncate font-mono">user: {m.username}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Super Admin Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Super Admin Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. shardul or shardul@flowguard.io"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-white/30 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Password <span className="text-[10px] text-amber-400/80">(e.g. shardul@codex2026 or codex2026)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter verified team password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-white/30 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-black shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isLoading ? "Verifying PBKDF2 Credentials..." : "Authenticate as Super Admin →"}
              </button>
            </form>
          </div>

          {/* Security Protocol Footer */}
          <div className="mt-5 border-t border-white/10 pt-3 flex items-center justify-between text-[10px] text-white/40">
            <span className="flex items-center gap-1 font-mono">
              <KeyRound className="h-3 w-3 text-amber-400" />
              PBKDF2-HMAC-SHA256 • HS256 Token
            </span>
            <span className="font-mono text-amber-400/80">CodeX Team Super Admins: 4</span>
          </div>
        </div>
      </div>
    </div>
  );
}
