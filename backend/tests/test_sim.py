from backend.app.sim.engine import run, window, score
from backend.app.sim.topology import BASE_EDGES
from backend.app.intel.scoring import resilience_score

def test_deterministic():
    assert run(BASE_EDGES,None)==run(BASE_EDGES,None)

def test_reference_numbers():
    p,e=window(run(BASE_EDGES,None)); assert round(p)==468; assert round(e,3)==0
    assert score(BASE_EDGES)==84
    p,e=window(run(BASE_EDGES,'db_latency',severity=3)); assert round(p)==628; assert round(e,3)==0.004
    p,e=window(run(BASE_EDGES,'service_down',severity=1)); assert round(p)==369; assert round(e,3)==0
    p,e=window(run(BASE_EDGES,'traffic_spike',severity=2)); assert round(p)==2018; assert round(e,3)==0.028

def test_predictor_shape():
    from backend.app.sim.engine import predict
    x=predict(BASE_EDGES,'db_latency',2.5)
    assert set(x)=={'p95_ms','error_rate','utilization','saturated','risk'}
