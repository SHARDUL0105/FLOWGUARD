from copy import deepcopy
from ..sim.topology import BASE_EDGES

def heal_edges(edges, findings):
    patched=deepcopy(edges); changes=[]
    for f in findings:
        edge=tuple(f["edge"].split("->")); cfg=patched[edge]
        if f["rule"]=="R1_TIMEOUT":
            upstream_timeout=2500 if edge == ("order", "inventory") else BASE_EDGES[edge]["timeout"]
            cfg["timeout"]=min(700, .3*upstream_timeout) if upstream_timeout else 700
            changes.append(f"+ timeout_ms: {cfg['timeout']:.0f}")
        elif f["rule"]=="R2_RETRY_STORM":
            cfg["retries"]=1; changes.append("+ retries: 1")
        elif f["rule"]=="R3_NO_FALLBACK":
            cfg["breaker"]=True; cfg["fallback"]=True; changes += ["+ circuit_breaker: true","+ fallback: true"]
    return patched, "@@ order -> inventory @@\n"+"\n".join(changes)
