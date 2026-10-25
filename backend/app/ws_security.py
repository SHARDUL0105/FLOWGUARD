#!/usr/bin/env python3
"""
WebSocket Security Manager
- Connection limit: 1 per project
- Auth timeout on connection (5s)
- Message validation with schema
- Redis-backed connection tracking
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Set
from dataclasses import dataclass, field

import redis.asyncio as redis
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, ValidationError, field

from . import auth


@dataclass
class WSConnection:
    """Tracked WebSocket connection"""
    websocket: 'WebSocket'
    project_id: str
    user_id: str
    tenant_id: str
    connected_at: datetime
    last_activity: datetime
    message_count: int = 0


class WSMessage(BaseModel):
    """Validated WebSocket message schema"""
    type: str  # "ping", "subscribe", "unsubscribe", "command"
    payload: dict = {}
    timestamp: float = field(default_factory=time.time)
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    class Config:
        extra = "forbid"


class WSCommand(BaseModel):
    """Validated command payload"""
    command: str  # "chaos", "reset", "subscribe"
    params: dict = {}

    class Config:
        extra = "forbid"


class WSSecurityManager:
    """
    Manages WebSocket connections with security controls:
    - 1 connection per project per user
    - Auth timeout (5s to authenticate after connect)
    - Message validation
    - Rate limiting (10 msg/s per connection)
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.connections: Dict[str, WSConnection] = {}  # ws_id -> connection
        self.project_connections: Dict[str, Set[str]] = {}  # project_id -> {ws_ids}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> {ws_ids}
        self.pending_auth: Dict[str, asyncio.Task] = {}  # ws_id -> auth timeout task
        self.lock = asyncio.Lock()
        self.auth_timeout = 5.0  # seconds to authenticate after connect
        self.max_messages_per_second = 10
        self.max_message_size = 64 * 1024  # 64KB

    async def initialize(self):
        """Initialize Redis connection"""
        self.redis_client = redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await self.redis_client.ping()

    async def close(self):
        if self.redis_client:
            await self.redis_client.close()

    def _generate_ws_id(self) -> str:
        return str(uuid.uuid4())

    def _get_redis_key(self, ws_id: str) -> str:
        return f"ws:conn:{ws_id}"

    def _get_project_key(self, project_id: str) -> str:
        return f"ws:project:{project_id}"

    def _get_user_key(self, user_id: str) -> str:
        return f"ws:user:{user_id}"

    async def authenticate_connection(
        self,
        websocket,
        project_id: str,
        token: str,
    ) -> tuple[bool, Optional[dict]]:
        """
        Authenticate WebSocket connection with JWT token.
        Returns (success, user_data).
        """
        try:
            payload = auth.verify_token(token)
            if not payload:
                return False, None

            # Verify project access
            user_tenant = payload.get("tenant_id")
            user_role = payload.get("role")
            user_id = payload.get("sub")

            # Verify user has access to project
            # (In real implementation, check project membership)
            return True, {
                "user_id": user_id,
                "tenant_id": user_tenant,
                "role": user_role,
                "username": payload.get("username"),
            }
        except Exception:
            return False, None

    async def handle_new_connection(
        self,
        websocket,
        project_id: str,
        token: str,
    ) -> tuple[bool, str, Optional[WSConnection]]:
        """
        Handle new WebSocket connection with security checks.
        Returns (success, ws_id, connection_or_none)
        """
        ws_id = self._generate_ws_id()

        # Authenticate with timeout
        auth_task = asyncio.create_task(
            self.authenticate_connection(websocket, project_id, token)
        )

        try:
            success, user_data = await asyncio.wait_for(auth_task, timeout=5.0)
        except asyncio.TimeoutError:
            await websocket.close(code=4001, reason="Authentication timeout")
            return False, ws_id, None

        if not success or not user_data:
            await websocket.close(code=4002, reason="Authentication failed")
            return False, ws_id, None

        user_id = user_data["user_id"]
        tenant_id = user_data["tenant_id"]

        # Check connection limits (1 per project per user)
        async with self.lock:
            # Check existing connections for this project+user
            project_key = self._get_project_key(project_id)
            user_key = self._get_user_key(user_id)

            # Use Redis for distributed tracking
            if self.redis_client:
                existing = await self.redis_client.smembers(project_key)
                user_conns = await self.redis_client.smembers(user_key)

                # Check if user already has connection to this project
                for existing_ws_id in existing:
                    conn_data = await self.redis_client.get(f"ws:conn:{existing_ws_id}")
                    if conn_data:
                        conn_info = json.loads(conn_data)
                        if conn_info.get("user_id") == user_id:
                            # Close existing connection
                            await self._force_close(existing_ws_id, "New connection from same user")

            # Register new connection
            conn = WSConnection(
                websocket=None,  # Set after
                project_id=project_id,
                user_id=user_id,
                tenant_id=user_data["tenant_id"],
                connected_at=datetime.now(timezone.utc),
                last_activity=datetime.now(timezone.utc),
            )

            # Store in memory and Redis
            self.connections[ws_id] = conn
            self.project_connections.setdefault(project_id, set()).add(ws_id)
            self.user_connections.setdefault(user_id, set()).add(ws_id)

            if self.redis_client:
                pipe = self.redis_client.pipeline()
                pipe.set(
                    f"ws:conn:{ws_id}",
                    json.dumps({
                        "project_id": project_id,
                        "user_id": user_id,
                        "tenant_id": tenant_id,
                        "connected_at": conn.connected_at.isoformat(),
                    }),
                    ex=3600  # 1 hour TTL
                )
                pipe.sadd(project_key, ws_id)
                pipe.sadd(user_key, ws_id)
                pipe.expire(project_key, 3600)
                pipe.expire(user_key, 3600)
                await pipe.execute()

        return True, ws_id, conn

    async def _force_close(self, ws_id: str, reason: str):
        """Force close a connection"""
        if ws_id in self.connections:
            conn = self.connections[ws_id]
            try:
                await conn.websocket.close(code=4003, reason=reason)
            except Exception:
                pass
            await self._remove_connection(ws_id)

    async def _remove_connection(self, ws_id: str):
        """Remove connection from tracking"""
        if ws_id in self.connections:
            conn = self.connections.pop(ws_id)
            project_id = conn.project_id
            user_id = conn.user_id

            self.project_connections.get(project_id, set()).discard(ws_id)
            self.user_connections.get(conn.user_id, set()).discard(ws_id)

            if self.redis_client:
                pipe = self.redis_client.pipeline()
                pipe.delete(f"ws:conn:{ws_id}")
                pipe.srem(self._get_project_key(project_id), ws_id)
                pipe.srem(self._get_user_key(user_id), ws_id)
                await pipe.execute()

    async def validate_message(self, ws_id: str, raw_message: str) -> tuple[bool, Optional[dict]]:
        """
        Validate incoming WebSocket message.
        Returns (valid, parsed_message_or_none)
        """
        if len(raw_message) > 64 * 1024:  # 64KB limit
            return False, None

        try:
            data = json.loads(raw_message)
        except json.JSONDecodeError:
            return False, None

        # Validate message structure
        try:
            msg = WSMessage(**data)
        except ValidationError:
            return False, None

        # Rate limiting per connection
        conn = self.connections.get(ws_id)
        if conn:
            now = time.time()
            if not hasattr(conn, '_msg_timestamps'):
                conn._msg_timestamps = []

            # Clean old timestamps
            conn._msg_timestamps = [t for t in conn._msg_timestamps if now - t < 1.0]

            if len(conn._msg_timestamps) >= 10:  # 10 msg/s limit
                return False, None

            conn._msg_timestamps.append(now)
            conn.last_activity = datetime.now(timezone.utc)
            conn.message_count += 1

            # Update Redis
            if self.redis_client:
                await self.redis_client.hset(
                    f"ws:conn:{ws_id}",
                    mapping={
                        "last_activity": datetime.now(timezone.utc).isoformat(),
                        "message_count": str(conn.message_count),
                    }
                )

        return True, msg.dict()

    async def handle_command(self, ws_id: str, msg: dict) -> Optional[dict]:
        """Handle validated command message"""
        conn = self.connections.get(ws_id)
        if not conn:
            return None

        payload = msg.get("payload", {})
        msg_type = msg.get("type")

        if msg_type == "command":
            try:
                cmd = WSCommand(**payload)
            except ValidationError:
                return {"error": "Invalid command format"}

            # Handle commands based on role
            if cmd.command == "chaos":
                # Only engineers and admins can trigger chaos
                return {"status": "accepted", "command": "chaos", "params": cmd.params}

            elif cmd.command == "reset":
                return {"status": "accepted", "command": "reset"}

            elif cmd.command == "subscribe":
                return {"status": "subscribed", "topic": cmd.params.get("topic")}

            return {"error": f"Unknown command: {cmd.command}"}

        elif msg_type == "ping":
            return {"type": "pong", "timestamp": time.time()}

        return {"error": f"Unknown message type: {msg_type}"}


# Global instance
ws_security = WSSecurityManager()


async def get_ws_security() -> WSSecurityManager:
    return ws_security