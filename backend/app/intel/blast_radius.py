"""Calculate services affected by a root node in a caller/callee topology."""

from collections.abc import Mapping
from typing import Any


def _caller_callee_pairs(edges: Any) -> set[tuple[str, str]]:
    candidates = edges.keys() if isinstance(edges, Mapping) else edges
    pairs: set[tuple[str, str]] = set()
    for edge in candidates:
        if isinstance(edge, Mapping):
            caller = edge.get("caller", edge.get("source"))
            callee = edge.get("callee", edge.get("target"))
        elif isinstance(edge, (tuple, list)) and len(edge) == 2:
            caller, callee = edge
        else:
            continue

        if caller is not None and callee is not None:
            pairs.add((str(caller), str(callee)))
    return pairs


def blast_radius(root: str, edges: list) -> dict[str, Any]:
    """Return direct callers, transitive callers, total affected, and checkout risk.

    Input edges are caller->callee, accepted as tuple-keyed mappings, edge-pair
    iterables, or mappings with caller/source and callee/target keys. Checkout
    reachability is derived from the graph using the conventional ``frontend``
    entry-node name.
    """
    root = str(root)
    callers: dict[str, set[str]] = {}
    for caller, callee in _caller_callee_pairs(edges):
        callers.setdefault(callee, set()).add(caller)

    direct = callers.get(root, set())
    affected = set(direct)
    pending = list(direct)
    while pending:
        node = pending.pop()
        for caller in callers.get(node, set()) - affected:
            if caller == root:
                continue
            affected.add(caller)
            pending.append(caller)

    checkout_at_risk = root == "frontend" or "frontend" in affected

    return {
        "direct": sorted(direct),
        "downstream": sorted(affected - direct),
        "total": len(affected) + 1,
        "checkout_at_risk": checkout_at_risk,
    }
