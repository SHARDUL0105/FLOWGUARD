from __future__ import annotations

from typing import Dict, List, Tuple

SERVICES = {
    "frontend": {"base": 20, "cap": 500, "layer": 0, "label": "Frontend"},
    "gateway": {"base": 15, "cap": 400, "layer": 1, "label": "Gateway"},
    "order": {"base": 40, "cap": 250, "layer": 2, "label": "Order"},
    "inventory": {"base": 30, "cap": 250, "layer": 3, "label": "Inventory"},
    "payment": {"base": 60, "cap": 200, "layer": 3, "label": "Payment"},
    "database": {"base": 10, "cap": 600, "layer": 4, "label": "Database"},
}
ORDER = ["frontend", "gateway", "order", "inventory", "payment", "database"]
DOWNSTREAM = {
    "frontend": ["gateway"],
    "gateway": ["order"],
    "order": ["inventory", "payment"],
    "inventory": ["database"],
    "payment": ["database"],
    "database": [],
}
CALLERS: Dict[str, List[str]] = {s: [] for s in ORDER}
for caller in ORDER:
    for callee in DOWNSTREAM[caller]:
        CALLERS[callee].append(caller)

EDGE_KEYS: List[Tuple[str, str]] = [
    ("frontend", "gateway"),
    ("gateway", "order"),
    ("order", "inventory"),
    ("order", "payment"),
    ("inventory", "database"),
    ("payment", "database"),
]

NODE_POSITIONS = {
    "frontend": {"x": 0, "y": 200},
    "gateway": {"x": 260, "y": 200},
    "order": {"x": 520, "y": 200},
    "inventory": {"x": 780, "y": 70},
    "payment": {"x": 780, "y": 330},
    "database": {"x": 1040, "y": 200},
}


def topology_json() -> dict:
    return {
        "nodes": [
            {"id": s, "label": SERVICES[s]["label"], "layer": SERVICES[s]["layer"],
             "base_ms": SERVICES[s]["base"], "capacity_rps": SERVICES[s]["cap"]}
            for s in ORDER
        ],
        "edges": [
            {"source": a, "target": b, "timeout_ms": cfg["timeout"],
             "retries": cfg["retries"], "breaker": cfg["breaker"], "fallback": cfg["fallback"]}
            for (a, b), cfg in BASE_EDGES.items()
        ],
    }

# Kept here as the canonical topology-adjacent configuration for callers that import it.
BASE_EDGES = {
    ("frontend", "gateway"): {"timeout": 3000, "retries": 0, "breaker": False, "fallback": False},
    ("gateway", "order"): {"timeout": 2500, "retries": 0, "breaker": False, "fallback": False},
    ("order", "inventory"): {"timeout": 700, "retries": 1, "breaker": True, "fallback": True},
    ("order", "payment"): {"timeout": 900, "retries": 0, "breaker": True, "fallback": True},
    ("inventory", "database"): {"timeout": 400, "retries": 1, "breaker": False, "fallback": False},
    ("payment", "database"): {"timeout": 400, "retries": 0, "breaker": False, "fallback": False},
}
