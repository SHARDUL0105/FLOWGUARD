from ..sim.topology import BASE_EDGES

def scan(pr_edges, changed_edges=None):
    findings=[]
    changed_edges=set(pr_edges) if changed_edges is None else changed_edges
    for edge in changed_edges:
        cfg=pr_edges[edge]; a,b=edge; key=f"{a}->{b}"
        if cfg["timeout"] is None or cfg["timeout"] > BASE_EDGES[edge]["timeout"]:
            findings.append({"rule":"R1_TIMEOUT","severity":"high","edge":key,"message":f"No effective timeout on {key}; callers can hang until the gateway gives up.","evidence":f"timeout_ms: {cfg['timeout']}"})
        if cfg["retries"] >= 3:
            findings.append({"rule":"R2_RETRY_STORM","severity":"high","edge":key,"message":f"{cfg['retries']} retries without backoff multiplies load on a struggling dependency.","evidence":f"retries: {cfg['retries']}"})
        if not cfg["breaker"] and not cfg["fallback"] and b != "database":
            findings.append({"rule":"R3_NO_FALLBACK","severity":"medium","edge":key,"message":f"No circuit breaker or fallback on changed edge {key}.","evidence":f"breaker: {cfg['breaker']}, fallback: {cfg['fallback']}"})
    return findings
