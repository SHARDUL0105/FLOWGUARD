from dotenv import load_dotenv
load_dotenv()
from collections import deque
import math
import threading
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from .api import public_router, router, websocket, websocket_router
from fastapi import WebSocket
from . import db

MAX_RATE_LIMIT_KEYS = 10_000
RATE_LIMIT_WINDOWS = {
    "login": 60,
    "register": 3600,
    "mutation": 60,
    "read": 60,
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-process sliding-window limits for login, registration, and API traffic."""

    def __init__(self, app):
        super().__init__(app)
        self.requests: dict[tuple[str, str], deque[float]] = {}
        self.lock = threading.Lock()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method.upper()
        if path == "/api/auth/login" and method == "POST":
            limit, window, bucket = 5, 60, "login"
        elif path == "/api/auth/register" and method == "POST":
            limit, window, bucket = 3, 3600, "register"
        elif path.startswith("/api/") and method in {"POST", "PUT", "PATCH", "DELETE"}:
            limit, window, bucket = 30, 60, "mutation"
        elif path.startswith("/api/"):
            limit, window, bucket = 120, 60, "read"
        else:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = (client_ip, bucket)
        now = time.monotonic()
        with self.lock:
            timestamps = self.requests.get(key)
            if timestamps is None:
                if len(self.requests) >= MAX_RATE_LIMIT_KEYS:
                    for stored_key, stored_times in tuple(self.requests.items()):
                        stored_window = RATE_LIMIT_WINDOWS[stored_key[1]]
                        while stored_times and now - stored_times[0] >= stored_window:
                            stored_times.popleft()
                        if not stored_times:
                            del self.requests[stored_key]

                if len(self.requests) >= MAX_RATE_LIMIT_KEYS:
                    next_expiry = min(
                        stored_times[0] + RATE_LIMIT_WINDOWS[stored_key[1]]
                        for stored_key, stored_times in self.requests.items()
                    )
                    retry_after = max(1, math.ceil(next_expiry - now))
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Rate limit capacity reached. Please try again later."},
                        headers={"Retry-After": str(retry_after)},
                    )

                timestamps = deque()
                self.requests[key] = timestamps

            while timestamps and now - timestamps[0] >= window:
                timestamps.popleft()
            if len(timestamps) >= limit:
                retry_after = max(1, int(window - (now - timestamps[0])))
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
            timestamps.append(now)
        return await call_next(request)


app=FastAPI(title="FLOWGUARD API", version="0.1.0")

app.add_middleware(RateLimitMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(public_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:4000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(websocket_router)

# Fixed contract: WebSocket endpoint is /ws, not /api/ws.
@app.websocket("/ws")
async def root_websocket(ws: WebSocket):
    await websocket(ws)

@app.get('/health')
def health(): 
    from .state import state
    return {"ok": True, "mode": state.mode}

@app.get('/')
def root(): return {"name":"FLOWGUARD","status":"ok","docs":"/docs"}

# Create indexes and seed demo tenants in the background; a no-op when MONGODB_URI is not set.
threading.Thread(target=db.init, daemon=True).start()
