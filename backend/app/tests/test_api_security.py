import pytest
from itertools import count
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.app import auth, db
from backend.app.main import app

_CLIENT_IPS = count(1)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(db, "list_tenants", lambda: list(db.SEED_TENANTS))
    client_ip = f"198.51.100.{next(_CLIENT_IPS)}"
    with TestClient(app, client=(client_ip, 12345)) as test_client:
        yield test_client


def _token(username: str, password: str) -> str:
    user = auth.authenticate_user(username, password)
    assert user is not None
    return auth.create_token(user)


def test_public_health_and_protected_api(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/history").status_code == 401
    assert client.get("/api/history", headers={"X-Tenant-ID": "acme"}).status_code == 401


def test_tenant_scope_comes_from_token(client):
    token = _token("acme_admin", "acme@admin2026")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/history", headers=headers).status_code == 200
    assert client.get(
        "/api/history",
        headers={**headers, "X-Tenant-ID": "beta"},
    ).status_code == 403


def test_user_listing_requires_admin_role(client):
    engineer_token = _token("marcus", "marcus@acme2026")
    response = client.get(
        "/api/auth/users",
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert response.status_code == 403

    admin_token = _token("acme_admin", "acme@admin2026")
    response = client.get(
        "/api/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert all(user["tenant_id"] == "acme" for user in response.json())


def test_register_cannot_assign_admin_role(client):
    token = _token("acme_admin", "acme@admin2026")
    response = client.post(
        "/api/auth/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "username": "new-admin",
            "email": "new-admin@example.test",
            "password": "safe-example-password",
            "tenant_id": "acme",
            "role": "company_admin",
        },
    )
    assert response.status_code == 400


def test_anonymous_registration_cannot_join_existing_tenant(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "unauthorized-join",
            "email": "unauthorized-join@example.test",
            "password": "safe-example-password",
            "tenant_id": "acme",
        },
    )
    assert response.status_code == 401
    assert "token" not in response.json()
    assert all(user["email"] != "unauthorized-join@example.test" for user in auth.list_users_for_tenant("acme"))


def test_admin_cannot_register_user_in_another_tenant(client):
    token = _token("acme_admin", "acme@admin2026")
    response = client.post(
        "/api/auth/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "username": "cross-tenant",
            "email": "cross-tenant@example.test",
            "password": "safe-example-password",
            "tenant_id": "beta",
        },
    )
    assert response.status_code == 403
    assert "token" not in response.json()
    assert all(user["email"] != "cross-tenant@example.test" for user in auth.list_users_for_tenant("beta"))


def test_admin_can_register_engineer_in_own_tenant(client):
    token = _token("acme_admin", "acme@admin2026")
    response = client.post(
        "/api/auth/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "username": "new-acme-engineer",
            "email": "new-acme-engineer@example.test",
            "password": "safe-example-password",
            "tenant_id": "acme",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["tenant_id"] == "acme"
    token_payload = auth.verify_token(body["token"])
    assert token_payload is not None
    assert token_payload["tenant_id"] == "acme"


def test_login_rate_limit(client):
    responses = [
        client.post(
            "/api/auth/login",
            json={"username_or_email": "not-a-user", "password": "incorrect"},
        )
        for _ in range(6)
    ]
    assert all(response.status_code == 401 for response in responses[:5])
    assert responses[5].status_code == 429
    assert int(responses[5].headers["Retry-After"]) > 0


def test_registration_rate_limit(client):
    token = _token("acme_admin", "acme@admin2026")
    responses = [
        client.post(
            "/api/auth/register",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": f"limited-{index}",
                "email": f"limited-{index}@example.test",
                "password": "safe-example-password",
                "tenant_id": "acme",
                "role": "company_admin",
            },
        )
        for index in range(4)
    ]
    assert all(response.status_code == 400 for response in responses[:3])
    assert responses[3].status_code == 429


def test_mutating_routes_are_rate_limited(client):
    responses = [client.post("/api/reset") for _ in range(31)]
    assert all(response.status_code == 401 for response in responses[:30])
    assert responses[30].status_code == 429


def test_websocket_requires_authentication(client):
    with pytest.raises(WebSocketDisconnect) as disconnected:
        with client.websocket_connect("/ws"):
            pass
    assert disconnected.value.code == 1008


def test_websocket_accepts_authenticated_subprotocol(client):
    token = _token("acme_admin", "acme@admin2026")
    with client.websocket_connect(
        "/ws",
        subprotocols=["flowguard", f"bearer.{token}"],
    ) as websocket:
        assert websocket.accepted_subprotocol == "flowguard"


def test_analyze_cannot_access_another_tenants_user_pr(client, monkeypatch):
    pr_id = 52002
    monkeypatch.setattr(db, "_db", lambda: None)
    monkeypatch.setattr(
        db,
        "_mem_user_prs",
        {pr_id: {"pr_id": pr_id, "tenant_id": "acme", "title": "Acme PR"}},
    )
    token = _token("beta_admin", "beta@admin2026")
    response = client.post(
        f"/api/pr/{pr_id}/analyze",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_super_admin_discovery_does_not_expose_password_hints(client):
    response = client.get("/api/auth/super-admins")
    assert response.status_code == 200
    assert all("default_password_hint" not in user for user in response.json()["super_admins"])
