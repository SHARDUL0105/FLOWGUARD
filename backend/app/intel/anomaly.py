"""Node status and deterministic first-anomaly/recovery tracking."""

from collections.abc import Iterable, Mapping
from typing import Literal, TypedDict

NodeStatus = Literal["healthy", "degraded", "critical"]


class AnomalyTrackingResult(TypedDict):
    t_first: dict[str, int]
    recovered_at: dict[str, list[int]]


def node_status(resp: float, resp0: float, succ: float) -> NodeStatus:
    """Return the status for a node using its caller-provided healthy response time."""
    if resp0 <= 0:
        raise ValueError("resp0 must be greater than zero")

    response_ratio = resp / resp0
    if succ < 0.8 or response_ratio >= 3:
        return "critical"
    if succ < 0.98 or response_ratio >= 1.5:
        return "degraded"
    return "healthy"


def track_anomalies(
    ticks: Iterable[tuple[int, Mapping[str, NodeStatus]]],
) -> AnomalyTrackingResult:
    """Track first anomaly ticks and recoveries from per-tick node statuses.

    Each input item is a tick number and a mapping of observed node IDs to statuses.
    A recovery is recorded on the fifth consecutive observed healthy tick after an
    anomaly. Missing observations, tick gaps, and anomalous statuses reset the
    pending recovery streak. ``t_first`` is retained if a node becomes anomalous
    again after recovering.
    """
    t_first: dict[str, int] = {}
    recovered_at: dict[str, list[int]] = {}
    healthy_streak: dict[str, int] = {}
    awaiting_recovery: set[str] = set()
    previous_tick: int | None = None

    for tick, statuses in ticks:
        if previous_tick is not None:
            if tick <= previous_tick:
                raise ValueError("tick numbers must be strictly increasing")
            if tick != previous_tick + 1:
                healthy_streak.clear()

        for node, status in statuses.items():
            if status not in ("healthy", "degraded", "critical"):
                raise ValueError(f"invalid status for node {node!r}: {status!r}")

            if status != "healthy":
                t_first.setdefault(node, tick)
                awaiting_recovery.add(node)
                healthy_streak[node] = 0
            elif node in awaiting_recovery:
                streak = healthy_streak.get(node, 0) + 1
                if streak == 5:
                    recovered_at.setdefault(node, []).append(tick)
                    awaiting_recovery.remove(node)
                    healthy_streak.pop(node, None)
                else:
                    healthy_streak[node] = streak

        observed_nodes = statuses.keys()
        for node in awaiting_recovery - observed_nodes:
            healthy_streak[node] = 0

        previous_tick = tick

    return {"t_first": t_first, "recovered_at": recovered_at}
