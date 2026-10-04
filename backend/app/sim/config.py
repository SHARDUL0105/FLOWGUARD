from copy import deepcopy
from .topology import BASE_EDGES

NO_TIMEOUT = 30000
BASE_LOAD = 100.0
DEFAULT_SEVERITY = {"db_latency": 3.0, "service_down": 1.0, "traffic_spike": 2.0}
SCENARIOS = ["db_latency", "service_down", "traffic_spike"]
SEED = 7
TICKS = 60
WARMUP_TICKS = 10
FAULT_AT = 10


def clone_edges(edges=None):
    return deepcopy(edges if edges is not None else BASE_EDGES)
