import asyncio
import json
from itertools import count

import pytest
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app import main


_CLIENT_IPS = count(1)


def _request(ip: str, path: str, method: str = "GET") -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": (ip, 12345),
            "server": ("testserver", 80),
        }
    )


async def _dispatch(limiter, ip: str, path: str, method: str = "GET"):
    async def call_next(_request):
        return JSONResponse({"ok": True})

    return await limiter.dispatch(_request(ip, path, method), call_next)


@pytest.mark.parametrize(
    ("path", "method", "limit"),
    [
        ("/api/auth/login", "POST", 5),
        ("/api/auth/register", "POST", 3),
        ("/api/reset", "POST", 30),
        ("/api/health", "GET", 120),
    ],
)
def test_rate_limit_buckets_keep_existing_request_limits(path, method, limit):
    limiter = main.RateLimitMiddleware(lambda *_args: None)
    ip = f"198.51.100.{next(_CLIENT_IPS)}"

    responses = [
        asyncio.run(_dispatch(limiter, ip, path, method))
        for _ in range(limit + 1)
    ]

    assert all(response.status_code == 200 for response in responses[:limit])
    assert responses[limit].status_code == 429
    assert int(responses[limit].headers["Retry-After"]) > 0


def test_rate_limit_storage_stays_within_hard_key_limit(monkeypatch):
    monkeypatch.setattr(main, "MAX_RATE_LIMIT_KEYS", 3)
    limiter = main.RateLimitMiddleware(lambda *_args: None)

    responses = [
        asyncio.run(
            _dispatch(limiter, f"198.51.100.{ip}", "/api/health")
        )
        for ip in range(1, 101)
    ]

    assert len(limiter.requests) == 3
    assert all(response.status_code == 200 for response in responses[:3])
    assert all(response.status_code == 429 for response in responses[3:])
    assert all(int(response.headers["Retry-After"]) > 0 for response in responses[3:])


def test_capacity_rejects_new_client_without_bypassing_existing_limits(monkeypatch):
    monkeypatch.setattr(main, "MAX_RATE_LIMIT_KEYS", 1)
    limiter = main.RateLimitMiddleware(lambda *_args: None)
    existing_ip = "198.51.100.200"

    login_responses = [
        asyncio.run(_dispatch(limiter, existing_ip, "/api/auth/login", "POST"))
        for _ in range(6)
    ]
    capacity_response = asyncio.run(
        _dispatch(limiter, "198.51.100.201", "/api/health")
    )

    assert all(response.status_code == 200 for response in login_responses[:5])
    assert login_responses[5].status_code == 429
    assert int(login_responses[5].headers["Retry-After"]) > 0
    assert capacity_response.status_code == 429
    assert "capacity" in json.loads(capacity_response.body)["detail"].lower()
    assert int(capacity_response.headers["Retry-After"]) > 0
    assert len(limiter.requests) == 1


def test_capacity_cleanup_reclaims_expired_keys(monkeypatch):
    monkeypatch.setattr(main, "MAX_RATE_LIMIT_KEYS", 1)
    now = [100.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: now[0])
    limiter = main.RateLimitMiddleware(lambda *_args: None)

    first = asyncio.run(
        _dispatch(limiter, "198.51.100.210", "/api/health")
    )
    now[0] += 61
    next_client = asyncio.run(
        _dispatch(limiter, "198.51.100.211", "/api/health")
    )

    assert first.status_code == 200
    assert next_client.status_code == 200
    assert len(limiter.requests) == 1
    assert ("198.51.100.211", "read") in limiter.requests
