"""Audit report storage and tenant association for security scans."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .. import db
from .models import SecurityScanReport

COLLECTION = "security_scans"
_mem_security_scans: Dict[str, Dict[str, Any]] = {}


def save_security_report(report: SecurityScanReport) -> None:
    """Save a security scan report to database or memory fallback."""
    doc = report.model_dump()
    key = f"{report.tenant_id}:{str(report.pr_id)}"
    _mem_security_scans[key] = copy.deepcopy(doc)

    # Persist via db.save (background async thread)
    try:
        db.save(COLLECTION, doc, tenant_id=report.tenant_id)
    except Exception:
        pass


def get_latest_security_report(pr_id: Any, tenant_id: str = "demo") -> Optional[Dict[str, Any]]:
    """Retrieve the latest security scan report for a PR."""
    key = f"{tenant_id}:{str(pr_id)}"
    if key in _mem_security_scans:
        return copy.deepcopy(_mem_security_scans[key])

    # Check MongoDB collection
    try:
        d = db._db()
        if d is not None:
            # Look up by tenant_id and pr_id
            doc = d[COLLECTION].find_one(
                {"tenant_id": tenant_id, "pr_id": pr_id},
                {"_id": 0},
                sort=[("created_at", -1)],
            )
            if doc:
                return doc
    except Exception:
        pass

    return None


def list_security_reports(tenant_id: str = "demo", limit: int = 10) -> List[Dict[str, Any]]:
    """List recent security scan reports for a tenant."""
    try:
        reports = db.recent(COLLECTION, limit=limit, tenant_id=tenant_id)
        if reports:
            return reports
    except Exception:
        pass

    # In-memory fallback
    matches = [
        v for v in _mem_security_scans.values()
        if v.get("tenant_id") == tenant_id
    ]
    return matches[:limit]
