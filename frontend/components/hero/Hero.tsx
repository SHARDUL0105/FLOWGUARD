"use client";
import { Button } from "@/components/ui/button";
import { GlyphPortal } from "@/components/ui/glyph-portal";

function Overlay() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-28 flex items-center justify-between px-6 text-[11px] md:px-10">
        <span className="tracking-[0.18em] text-forest">PREDICTIVE SYSTEM RELIABILITY</span>
        <span className="hidden text-mute sm:block">Validated on a simulated environment</span>
      </div>
      <div className="absolute inset-x-0 bottom-16 flex flex-col justify-between gap-8 px-6 md:flex-row md:items-end md:px-10">
        <div>
          <p className="max-w-[460px] text-[clamp(22px,2.4vw,34px)] font-semibold leading-[1.08] tracking-tight text-ink">Don&apos;t wait for your system to fail.</p>
          <p className="mt-1 text-[clamp(22px,2.4vw,34px)] font-light leading-[1.08] tracking-tight text-mute">Predict it. Simulate it. Stop it.</p>
        </div>
        <div className="max-w-[360px]">
          <p className="text-[13px] leading-relaxed text-ink/75">
            FLOWGUARD models how failures propagate across your services, identifies likely root causes, forecasts impact, and verifies fixes before they reach production.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button href="/command-center">Enter Command Center</Button>
            <Button href="/projects/connect" variant="outline">Connect a Project</Button>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-5 text-center text-[11px] text-mute">Scroll to explore ↓</div>
    </div>
  );
}

export default function Hero() {
  return (
    <GlyphPortal word="FLOWGUARD" target={2} overlay={<Overlay />} length={2.4}>
      {() => null}
    </GlyphPortal>
  );
}
