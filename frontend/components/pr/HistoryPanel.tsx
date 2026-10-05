"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getTenant, setTenant } from "@/lib/tenant";

type Row = Record<string, unknown>;
type Tenant = { tenant_id: string; name: string; plan: string };
const when = (v: unknown) => { const d = new Date(String(v)); return isNaN(d.getTime()) ? "" : d.toLocaleString(); };

/** Stored checks and Auto-Fix results for the active organization (tenant). Hidden when no database is connected. */
export default function HistoryPanel() {
  const [connected, setConnected] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenant, setT] = useState("demo");
  const [checks, setChecks] = useState<Row[]>([]);
  const [fixes, setFixes] = useState<Row[]>([]);

  const load = useCallback(() => { api.history("pr_checks").then(setChecks); api.history("heal_results").then(setFixes); }, []);
  useEffect(() => {
    setT(getTenant());
    api.dbStatus().then((s) => { setConnected(s.connected); if (s.connected) { api.tenants().then(setTenants); load(); } });
  }, [load]);

  if (!connected) return null;
  const pick = (id: string) => { setTenant(id); setT(id); setChecks([]); setFixes([]); load(); };
  const name = tenants.find((t) => t.tenant_id === tenant)?.name ?? tenant;

  return (
    <section className="mx-auto mt-20 max-w-[1500px] border-t border-rule px-6 pt-8 md:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Stored history <span className="font-normal text-mute">for {name}</span></h2>
        <label className="flex items-center gap-2 text-[12px] text-mute">
          Organization
          <select value={tenant} onChange={(e) => pick(e.target.value)} className="glass rounded-full px-3 py-1 text-[12px] text-ink">
            {(tenants.length ? tenants : [{ tenant_id: "demo", name: "Demo Org", plan: "free" }]).map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1 text-[11.5px] text-mute">MongoDB Atlas. Each organization only sees its own records.</p>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-[12px] text-mute">PR checks</h3>
          {!checks.length && <p className="py-2 text-[12.5px] text-mute">Nothing stored yet. Analyze a PR while acting as this organization.</p>}
          {checks.map((r, i) => (
            <div key={i} className="num flex justify-between border-b border-rule py-2 text-[12.5px]"><span>PR #{String(r.id)}: {String(r.score_base)} → {String(r.score_pr)}</span><span className="text-mute">{when(r.created_at)}</span></div>
          ))}
        </div>
        <div>
          <h3 className="text-[12px] text-mute">Auto-Fix results</h3>
          {!fixes.length && <p className="py-2 text-[12.5px] text-mute">Nothing stored yet.</p>}
          {fixes.map((r, i) => (
            <div key={i} className="num flex justify-between border-b border-rule py-2 text-[12.5px]"><span>PR #{String(r.id)}: {String(r.score_before)} → {String(r.score_after)}, {String(r.gate)}</span><span className="text-mute">{when(r.created_at)}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
