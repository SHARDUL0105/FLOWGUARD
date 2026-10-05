from .propagation import transitive_callers
from ...sim.topology import CALLERS

def calculate(root):
    direct=list(CALLERS[root]); all_callers=transitive_callers(root); downstream=list(all_callers-set(direct))
    return {"direct":direct,"downstream":downstream,"total":len(all_callers),"checkout_at_risk":"frontend" in all_callers}
