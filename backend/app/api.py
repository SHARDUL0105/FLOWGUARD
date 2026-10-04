from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from types import SimpleNamespace
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from .schemas import ChaosRequest, DemoModeRequest, WhatIfRequest
from .state import state
from .sim.topology import topology_json, BASE_EDGES
from .sim.config import DEFAULT_SEVERITY, SCENARIOS
from .sim.engine import run, window
from .intel.predictor import what_if
from .intel.scoring import resilience_score
from .pr.prs import list_prs, PRS, edges_for_pr
from .pr.scanner import scan
from .pr.heal import heal_edges
from .pr.gate import evaluate
from .ai.pr_comment import render_comment
from .ai.brief import stream_brief

router=APIRouter(prefix="/api")
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
def prs(): return list_prs()

@router.post('/pr/{pr_id}/analyze')
def analyze(pr_id:int):
    if pr_id not in PRS: raise HTTPException(404,'PR not found')
    base_edges=BASE_EDGES; pr_edges=edges_for_pr(pr_id)
    score_base, _, base = resilience_score(base_edges)
    score_pr,_,_=resilience_score(pr_edges)
    findings=scan(pr_edges, {e for e in pr_edges if pr_edges[e]!=base_edges[e]})
    per=[]
    for sc in SCENARIOS:
        bp,be=window(run(base_edges,sc,severity=DEFAULT_SEVERITY[sc])); pp,pe=window(run(pr_edges,sc,severity=DEFAULT_SEVERITY[sc]))
        per.append({"scenario":sc,"base":{"p95_ms":round(bp),"error_rate":round(be,3)},"pr":{"p95_ms":round(pp),"error_rate":round(pe,3)}})
    result={"id":pr_id,"score_base":score_base,"score_pr":score_pr,"verdict":"regression" if score_pr<score_base else "pass","per_scenario":per,"findings":findings,"cascade_path":["database","inventory","order","gateway","frontend"] if pr_id==12 else [],"diff":PRS[pr_id]['changes'],"comment":""}
    result['comment']=render_comment(result)
    return result

@router.post('/pr/{pr_id}/heal')
def heal(pr_id:int):
    if pr_id not in PRS: raise HTTPException(404,'PR not found')
    pr_edges=edges_for_pr(pr_id); findings=scan(pr_edges,{e for e in pr_edges if pr_edges[e]!=BASE_EDGES[e]})
    patched,diff=heal_edges(pr_edges,findings)
    score_pr,_,_=resilience_score(pr_edges); accepted,reason,after_score,rows=evaluate(BASE_EDGES,pr_edges,patched,score_pr)
    return {"id":pr_id,"gate":"accepted" if accepted else "rejected","reason":reason,"score_before":score_pr,"score_after":after_score,"patch_diff":diff,"per_scenario_after":rows,"verified_under":SCENARIOS}

@router.get('/brief')
async def brief(scenario:str='db_latency', pr:int|None=None):
    if pr is not None:
        analysis=analyze(pr); evidence={"scenario":"pr","severity":1,"root_cause":[{"node":"database","confidence":0.71}],"propagation_path":analysis['cascade_path'],"blast_radius":{"total":5,"checkout_at_risk":True},"p95_ms":analysis['per_scenario'][0]['pr']['p95_ms'],"error_rate":analysis['per_scenario'][0]['pr']['error_rate']}
    else:
        # Use a representative measured tick from a deterministic run so the brief is usable before live data exists.
        out=run(BASE_EDGES,scenario,severity=DEFAULT_SEVERITY.get(scenario,3.0)); p95,err=window(out)
        evidence={"scenario":scenario,"severity":DEFAULT_SEVERITY.get(scenario,3.0),"root_cause":[{"node":"database" if scenario=='db_latency' else 'inventory' if scenario=='service_down' else 'payment',"confidence":0.71}],"propagation_path":["database","inventory","order","gateway","frontend"] if scenario=='db_latency' else [],"blast_radius":{"total":5,"checkout_at_risk":True},"p95_ms":round(p95),"error_rate":round(err,3)}
    text,source=await stream_brief(evidence)
    async def gen():
        for i in range(0,len(text),40):
            yield f"data: {json.dumps({'chunk':text[i:i+40]})}\n\n"
            await asyncio.sleep(1.0)
        yield f"data: {json.dumps({'done':True,'source':source})}\n\n"
    return StreamingResponse(gen(),media_type='text/event-stream',headers={'Cache-Control':'no-cache','Connection':'keep-alive'})

@router.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    state.clients.add(ws)

    try:
        if state.mode == "replay":
            scenario = state.scenario or "db_latency"

            fixture = load_replay_fixture(scenario)

            # Isolated state is used only to transform the recorded
            # simulator ticks into the normal API TickMessage shape.
            from .state import AppState

            temp = AppState()
            temp.mode = "replay"
            temp.configure_fault(
                scenario,
                DEFAULT_SEVERITY[scenario],
            )

            for item in fixture["ticks"]:
                result = SimpleNamespace(
                    t=item["t"],
                    p95=item["p95"],
                    err=item["err"],
                    nodes=item["nodes"],
                )

                message = temp.make_tick(result)

                await ws.send_json(message)
                await asyncio.sleep(0.025)

            await ws.close()

        else:
            await state.start()

            while True:
                await asyncio.sleep(60)

    except WebSocketDisconnect:
        pass

    finally:
        state.clients.discard(ws)
