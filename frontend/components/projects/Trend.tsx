"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Trend({ values, height = 160 }: { values: number[]; height?: number }) {
  const data = values.map((v, i) => ({ d: `Day ${i + 1}`, score: v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="d" hide />
          <YAxis domain={[Math.min(...values) - 6, 100]} hide />
          <Tooltip contentStyle={{ background: "#FAFAF7", border: "1px solid #E6E8E3", borderRadius: 0, fontSize: 12 }} />
          <Area type="monotone" dataKey="score" stroke="#0B4F3A" strokeWidth={1.6} fill="#DCEFE7" fillOpacity={0.7} animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
