"""Tests for FLOWGUARD Real Authentication & RBAC."""
import pytest
from backend.app import auth


def test_hash_and_verify_password():
    pwd = "SecretPassword123!"
    h, salt = auth.hash_password(pwd)
    assert auth.verify_password(pwd, h, salt) is True
    assert auth.verify_password("WrongPassword!", h, salt) is False


def test_team_codex_super_admins_preseeded():
    # Exactly 4 super admins
    admins = auth.get_hackathon_super_admins()
    assert len(admins) == 4
    names = {a["name"] for a in admins}
    assert "Shardul Kulkarni" in names
    assert "Abhiraj Mangire" in names
    assert "Sneha Barge" in names
    assert "Vaishnavi Repal" in names


def test_super_admin_authentication():
    # Test Shardul
    user = auth.authenticate_user("shardul", "shardul@codex2026")
    assert user is not None
    assert user["role"] == "platform_owner"
    assert user["tenant_id"] == "flowguard"

    # Test alternate password
    user_alt = auth.authenticate_user("shardul@flowguard.io", "codex2026")
    assert user_alt is not None

    # Test bad password
    bad = auth.authenticate_user("shardul", "incorrect-pwd")
    assert bad is None


def test_tenant_user_authentication():
    # Acme admin
    user = auth.authenticate_user("admin@acme.com", "acme@admin2026", tenant_id="acme")
    assert user is not None
    assert user["role"] == "company_admin"
    assert user["tenant_id"] == "acme"

    # Tenant mismatch should fail
    mismatch = auth.authenticate_user("admin@acme.com", "acme@admin2026", tenant_id="beta")
    assert mismatch is None


def test_super_admin_creation_restriction():
    # Random person cannot register as platform_owner
    with pytest.raises(ValueError, match="Super Admin access is restricted"):
        auth.register_user(
            username="hacker",
            email="hacker@evil.com",
            password="HackerPass123!",
            tenant_id="flowguard",
            role="platform_owner"
        )


def test_token_creation_and_verification():
    user = {
        "id": "u-test",
        "username": "tester",
        "email": "test@flowguard.io",
        "role": "company_engineer",
        "tenant_id": "demo"
    }
    token = auth.create_token(user)
    assert isinstance(token, str)
    payload = auth.verify_token(token)
    assert payload is not None
    assert payload["username"] == "tester"
    assert payload["role"] == "company_engineer"

    # Tampered token fails
    tampered = token[:-4] + "abcd"
    assert auth.verify_token(tampered) is None
