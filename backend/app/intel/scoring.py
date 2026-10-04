from ..sim.engine import run, window
from ..sim.config import DEFAULT_SEVERITY, SCENARIOS

def resilience_score(edges, base=None):
    base=base or window(run(edges,None))
    per={}
    penalties=[]
    for sc in SCENARIOS:
        p95,err=window(run(edges,sc,severity=DEFAULT_SEVERITY[sc]))
        e_pen=min(1,err/.5); l_pen=min(1,max(0,p95/base[0]-1)/3)
        pen=.6*e_pen+.4*l_pen
        per[sc]={"p95_ms":round(p95),"error_rate":round(err,3),"penalty":round(pen,3)}; penalties.append(pen)
    return round(100*(1-sum(penalties)/len(penalties))), per, {"p95_ms":round(base[0]),"error_rate":round(base[1],3)}
