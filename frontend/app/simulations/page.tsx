"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import NumberTicker from "@/components/effects/NumberTicker";
import SiteNav from "@/components/layout/SiteNav";
import { WHATIF } from "@/lib/fixtures";
import { cn } from "@/lib/utils";

const SCEN = { db_latency: { label: "Database latency", unit: "Database slows down by" }, traffic_spike: { label: "Traffic", unit: "Checkout traffic rises by" } } as const;
const RISK_COLOR = { LOW: "#218B6A", MEDIUM: "#C9851F", HIGH: "#D94B45" } as const;

export default function SimulationsPage() {
  const [sc, setSc] = useState<keyof typeof SCEN>("db_latency");
  const [factor, setFactor] = useState(2.5);
  const rows = WHATIF[sc];
  const r = rows.find((x) => x.factor === factor) ?? rows[0];
  const diff = r.measured.p95_ms - r.predicted.p95_ms;
  const data = rows.map((x) => ({ factor: `${x.factor}x`, Forecast: x.predicted.p95_ms, Measured: x.measured.p95_ms }));

  return (
    <div className="min-h-screen bg-paper">
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-14 md:px-10">
        <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-none tracking-tight">What if</h1>
        <p className="mt-4 max-w-[520px] text-[15px] text-mute">Change the conditions and compare a quick forecast with what the simulator actually measured.</p>

        <div className="mt-14 grid gap-14 md:grid-cols-[4fr_7fr]">
          <div>
            <div className="flex gap-2 text-[12.5px]">
              {(Object.keys(SCEN) as (keyof typeof SCEN)[]).map((k) => (
                <button key={k} onClick={() => setSc(k)} className={cn("rounded-full border px-4 py-1.5 transition-colors", sc === k ? "border-forest bg-forest text-paper" : "border-ink/20 hover:border-ink")}>{SCEN[k].label}</button>
              ))}
            </div>
            <p className="mt-8 text-[13px] text-mute">{SCEN[sc].unit}</p>
            <div className="mt-2 num text-[88px] font-extralight leading-none"><NumberTicker value={factor} decimals={1} suffix="x" /></div>
            <div className="mt-6 flex flex-wrap gap-2">
              {rows.map((x) => (
                <button key={x.factor} onClick={() => setFactor(x.factor)} className={cn("num rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors", factor === x.factor ? "border-ink bg-ink text-paper" : "border-ink/20 hover:border-ink")}>{x.factor.toFixed(1)}x</button>
              ))}
            </div>
            <p className="mt-8 text-[11.5px] leading-relaxed text-mute">Numbers are recorded from the reference simulator (seed 7). The forecast ignores retry load and lag, so it is accurate in steady regimes and diverges near saturation.</p>
          </div>

          <div>
            <dl className="grid grid-cols-2 gap-px border border-rule bg-rule md:grid-cols-5">
              {[
                ["Predicted", <><NumberTicker value={r.predicted.p95_ms} /><span className="text-[11px] text-mute"> ms</span></>],
                ["Measured", <><NumberTicker value={r.measured.p95_ms} /><span className="text-[11px] text-mute"> ms</span></>],
                ["Difference", <span className="num">{diff >= 0 ? "+" : ""}{diff}<span className="text-[11px] text-mute"> ms</span></span>],
                ["Risk", <span style={{ color: RISK_COLOR[r.predicted.risk] }} className="text-[22px] font-medium">{r.predicted.risk}</span>],
                ["Resilience", <NumberTicker value={r.resilience} />],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-paper p-4"><dt className="text-[11.5px] text-mute">{k}</dt><dd className="num mt-1 text-[28px] font-light leading-none">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex items-baseline justify-between text-[13px]">
              <span>Forecast accuracy <span className="num font-semibold">{Math.round(r.accuracy * 100)}%</span></span>
              <span className="text-mute">errors: {(r.measured.error_rate * 100).toFixed(1)}% measured</span>
            </div>
            {r.note && <p className="mt-2 border-l-2 border-warn pl-3 text-[12.5px] text-ink/80">{r.note}</p>}
            <div className="mt-8 h-[300px]">
              <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke="#E6E8E3" vertical={false} />
                  <XAxis dataKey="factor" stroke="#6E756F" tickLine={false} fontSize={11} />
                  <YAxis stroke="#6E756F" tickLine={false} axisLine={false} fontSize={11} width={44} unit=" ms" />
                  <Tooltip cursor={{ fill: "#F3F3ED" }} contentStyle={{ background: "#FAFAF7", border: "1px solid #E6E8E3", borderRadius: 0, fontSize: 12 }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={`${factor}x`} stroke="#101412" strokeDasharray="2 3" />
                  <Bar dataKey="Forecast" fill="#C9CEC6" isAnimationActive animationDuration={900} />
                  <Bar dataKey="Measured" fill="#0B4F3A" isAnimationActive animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
