"""Optional MongoDB Atlas persistence.

Design rule: the database can NEVER break the demo.
- No MONGODB_URI set  -> every function is a no-op / returns [].
- Atlas unreachable   -> writes fail silently in a background thread, reads return [].
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Any

DEFAULT_TENANT = "demo"      # single tenant for the prototype; real tenants come from the auth token later
DEFAULT_PROJECT = "checkout"
COLLECTIONS = {"pr_checks", "heal_results", "incidents"}

import re

# Demo tenants seeded into the `tenants` collection. In production these come from sign-up, not code.
SEED_TENANTS = [
    {"tenant_id": "demo", "name": "Demo Org", "plan": "free"},
    {"tenant_id": "acme", "name": "Acme Corp", "plan": "pro"},
    {"tenant_id": "beta", "name": "Beta Inc", "plan": "free"},
]
_TENANT_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,39}$")

_client = None
_lock = threading.Lock()
_last_error: str | None = None


def _db():
    """Lazily create the client. Returns None when no database is configured."""
    global _client, _last_error
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri:
        return None
    with _lock:
        if _client is None:
            try:
                from pymongo import MongoClient
                _client = MongoClient(uri, serverSelectionTimeoutMS=2500, connectTimeoutMS=2500)
            except Exception as e:  # driver missing or bad URI
                _last_error = str(e)[:200]
                return None
    try:
        return _client.get_default_database(default="flowguard")
    except Exception as e:
        _last_error = str(e)[:200]
        return None


def _write(collection: str, doc: dict[str, Any]) -> None:
    global _last_error
    try:
        d = _db()
        if d is not None:
            d[collection].insert_one(doc)
    except Exception as e:
        _last_error = str(e)[:200]


def save(collection: str, payload: dict[str, Any], tenant_id: str = DEFAULT_TENANT, project_id: str = DEFAULT_PROJECT) -> None:
    """Fire-and-forget insert. Returns immediately, never raises."""
    if not os.getenv("MONGODB_URI", "").strip():
        return
    doc = {**payload, "tenant_id": tenant_id, "project_id": project_id, "created_at": datetime.now(timezone.utc)}
    threading.Thread(target=_write, args=(collection, doc), daemon=True).start()


def recent(collection: str, limit: int = 10, tenant_id: str = DEFAULT_TENANT) -> list[dict[str, Any]]:
    """Newest-first documents for ONE tenant. Always filtered by tenant_id."""
    global _last_error
    if collection not in COLLECTIONS:
        return []
    try:
        d = _db()
        if d is None:
            return []
        out = []
        for doc in d[collection].find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1).limit(limit):
            if isinstance(doc.get("created_at"), datetime):
                doc["created_at"] = doc["created_at"].isoformat()
            out.append(doc)
        return out
    except Exception as e:
        _last_error = str(e)[:200]
        return []


def status() -> dict[str, Any]:
    """Used by GET /api/db/status so you can check the connection before the demo."""
    if not os.getenv("MONGODB_URI", "").strip():
        return {"configured": False, "connected": False, "error": None}
    try:
        d = _db()
        if d is None:
            return {"configured": True, "connected": False, "error": _last_error}
        d.client.admin.command("ping")
        return {"configured": True, "connected": True, "database": d.name, "error": None}
    except Exception as e:
        return {"configured": True, "connected": False, "error": str(e)[:200]}


def resolve_tenant(raw: str | None) -> str:
    """Validate a tenant id. Raises ValueError on anything that is not a known, well-formed tenant.
    PROTOTYPE: the id arrives in the X-Tenant-ID header. PRODUCTION: it must come from the signed login token."""
    t = (raw or DEFAULT_TENANT).strip().lower()
    if not _TENANT_RE.match(t):
        raise ValueError("invalid tenant id")
    if t not in {x["tenant_id"] for x in list_tenants()}:
        raise ValueError("unknown tenant")
    return t


def list_tenants() -> list[dict[str, Any]]:
    """Tenants from Atlas when connected, otherwise the seed list, so the switcher works offline."""
    try:
        d = _db()
        if d is not None:
            rows = [{"tenant_id": t["tenant_id"], "name": t.get("name", t["tenant_id"]), "plan": t.get("plan", "free")}
                    for t in d["tenants"].find({}, {"_id": 0}).limit(100)]
            if rows:
                return rows
    except Exception as e:
        global _last_error
        _last_error = str(e)[:200]
    return list(SEED_TENANTS)


def init() -> None:
    """Idempotent setup: indexes for fast tenant-scoped queries, seed tenants and their demo project."""
    global _last_error
    try:
        d = _db()
        if d is None:
            return
        for name in COLLECTIONS:
            d[name].create_index([("tenant_id", 1), ("project_id", 1), ("created_at", -1)])
        d["tenants"].create_index("tenant_id", unique=True)
        d["projects"].create_index([("tenant_id", 1), ("project_id", 1)], unique=True)
        now = datetime.now(timezone.utc)
        for t in SEED_TENANTS:
            d["tenants"].update_one({"tenant_id": t["tenant_id"]}, {"$setOnInsert": {**t, "created_at": now}}, upsert=True)
            d["projects"].update_one({"tenant_id": t["tenant_id"], "project_id": DEFAULT_PROJECT},
                                     {"$setOnInsert": {"name": "Checkout Platform", "environment": "simulated", "created_at": now}}, upsert=True)
    except Exception as e:
        _last_error = str(e)[:200]


# ─── Project CRUD ────────────────────────────────────────────────────────────

from .projects_seed import SEED_PROJECTS   # local import to avoid circular deps

_PROJECT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,59}$")


def list_projects(tenant_id: str = DEFAULT_TENANT) -> list[dict[str, Any]]:
    """All projects for a tenant. Falls back to seed data when Atlas is offline."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            rows = []
            for doc in d["projects"].find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1):
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                if isinstance(doc.get("updated_at"), datetime):
                    doc["updated_at"] = doc["updated_at"].isoformat()
                rows.append(doc)
            if rows:
                return rows
    except Exception as e:
        _last_error = str(e)[:200]
    # Offline fallback: return seed projects tagged with this tenant
    return [{**p, "tenant_id": tenant_id} for p in SEED_PROJECTS]


def get_project(tenant_id: str, project_id: str) -> dict[str, Any] | None:
    """Single project by composite key. Returns None when not found."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            doc = d["projects"].find_one(
                {"tenant_id": tenant_id, "project_id": project_id}, {"_id": 0}
            )
            if doc:
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                if isinstance(doc.get("updated_at"), datetime):
                    doc["updated_at"] = doc["updated_at"].isoformat()
                return doc
    except Exception as e:
        _last_error = str(e)[:200]
    # Offline fallback
    for p in SEED_PROJECTS:
        if p["project_id"] == project_id:
            return {**p, "tenant_id": tenant_id}
    return None


def create_project(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Insert a new project. Raises ValueError on duplicate project_id."""
    global _last_error
    project_id = data.get("project_id", "")
    if not _PROJECT_ID_RE.match(project_id):
        raise ValueError("invalid project_id")
    now = datetime.now(timezone.utc)
    doc = {
        "tenant_id": tenant_id,
        "project_id": project_id,
        "name": data.get("name", project_id),
        "environment": data.get("environment", "Production-like"),
        "source": data.get("source", "Manual"),
        "score": data.get("score", 84),
        "services": data.get("services", 6),
        "alerts": data.get("alerts", 0),
        "last_sim": data.get("last_sim", "No simulation yet"),
        "trend": data.get("trend", [84, 84, 84, 84, 84, 84, 84]),
        "sims": data.get("sims", []),
        "created_at": now,
        "updated_at": now,
    }
    try:
        d = _db()
        if d is not None:
            d["projects"].insert_one({**doc, "_id_skip": True})
            # remove the mongo _id before returning
            doc_clean = {k: v for k, v in doc.items() if k != "_id"}
            doc_clean["created_at"] = now.isoformat()
            doc_clean["updated_at"] = now.isoformat()
            return doc_clean
    except Exception as e:
        if "duplicate" in str(e).lower() or "E11000" in str(e):
            raise ValueError("project_id already exists for this tenant")
        _last_error = str(e)[:200]
    # Offline: return the doc anyway so the frontend still works
    doc["created_at"] = now.isoformat()
    doc["updated_at"] = now.isoformat()
    return doc


def update_project(tenant_id: str, project_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    """Partial update of a project. Returns the updated doc or None if not found."""
    global _last_error
    allowed = {"name", "environment", "source", "score", "services", "alerts", "last_sim", "trend", "sims"}
    patch = {k: v for k, v in updates.items() if k in allowed}
    if not patch:
        return get_project(tenant_id, project_id)
    patch["updated_at"] = datetime.now(timezone.utc)
    try:
        d = _db()
        if d is not None:
            result = d["projects"].find_one_and_update(
                {"tenant_id": tenant_id, "project_id": project_id},
                {"$set": patch},
                return_document=True,
                projection={"_id": 0},
            )
            if result:
                if isinstance(result.get("created_at"), datetime):
                    result["created_at"] = result["created_at"].isoformat()
                if isinstance(result.get("updated_at"), datetime):
                    result["updated_at"] = result["updated_at"].isoformat()
                return result
    except Exception as e:
        _last_error = str(e)[:200]
    return None


def delete_project(tenant_id: str, project_id: str) -> bool:
    """Delete a project. Returns True if it existed."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            r = d["projects"].delete_one({"tenant_id": tenant_id, "project_id": project_id})
            return r.deleted_count > 0
    except Exception as e:
        _last_error = str(e)[:200]
    return False


def add_simulation(tenant_id: str, project_id: str, sim: dict[str, Any]) -> None:
    """Append a simulation record to a project's sims array and update last_sim."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            d["projects"].update_one(
                {"tenant_id": tenant_id, "project_id": project_id},
                {
                    "$push": {"sims": {"$each": [sim], "$position": 0, "$slice": 50}},
                    "$set": {"last_sim": sim.get("name", "Simulation"), "updated_at": datetime.now(timezone.utc)},
                },
            )
    except Exception as e:
        _last_error = str(e)[:200]


# ─── User Pull Requests ───────────────────────────────────────────────────────

import uuid as _uuid


def list_user_prs(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    """User-created PRs from Atlas for a tenant, optionally filtered by project."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            q: dict[str, Any] = {"tenant_id": tenant_id}
            if project_id:
                q["project_id"] = project_id
            rows = []
            for doc in d["user_prs"].find(q, {"_id": 0}).sort("created_at", -1):
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                rows.append(doc)
            return rows
    except Exception as e:
        _last_error = str(e)[:200]
    return []


def create_user_pr(tenant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Persist a user-created PR. Returns the stored doc."""
    global _last_error
    now = datetime.now(timezone.utc)
    pr_id = int(_uuid.uuid4().int % 90000) + 10000   # 5-digit numeric id, avoids clashes with demo ids 12/13
    doc = {
        "tenant_id": tenant_id,
        "pr_id": pr_id,
        "project_id": data.get("project_id", DEFAULT_PROJECT),
        "title": (data.get("title") or "Untitled PR")[:200],
        "author": (data.get("author") or "you")[:80],
        "description": (data.get("description") or "")[:1000],
        "diff": (data.get("diff") or "")[:8000],
        "status": "open",
        "created_at": now,
    }
    try:
        d = _db()
        if d is not None:
            d["user_prs"].insert_one({**doc})
    except Exception as e:
        _last_error = str(e)[:200]
    doc["created_at"] = now.isoformat()
    return doc


def delete_user_pr(tenant_id: str, pr_id: int) -> bool:
    """Delete a user PR. Returns True if it existed."""
    global _last_error
    try:
        d = _db()
        if d is not None:
            r = d["user_prs"].delete_one({"tenant_id": tenant_id, "pr_id": pr_id})
            return r.deleted_count > 0
    except Exception as e:
        _last_error = str(e)[:200]
    return False
