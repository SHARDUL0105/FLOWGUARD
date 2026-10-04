from __future__ import annotations

import copy
import math
import random
from dataclasses import dataclass
from typing import Dict, Optional

from .config import BASE_LOAD, DEFAULT_SEVERITY, FAULT_AT, NO_TIMEOUT, SEED, TICKS
from .faults import apply_fault, validate_scenario
from .topology import BASE_EDGES, DOWNSTREAM, ORDER, SERVICES


@dataclass
class TickResult:
    t: int
    p95: float
    err: float
    nodes: dict


def edge_attempt(cfg, callee_prev):
    R, p = callee_prev["resp"], callee_prev["succ"]
    T = cfg["timeout"] or NO_TIMEOUT
    if cfg["breaker"] and p < 0.5:
        return (1.0 if cfg["fallback"] else 0.0), 2.0, 0.0
    p_att = p * (1 - math.exp(-((T / R) ** 2)))
    t_att = min(R, T)
    q, k = 1 - p_att, cfg["retries"]
    attempts = (k + 1) if q >= 0.999999 else (1 - q ** (k + 1)) / (1 - q)
    succ = 1 - q ** (k + 1)
    if cfg["fallback"]:
        succ = 1.0
    return succ, t_att * attempts, attempts


class Simulator:
    """Faithful modular port of reference_sim.py Appendix A."""

    def __init__(self, edges=None, seed=SEED, scenario=None, severity=None, fault_at=FAULT_AT):
        self.edges = copy.deepcopy(edges or BASE_EDGES)
        self.seed = seed
        self.rnd = random.Random(seed)
        self.scenario = scenario
        self.severity = DEFAULT_SEVERITY.get(scenario, 3.0) if severity is None else severity
        self.fault_at = fault_at
        self.t = -10
        self.state = {
            s: {"resp": SERVICES[s]["base"], "succ": 1.0, "own": SERVICES[s]["base"], "rho": 0.0, "load": 0.0}
            for s in ORDER
        }

    def step(self) -> Optional[TickResult]:
        t = self.t
        self.t += 1
        mult, down, load_mult = apply_fault(self.scenario, self.severity, t, self.fault_at, ORDER)
        L0 = BASE_LOAD * load_mult * (1 + self.rnd.gauss(0, 0.02))
        edge = {}
        for (a, b), cfg in self.edges.items():
            cb = self.state[b]
            if b in down:
                cb = {"resp": 5.0, "succ": 0.0}
            edge[(a, b)] = edge_attempt(cfg, cb)

        lam = {s: 0.0 for s in ORDER}
        lam["frontend"] = L0
        for s in ORDER:
            r = lam[s]
            prior_ok = 1.0
            for d in DOWNSTREAM[s]:
                succ, ms, att = edge[(s, d)]
                lam[d] += r * prior_ok * att
                prior_ok *= succ

        new = {}
        for s in reversed(ORDER):
            cap_eff = SERVICES[s]["cap"] / mult[s]
            rho = lam[s] / cap_eff if cap_eff else 9
            own = SERVICES[s]["base"] * mult[s] * (1 + self.rnd.gauss(0, 0.03)) / (1 - min(rho, 0.95))
            serve = 0.0 if s in down else min(1.0, 1 / rho) if rho > 1 else 1.0
            resp, prior_ok = own, 1.0
            for d in DOWNSTREAM[s]:
                succ, ms, _ = edge[(s, d)]
                resp += prior_ok * ms
                prior_ok *= succ
            new[s] = {"resp": resp, "succ": serve * prior_ok, "own": own, "rho": rho, "load": lam[s]}
        self.state = new
        if t >= 0:
            fr = self.state["frontend"]
            return TickResult(t=t, p95=min(1.5 * fr["resp"], 3000), err=1 - fr["succ"], nodes=copy.deepcopy(self.state))
        return None

    def run(self, ticks=TICKS, include_warmup=True):
        results=[]
        target = -10 if include_warmup else 0
        while len(results) < ticks:
            result=self.step()
            if result is not None and result.t >= target:
                results.append(result)
        return results


def run(edges=BASE_EDGES, fault=None, ticks=60, fault_at=10, seed=7, severity=3.0, record=False):
    sim=Simulator(edges=edges, seed=seed, scenario=fault, severity=severity, fault_at=fault_at)
    out=[]
    while len(out) < ticks:
        result=sim.step()
        if result is not None:
            item={"t":result.t,"p95":result.p95,"err":result.err,"nodes":result.nodes if record else None}
            out.append(item)
    return out


def window(out, a=20, b=60):
    w=[o for o in out if a <= o["t"] < b]
    return sum(o["p95"] for o in w)/len(w), sum(o["err"] for o in w)/len(w)


def score(edges=BASE_EDGES, base=None, verbose=False):
    base=base or window(run(edges, None))
    pens={}
    for sc, sev in DEFAULT_SEVERITY.items():
        p95, err=window(run(edges, sc, severity=sev))
        e_pen=min(1.0, err/0.5)
        l_pen=min(1.0, max(0.0, p95/base[0]-1)/3)
        pens[sc]=(round(p95), round(err,3), round(0.6*e_pen+0.4*l_pen,3))
    return round(100*(1-sum(v[2] for v in pens.values())/len(pens)))


def predict(edges=BASE_EDGES, fault=None, severity=3.0):
    mult={s:1.0 for s in ORDER}; down=set(); lm=1.0
    if fault=="db_latency": mult["database"]=severity
    if fault=="service_down": down.add("inventory")
    if fault=="traffic_spike": lm=severity
    lam={s:0.0 for s in ORDER}; lam["frontend"]=BASE_LOAD*lm
    for s in ORDER:
        for d in DOWNSTREAM[s]: lam[d]+=lam[s]
    own, serve, rhos={},{},{}
    for s in ORDER:
        rho=lam[s]/(SERVICES[s]["cap"]/mult[s]); rhos[s]=rho
        own[s]=SERVICES[s]["base"]*mult[s]/(1-min(rho,0.95))
        serve[s]=0.0 if s in down else (min(1.0,1/rho) if rho>1 else 1.0)
    resp,succ={},{ }
    for s in reversed(ORDER):
        r,ok=own[s],1.0
        for d in DOWNSTREAM[s]:
            cfg=edges[(s,d)]; T=cfg["timeout"] or NO_TIMEOUT
            dr,dp=(5.0,0.0) if d in down else (resp[d],succ[d])
            if cfg["breaker"] and dp<0.5:
                e_succ,e_ms=(1.0 if cfg["fallback"] else 0.0),2.0
            else:
                timed_out=dr>T
                p_att=0.0 if timed_out else dp
                k=cfg["retries"]
                e_succ=1.0 if cfg["fallback"] else 1-(1-p_att)**(k+1)
                e_ms=min(dr,T)*(1+k*(1-p_att))
            r += ok*e_ms; ok *= e_succ
        resp[s],succ[s]=r,serve[s]*ok
    worst=max(rhos.values())
    risk="HIGH" if worst>=0.95 else "MEDIUM" if worst>=0.8 else "LOW"
    return {"p95_ms":min(1.5*resp["frontend"],3000),"error_rate":1-succ["frontend"],
            "utilization":{k:round(v,2) for k,v in rhos.items()},
            "saturated":[k for k,v in rhos.items() if v>=0.95],"risk":risk}
