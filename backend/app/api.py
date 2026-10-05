from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from .schemas import ChaosRequest, DemoModeRequest, WhatIfRequest
from .state import state
from .sim.topology import topology_json, BASE_EDGES
from .sim.config import DEFAULT_SEVERITY, SCENARIOS
from .sim.engine import run, window
from .intel.runtime.predictor import what_if
from .intel.runtime.scoring import resilience_score
from .pr.prs import list_prs
from .pr.service import analyze_pr, heal_pr
from .ai.brief import build_evidence, stream_brief_events
from . import db

router=APIRouter(prefix="/api")


def current_tenant(x_tenant_id: str | None = Header(default=None)) -> str:
    """Which organization is asking. Every stored read and write is scoped to this value."""
    try:
        return db.resolve_tenant(x_tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


def load_replay_fixture(scenario: str):
    """Load a recorded simulator run for replay mode."""
    if scenario not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario: {scenario}",
        )

    path = FIXTURES_DIR / f"run.{scenario}.json"

    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Replay fixture not found: {path.name}",
        )

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    return data
@router.get('/topology')
def topology(): return topology_json()
@router.get('/health')
def health(): return {"ok":True,"mode":state.mode}
@router.post('/chaos')
async def chaos(body: ChaosRequest):
    state.configure_fault(body.scenario,body.severity)
    await state.start()
    return {"started":True,"scenario":body.scenario,"t0":10}
@router.post('/reset')
async def reset():
    state.reset(); await state.start(); return {"ok":True}
@router.get('/demo/mode')
def demo_mode(): return {"mode":state.mode}
@router.post('/demo/mode')
async def set_demo_mode(body: DemoModeRequest):
    state.mode=body.mode
    if body.mode=='replay': state.clients.clear()
    else: await state.start()
    return {"mode":state.mode}

@router.post('/whatif')
def whatif(body: WhatIfRequest): return what_if(BASE_EDGES,body.scenario,body.factor)

@router.get('/pr')
def prs(project_id: str | None = None, tenant_id: str = Depends(current_tenant)):
    return list_prs(project_id=project_id, tenant_id=tenant_id)

@router.post('/pr')
def create_pr(body: dict, tenant_id: str = Depends(current_tenant)):
    """Create a user pull request stored in MongoDB."""
    if not body.get("title", "").strip():
        raise HTTPException(400, "title is required")
    return db.create_user_pr(tenant_id, body)

@router.delete('/pr/{pr_id}')
def delete_pr(pr_id: int, tenant_id: str = Depends(current_tenant)):
    """Delete a user-created PR."""
    if not db.delete_user_pr(tenant_id, pr_id):
        raise HTTPException(404, "PR not found or not deletable")
    return {"ok": True}

@router.post('/pr/{pr_id}/analyze')
def analyze(pr_id: int, tenant_id: str = Depends(current_tenant)):
    r = analyze_pr(pr_id)
    if r is None: raise HTTPException(404, f'Pull request #{pr_id} not found')
    db.save('pr_checks', r, tenant_id)
    return r

@router.post('/pr/{pr_id}/heal')
def heal(pr_id: int, tenant_id: str = Depends(current_tenant)):
    r = heal_pr(pr_id)
    if r is None: raise HTTPException(404, f'Pull request #{pr_id} not found')
    db.save('heal_results', r, tenant_id)
    return r

@router.get('/tenants')
def tenants(): return db.list_tenants()

@router.get('/db/status')
def db_status(): return db.status()

@router.get('/history')
def history(kind: str = 'pr_checks', limit: int = 10, tenant_id: str = Depends(current_tenant)):
    """Most recent stored results for the demo tenant. Empty list when no database is configured."""
    return db.recent(kind, max(1, min(limit, 50)), tenant_id)

@router.get('/brief')
async def brief(scenario: str | None = None, pr: int | None = None, tenant_id: str = Depends(current_tenant)):
    sc = scenario.strip() if scenario else None
    if not sc and pr is None: sc = 'db_latency'
    evidence = build_evidence(scenario=sc, pr_id=pr)
    async def gen():
        text = ''
        async for event in stream_brief_events(evidence, stream_delay=0.01):
            if event.get('chunk'): text += event['chunk']
            if event.get('done') and text.strip():
                db.save('incidents', {'scenario': sc, 'pr_id': pr, 'brief': text, 'source': event.get('source')}, tenant_id)
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(gen(), media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'})
@router.get('/projects')
def list_projects_api(tenant_id: str = Depends(current_tenant)):
    return db.list_projects(tenant_id)

@router.get('/projects/{project_id}')
def get_project_api(project_id: str, tenant_id: str = Depends(current_tenant)):
    p = db.get_project(tenant_id, project_id)
    if not p: raise HTTPException(404, "Project not found")
    return p

@router.post('/projects')
def create_project_api(body: dict, tenant_id: str = Depends(current_tenant)):
    try:
        return db.create_project(tenant_id, body)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.patch('/projects/{project_id}')
def update_project_api(project_id: str, body: dict, tenant_id: str = Depends(current_tenant)):
    p = db.update_project(tenant_id, project_id, body)
    if not p: raise HTTPException(404, "Project not found")
    return p

@router.delete('/projects/{project_id}')
def delete_project_api(project_id: str, tenant_id: str = Depends(current_tenant)):
    if not db.delete_project(tenant_id, project_id):
        raise HTTPException(404, "Project not found")
    return {"ok": True}

@router.get('/projects/{project_id}/topology')
def get_topology(project_id: str, tenant_id: str = Depends(current_tenant)):
    """Return the custom topology stored for a project, or None if not yet set."""
    p = db.get_project(tenant_id, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return p.get("topology") or None

@router.put('/projects/{project_id}/topology')
def save_topology(project_id: str, body: dict, tenant_id: str = Depends(current_tenant)):
    """Persist a custom topology for a project. Overwrites the previous one."""
    from .schemas import TopologySave
    try:
        TopologySave(**body)   # validate shape
    except Exception as e:
        raise HTTPException(400, f"Invalid topology: {e}")
    p = db.update_project(tenant_id, project_id, {"topology": body, "services": len(body.get("nodes", []))})
    if not p:
        raise HTTPException(404, "Project not found")
    return {"ok": True, "nodes": len(body.get("nodes", [])), "edges": len(body.get("edges", []))}

@router.post('/projects/{project_id}/simulate')
def simulate_project(project_id: str, tenant_id: str = Depends(current_tenant)):
    """Run all 3 fault scenarios against the project's custom topology and return a resilience report."""
    from .sim.topo_adapter import build_sim_structures
    from .sim.engine import run as sim_run, window, score as sim_score
    from .sim.config import DEFAULT_SEVERITY

    p = db.get_project(tenant_id, project_id)
    if not p:
        raise HTTPException(404, "Project not found")

    topo = p.get("topology")
    if not topo or not topo.get("nodes"):
        raise HTTPException(400, "No custom topology saved for this project yet. Build one in the Topology Editor first.")

    services, order, downstream, edges = build_sim_structures(topo)

    # We need the sim engine to use our custom services/order/downstream instead of the hardcoded ones.
    # Run the reference_sim directly since it accepts arbitrary edges, services, order, downstream.
    import copy, math, random

    def _run(fault=None, severity=3.0, ticks=60, seed=7):
        NO_TIMEOUT = 30000
        rnd = random.Random(seed)
        state = {s: {"resp": services[s]["base"], "succ": 1.0, "own": services[s]["base"], "rho": 0.0, "load": 0.0} for s in order}
        out = []
        for t in range(-10, ticks):
            mult = {s: 1.0 for s in order}; down = set(); load_mult = 1.0
            if fault and t >= 10:
                if fault == "db_latency":
                    # degrade the first leaf node (highest latency base)
                    leaf = max((s for s in order if not downstream.get(s)), key=lambda s: services[s]["base"], default=order[-1])
                    mult[leaf] = severity
                elif fault == "service_down":
                    # bring down the second node in topo order
                    if len(order) > 1: down.add(order[1])
                elif fault == "traffic_spike":
                    load_mult = severity

            L0 = services[order[0]]["base"] * 5 * load_mult * (1 + rnd.gauss(0, 0.02))
            edge_cache = {}
            for (a, b), cfg in edges.items():
                cb = state.get(b, {"resp": 100, "succ": 1.0})
                if b in down: cb = {"resp": 5.0, "succ": 0.0}
                R, p_succ = cb["resp"], cb["succ"]
                T = cfg["timeout"] or NO_TIMEOUT
                if cfg["breaker"] and p_succ < 0.5:
                    edge_cache[(a,b)] = (1.0 if cfg["fallback"] else 0.0, 2.0, 0.0)
                else:
                    p_att = p_succ * (1 - math.exp(-((T/R)**2)))
                    t_att = min(R, T); q, k = 1 - p_att, cfg["retries"]
                    attempts = (k+1) if q >= 0.999999 else (1 - q**(k+1))/(1-q)
                    succ_e = 1.0 if cfg["fallback"] else 1 - q**(k+1)
                    edge_cache[(a,b)] = (succ_e, t_att*attempts, attempts)

            lam = {s: 0.0 for s in order}; lam[order[0]] = L0
            for s in order:
                r = lam[s]; prior_ok = 1.0
                for d in downstream.get(s, []):
                    if (s,d) not in edge_cache: continue
                    succ_e, ms, att = edge_cache[(s,d)]
                    lam[d] += r * prior_ok * att; prior_ok *= succ_e

            new = {}
            for s in reversed(order):
                cap_eff = services[s]["cap"] / mult.get(s, 1.0)
                rho = lam[s] / cap_eff if cap_eff else 9
                own = services[s]["base"] * mult.get(s,1.0) * (1 + rnd.gauss(0, 0.03)) / (1 - min(rho, 0.95))
                serve = 0.0 if s in down else min(1.0, 1/rho) if rho > 1 else 1.0
                resp, prior_ok = own, 1.0
                for d in downstream.get(s, []):
                    if (s,d) not in edge_cache: continue
                    succ_e, ms, _ = edge_cache[(s,d)]
                    resp += prior_ok * ms; prior_ok *= succ_e
                new[s] = {"resp": resp, "succ": serve * prior_ok, "own": own, "rho": rho, "load": lam[s]}
            state = new
            if t >= 0:
                fr = state[order[0]]
                out.append({"t": t, "p95": min(1.5*fr["resp"], 3000), "err": 1 - fr["succ"]})
        return out

    def _window(out):
        w = [o for o in out if 20 <= o["t"] < 60]
        if not w: return 0.0, 0.0
        return sum(o["p95"] for o in w)/len(w), sum(o["err"] for o in w)/len(w)

    base_p95, base_err = _window(_run(None))
    results = {}
    penalties = {}
    for sc, sev in DEFAULT_SEVERITY.items():
        p95, err = _window(_run(sc, sev))
        e_pen = min(1.0, err / 0.5)
        l_pen = min(1.0, max(0.0, (p95/base_p95 - 1)/3)) if base_p95 > 0 else 0
        pen = round(0.6*e_pen + 0.4*l_pen, 3)
        penalties[sc] = pen
        results[sc] = {"p95_ms": round(p95), "error_rate": round(err, 3), "base_p95_ms": round(base_p95), "base_err": round(base_err, 3)}

    resilience_score = round(100 * (1 - sum(penalties.values()) / len(penalties)))
    report = {
        "project_id": project_id,
        "score": resilience_score,
        "nodes": len(topo.get("nodes", [])),
        "edges_count": len(topo.get("edges", [])),
        "scenarios": results,
        "penalties": penalties,
        "baseline": {"p95_ms": round(base_p95), "error_rate": round(base_err, 3)},
    }

    # Persist result into the project's sim history
    from datetime import datetime, timezone
    sim_record = {
        "name": f"Fault scan · {len(topo.get('nodes', []))} nodes",
        "when": datetime.now(timezone.utc).strftime("%b %d, %H:%M"),
        "result": f"Score {resilience_score} · {', '.join(sc for sc, p in penalties.items() if p > 0.3)}",
    }
    db.update_project(tenant_id, project_id, {
        "score": resilience_score,
        "last_sim": sim_record["name"],
    })

    return report

@router.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    try:
        if state.mode == "replay":
            # Recorded runs are already TickMessage-shaped; stream them at 1 tick per second.
            scenario = state.scenario or "db_latency"
            for tick in load_replay_fixture(scenario).get("ticks", []):
                await ws.send_json(tick)
                await asyncio.sleep(1.0)
            await ws.close()
        else:
            state.clients.add(ws)
            await state.start()
            while True:
                await ws.receive_text()  # keeps the socket open; raises on disconnect
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        state.clients.discard(ws)
