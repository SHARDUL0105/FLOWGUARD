from __future__ import annotations

from typing import Dict
from ..sim.topology import ORDER, SERVICES


def status(resp: float, resp0: float, succ: float) -> str:
    ratio = resp / max(resp0, 1e-9)

    if succ < 0.8 or ratio >= 3:
        return "critical"

    if succ < 0.98 or ratio >= 1.5:
        return "degraded"

    return "healthy"


def update_tracking(
    previous: Dict[str, str],
    current: Dict[str, str],
    t: int,
    first: Dict[str, int],
    recovered_streak: Dict[str, int],
):
    events = []

    for node in ORDER:
        old = previous.get(node, "healthy")
        new = current[node]

        # Healthy -> anomaly
        if old == "healthy" and new != "healthy" and node not in first:
            first[node] = t

            events.append({
                "t": t,
                "node": node,
                "kind": "anomaly_start",
                "msg": (
                    f"{SERVICES[node]['label']} "
                    f"{'failing requests' if new == 'critical' else 'latency rising'}"
                ),
            })

        # Recovery tracking
        if new == "healthy":
            recovered_streak[node] = recovered_streak.get(node, 0) + 1

            if old != "healthy" and recovered_streak[node] >= 5:
                events.append({
                    "t": t,
                    "node": node,
                    "kind": "recovered",
                    "msg": f"{SERVICES[node]['label']} recovered",
                })
                recovered_streak[node] = 0

        else:
            recovered_streak[node] = 0

    return events