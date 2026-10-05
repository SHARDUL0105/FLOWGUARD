"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import SignInModal from "../auth/SignInModal";
import { getTenant, getTenantInfo, getUserEmail } from "@/lib/tenant";
import { User, Building, LogIn } from "lucide-react";

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

const LINKS = [
  { label: "Projects", href: "/projects" },
  { label: "Platform", href: "/#platform" },
  { label: "Simulations", href: "/simulations" },
  { label: "Alerts", href: "/alerts" },
  { label: "Pull requests", href: "/pull-requests" },
  { label: "Docs", href: "/docs" },
];

/** Fixed, frosted-glass bar that stays visible on every page. A spacer keeps in-flow pages from sliding under it;
 *  `floating` skips the spacer so the home hero can sit directly beneath the bar. */
export default function SiteNav({ floating = false, className }: { floating?: boolean; className?: string }) {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>("demo");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Initial state setup
    setTenantId(getTenant());
    setUserEmail(getUserEmail());

    // Listen to auth & tenant updates
    const handleTenantChange = (e: CustomEvent) => {
      if (e.detail?.tenantId) setTenantId(e.detail.tenantId);
      setUserEmail(e.detail?.email !== undefined ? e.detail.email : getUserEmail());
    };

    window.addEventListener("fg-tenant-change", handleTenantChange as EventListener);
    return () => window.removeEventListener("fg-tenant-change", handleTenantChange as EventListener);
  }, []);

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

  return (
    <>
      <header ref={ref} data-tone="light" className={cn("glass fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between rounded-none border-x-0 border-t-0 px-6 text-[12.5px] text-ink md:px-10", className)}>
        <Wordmark />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={cn("transition-colors hover:text-forest font-medium", path === l.href ? "text-forest font-semibold" : "text-ink/70")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 sm:gap-5">
          <ThemeToggle />
          
          {/* Sign in / Active Tenant Button */}
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 bg-surface/30 px-3 py-1.5 text-xs text-ink/80 transition-all hover:border-forest/50 hover:bg-forest/10 hover:text-forest"
          >
            {userEmail ? (
              <>
                <Building className="h-3.5 w-3.5 text-forest" />
                <span className="font-semibold">{tenantInfo.name}</span>
                <span className="hidden rounded bg-forest/20 px-1 py-0.2 text-[10px] text-forest sm:inline">
                  {tenantId}
                </span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 text-ink/60" />
                <span>Sign in</span>
              </>
            )}
          </button>

          <Link href="/projects/connect" className="navctl rounded-full border border-ink/20 bg-surface/40 px-4 py-1.5 backdrop-blur transition-colors hover:border-forest hover:bg-forest hover:text-paper font-medium">
            Connect project
          </Link>
        </div>
      </header>
      {!floating && <div className="h-16 shrink-0" aria-hidden />}

      {/* Auth & Tenant Modal */}
      <SignInModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
