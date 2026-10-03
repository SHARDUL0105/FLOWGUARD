"""Owner: Sneha. earliness=1-(t_first-t_min)/(t_max-t_min+1); impact=anomalous transitive callers/max(1,n-1);
severity=min(1,(own_ms/base_ms)/10); raw=.5e+.3i+.2s; confidence=raw/sum(raw)."""
def rank_root_causes(first_anomaly: dict, edges: list, own_ratio: dict) -> list:
    raise NotImplementedError("TODO Sneha")
