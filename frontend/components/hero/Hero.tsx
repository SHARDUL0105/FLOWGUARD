"use client";
import { useMotionValueEvent } from "framer-motion";
import type { MotionValue } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import MiniGraph from "@/components/graph/MiniGraph";
import { Button } from "@/components/ui/button";
import { GlyphPortal } from "@/components/ui/glyph-portal";
import { STEP_CAPTION, STEP_VALUES, statusesForStep } from "@/lib/cascade";

function stepFor(p: number) {
  if (p < 0.72) return 0;
  if (p < 0.77) return 1;
  if (p < 0.82) return 2;
  if (p < 0.87) return 3;
  if (p < 0.92) return 4;
  return 5;
}

function Scene({ p }: { p: MotionValue<number> }) {
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    const n = stepFor(v); if (n !== step) setStep(n);
    const l = v > 0.45; if (l !== live) setLive(l); // the scene is invisible during the zoom, so keep it idle
  });
  return (
    <div className="flex h-full flex-col justify-between px-6 py-10 text-snow md:px-14">
      <div className="flex items-start justify-between text-[12px] text-snow/60">
        <span>You are now inside the system</span>
        <span className="num">checkout, 100 req/s</span>
      </div>
      <div className="mx-auto w-full max-w-[1180px]">
        <MiniGraph tone="green" paused={!live} statuses={statusesForStep(step)} values={STEP_VALUES[step]} />
      </div>
      <div className="flex items-end justify-between gap-6">
        <p className="max-w-[520px] text-[clamp(22px,3vw,40px)] font-light leading-[1.1] tracking-tight fade-in" key={step}>{STEP_CAPTION[step]}</p>
        <span className="hidden text-[12px] text-snow/60 md:block">Keep scrolling</span>
      </div>
    </div>
  );
}

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
    <GlyphPortal word="FLOWGUARD" target={2} overlay={<Overlay />} length={5}>
      {(p) => <Scene p={p} />}
    </GlyphPortal>
  );
}
