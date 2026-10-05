"""Propagation paths through anomalous caller/callee relationships."""

from collections.abc import Mapping
from typing import Any


def _anomaly_ticks(first_anomaly: Mapping[str, Any]) -> dict[str, int | None]:
    ticks: dict[str, int | None] = {}
    for node, value in first_anomaly.items():
        if isinstance(value, Mapping):
            value = value.get("t_first")
        ticks[str(node)] = value if isinstance(value, int) else None
    return ticks


def _caller_callee_pairs(edges: Any) -> list[tuple[str, str]]:
    if isinstance(edges, Mapping):
        candidates = edges.keys()
    else:
        candidates = edges

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
    return sorted(pairs)


def _node_order(node: str, ticks: Mapping[str, int | None]) -> tuple[int, int, str]:
    tick = ticks[node]
    return (1, 0, node) if tick is None else (0, tick, node)


def affected_anomalous_nodes(first_anomaly: Mapping[str, Any]) -> list[str]:
    """Return all anomalous node IDs, deterministically ordered by ``t_first``."""
    ticks = _anomaly_ticks(first_anomaly)
    return sorted(ticks, key=lambda node: _node_order(node, ticks))


def propagation_path(first_anomaly: dict, edges: list) -> list[str]:
    """Return the longest valid anomalous root-to-caller path.

    ``first_anomaly`` maps node IDs to first-anomaly ticks, or to mappings that
    contain ``t_first``. ``edges`` may be the simulator's tuple-keyed mapping,
    a sequence of ``(caller, callee)`` pairs, or edge mappings with caller/source
    and callee/target fields. Topology edges are traversed in reverse, from callee
    to caller. Paths only advance to callers with an equal or later known tick.
    """
    ticks = _anomaly_ticks(first_anomaly)
    if not ticks:
        return []

    callers: dict[str, set[str]] = {node: set() for node in ticks}
    for caller, callee in _caller_callee_pairs(edges):
        if caller in ticks and callee in ticks:
            callers[callee].add(caller)

    paths: list[list[str]] = []

    def visit(node: str, path: list[str], visited: set[str]) -> None:
        next_callers = [
            caller
            for caller in callers[node]
            if caller not in visited
            and (
                ticks[node] is None
                or ticks[caller] is None
                or ticks[caller] >= ticks[node]
            )
        ]
        if not next_callers:
            paths.append(path)
            return

        for caller in sorted(next_callers, key=lambda item: _node_order(item, ticks)):
            visit(caller, [*path, caller], visited | {caller})

    for root in affected_anomalous_nodes(first_anomaly):
        visit(root, [root], {root})

    return min(
        paths,
        key=lambda path: (
            -len(path),
            tuple(_node_order(node, ticks) for node in path),
        ),
    )
