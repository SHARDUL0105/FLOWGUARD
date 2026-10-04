from copy import deepcopy
from ..sim.topology import BASE_EDGES

PR12_DIFF="""--- a/order-service/config.yaml\n+++ b/order-service/config.yaml\n@@ order -> inventory @@\n- timeout_ms: 700\n- retries: 1\n- circuit_breaker: true\n- fallback: true\n+ timeout_ms: null\n+ retries: 4\n+ circuit_breaker: false\n+ fallback: false"""
PR13_DIFF="""--- a/README.md\n+++ b/README.md\n@@\n+ Update README and logging\n"""

PRS={
 12:{"id":12,"title":"Refactor inventory client","author":"dev-a","status":"open","changes":PR12_DIFF},
 13:{"id":13,"title":"Update README and logging","author":"dev-b","status":"open","changes":PR13_DIFF},
}

def list_prs(): return [{k:v for k,v in p.items() if k in ('id','title','author','status')} for p in PRS.values()]

def edges_for_pr(pr_id):
    e=deepcopy(BASE_EDGES)
    if pr_id==12:
        e[("order","inventory")].update(timeout=None,retries=4,breaker=False,fallback=False)
    elif pr_id==14:
        e[("order","payment")]["timeout"]=1000
    return e
