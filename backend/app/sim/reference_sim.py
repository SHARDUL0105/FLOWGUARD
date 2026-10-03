import random, copy, math

SERVICES = {  # base_ms: own latency at zero load; cap: req/s at base latency
    "frontend":  {"base": 20, "cap": 500},
    "gateway":   {"base": 15, "cap": 400},
    "order":     {"base": 40, "cap": 250},
    "inventory": {"base": 30, "cap": 250},
    "payment":   {"base": 60, "cap": 200},
    "database":  {"base": 10, "cap": 600},
}
ORDER = ["frontend", "gateway", "order", "inventory", "payment", "database"]  # callers before callees
DOWNSTREAM = {
    "frontend": ["gateway"], "gateway": ["order"], "order": ["inventory", "payment"],
    "inventory": ["database"], "payment": ["database"], "database": [],
}
NO_TIMEOUT = 30000
BASE_EDGES = {
    ("frontend", "gateway"):  {"timeout": 3000, "retries": 0, "breaker": False, "fallback": False},
    ("gateway", "order"):     {"timeout": 2500, "retries": 0, "breaker": False, "fallback": False},
    ("order", "inventory"):   {"timeout": 700,  "retries": 1, "breaker": True,  "fallback": True},
    ("order", "payment"):     {"timeout": 900,  "retries": 0, "breaker": True,  "fallback": True},
    ("inventory", "database"):{"timeout": 400,  "retries": 1, "breaker": False, "fallback": False},
    ("payment", "database"):  {"timeout": 400,  "retries": 0, "breaker": False, "fallback": False},
}
BASE_LOAD = 100.0
SEVERITY = {"db_latency": 3.0, "service_down": 1.0, "traffic_spike": 2.0}

def edge_attempt(cfg, callee_prev):
    """-> (success_prob, expected_ms, expected_attempts) for one caller->callee edge"""
    R, p = callee_prev["resp"], callee_prev["succ"]
    T = cfg["timeout"] or NO_TIMEOUT
    if cfg["breaker"] and p < 0.5:           # circuit open: fail fast, no load on callee
        return (1.0 if cfg["fallback"] else 0.0), 2.0, 0.0
    p_att = p * (1 - math.exp(-((T / R) ** 2)))   # P(response arrives before timeout), Weibull k=2
    t_att = min(R, T)
    q, k = 1 - p_att, cfg["retries"]
    attempts = (k + 1) if q >= 0.999999 else (1 - q ** (k + 1)) / (1 - q)
    succ = 1 - q ** (k + 1)
    if cfg["fallback"]:
        succ = 1.0                              # degraded-but-successful (e.g. cached stock)
    return succ, t_att * attempts, attempts

def run(edges=BASE_EDGES, fault=None, ticks=60, fault_at=10, seed=7, severity=3.0, record=False):
    rnd = random.Random(seed)
    state = {s: {"resp": SERVICES[s]["base"], "succ": 1.0, "own": SERVICES[s]["base"],
                 "rho": 0.0, "load": 0.0} for s in ORDER}
    out = []
    for t in range(-10, ticks):
        mult = {s: 1.0 for s in ORDER}; down = set(); load_mult = 1.0
        if fault and t >= fault_at:
            if fault == "db_latency": mult["database"] = severity
            if fault == "service_down": down.add("inventory")
            if fault == "traffic_spike": load_mult = severity
        L0 = BASE_LOAD * load_mult * (1 + rnd.gauss(0, 0.02))
        edge = {}                              # (caller,callee) -> (succ, ms, attempts) using PREVIOUS tick callee state
        for (a, b), cfg in edges.items():
            cb = state[b]
            if b in down: cb = {"resp": 5.0, "succ": 0.0}
            edge[(a, b)] = edge_attempt(cfg, cb)
        lam = {s: 0.0 for s in ORDER}; lam["frontend"] = L0
        reach = {s: 1.0 for s in ORDER}
        for s in ORDER:                         # top-down load incl. retries
            r = lam[s]; prior_ok = 1.0
            for d in DOWNSTREAM[s]:
                succ, ms, att = edge[(s, d)]
                lam[d] += r * prior_ok * att
                prior_ok *= succ
        new = {}
        for s in reversed(ORDER):               # bottom-up response + success
            cap_eff = SERVICES[s]["cap"] / mult[s]
            rho = lam[s] / cap_eff if cap_eff else 9
            own = SERVICES[s]["base"] * mult[s] * (1 + rnd.gauss(0, 0.03)) / (1 - min(rho, 0.95))
            serve = 0.0 if s in down else min(1.0, 1 / rho) if rho > 1 else 1.0
            resp, ok, prior_ok = own, 1.0, 1.0
            for d in DOWNSTREAM[s]:
                succ, ms, att = edge[(s, d)]
                resp += prior_ok * ms; prior_ok *= succ
            new[s] = {"resp": resp, "succ": serve * prior_ok, "own": own, "rho": rho, "load": lam[s]}
        state = new
        if t >= 0:
            fr = state["frontend"]
            out.append({"t": t, "p95": min(1.5 * fr["resp"], 3000), "err": 1 - fr["succ"],
                        "nodes": copy.deepcopy(state) if record else None})
    return out

def window(out, a=20, b=60):
    w = [o for o in out if a <= o["t"] < b]
    return sum(o["p95"] for o in w) / len(w), sum(o["err"] for o in w) / len(w)

SCENARIOS = ["db_latency", "service_down", "traffic_spike"]
def score(edges=BASE_EDGES, base=None, verbose=False):
    base = base or window(run(edges, None))
    pens = {}
    for sc in SCENARIOS:
        p95, err = window(run(edges, sc, severity=SEVERITY[sc]))
        e_pen = min(1.0, err / 0.5)
        l_pen = min(1.0, max(0.0, p95 / base[0] - 1) / 3)
        pens[sc] = (round(p95), round(err, 3), round(0.6 * e_pen + 0.4 * l_pen, 3))
    s = round(100 * (1 - sum(v[2] for v in pens.values()) / len(pens)))
    if verbose: print(pens)
    return s

if __name__ == "__main__":
    b = window(run(BASE_EDGES, None)); print("baseline p95/err", b)
    print("base score", score(verbose=True))


# ---------------- analytic predictor (deliberately simpler than the simulator) ----------------
def predict(edges=BASE_EDGES, fault=None, severity=3.0):
    """Steady-state closed-form forecast. Ignores: retry load amplification, per-tick lag, noise,
    smooth timeout tails (uses a hard timeout threshold). Returns dict incl. risk level."""
    mult = {s: 1.0 for s in ORDER}; down = set(); lm = 1.0
    if fault == "db_latency": mult["database"] = severity
    if fault == "service_down": down.add("inventory")
    if fault == "traffic_spike": lm = severity
    lam = {s: 0.0 for s in ORDER}; lam["frontend"] = BASE_LOAD * lm
    for s in ORDER:
        for d in DOWNSTREAM[s]:
            lam[d] += lam[s]                           # one attempt per request (no retry load)
    own, serve, rhos = {}, {}, {}
    for s in ORDER:
        rho = lam[s] / (SERVICES[s]["cap"] / mult[s]); rhos[s] = rho
        own[s] = SERVICES[s]["base"] * mult[s] / (1 - min(rho, 0.95))
        serve[s] = 0.0 if s in down else (min(1.0, 1 / rho) if rho > 1 else 1.0)
    resp, succ = {}, {}
    for s in reversed(ORDER):
        r, ok = own[s], 1.0
        for d in DOWNSTREAM[s]:
            cfg = edges[(s, d)]; T = cfg["timeout"] or NO_TIMEOUT
            dr, dp = (5.0, 0.0) if d in down else (resp[d], succ[d])
            if cfg["breaker"] and dp < 0.5:
                e_succ, e_ms = (1.0 if cfg["fallback"] else 0.0), 2.0
            else:
                timed_out = dr > T
                p_att = 0.0 if timed_out else dp
                k = cfg["retries"]
                e_succ = 1.0 if cfg["fallback"] else 1 - (1 - p_att) ** (k + 1)
                e_ms = min(dr, T) * (1 + k * (1 - p_att))
            r += ok * e_ms; ok *= e_succ
        resp[s], succ[s] = r, serve[s] * ok
    worst = max(rhos.values())
    risk = "HIGH" if worst >= 0.95 else "MEDIUM" if worst >= 0.8 else "LOW"
    return {"p95_ms": min(1.5 * resp["frontend"], 3000), "error_rate": 1 - succ["frontend"],
            "utilization": {k: round(v, 2) for k, v in rhos.items()},
            "saturated": [k for k, v in rhos.items() if v >= 0.95], "risk": risk}
