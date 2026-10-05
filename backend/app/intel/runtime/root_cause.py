from ...sim.topology import CALLERS, SERVICES
from .propagation import transitive_callers, longest_chain

def rank(t_first, anomalous, cur):
    if not anomalous:
        return None

    tmin = min(t_first[n] for n in anomalous)
    tmax = max(t_first[n] for n in anomalous)

    # Services that have participated in the incident so far.
    # t_first contains the first-anomaly tick for each affected service.
    incident_nodes = set(t_first.keys())

    rows = []

    for n in anomalous:
        earliness = 1 - (t_first[n] - tmin) / (tmax - tmin + 1)

        upstream = len([
            c for c in transitive_callers(n)
            if c in anomalous
        ])

        impact = upstream / max(1, len(anomalous) - 1)

        severity = min(
            1,
            (cur[n]["own"] / SERVICES[n]["base"]) / 10
        )

        raw = (
            .5 * earliness
            + .3 * impact
            + .2 * severity
        )

        rows.append((n, raw, upstream))

    total = sum(r[1] for r in rows) or 1

    candidates = []

    for n, raw, upstream in rows:
        ev = [
            (
                f"latency rose first (tick {t_first[n]})"
                if t_first[n] == tmin
                else f"degraded at tick {t_first[n]}"
            )
        ]

        if upstream:
            ev.append(
                f"{upstream} upstream service"
                f"{'s' if upstream > 1 else ''} degraded after it"
            )

        candidates.append({
            "node": n,
            "confidence": round(raw / total, 2),
            "evidence": ev
        })

    candidates.sort(
        key=lambda x: x["confidence"],
        reverse=True
    )

    top = candidates[0]["node"]

    direct = list(CALLERS[top])
    downstream = list(
        transitive_callers(top) - set(direct)
    )

    return {
        "root_cause": candidates,

        # IMPORTANT:
        # Use the accumulated incident history rather than
        # only the nodes anomalous on the current tick.
        "propagation_path": longest_chain(
            top,
            incident_nodes,
            t_first
        ),

        "blast_radius": {
            "direct": direct,
            "downstream": downstream,
            "total": len(direct) + len(downstream),
            "checkout_at_risk":
                "frontend" in direct + downstream
        }
    }