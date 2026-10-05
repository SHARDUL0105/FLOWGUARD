"""Runs the real engine and writes fixtures/ in the exact API shapes (Brief Section 13)."""
from pathlib import Path
import json

from backend.app.sim.engine import run, window
from backend.app.sim.topology import topology_json, BASE_EDGES
from backend.app.sim.config import DEFAULT_SEVERITY, SCENARIOS, FAULT_AT
from backend.app.sim.engine import Simulator
from backend.app.state import AppState
from backend.app.intel.runtime.predictor import what_if
from backend.app.intel.runtime.scoring import resilience_score
from backend.app.pr.prs import list_prs
from backend.app.pr.service import analyze_pr, heal_pr

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures"
OUT.mkdir(exist_ok=True)
FRONT = ROOT / "frontend" / "public" / "fixtures"
N_TICKS = 40


def write(name, data):
    text = json.dumps(data, indent=1)
    (OUT / name).write_text(text)
    if FRONT.exists():
        (FRONT / name).write_text(text)


def record_run(scenario):
    """40 TickMessages (t=0..39), fault at tick 10, produced by the same code path as live mode."""
    st = AppState()
    st.mode = "replay"
    st.configure_fault(scenario, DEFAULT_SEVERITY[scenario])
    ticks = []
    while len(ticks) < N_TICKS:
        r = st.sim.step()
        if r is None:
            continue
        ticks.append(st.make_tick(r))
    return {"scenario": scenario, "ticks": ticks}


def main():
    write("topology.json", topology_json())
    for sc in SCENARIOS:
        write(f"run.{sc}.json", record_run(sc))
    base = window(run(BASE_EDGES, None))
    rows = []
    for sc in SCENARIOS:
        p, e = window(run(BASE_EDGES, sc, severity=DEFAULT_SEVERITY[sc]))
        rows.append({"scenario": sc, "p95_ms": round(p), "error_rate": round(e, 3)})
    score, _, _ = resilience_score(BASE_EDGES)
    write("graph.healthy.json", {"baseline": {"p95_ms": round(base[0]), "error_rate": round(base[1], 3)}, "score": score, "scenarios": rows})
    write("pr.list.json", list_prs())
    write("pr.risky.analyze.json", analyze_pr(12))
    write("pr.safe.analyze.json", analyze_pr(13))
    write("pr.risky.heal.json", heal_pr(12))
    write("whatif.db_latency.json", [what_if(BASE_EDGES, "db_latency", f) for f in [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]])
    print(f"Fixtures written to {OUT}" + (f" and {FRONT}" if FRONT.exists() else ""))


if __name__ == "__main__":
    main()
