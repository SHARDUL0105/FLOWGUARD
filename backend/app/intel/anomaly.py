"""Owner: Sneha. Node status + anomaly events (Section 7).
critical: succ<0.8 or resp/resp0>=3 | degraded: succ<0.98 or resp/resp0>=1.5 | else healthy."""
def node_status(resp: float, resp0: float, succ: float) -> str:
    raise NotImplementedError("TODO Sneha")
