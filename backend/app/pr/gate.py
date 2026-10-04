from ..intel.scoring import resilience_score
from ..sim.engine import run, window
from ..sim.config import SCENARIOS, DEFAULT_SEVERITY

def evaluate(base_edges, pr_edges, healed_edges, score_pr):
    after_score, _, baseline = resilience_score(healed_edges)
    rows=[]
    worse=False
    for sc in SCENARIOS:
        pr_p95, pr_err=window(run(pr_edges, sc, severity=DEFAULT_SEVERITY[sc]))
        after_p95, after_err=window(run(healed_edges, sc, severity=DEFAULT_SEVERITY[sc]))
        rows.append({"scenario":sc,"p95_ms":round(after_p95),"error_rate":round(after_err,3)})
        if after_err > pr_err + 0.001: worse=True
    smoke_p95, _ = window(run(healed_edges, None))
    accepted=(after_score >= score_pr + 15 and not worse and smoke_p95 <= baseline["p95_ms"]*1.10)
    reason=None if accepted else "Acceptance gate conditions were not all satisfied."
    return accepted, reason, after_score, rows
