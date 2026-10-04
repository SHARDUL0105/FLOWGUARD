from backend.app.sim.engine import run, window, score
from backend.app.sim.topology import BASE_EDGES
print('baseline', window(run(BASE_EDGES,None)))
print('score', score(BASE_EDGES))
print('db_latency', window(run(BASE_EDGES,'db_latency',severity=3)))
print('service_down', window(run(BASE_EDGES,'service_down',severity=1)))
print('traffic_spike', window(run(BASE_EDGES,'traffic_spike',severity=2)))
