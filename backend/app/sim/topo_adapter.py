"""Convert a user-saved topology document into the data structures the sim engine expects.

A saved topology looks like:
  {
    "nodes": [{"id": "gateway", "label": "Gateway", "type": "gateway", "base_ms": 20, "capacity_rps": 1000, ...}],
    "edges": [{"id": "e1", "source": "gateway", "target": "svc-a", "timeout_ms": 700, "retries": 1, "breaker": true, "fallback": false}]
  }

The engine needs:
  SERVICES  : dict[id -> {"base": ms, "cap": rps}]
  ORDER     : topological sort of node ids (callers before callees)
  DOWNSTREAM: dict[id -> [id]]
  EDGES     : dict[(caller, callee) -> {"timeout", "retries", "breaker", "fallback"}]
"""
from __future__ import annotations
from typing import Any


def build_sim_structures(topo: dict[str, Any]):
    """Return (services, order, downstream, edges) ready to pass into the sim engine."""
    nodes = {n["id"]: n for n in topo.get("nodes", [])}
    raw_edges = topo.get("edges", [])

    # Build adjacency
    downstream: dict[str, list[str]] = {n: [] for n in nodes}
    for e in raw_edges:
        src, tgt = e["source"], e["target"]
        if src in downstream and tgt in nodes:
            if tgt not in downstream[src]:
                downstream[src].append(tgt)

    # Topological sort (Kahn's algorithm)
    in_degree = {n: 0 for n in nodes}
    for children in downstream.values():
        for c in children:
            in_degree[c] += 1
    queue = [n for n, d in in_degree.items() if d == 0]
    order: list[str] = []
    while queue:
        node = queue.pop(0)
        order.append(node)
        for child in downstream[node]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)
    # Any nodes not reachable (cycles) — append them at the end
    for n in nodes:
        if n not in order:
            order.append(n)

    services = {
        n: {
            "base": float(meta.get("base_ms", 80)),
            "cap": float(meta.get("capacity_rps", 500)),
        }
        for n, meta in nodes.items()
    }

    edges = {}
    for e in raw_edges:
        src, tgt = e["source"], e["target"]
        if src in nodes and tgt in nodes:
            edges[(src, tgt)] = {
                "timeout": e.get("timeout_ms", 700),
                "retries": int(e.get("retries", 1)),
                "breaker": bool(e.get("breaker", True)),
                "fallback": bool(e.get("fallback", False)),
            }

    return services, order, downstream, edges
