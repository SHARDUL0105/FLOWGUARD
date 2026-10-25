"""Unit and integration tests for Phase 6: Patch Validation and Auto-Fix Safety Pipeline."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.pr.service import heal_pr
from backend.app.security.revalidation import (
    execute_simulated_merge,
    extract_changed_files_from_diff,
    get_reviewer_approval,
    record_reviewer_approval,
    validate_autofix_workflow,
)

client = TestClient(app)


def test_pr_12_autofix_safety_full_sequence():
    """Verify all 9 sequence steps on PR 12:
    1. Original PR 12 recorded (score 32, clean security, BLOCKED_RELIABILITY).
    2. Auto-Fix generates patch restoring timeout, retries, breaker, fallback.
    3. Changed files and revision ID computed.
    4. Reliability verification passes (score 32 -> 84, gate: accepted).
    5. Security scan re-runs on patched snapshot (clean PASS).
    6. Before/after findings compared (0 introduced, 0 remaining).
    7. Both gates pass -> overall gate accepted.
    8. Both original and post-fix results displayed.
    9. Reviewer sign-off required; automatic merge NOT authorized.
    """
    res = heal_pr(12)
    assert res is not None

    # Step 1 & 8: Original state preserved
    assert res["id"] == 12
    assert res["original"]["reliability"]["score"] == 32
    assert res["original"]["reliability"]["verdict"] == "regression"
    assert res["original"]["security"]["policy_verdict"] == "PASS"
    assert res["original"]["combined_status"] == "BLOCKED_RELIABILITY"

    # Step 2, 3: Patch generation and metadata
    assert "timeout_ms: 700" in res["patch_diff"]
    assert "retries: 1" in res["patch_diff"]
    assert "circuit_breaker: true" in res["patch_diff"]
    assert len(res["patch_hash"]) == 64
    assert res["revision_id"].startswith("rev-12-")
    assert len(res["changed_files"]) > 0

    # Step 4, 5, 6, 7: Dual gate acceptance
    assert res["score_before"] == 32
    assert res["score_after"] == 84
    assert res["gate"] == "accepted"
    assert res["reason"] is None
    assert res["security_revalidation"]["passed"] is True
    assert res["security_revalidation"]["policy_verdict"] == "PASS"
    assert res["security_revalidation"]["blocking_introduced_count"] == 0
    assert res["security_revalidation"]["blocking_remaining_count"] == 0

    # Step 8, 9: Post-fix combined verdict and governance controls
    assert res["post_fix"]["combined_status"] == "ELIGIBLE_FOR_REVIEW"
    assert res["combined_status"] == "ELIGIBLE_FOR_REVIEW"
    assert res["eligible_for_review"] is True
    assert res["automatic_merge_authorized"] is False  # Never automatic!
    assert res["review_signoff_required"] is True
    assert res["reviewer_approval_status"] == "pending_review"


def test_autofix_rejected_when_security_failure_unresolved():
    """Verify that improving resilience score CANNOT mark a patch safe if a security flaw remains.
    Demonstrated on PR 22 (risky edge + unredacted auth token in config).
    """
    res = heal_pr(22)
    assert res is not None

    # Auto-Fix healed the edge resilience (32 -> 84)
    assert res["score_before"] == 32
    assert res["score_after"] == 84
    assert res["post_fix"]["reliability"]["gate"] == "accepted"

    # But security check remains FAIL because the diff still has the secret
    assert res["post_fix"]["security"]["policy_verdict"] == "FAIL"
    assert res["post_fix"]["security"]["blocking_count"] >= 1

    # Gate must be REJECTED despite resilience score improvement!
    assert res["gate"] == "rejected"
    assert "did not pass security verification" in res["reason"]
    assert res["combined_status"] == "BLOCKED_SECURITY"
    assert res["eligible_for_review"] is False
    assert res["automatic_merge_authorized"] is False
    assert res["reviewer_approval_status"] == "blocked"


def test_autofix_rejected_when_patch_introduces_new_security_flaw():
    """Verify that a patch introducing a new blocking security flaw is rejected immediately."""
    malicious_patch_diff = """--- a/order-service/config.yaml
+++ b/order-service/config.yaml
@@ -7,5 +7,7 @@ client:
   inventory:
+    timeout_ms: 700
+    retries: 1
+    circuit_breaker: true
+    fallback: true
+    api_key = "flowguard_leaked_secret_token_778899"
"""
    res = validate_autofix_workflow(
        pr_id=12,
        patch_diff_override=malicious_patch_diff,
    )
    assert res["gate"] == "rejected"
    assert "introduced" in res["reason"]
    assert res["security_revalidation"]["blocking_introduced_count"] >= 1
    assert res["combined_status"] == "BLOCKED_SECURITY"
    assert res["eligible_for_review"] is False


def test_extract_changed_files_from_diff():
    """Verify changed files extraction from diff headers."""
    diff_sample = """--- a/services/order.py
+++ b/services/order.py
@@ -1,3 +1,3 @@
--- a/config/gateway.yaml
+++ b/config/gateway.yaml
@@ -10,2 +10,2 @@"""
    files = extract_changed_files_from_diff(diff_sample)
    assert "services/order.py" in files
    assert "config/gateway.yaml" in files


def test_reviewer_approval_and_simulated_merge_governance():
    """Verify explicit human reviewer sign-off requirement and simulated merge."""
    # 1. PR 12 before Auto-Fix is BLOCKED_RELIABILITY -> reviewer approval must fail
    res_app_blocked = client.post(
        "/api/pr/12/review/approve",
        json={"reviewer": "alice", "role": "security_lead"},
        headers={"X-Tenant-ID": "demo"},
    )
    assert res_app_blocked.status_code == 400
    assert "ELIGIBLE_FOR_REVIEW" in res_app_blocked.json()["detail"]

    # 2. PR 13 is ELIGIBLE_FOR_REVIEW -> reviewer approval succeeds
    res_app_ok = client.post(
        "/api/pr/13/review/approve",
        json={"reviewer": "bob", "role": "lead_engineer", "comments": "Approved"},
        headers={"X-Tenant-ID": "demo"},
    )
    assert res_app_ok.status_code == 200
    assert res_app_ok.json()["status"] == "approved"
    assert res_app_ok.json()["reviewer"] == "bob"

    # 3. Check review status endpoint
    res_status = client.get("/api/pr/13/review/status", headers={"X-Tenant-ID": "demo"})
    assert res_status.status_code == 200
    st_data = res_status.json()
    assert st_data["has_reviewer_approval"] is True
    assert st_data["simulated_merge_ready"] is True
    assert st_data["combined_status"] == "ELIGIBLE_FOR_REVIEW"

    # 4. Simulated merge on PR 13 succeeds
    res_merge = client.post(
        "/api/pr/13/merge",
        json={"actor": "release-manager"},
        headers={"X-Tenant-ID": "demo"},
    )
    assert res_merge.status_code == 200
    assert res_merge.json()["status"] == "simulated_merge_success"
    assert "simulation mode" in res_merge.json()["message"]

    # 5. Simulated merge on unapproved PR fails
    res_merge_fail = client.post(
        "/api/pr/12/merge",
        json={"actor": "release-manager"},
        headers={"X-Tenant-ID": "demo"},
    )
    assert res_merge_fail.status_code == 400


def test_revalidate_patch_endpoint():
    """Verify POST /api/pr/{id}/revalidate endpoint."""
    patch_clean = """--- a/order-service/config.yaml
+++ b/order-service/config.yaml
@@ -7,4 +7,4 @@
+timeout_ms: 700"""
    res = client.post(
        "/api/pr/12/revalidate",
        json={"patch_diff": patch_clean},
        headers={"X-Tenant-ID": "demo"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is True
    assert data["pr_id"] == 12
