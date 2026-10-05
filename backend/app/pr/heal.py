"""Owner: Vaishnavi. Auto-Fix templates and patch generation for pull request resilience checks.
Applies deterministic healing templates to address scanner findings:
- R1_TIMEOUT: Restore timeout to 700 ms (or 0.3 * caller upstream timeout if lower).
- R2_RETRY_STORM: Set retries to 1.
- R3_NO_FALLBACK: Set breaker to True and fallback to True.

Verification belongs to gate.py.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple, Union

from ..sim.reference_sim import BASE_EDGES
from .prs import pr_edges as get_pr_edges
from .scanner import RULE_NO_FALLBACK, RULE_RETRY_STORM, RULE_TIMEOUT, scan


class HealResult:
    """Container holding the patched edge configuration and patch diff representation.
    Supports attribute access (edges, patch_diff, diff) and tuple unpacking (edges, diff).
    """

    def __init__(self, edges: Dict[Tuple[str, str], Dict[str, Any]], patch_diff: str, diff: str = "") -> None:
        self.edges = edges
        self.patch_diff = patch_diff
        self.diff = diff or patch_diff

    def __iter__(self):
        return iter((self.edges, self.patch_diff))

    def __getitem__(self, idx: int) -> Any:
        if idx == 0:
            return self.edges
        elif idx == 1:
            return self.patch_diff
        elif idx == 2:
            return self.diff
        raise IndexError(f"HealResult index out of range: {idx}")

    def __repr__(self) -> str:
        return f"HealResult(edges_count={len(self.edges)}, patch_diff_len={len(self.patch_diff)})"


def _get_upstream_timeout(node: str, edges: Dict[Tuple[str, str], Dict[str, Any]]) -> Optional[int]:
    """Find minimum timeout among direct upstream callers of `node`."""
    upstream_timeouts: List[int] = []
    for (src, dst), cfg in edges.items():
        if dst == node:
            t = cfg.get("timeout") if cfg.get("timeout") is not None else cfg.get("timeout_ms")
            if t is not None:
                upstream_timeouts.append(t)
    return min(upstream_timeouts) if upstream_timeouts else None


def _parse_edge_key(edge_val: Union[str, Tuple[str, str]]) -> Tuple[str, str]:
    if isinstance(edge_val, tuple):
        return edge_val
    if "->" in edge_val:
        u, v = edge_val.split("->", 1)
        return (u.strip(), v.strip())
    if ">" in edge_val:
        u, v = edge_val.split(">", 1)
        return (u.strip(), v.strip())
    return ("", "")


def _generate_patch_diff(changes: List[Tuple[Tuple[str, str], Dict[str, Any], Dict[str, Any]]]) -> str:
    """Generate a clean patch diff representation for healed edges."""
    lines: List[str] = []
    for (u, v), before, after in changes:
        lines.append(f"@@ {u} -> {v} @@")
        # Removed / modified lines
        if before.get("timeout") != after.get("timeout"):
            b_t = "null" if before.get("timeout") is None else before.get("timeout")
            lines.append(f"- timeout_ms: {b_t}")
        if before.get("retries") != after.get("retries"):
            lines.append(f"- retries: {before.get('retries')}")
        if before.get("breaker") != after.get("breaker"):
            lines.append(f"- circuit_breaker: {str(before.get('breaker')).lower()}")
        if before.get("fallback") != after.get("fallback"):
            lines.append(f"- fallback: {str(before.get('fallback')).lower()}")

        # Added / restored lines
        if before.get("timeout") != after.get("timeout"):
            lines.append(f"+ timeout_ms: {after.get('timeout')}")
        if before.get("retries") != after.get("retries"):
            lines.append(f"+ retries: {after.get('retries')}")
        if before.get("breaker") != after.get("breaker"):
            lines.append(f"+ circuit_breaker: {str(after.get('breaker')).lower()}")
        if before.get("fallback") != after.get("fallback"):
            lines.append(f"+ fallback: {str(after.get('fallback')).lower()}")

    return "\n".join(lines)


def heal(
    pr_edges: Optional[Dict[Tuple[str, str], Dict[str, Any]]] = None,
    findings: Optional[List[Dict[str, Any]]] = None,
    *,
    pr_id: Optional[Union[int, str]] = None,
) -> HealResult:
    """Apply Auto-Fix healing templates to address scanner findings.

    Args:
        pr_edges: Target PR edge configuration. If None and pr_id provided, loaded from pr_edges(pr_id).
        findings: Findings from scanner.scan. If None, scanner.scan is called automatically.
        pr_id: Optional PR ID for convenience.

    Returns:
        HealResult with:
          - edges: patched edge configuration dict
          - patch_diff: unified patch string representation
          - diff: alias for patch_diff
    """
    if pr_edges is None:
        if pr_id is not None:
            pr_edges = get_pr_edges(pr_id)
        else:
            pr_edges = copy.deepcopy(BASE_EDGES)

    if findings is None:
        findings = scan(base_edges=BASE_EDGES, pr_edges=pr_edges)

    patched_edges = copy.deepcopy(pr_edges)
    healed_edges_set = set()

    for finding in findings:
        rule = finding.get("rule")
        edge_key = _parse_edge_key(finding.get("edge", ""))
        if not edge_key or edge_key not in patched_edges:
            continue

        u, v = edge_key
        target_cfg = patched_edges[edge_key]

        # ----------------------------------------------------
        # R1_TIMEOUT Template:
        # Restore effective timeout: 700 ms (or 0.3 * upstream timeout if lower)
        # ----------------------------------------------------
        if rule == RULE_TIMEOUT:
            upstream_timeout = _get_upstream_timeout(u, pr_edges)
            if upstream_timeout is not None:
                effective_timeout = min(700, int(0.3 * upstream_timeout))
            else:
                effective_timeout = 700
            target_cfg["timeout"] = effective_timeout
            healed_edges_set.add(edge_key)

        # ----------------------------------------------------
        # R2_RETRY_STORM Template:
        # Set retries to 1
        # ----------------------------------------------------
        elif rule == RULE_RETRY_STORM:
            target_cfg["retries"] = 1
            healed_edges_set.add(edge_key)

        # ----------------------------------------------------
        # R3_NO_FALLBACK Template:
        # Set breaker to True and fallback to True
        # ----------------------------------------------------
        elif rule == RULE_NO_FALLBACK:
            target_cfg["breaker"] = True
            target_cfg["fallback"] = True
            healed_edges_set.add(edge_key)

    # Collect changes for diff generation
    changes: List[Tuple[Tuple[str, str], Dict[str, Any], Dict[str, Any]]] = []
    for edge_key in healed_edges_set:
        changes.append((edge_key, pr_edges[edge_key], patched_edges[edge_key]))

    patch_diff = _generate_patch_diff(changes)
    return HealResult(edges=patched_edges, patch_diff=patch_diff, diff=patch_diff)


def heal_pr(pr_id: Union[int, str]) -> HealResult:
    """Convenience helper to heal a specific demo PR by ID."""
    edges = get_pr_edges(pr_id)
    findings = scan(base_edges=BASE_EDGES, pr_edges=edges)
    return heal(pr_edges=edges, findings=findings)
