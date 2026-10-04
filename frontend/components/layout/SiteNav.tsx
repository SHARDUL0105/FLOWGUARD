"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
];

/** Deliberately small. `floating` places it over a hero instead of in the page flow. */
export default function SiteNav({ floating = false, className }: { floating?: boolean; className?: string }) {
  const path = usePathname();
  return (
    <header className={cn("z-50 flex w-full items-center justify-between px-6 py-5 text-[12.5px] text-ink md:px-10", floating && "absolute left-0 top-0", className)}>
      <Wordmark />
      <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className={cn("transition-colors hover:text-forest", path === l.href ? "text-forest" : "text-ink/70")}>
            {l.label}
          </Link>
        ))}
        <span title="Docs are not published yet" className="cursor-default text-ink/30">Docs</span>
      </nav>
      <div className="flex items-center gap-5">
        <span title="Accounts are not part of the prototype" className="hidden cursor-default text-ink/40 sm:inline">Sign in</span>
        <Link href="/projects/connect" className="rounded-full border border-ink/20 px-4 py-1.5 transition-colors hover:border-forest hover:bg-forest hover:text-paper">
          Connect project
        </Link>
      </div>
    </header>
  );
}
