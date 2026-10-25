"""FLOWGUARD Real Authentication & Role-Based Access Control (RBAC).

Security Architecture:
- Cryptographically secure PBKDF2-HMAC-SHA256 password derivation (100,000 iterations + 16-byte random salt).
- Signed HMAC-SHA256 Bearer tokens with payload tamper-proofing and expiration checks.
- Super Admin privilege is strictly restricted to the 4 Team CodeX Hackathon members:
    1. Shardul Kulkarni (Frontend & Demo Lead)
    2. Abhiraj Mangire (Backend & Simulation Lead)
    3. Sneha Earge / Sneha Barge (Intelligence & Scoring Lead)
    4. Vaishnavi Repal (PR Checks & Auto-Fix Lead)
- Tenant users are partitioned by tenant_id (e.g., Acme Corp, Beta Inc, Demo Sandbox).
- Safe dual storage: MongoDB Atlas `users` collection when online + in-memory fallback.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "flowguard-hackathon-codeapex-2026-secret-seed-key")

# The only 4 accounts authorized to have platform_owner (Super Admin) status:
TEAM_CODEX_MEMBERS = [
    {
        "id": "admin-1",
        "username": "shardul",
        "name": "Shardul Kulkarni",
        "email": "shardul@flowguard.io",
        "role": "platform_owner",
        "tenant_id": "flowguard",
        "title": "Frontend, AI Prompts & Demo Lead",
        "default_passwords": ["shardul@codex2026", "codex2026"],
    },
    {
        "id": "admin-2",
        "username": "abhiraj",
        "name": "Abhiraj Mangire",
        "email": "abhiraj@flowguard.io",
        "role": "platform_owner",
        "tenant_id": "flowguard",
        "title": "Backend, Simulator & Integration Lead",
        "default_passwords": ["abhiraj@codex2026", "codex2026"],
    },
    {
        "id": "admin-3",
        "username": "sneha",
        "name": "Sneha Barge",
        "email": "sneha@flowguard.io",
        "role": "platform_owner",
        "tenant_id": "flowguard",
        "title": "Intelligence & Resilience Scoring Lead",
        "default_passwords": ["sneha@codex2026", "codex2026"],
    },
    {
        "id": "admin-4",
        "username": "vaishnavi",
        "name": "Vaishnavi Repal",
        "email": "vaishnavi@flowguard.io",
        "role": "platform_owner",
        "tenant_id": "flowguard",
        "title": "PR Gate Checks & Auto-Fix Lead",
        "default_passwords": ["vaishnavi@codex2026", "codex2026"],
    },
]

# Client company pre-seeded accounts:
SEED_TENANT_USERS = [
    # Acme Corp
    {
        "id": "u-acme-1",
        "username": "acme_admin",
        "name": "Sarah Chen",
        "email": "admin@acme.com",
        "role": "company_admin",
        "tenant_id": "acme",
        "title": "VP of Engineering",
        "default_passwords": ["acme@admin2026", "acme2026"],
    },
    {
        "id": "u-acme-2",
        "username": "marcus",
        "name": "Marcus Brody",
        "email": "marcus@acme.com",
        "role": "company_engineer",
        "tenant_id": "acme",
        "title": "Senior SRE",
        "default_passwords": ["marcus@acme2026", "acme2026"],
    },
    {
        "id": "u-acme-3",
        "username": "elena",
        "name": "Elena Rostova",
        "email": "elena@acme.com",
        "role": "company_engineer",
        "tenant_id": "acme",
        "title": "Infrastructure Engineer",
        "default_passwords": ["elena@acme2026", "acme2026"],
    },
    # Beta Inc
    {
        "id": "u-beta-1",
        "username": "beta_admin",
        "name": "Alex Kumar",
        "email": "dev@betainc.io",
        "role": "company_admin",
        "tenant_id": "beta",
        "title": "Lead DevOps Architect",
        "default_passwords": ["beta@admin2026", "beta2026"],
    },
    {
        "id": "u-beta-2",
        "username": "chloe",
        "name": "Chloe Bennett",
        "email": "chloe@betainc.io",
        "role": "company_engineer",
        "tenant_id": "beta",
        "title": "Reliability Engineer",
        "default_passwords": ["chloe@beta2026", "beta2026"],
    },
    # Demo Sandbox
    {
        "id": "u-demo-1",
        "username": "guest",
        "name": "Hackathon Judge / Guest",
        "email": "guest@demo.org",
        "role": "company_engineer",
        "tenant_id": "demo",
        "title": "Guest Evaluator",
        "default_passwords": ["demo@guest2026", "demo2026"],
    },
]

SUPER_ADMIN_EMAILS = {u["email"].lower() for u in TEAM_CODEX_MEMBERS}
SUPER_ADMIN_USERNAMES = {u["username"].lower() for u in TEAM_CODEX_MEMBERS}


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Derive standard PBKDF2-HMAC-SHA256 hex digest using 100,000 iterations."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return key.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Constant-time verification of password against stored hash."""
    derived_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(derived_hash, password_hash)


def create_token(user: Dict[str, Any], expires_in_seconds: int = 86400 * 7) -> str:
    """Generate a tamper-proof HMAC-SHA256 signed bearer token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "tenant_id": user["tenant_id"],
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time()),
    }
    
    b64_header = base64.urlsafe_b64encode(json.dumps(header).encode("utf-8")).decode("utf-8").rstrip("=")
    b64_payload = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    message = f"{b64_header}.{b64_payload}".encode("utf-8")
    
    sig = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    b64_sig = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")
    
    return f"{b64_header}.{b64_payload}.{b64_sig}"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify bearer token signature and expiration."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        b64_header, b64_payload, b64_sig = parts
        message = f"{b64_header}.{b64_payload}".encode("utf-8")
        
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        
        # Add back base64 padding
        pad = len(b64_sig) % 4
        sig_bytes = base64.urlsafe_b64decode(b64_sig + ("=" * (4 - pad) if pad else ""))
        
        if not hmac.compare_digest(expected_sig, sig_bytes):
            return None
        
        pad_p = len(b64_payload) % 4
        payload_bytes = base64.urlsafe_b64decode(b64_payload + ("=" * (4 - pad_p) if pad_p else ""))
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        if payload.get("exp", 0) < int(time.time()):
            return None  # expired
        
        return payload
    except Exception:
        return None


# ── In-Memory & DB Storage ──────────────────────────────────────────────────

_USERS_DB: Dict[str, Dict[str, Any]] = {}


def _init_users():
    """Seed default Super Admin accounts and client company accounts with hashed passwords."""
    global _USERS_DB
    all_seeds = TEAM_CODEX_MEMBERS + SEED_TENANT_USERS
    for u in all_seeds:
        user_key = u["email"].lower()
        if user_key not in _USERS_DB:
            # Hash first default password
            first_pwd = u["default_passwords"][0]
            pwd_hash, salt = hash_password(first_pwd)
            
            # Store valid hashes for alternative quick passwords (like "codex2026")
            alt_hashes = []
            for alt_pwd in u["default_passwords"][1:]:
                alt_hash, alt_salt = hash_password(alt_pwd)
                alt_hashes.append({"hash": alt_hash, "salt": alt_salt})
            
            _USERS_DB[user_key] = {
                "id": u["id"],
                "username": u["username"],
                "name": u["name"],
                "email": u["email"],
                "role": u["role"],
                "tenant_id": u["tenant_id"],
                "title": u.get("title", ""),
                "password_hash": pwd_hash,
                "salt": salt,
                "alt_passwords": alt_hashes,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": None,
            }


_init_users()


def authenticate_user(
    username_or_email: str,
    password: str,
    tenant_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Verify credentials. Returns user dict on success, None on failure."""
    identifier = username_or_email.strip().lower()
    
    # Locate user by email or username
    user = None
    for u in _USERS_DB.values():
        if u["email"].lower() == identifier or u["username"].lower() == identifier:
            user = u
            break
            
    if not user:
        return None
        
    # Tenant verification if specified and user is not super-admin
    if tenant_id and user["role"] != "platform_owner":
        if user["tenant_id"].lower() != tenant_id.lower():
            return None
            
    # Check primary password
    if verify_password(password, user["password_hash"], user["salt"]):
        user["last_login"] = datetime.now(timezone.utc).isoformat()
        return copy.deepcopy(user)
        
    # Check alternate accepted passwords
    for alt in user.get("alt_passwords", []):
        if verify_password(password, alt["hash"], alt["salt"]):
            user["last_login"] = datetime.now(timezone.utc).isoformat()
            return copy.deepcopy(user)
            
    return None


# ─── Password + OTP Two-Factor Authentication Engine ────────────────────────

_OTP_SESSIONS: Dict[str, Dict[str, Any]] = {}


def mask_email(email: str) -> str:
    """Mask email for privacy display (e.g., s***l@flowguard.io)."""
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + ("*" * (len(local) - 2)) + local[-1]
    return f"{masked_local}@{domain}"


def create_otp_session(user: Dict[str, Any], expires_in_seconds: int = 300) -> tuple[str, str]:
    """Generate a cryptographically secure 6-digit OTP code and session ID."""
    session_id = secrets.token_hex(16)
    # 6-digit numeric OTP code (100000 - 999999)
    otp_code = str(secrets.randbelow(900000) + 100000)
    
    _OTP_SESSIONS[session_id] = {
        "user": copy.deepcopy(user),
        "otp": otp_code,
        "expires_at": time.time() + expires_in_seconds,
        "attempts": 0,
    }
    return session_id, otp_code


def verify_otp(session_id: str, otp_code: str) -> Optional[Dict[str, Any]]:
    """Validate 6-digit OTP against session. Returns user dict on match, None otherwise."""
    session = _OTP_SESSIONS.get(session_id)
    if not session:
        return None
        
    if time.time() > session["expires_at"]:
        del _OTP_SESSIONS[session_id]
        return None
        
    session["attempts"] += 1
    if session["attempts"] > 5:
        del _OTP_SESSIONS[session_id]
        return None
        
    # Constant-time comparison
    if hmac.compare_digest(session["otp"].strip(), otp_code.strip()):
        user = session["user"]
        del _OTP_SESSIONS[session_id]
        user_key = user["email"].lower()
        if user_key in _USERS_DB:
            _USERS_DB[user_key]["last_login"] = datetime.now(timezone.utc).isoformat()
        return copy.deepcopy(user)
        
    return None


def resend_otp(session_id: str, expires_in_seconds: int = 300) -> Optional[tuple[str, str]]:
    """Regenerate a new 6-digit OTP for an existing session."""
    session = _OTP_SESSIONS.get(session_id)
    if not session:
        return None
        
    new_otp = str(secrets.randbelow(900000) + 100000)
    session["otp"] = new_otp
    session["expires_at"] = time.time() + expires_in_seconds
    session["attempts"] = 0
    return session_id, new_otp


def register_user(
    username: str,
    email: str,
    password: str,
    tenant_id: str,
    role: str = "company_engineer",
    name: Optional[str] = None,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Register a new user under a tenant. Enforces security rules for platform_owner."""
    clean_username = username.strip().lower()
    clean_email = email.strip().lower()
    clean_tenant = tenant_id.strip().lower()
    
    # Security Rule: Only the 4 authorized Hackathon team members can be platform_owner
    if role == "platform_owner":
        if clean_email not in SUPER_ADMIN_EMAILS and clean_username not in SUPER_ADMIN_USERNAMES:
            raise ValueError("Forbidden: Super Admin access is restricted to verified Team CodeX members.")
            
    # Check for duplicate
    for u in _USERS_DB.values():
        if u["email"].lower() == clean_email:
            raise ValueError(f"User with email '{clean_email}' already exists.")
        if u["username"].lower() == clean_username and u["tenant_id"].lower() == clean_tenant:
            raise ValueError(f"Username '{clean_username}' already taken in this organization.")
            
    pwd_hash, salt = hash_password(password)
    new_user = {
        "id": f"u-{secrets.token_hex(4)}",
        "username": clean_username,
        "name": name or clean_username.capitalize(),
        "email": clean_email,
        "role": role,
        "tenant_id": clean_tenant,
        "title": title or ("Engineer" if role == "company_engineer" else "Administrator"),
        "password_hash": pwd_hash,
        "salt": salt,
        "alt_passwords": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat(),
    }
    
    _USERS_DB[clean_email] = new_user
    return copy.deepcopy(new_user)


def list_users_for_tenant(tenant_id: str) -> List[Dict[str, Any]]:
    """List sanitized user profiles (no password hashes) for a given tenant."""
    clean_tenant = tenant_id.strip().lower()
    out = []
    for u in _USERS_DB.values():
        if clean_tenant == "flowguard" or u["tenant_id"].lower() == clean_tenant:
            clean = copy.deepcopy(u)
            clean.pop("password_hash", None)
            clean.pop("salt", None)
            clean.pop("alt_passwords", None)
            out.append(clean)
    return out


def get_hackathon_super_admins() -> List[Dict[str, Any]]:
    """Return the official 4 Team CodeX Hackathon Super Admins."""
    return [
        {
            "username": m["username"],
            "name": m["name"],
            "email": m["email"],
            "role": m["role"],
            "title": m["title"],
            "default_password_hint": m["default_passwords"][0],
        }
        for m in TEAM_CODEX_MEMBERS
    ]
