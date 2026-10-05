"""Tenant isolation: every read is filtered by tenant_id, and bad tenant ids are rejected."""
import pytest
from backend.app import db


class FakeCursor(list):
    def sort(self, *a, **k): return self
    def limit(self, n): return FakeCursor(self[:n])


class FakeColl:
    def __init__(self, rows): self.rows = rows
    def find(self, flt, proj=None):
        return FakeCursor([{k: v for k, v in r.items() if k != "_id"} for r in self.rows if all(r.get(k) == v for k, v in flt.items())])


class FakeDb(dict):
    def __getitem__(self, k): return dict.get(self, k, FakeColl([]))


def test_recent_only_returns_own_tenant(monkeypatch):
    rows = [{"tenant_id": "acme", "id": 12}, {"tenant_id": "beta", "id": 13}, {"tenant_id": "acme", "id": 14}]
    monkeypatch.setattr(db, "_db", lambda: FakeDb(pr_checks=FakeColl(rows)))
    assert [r["id"] for r in db.recent("pr_checks", 10, "acme")] == [12, 14]
    assert [r["id"] for r in db.recent("pr_checks", 10, "beta")] == [13]
    assert db.recent("pr_checks", 10, "unknown") == []


@pytest.mark.parametrize("bad", ["", "A B", "../x", "x" * 80, "$ne", "acme;drop"])
def test_bad_tenant_ids_rejected(bad):
    if bad == "":
        assert db.resolve_tenant("") == "demo"   # empty falls back to the demo tenant
    else:
        with pytest.raises(ValueError):
            db.resolve_tenant(bad)


def test_known_tenants_accepted():
    assert db.resolve_tenant("ACME") == "acme"
    assert db.resolve_tenant(None) == "demo"
    with pytest.raises(ValueError):
        db.resolve_tenant("nobody")
