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
