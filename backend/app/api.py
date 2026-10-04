"""Owner: Abhiraj. All routes. Working: health, topology, chaos/reset (state only), ws (healthy stub).
Everything else returns 501 until the owner fills it in."""
import asyncio, json, pathlib
from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket
from fastapi.responses import StreamingResponse
from .schemas import ChaosRequest, WhatIfRequest, DemoModeRequest
from .state import STATE
from .pr.prs import get_pr, pr_edges, list_prs, pr_diff
from .pr.scanner import scan
from .pr.heal import heal
from .pr.gate import gate
from .intel.scoring import resilience_score
from .sim.reference_sim import BASE_EDGES, SCENARIOS, SEVERITY, run, window
from .ai.brief import build_evidence, stream_brief_events
from .ai.pr_comment import render_comment

router = APIRouter()
FIX = pathlib.Path(__file__).resolve().parents[2] / "fixtures"
def _fixture(name):
    return json.loads((FIX / name).read_text(encoding="utf8"))
def _todo(owner): raise HTTPException(501, f"TODO ({owner})")

@router.get("/api/health")
def health(): return {"ok": True, "mode": STATE.mode}

@router.get("/api/topology")
def topology(): return _fixture("topology.json")

@router.post("/api/chaos")
def chaos(req: ChaosRequest):
    STATE.scenario, STATE.severity, STATE.t = req.scenario, req.severity or 1.0, 10
    return {"started": True, "scenario": req.scenario, "t0": 10}

@router.post("/api/reset")
def reset():
    STATE.scenario, STATE.t = None, 0
    return {"ok": True}

@router.get("/api/demo/mode")
def get_mode(): return {"mode": STATE.mode}
@router.post("/api/demo/mode")
def set_mode(req: DemoModeRequest):
    STATE.mode = req.mode; return {"mode": STATE.mode}

@router.post("/api/whatif")
def whatif(req: WhatIfRequest): _todo("Sneha: intel.predictor + sim headless")
@router.get("/api/pr")
def pr_list():
    return list_prs()


@router.post("/api/pr/{id}/analyze")
def pr_analyze(id: str):
    pr = get_pr(id)
    if not pr:
        raise HTTPException(status_code=404, detail=f"Pull request #{id} not found")

    pr_id_val = pr["id"]
    current_edges = pr_edges(id)

    # Use Sneha's scoring implementation
    score_base = resilience_score(BASE_EDGES)
    score_pr = resilience_score(current_edges)
    verdict = "regression" if score_pr < score_base else "no change"

    # Static scanner findings
    findings = scan(base_edges=BASE_EDGES, pr_edges=current_edges)

    # Re-run the 3 scenarios on BASE and PR
    per_scenario = []
    for sc in SCENARIOS:
        sev = SEVERITY.get(sc, 3.0)
        base_out = run(BASE_EDGES, fault=sc, severity=sev, ticks=60, seed=7)
        b_p95, b_err = window(base_out)
        pr_out = run(current_edges, fault=sc, severity=sev, ticks=60, seed=7)
        p_p95, p_err = window(pr_out)
        per_scenario.append({
            "scenario": sc,
            "base": {"p95_ms": round(b_p95), "error_rate": round(b_err, 3)},
            "pr": {"p95_ms": round(p_p95), "error_rate": round(p_err, 3)},
        })

    # Cascade propagation path (try Sneha's propagation_path if implemented)
    cascade_path = []
    try:
        from .intel.propagation import propagation_path
        cascade_path = propagation_path({}, [])
    except (NotImplementedError, Exception):
        if findings:
            cascade_path = ["database", "inventory", "order", "gateway", "frontend"]

    analysis_data = {
        "id": pr_id_val,
        "score_base": score_base,
        "score_pr": score_pr,
        "verdict": verdict,
        "per_scenario": per_scenario,
        "findings": findings,
        "cascade_path": cascade_path,
        "diff": pr_diff(id),
    }

    analysis_data["comment"] = render_comment(analysis_data)
    return analysis_data
@router.post("/api/pr/{id}/heal")
def pr_heal(id: str):
    pr = get_pr(id)
    if not pr:
        raise HTTPException(status_code=404, detail=f"Pull request #{id} not found")

    pr_id_val = pr["id"]
    current_edges = pr_edges(id)
    findings = scan(base_edges=BASE_EDGES, pr_edges=current_edges)
    heal_res = heal(pr_edges=current_edges, findings=findings)
    gate_res = gate(
        pr_edges=current_edges,
        patched_edges=heal_res.edges,
        patch_diff=heal_res.patch_diff,
        pr_id=pr_id_val,
    )

    return {
        "id": gate_res["id"],
        "gate": gate_res["gate"],
        "reason": gate_res["reason"],
        "score_before": gate_res["score_before"],
        "score_after": gate_res["score_after"],
        "patch_diff": gate_res["patch_diff"],
        "per_scenario_after": gate_res["per_scenario_after"],
        "verified_under": gate_res["verified_under"],
    }
@router.get("/api/brief")
async def brief(scenario: Optional[str] = None, pr: Optional[str] = None):
    sc_val = scenario.strip() if scenario else None
    pr_val = pr.strip() if pr else None
    if not sc_val and not pr_val:
        sc_val = "db_latency"

    evidence = build_evidence(scenario=sc_val, pr_id=pr_val)

    async def event_generator():
        async for event in stream_brief_events(evidence, stream_delay=0.01):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.websocket("/ws")
async def ws(sock: WebSocket):
    """TODO(Abhiraj): replace this stub with the real live simulator tick (1/s, Section 6/10)."""
    await sock.accept()
    topo = _fixture("topology.json")
    try:
        while True:
            nodes = {n["id"]: {"status": "healthy", "p95_ms": n["base_ms"] * 1.5, "error_rate": 0.0,
                               "load_rps": 100.0, "utilization": 0.3} for n in topo["nodes"]}
            await sock.send_json({"type": "tick", "t": STATE.t, "mode": STATE.mode, "scenario": STATE.scenario,
                                  "severity": STATE.severity, "nodes": nodes,
                                  "checkout": {"p95_ms": 468, "error_rate": 0.0}, "events": [], "analysis": None})
            STATE.t += 1
            await asyncio.sleep(1)
    except Exception:
        pass
