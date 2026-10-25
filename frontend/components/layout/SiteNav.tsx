"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import AdminSignInModal from "../auth/AdminSignInModal";
import TenantSignInModal from "../auth/TenantSignInModal";
import GrantAdminModal from "../projects/GrantAdminModal";
import { getTenant, getTenantInfo, getUserEmail, getUserRole, getUserName, isPlatformOwner } from "@/lib/tenant";
import { api } from "@/lib/api";
import { User, Building, LogIn, ShieldCheck, ShieldAlert } from "lucide-react";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-[15px] font-extrabold tracking-tight", className)}>
      <svg width="15" height="17" viewBox="0 0 15 17" fill="none" aria-hidden>
        <path d="M7.5 1 L14 3.6 V8.6 C14 12 11.4 14.7 7.5 16 C3.6 14.7 1 12 1 8.6 V3.6 Z" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="7.5" cy="8.2" r="1.9" fill="currentColor" />
      </svg>
      FLOWGUARD.
    </Link>
  );
}

const BASE_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Command Center", href: "/command-center" },
  { label: "Simulations", href: "/simulations" },
  { label: "Alerts", href: "/alerts" },
  { label: "Pull requests", href: "/pull-requests" },
  { label: "Security Demo", href: "/security-demo" },
  { label: "Docs", href: "/docs" },
];

/** Fixed, frosted-glass bar that stays visible on every page. A spacer keeps in-flow pages from sliding under it;
 *  `floating` skips the spacer so the home hero can sit directly beneath the bar. */
export default function SiteNav({ floating = false, className }: { floating?: boolean; className?: string }) {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>("demo");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("company_engineer");
  const [isOwner, setIsOwner] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [grantActive, setGrantActive] = useState<{ remaining: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    setTenantId(getTenant());
    setUserEmail(getUserEmail());
    setUserRole(getUserRole());
    setIsOwner(isPlatformOwner());
    setUserName(getUserName());

    // Listen to auth & tenant updates
    const handleTenantChange = (e: CustomEvent) => {
      if (e.detail?.tenantId) setTenantId(e.detail.tenantId);
      if (e.detail?.role) setUserRole(e.detail.role);
      setUserEmail(e.detail?.email !== undefined ? e.detail.email : getUserEmail());
      setIsOwner(isPlatformOwner());
      setUserName(getUserName());
    };

    window.addEventListener("fg-tenant-change", handleTenantChange as EventListener);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange as EventListener);
  }, []);

  // Poll for active super-admin emergency grant for this tenant
  useEffect(() => {
    if (!mounted || isOwner || tenantId === "flowguard") return;
    const checkGrant = async () => {
      try {
        const res = await api.checkAdminGrant(tenantId);
        if (res.granted && res.remaining_seconds && res.remaining_seconds > 0) {
          setGrantActive({ remaining: res.remaining_seconds });
        } else {
          setGrantActive(null);
        }
      } catch {
        setGrantActive(null);
      }
    };
    checkGrant();
    const interval = setInterval(checkGrant, 8000);
    return () => clearInterval(interval);
  }, [mounted, isOwner, tenantId]);

  const [emergencyTenantCookie, setEmergencyTenantCookie] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|; )fg-emergency-tenant=([^;]*)/);
      setEmergencyTenantCookie(match ? decodeURIComponent(match[1]) : null);
    }
  }, [path]);

  const handleExitEmergencyMode = () => {
    if (typeof document !== "undefined") {
      document.cookie = "fg-emergency-tenant=; path=/; max-age=0";
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fg-tenant", "flowguard");
    }
    window.location.href = "/admin";
  };

  const navLinks = mounted && isOwner && !emergencyTenantCookie
    ? [
        { label: "Master Control", href: "/admin" },
      ]
    : BASE_LINKS;

  // Switch to a dark-tinted bar while it sits over a dark section (anything marked data-nav-tone="dark").
  useEffect(() => {
    let raf = 0;
    let els: HTMLElement[] = [];
    const collect = () => { els = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-tone]")); };
    const update = () => {
      raf = 0;
      let tone = "light";
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= 32 && r.bottom > 32) tone = el.dataset.navTone === "dark" ? "dark" : "light";
      }
      if (ref.current && ref.current.dataset.tone !== tone) ref.current.dataset.tone = tone;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    collect(); update();
    const mo = new MutationObserver(() => { collect(); queue(); });
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-nav-tone"] });
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => { mo.disconnect(); window.removeEventListener("scroll", queue); window.removeEventListener("resize", queue); if (raf) cancelAnimationFrame(raf); };
  }, [path]);

  const tenantInfo = getTenantInfo(tenantId);

  const isAdminInstance = process.env.NEXT_PUBLIC_ADMIN === "true";

  return (
    <>
      <header ref={ref} data-tone="light" className={cn("glass fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between rounded-none border-x-0 border-t-0 px-6 text-[12.5px] text-ink md:px-10", className)}>
        <Wordmark />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {navLinks.map((l) => (
            <Link key={l.label} href={l.href} className={cn("transition-colors hover:text-forest", path === l.href ? "text-forest font-medium" : "text-ink/70")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 sm:gap-5">
          <ThemeToggle />

          {/* Active Emergency Tenant Inspection Indicator for Super Admin */}
          {mounted && emergencyTenantCookie && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-300 font-semibold shadow-sm animate-pulse">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Inspecting:</span>
              <span className="font-mono uppercase font-bold text-white">{emergencyTenantCookie}</span>
              <button
                onClick={handleExitEmergencyMode}
                className="ml-1 rounded-md bg-amber-500/30 px-2 py-0.5 text-[10px] text-white hover:bg-amber-500/60 transition-colors"
                title="Exit Emergency Inspection and return to Master Control"
              >
                Exit Session
              </button>
            </div>
          )}

          {/* Emergency Super-Admin Grant Button for Tenants */}
          {mounted && !isAdminInstance && !isOwner && tenantId !== "flowguard" && (
            <button
              onClick={() => setIsGrantOpen(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all",
                grantActive
                  ? "border-amber-500/60 bg-amber-500/20 text-amber-300 font-semibold shadow-md animate-pulse"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/20"
              )}
              title={
                grantActive
                  ? `Super-Admin emergency access is ACTIVE (approx ${Math.ceil(grantActive.remaining / 60)}m left)`
                  : "Grant temporary Super-Admin access for anomaly resolution"
              }
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">
                {grantActive ? `Admin Access (${Math.ceil(grantActive.remaining / 60)}m)` : "Emergency Access"}
              </span>
            </button>
          )}
          
          {/* Sign in / Active Tenant Button */}
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 bg-surface/30 px-3 py-1.5 text-xs text-ink/80 transition-all hover:border-forest/50 hover:bg-forest/10 hover:text-forest"
          >
            {mounted && userEmail ? (
              isOwner ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-400">{userName || "CodeX Admin"}</span>
                  <span className="hidden rounded bg-amber-500/25 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono sm:inline">
                    SUPER-ADMIN
                  </span>
                </>
              ) : (
                <>
                  <Building className="h-3.5 w-3.5 text-forest" />
                  <span className="font-semibold">{tenantInfo.name}</span>
                  <span className="hidden rounded bg-forest/20 px-1 py-0.2 text-[10px] text-forest sm:inline">
                    {tenantId}
                  </span>
                </>
              )
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 text-ink/60" />
                <span>Sign in</span>
              </>
            )}
          </button>

          <Link href="/projects/connect" className="navctl rounded-full border border-ink/20 bg-surface/40 px-4 py-1.5 backdrop-blur transition-colors hover:border-forest hover:bg-forest hover:text-paper">
            Connect project
          </Link>
        </div>
      </header>
      {!floating && <div className="h-16 shrink-0" aria-hidden />}

      {/* Auth Modal — show the correct one based on which instance is running */}
      {isAdminInstance ? (
        <AdminSignInModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      ) : (
        <TenantSignInModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      )}

      {/* Emergency Super-Admin Grant Modal for Tenant */}
      <GrantAdminModal isOpen={isGrantOpen} onClose={() => setIsGrantOpen(false)} />
    </>
  );
}
