from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import router, websocket
from fastapi import WebSocket

app=FastAPI(title="FLOWGUARD API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

# Fixed contract: WebSocket endpoint is /ws, not /api/ws.
@app.websocket("/ws")
async def root_websocket(ws: WebSocket):
    await websocket(ws)

@app.get('/')
def root(): return {"name":"FLOWGUARD","status":"ok","docs":"/docs"}
