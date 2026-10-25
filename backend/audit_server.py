#!/usr/bin/env python3
"""
Immutable Audit Log Service with Tamper Detection
- Hash chaining (Merkle tree style) for tamper detection
- Append-only SQLite database
- HMAC-SHA256 signing of each entry
- Merkle root verification endpoint
"""

import os
import json
import hashlib
import hmac
import sqlite3
import threading
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from contextlib import contextmanager

from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
AUDIT_DB_PATH = os.getenv("AUDIT_DB_PATH", "/var/lib/audit/audit.db")
AUDIT_HMAC_KEY = os.getenv("AUDIT_HMAC_KEY", "flowguard-audit-secret-change-in-prod").encode()
AUDIT_PORT = int(os.getenv("AUDIT_PORT", "8080"))

# Ensure audit directory exists
os.makedirs(os.path.dirname(AUDIT_DB_PATH), exist_ok=True)


@dataclass
class AuditEntry:
    """Immutable audit log entry with hash chain"""
    id: int
    timestamp: str
    tenant_id: str
    user_id: str
    action: str
    resource: str
    metadata: Dict[str, Any]
    ip_address: str
    user_agent: str
    prev_hash: str
    entry_hash: str
    hmac_signature: str
    merkle_root: str


class AuditLog:
    """Immutable audit log with hash chaining and HMAC signing"""

    def __init__(self, db_path: str, hmac_key: bytes):
        self.db_path = db_path
        self.hmac_key = hmac_key
        self.lock = threading.RLock()
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with audit table"""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    resource TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    user_agent TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    entry_hash TEXT NOT NULL,
                    hmac_signature TEXT NOT NULL,
                    merkle_root TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tenant_time ON audit_log(tenant_id, timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user_time ON audit_log(user_id, timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_action_time ON audit_log(action, timestamp)")

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _compute_entry_hash(self, entry_data: dict) -> str:
        """Compute SHA256 hash of entry data (excluding signatures)"""
        canonical = json.dumps(entry_data, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(canonical.encode()).hexdigest()

    def _compute_hmac(self, data: str) -> str:
        """Compute HMAC-SHA256 signature"""
        return hmac.new(self.hmac_key, data.encode(), hashlib.sha256).hexdigest()

    def _get_last_entry(self) -> Optional[sqlite3.Row]:
        """Get the most recent audit entry"""
        with self._get_conn() as conn:
            return conn.execute(
                "SELECT * FROM audit_log ORDER BY id DESC LIMIT 1"
            ).fetchone()

    def _compute_merkle_root(self, new_entry_hash: str) -> str:
        """Compute new Merkle root (simplified: hash of all entry hashes)"""
        with self._get_conn() as conn:
            hashes = [row[0] for row in conn.execute(
                "SELECT entry_hash FROM audit_log ORDER BY id"
            ).fetchall()]
        hashes.append(new_entry_hash)
        # Build Merkle tree (simplified for audit log)
        while len(hashes) > 1:
            next_level = []
            for i in range(0, len(hashes), 2):
                left = hashes[i]
                right = hashes[i + 1] if i + 1 < len(hashes) else left
                next_level.append(hashlib.sha256((left + right).encode()).hexdigest())
            hashes = next_level
        return hashes[0] if hashes else hashlib.sha256(b"empty").hexdigest()

    def append(self, entry: Dict[str, Any]) -> AuditEntry:
        """Append new audit entry with hash chain and HMAC"""
        with self.lock:
            timestamp = datetime.now(timezone.utc).isoformat()

            # Get previous entry for hash chaining
            last = self._get_last_entry()
            prev_hash = last["entry_hash"] if last else "0" * 64

            # Prepare entry data (without signatures)
            entry_data = {
                "timestamp": timestamp,
                "tenant_id": entry["tenant_id"],
                "user_id": entry["user_id"],
                "action": entry["action"],
                "resource": entry["resource"],
                "metadata": entry["metadata"],
                "ip_address": entry["ip_address"],
                "user_agent": entry["user_agent"],
                "prev_hash": prev_hash,
            }

            # Compute hashes
            entry_hash = self._compute_entry_hash(entry_data)
            merkle_root = self._compute_merkle_root(entry_hash)
            hmac_sig = self._compute_hmac(f"{entry_hash}:{merkle_root}:{prev_hash}")

            # Store in database
            with self._get_conn() as conn:
                cursor = conn.execute("""
                    INSERT INTO audit_log (
                        timestamp, tenant_id, user_id, action, resource,
                        metadata, ip_address, user_agent,
                        prev_hash, entry_hash, hmac_signature, merkle_root
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    timestamp, entry["tenant_id"], entry["user_id"],
                    entry["action"], entry["resource"],
                    json.dumps(entry["metadata"]),
                    entry["ip_address"], entry["user_agent"],
                    prev_hash, entry_hash, hmac_sig, merkle_root
                ))
                entry_id = cursor.lastrowid

            return AuditEntry(
                id=entry_id,
                timestamp=timestamp,
                tenant_id=entry["tenant_id"],
                user_id=entry["user_id"],
                action=entry["action"],
                resource=entry["resource"],
                metadata=entry["metadata"],
                ip_address=entry["ip_address"],
                user_agent=entry["user_agent"],
                prev_hash=prev_hash,
                entry_hash=entry_hash,
                hmac_signature=hmac_sig,
                merkle_root=merkle_root,
            )

    def verify_chain(self) -> Dict[str, Any]:
        """Verify entire hash chain integrity"""
        with self._get_conn() as conn:
            rows = conn.execute("SELECT * FROM audit_log ORDER BY id").fetchall()

        if not rows:
            return {"valid": True, "entries": 0, "merkle_root": "0" * 64}

        errors = []
        prev_hash = "0" * 64
        all_hashes = []

        for i, row in enumerate(rows):
            # Reconstruct entry data
            entry_data = {
                "timestamp": row["timestamp"],
                "tenant_id": row["tenant_id"],
                "user_id": row["user_id"],
                "action": row["action"],
                "resource": row["resource"],
                "metadata": json.loads(row["metadata"]),
                "ip_address": row["ip_address"],
                "user_agent": row["user_agent"],
                "prev_hash": row["prev_hash"],
            }

            # Verify hash chain
            computed_hash = hashlib.sha256(
                json.dumps(entry_data, sort_keys=True, separators=(',', ':')).encode()
            ).hexdigest()

            if computed_hash != row["entry_hash"]:
                errors.append(f"Entry {row['id']}: hash mismatch")

            if row["prev_hash"] != prev_hash:
                errors.append(f"Entry {row['id']}: prev_hash mismatch")

            # Verify HMAC
            expected_hmac = hmac.new(
                self.hmac_key,
                f"{row['entry_hash']}:{row['merkle_root']}:{row['prev_hash']}".encode(),
                hashlib.sha256
            ).hexdigest()

            if expected_hmac != row["hmac_signature"]:
                errors.append(f"Entry {row['id']}: HMAC verification failed")

            prev_hash = row["entry_hash"]
            all_hashes.append(row["entry_hash"])

        # Verify Merkle root consistency
        computed_merkle = self._compute_merkle_root_from_hashes(all_hashes)
        final_merkle = rows[-1]["merkle_root"]
        if computed_merkle != final_merkle:
            errors.append("Merkle root mismatch")

        return {
            "valid": len(errors) == 0,
            "entries": len(rows),
            "errors": errors,
            "merkle_root": final_merkle,
            "last_entry_id": rows[-1]["id"],
        }

    def _compute_merkle_root_from_hashes(self, hashes: List[str]) -> str:
        """Compute Merkle root from list of hashes"""
        if not hashes:
            return hashlib.sha256(b"empty").hexdigest()
        while len(hashes) > 1:
            next_level = []
            for i in range(0, len(hashes), 2):
                left = hashes[i]
                right = hashes[i + 1] if i + 1 < len(hashes) else left
                next_level.append(hashlib.sha256((left + right).encode()).hexdigest())
            hashes = next_level
        return hashes[0]

    def get_entries(self, tenant_id: Optional[str] = None,
                    user_id: Optional[str] = None,
                    action: Optional[str] = None,
                    limit: int = 100,
                    offset: int = 0) -> List[AuditEntry]:
        """Query audit entries with filters"""
        with self._get_conn() as conn:
            query = "SELECT * FROM audit_log WHERE 1=1"
            params = []

            if tenant_id:
                query += " AND tenant_id = ?"
                params.append(tenant_id)
            if user_id:
                query += " AND user_id = ?"
                params.append(user_id)
            if action:
                query += " AND action = ?"
                params.append(action)

            query += " ORDER BY id DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            rows = conn.execute(query, params).fetchall()

        return [AuditEntry(
            id=row["id"],
            timestamp=row["timestamp"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            action=row["action"],
            resource=row["resource"],
            metadata=json.loads(row["metadata"]),
            ip_address=row["ip_address"],
            user_agent=row["user_agent"],
            prev_hash=row["prev_hash"],
            entry_hash=row["entry_hash"],
            hmac_signature=row["hmac_signature"],
            merkle_root=row["merkle_root"],
        ) for row in rows]


# Initialize audit log
audit_log = AuditLog(AUDIT_DB_PATH, AUDIT_HMAC_KEY)


# Flask Routes
@app.route("/health")
def health():
    return jsonify({"status": "healthy", "service": "audit-log"})


@app.route("/audit", methods=["POST"])
def create_audit_entry():
    """Create new audit entry"""
    try:
        data = request.get_json()
        required = ["tenant_id", "user_id", "action", "resource", "metadata",
                    "ip_address", "user_agent"]
        for field in required:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        entry = audit_log.append(data)
        return jsonify({"id": entry.id, "status": "recorded"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/audit/verify", methods=["GET"])
def verify_chain():
    """Verify audit chain integrity"""
    result = audit_log.verify_chain()
    return jsonify(result)


@app.route("/audit/entries", methods=["GET"])
def get_entries():
    """Query audit entries with filters"""
    tenant_id = request.args.get("tenant_id")
    user_id = request.args.get("user_id")
    action = request.args.get("action")
    limit = min(int(request.args.get("limit", 100)), 1000)
    offset = int(request.args.get("offset", 0))

    entries = audit_log.get_entries(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        limit=limit,
        offset=offset
    )

    return jsonify({
        "entries": [asdict(e) for e in entries],
        "count": len(entries),
        "limit": limit,
        "offset": offset
    })


@app.route("/audit/stats", methods=["GET"])
def get_stats():
    """Get audit log statistics"""
    with sqlite3.connect(AUDIT_DB_PATH) as conn:
        total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        by_action = dict(conn.execute(
            "SELECT action, COUNT(*) FROM audit_log GROUP BY action"
        ).fetchall())
        by_tenant = dict(conn.execute(
            "SELECT tenant_id, COUNT(*) FROM audit_log GROUP BY tenant_id"
        ).fetchall())
        by_user = dict(conn.execute(
            "SELECT user_id, COUNT(*) FROM audit_log GROUP BY user_id"
        ).fetchall())

    return jsonify({
        "total_entries": total,
        "by_action": by_action,
        "by_tenant": by_tenant,
        "by_user": by_user,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=AUDIT_PORT, debug=False)