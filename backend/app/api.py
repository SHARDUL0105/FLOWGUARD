"""Owner: Abhiraj. All routes. Working: health, topology, chaos/reset (state only), ws (healthy stub).
Everything else returns 501 until the owner fills it in."""
import asyncio, json, pathlib
from fastapi import APIRouter, HTTPException, WebSocket
from .schemas import ChaosRequest, WhatIfRequest, DemoModeRequest
from .state import STATE
from .pr.prs import get_pr, pr_edges
from .pr.scanner import scan
from .pr.heal import heal
from .pr.gate import gate
from .sim.reference_sim import BASE_EDGES

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
def pr_list(): _todo("Vaishnavi: pr.prs")
@router.post("/api/pr/{pr_id}/analyze")
def pr_analyze(pr_id: str): _todo("Vaishnavi: pr.scanner + intel.scoring")
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
def brief(scenario: str = "", pr: str = ""): _todo("Vaishnavi: ai.brief (SSE)")

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
