"""Owner: Vaishnavi. Demo PR definitions and configuration diffs.
Defines demo PRs (12, 13, and PR 12 auto-fix) per the FLOWGUARD Master Build Brief Section 8 & 10.
These represent demo data, not real GitHub integration.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple, Union

from ..sim.reference_sim import BASE_EDGES

# Order -> Inventory edge configurations
BASE_ORDER_INVENTORY_EDGE: Dict[str, Any] = {
    "timeout": 700,
    "retries": 1,
    "breaker": True,
    "fallback": True,
}

RISKY_ORDER_INVENTORY_EDGE: Dict[str, Any] = {
    "timeout": None,
    "retries": 4,
    "breaker": False,
    "fallback": False,
}

FIXED_ORDER_INVENTORY_EDGE: Dict[str, Any] = {
    "timeout": 700,
    "retries": 1,
    "breaker": True,
    "fallback": True,
}

# Unified diffs for demo PRs (order-service/config.yaml / README.md)
DIFF_PR_12: str = """--- a/order-service/config.yaml
+++ b/order-service/config.yaml
@@ -7,6 +7,5 @@ client:
   inventory:
-    timeout_ms: 700
-    retries: 1
-    circuit_breaker: true
-    fallback: true
+    retries: 4
+    circuit_breaker: false
+    fallback: false"""

DIFF_PR_13: str = """--- a/README.md
+++ b/README.md
@@ -10,3 +10,5 @@
 ## Logging
 Detailed debug logs for order flows have been moved to standard JSON logging.
+Health check probes will not log at info level."""

DIFF_PR_12_FIX: str = """--- a/order-service/config.yaml
+++ b/order-service/config.yaml
@@ -7,5 +7,6 @@ client:
   inventory:
+    timeout_ms: 700
+    retries: 1
+    circuit_breaker: true
+    fallback: true
-    retries: 4
-    circuit_breaker: false
-    fallback: false"""

DEMO_PRS: Dict[str, Dict[str, Any]] = {
    "12": {
        "id": 12,
        "title": "Refactor inventory client",
        "author": "dev-a",
        "status": "open",
        "description": "On edge order->inventory: remove timeout_ms, set retries: 4, remove circuit_breaker and fallback",
        "diff": DIFF_PR_12,
        "target_edge": ("order", "inventory"),
        "base_edge": BASE_ORDER_INVENTORY_EDGE,
        "pr_edge": RISKY_ORDER_INVENTORY_EDGE,
    },
    "13": {
        "id": 13,
        "title": "Update README and logging",
        "author": "dev-b",
        "status": "open",
        "description": "No resilience-related edge configuration changes",
        "diff": DIFF_PR_13,
        "target_edge": None,
        "base_edge": None,
        "pr_edge": None,
    },
    "12-fix": {
        "id": "12-fix",
        "title": "Auto-Fix for PR 12 (generated)",
        "author": "flowguard-bot",
        "status": "open",
        "description": "Restores timeout, bounded retries, breaker + fallback",
        "diff": DIFF_PR_12_FIX,
        "target_edge": ("order", "inventory"),
        "base_edge": RISKY_ORDER_INVENTORY_EDGE,
        "pr_edge": FIXED_ORDER_INVENTORY_EDGE,
    },
}


def _normalize_pr_id(pr_id: Union[int, str]) -> str:
    s = str(pr_id).strip()
    if s.lower().startswith("pr"):
        s = s[2:].lstrip("-_#")
    return s


def list_prs() -> List[Dict[str, Any]]:
    """Return PR list for GET /api/pr (Section 10)."""
    return [
        {
            "id": DEMO_PRS["12"]["id"],
            "title": DEMO_PRS["12"]["title"],
            "author": DEMO_PRS["12"]["author"],
            "status": DEMO_PRS["12"]["status"],
        },
        {
            "id": DEMO_PRS["13"]["id"],
            "title": DEMO_PRS["13"]["title"],
            "author": DEMO_PRS["13"]["author"],
            "status": DEMO_PRS["13"]["status"],
        },
    ]


def get_pr(pr_id: Union[int, str]) -> Optional[Dict[str, Any]]:
    """Retrieve demo PR details by ID."""
    key = _normalize_pr_id(pr_id)
    return DEMO_PRS.get(key)


def pr_diff(pr_id: Union[int, str]) -> str:
    """Return unified diff string for the given PR."""
    pr = get_pr(pr_id)
    if pr:
        return pr["diff"]
    return ""


def pr_edges(pr_id: Union[int, str]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """Return full edge configuration dict resulting from applying PR changes.
    PR 12: sets order->inventory to timeout=None, retries=4, breaker=False, fallback=False.
    PR 13: unchanged (BASE_EDGES).
    PR 12-fix: restores order->inventory to timeout=700, retries=1, breaker=True, fallback=True.
    """
    edges = copy.deepcopy(BASE_EDGES)
    key = _normalize_pr_id(pr_id)

    if key == "12":
        edges[("order", "inventory")].update(copy.deepcopy(RISKY_ORDER_INVENTORY_EDGE))
    elif key in ("12-fix", "12_fix", "fix-12"):
        edges[("order", "inventory")].update(copy.deepcopy(FIXED_ORDER_INVENTORY_EDGE))
    # PR 13 has no edge changes, returns deepcopied BASE_EDGES

    return edges


def get_fixed_pr12_edges() -> Dict[Tuple[str, str], Dict[str, Any]]:
    """Convenience helper returning the healed/fixed edge config for PR 12."""
    edges = copy.deepcopy(BASE_EDGES)
    edges[("order", "inventory")].update(copy.deepcopy(FIXED_ORDER_INVENTORY_EDGE))
    return edges
