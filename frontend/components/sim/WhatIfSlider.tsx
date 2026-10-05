"use client";
import { useEffect, useRef, useState } from "react";
import { Block } from "@/components/command-center/Panels";
import { api } from "@/lib/api";
import type { WhatIfResponse } from "@/lib/types";
import PredVsMeasured from "./PredVsMeasured";

/** Database latency slider (1.0x-4.0x). Calls /api/whatif on release; falls back to recorded results. */
export default function WhatIfSlider() {
  const [factor, setFactor] = useState(2.5);
  const [res, setRes] = useState<WhatIfResponse | null>(null);
  const [src, setSrc] = useState("");
  const seq = useRef(0);
  const run = async (f: number) => {
    const id = ++seq.current;
    const r = await api.whatif("db_latency", f);
    if (id === seq.current) { setRes(r.data); setSrc(r.source === "live" ? "live engine" : "recorded"); }
  };
  useEffect(() => { run(2.5); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <Block title="What if" aside={src || "database latency"}>
      <div className="flex items-baseline justify-between text-[12.5px]"><span className="text-mute">Database slows down by</span><span className="num text-[22px] font-light">{factor.toFixed(1)}x</span></div>
      <input type="range" min={1} max={4} step={0.5} value={factor} aria-label="Database latency factor"
        onChange={(e) => setFactor(Number(e.target.value))}
        onPointerUp={() => run(factor)} onKeyUp={() => run(factor)} onTouchEnd={() => run(factor)}
        className="mt-2 w-full accent-[rgb(var(--forest))]" />
      <div className="num mt-0.5 flex justify-between text-[10.5px] text-mute"><span>1.0x</span><span>2.0x</span><span>3.0x</span><span>4.0x</span></div>
      <div className="mt-3">{res ? <PredVsMeasured r={res} /> : <p className="text-[12px] text-mute">Running the forecast and the simulator…</p>}</div>
    </Block>
  );
}
