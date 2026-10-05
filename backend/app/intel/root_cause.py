"""Rank anomalous nodes as root-cause candidates using timing, impact, and severity."""

from collections.abc import Mapping
from math import isfinite
from typing import Any


def _ticks(first_anomaly: Mapping[str, Any]) -> dict[str, int | None]:
    result: dict[str, int | None] = {}
    for node, value in first_anomaly.items():
        if isinstance(value, Mapping):
            value = value.get("t_first")
        result[str(node)] = value if isinstance(value, int) else None
    return result


def _edges(edges: Any) -> list[tuple[str, str]]:
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
    return sorted(pairs)


def _ratio(value: Any) -> float:
    if isinstance(value, Mapping):
        if "own_ms" in value and "base_ms" in value:
            base_ms = _number(value.get("base_ms"))
            return _number(value.get("own_ms")) / base_ms if base_ms > 0 else 0.0
        value = value.get("own_ratio", value.get("ratio", 0.0))
    return max(0.0, _number(value))


def _number(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return number if isfinite(number) else 0.0
    return 0.0


def rank_root_causes(
    first_anomaly: dict,
    edges: list,
    own_ratio: dict,
) -> list[dict[str, Any]]:
    """Return anomalous candidates ranked by normalized confidence estimate.

    ``first_anomaly`` maps node IDs to first-anomaly ticks, or mappings containing
    ``t_first``. ``edges`` accepts caller->callee pairs, the simulator's
    tuple-keyed edge mapping, or edge mappings with caller/source and callee/target
    keys. ``own_ratio`` maps node IDs to ``own_ms / base_ms`` ratios, or to
    telemetry mappings with ``own_ms`` and ``base_ms`` (or an explicit ratio).
    """
    ticks = _ticks(first_anomaly)
    if not ticks:
        return []

    known_ticks = [tick for tick in ticks.values() if tick is not None]
    t_min = min(known_ticks) if known_ticks else None
    t_max = max(known_ticks) if known_ticks else None

    callers: dict[str, set[str]] = {node: set() for node in ticks}
    for caller, callee in _edges(edges):
        if caller in ticks and callee in ticks and caller != callee:
            callers[callee].add(caller)

    ratios = {node: _ratio(own_ratio.get(node, 0.0)) for node in ticks}
    ranked: list[dict[str, Any]] = []
    for node in sorted(ticks):
        tick = ticks[node]
        if tick is None or t_min is None or t_max is None:
            earliness = 0.0
        else:
            earliness = 1 - (tick - t_min) / (t_max - t_min + 1)

        transitive_callers: set[str] = set()
        visited = {node}
        pending = list(callers[node])
        while pending:
            caller = pending.pop()
            if caller in visited:
                continue
            visited.add(caller)
            transitive_callers.add(caller)
            pending.extend(callers[caller] - visited)

        impact = len(transitive_callers) / max(1, len(ticks) - 1)
        severity = min(1.0, ratios[node] / 10)
        raw_score = 0.5 * earliness + 0.3 * impact + 0.2 * severity

        evidence = []
        if tick is not None:
            if tick == t_min:
                evidence.append(f"latency rose first (tick {tick})")
            else:
                evidence.append(f"first anomaly observed at tick {tick}")
        evidence.append(
            f"{len(transitive_callers)} upstream anomalous "
            f"{'service degraded' if len(transitive_callers) == 1 else 'services degraded'} after it"
        )
        evidence.append(
            f"own latency was {ratios[node]:.2f}x baseline "
            f"(severity contribution {severity:.2f})"
        )
        ranked.append(
            {
                "node": node,
                "confidence": 0.0,
                "confidence_label": "estimate",
                "earliness": earliness,
                "impact": impact,
                "severity": severity,
                "raw_score": raw_score,
                "evidence": evidence,
            }
        )

    raw_total = sum(candidate["raw_score"] for candidate in ranked)
    if raw_total > 0:
        for candidate in ranked:
            candidate["confidence"] = candidate["raw_score"] / raw_total
    else:
        equal_confidence = 1.0 / len(ranked)
        for candidate in ranked:
            candidate["confidence"] = equal_confidence

    ranked.sort(
        key=lambda candidate: (
            -candidate["confidence"],
            ticks[candidate["node"]] is None,
            ticks[candidate["node"]] if ticks[candidate["node"]] is not None else 0,
            candidate["node"],
        )
    )
    return ranked
