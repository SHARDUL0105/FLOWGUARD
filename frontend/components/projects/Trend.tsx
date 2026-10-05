"use client";
import { C, TOOLTIP_STYLE } from "@/lib/theme";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Trend({ values, height = 160 }: { values: number[]; height?: number }) {
  const data = values.map((v, i) => ({ d: `Day ${i + 1}`, score: v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="d" hide />
          <YAxis domain={[Math.min(...values) - 6, 100]} hide />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="score" stroke={C.forest} strokeWidth={1.6} fill={C.mint} fillOpacity={0.7} animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
