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
        "project_id": "checkout",
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
        "project_id": "checkout",
        "description": "No resilience-related edge configuration changes",
        "diff": DIFF_PR_13,
        "target_edge": None,
        "base_edge": None,
        "pr_edge": None,
    },
    "14": {
        "id": 14,
        "title": "Add payment retry backoff",
        "author": "dev-c",
        "status": "open",
        "project_id": "payments-api",
        "description": "Adds exponential backoff to payment service retries",
        "diff": """--- a/payment-service/config.yaml\n+++ b/payment-service/config.yaml\n@@ -4,3 +4,4 @@\n retries: 3\n+retry_backoff_ms: 200\n+retry_max_ms: 2000""",
        "target_edge": None,
        "base_edge": None,
        "pr_edge": None,
    },
    "15": {
        "id": 15,
        "title": "Increase inventory cache TTL",
        "author": "dev-d",
        "status": "open",
        "project_id": "e-commerce-platform",
        "description": "Raises inventory cache TTL from 30s to 120s to reduce DB pressure",
        "diff": """--- a/inventory-service/config.yaml\n+++ b/inventory-service/config.yaml\n@@ -2,2 +2,2 @@\n-cache_ttl_s: 30\n+cache_ttl_s: 120""",
        "target_edge": None,
        "base_edge": None,
        "pr_edge": None,
    },
    "12-fix": {
        "id": "12-fix",
        "title": "Auto-Fix for PR 12 (generated)",
        "author": "flowguard-bot",
        "status": "open",
        "project_id": "checkout",
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


def list_prs(project_id: Optional[str] = None, tenant_id: str = "demo") -> List[Dict[str, Any]]:
    """Return PR list for GET /api/pr. Merges hardcoded demo PRs with user-created ones from Atlas."""
    from .. import db as _db_module

    results = []
    # 1. Demo PRs
    for pr in DEMO_PRS.values():
        if str(pr.get("id", "")).endswith("-fix"):
            continue
        if project_id and pr.get("project_id") != project_id:
            continue
        results.append({
            "id": pr["id"],
            "title": pr["title"],
            "author": pr["author"],
            "status": pr["status"],
            "project_id": pr.get("project_id", "checkout"),
            "source": "demo",
        })

    # 2. User PRs from MongoDB Atlas
    user_prs = _db_module.list_user_prs(tenant_id, project_id)
    for upr in user_prs:
        results.append({
            "id": upr["pr_id"],
            "title": upr["title"],
            "author": upr["author"],
            "status": upr.get("status", "open"),
            "project_id": upr.get("project_id", ""),
            "description": upr.get("description", ""),
            "diff": upr.get("diff", ""),
            "source": "user",
            "created_at": upr.get("created_at"),
        })

    return results


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
