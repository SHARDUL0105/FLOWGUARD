# FLOWGUARD Backend

Backend implementation for the FLOWGUARD hackathon prototype. The simulator is a modular, faithful port of `reference_sim.py` and is the source of truth for live/headless simulation, scoring, What-If, PR analysis and fixture recording.

## Requirements
- Python 3.11+
- pip

## Run

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cd ..
python -m uvicorn backend.app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs
Health: http://localhost:8000/api/health

## Verify simulator

```bash
python -m pytest backend/tests -q
python scripts/record_fixtures.py
```

Expected reference values:
- baseline p95 ~468 ms, error 0
- resilience score 84
- db_latency x3 ~628 ms, error ~0.004
- service_down ~369 ms, error 0
- traffic_spike x2 ~2018 ms, error ~0.028
- PR 12 score ~32
- healed PR 12 score ~84

## API
- GET `/api/topology`
- GET `/api/health`
- POST `/api/chaos`
- POST `/api/reset`
- GET/POST `/api/demo/mode`
- WS `/api/ws` is not used; WebSocket contract is `/api/ws`? No: FastAPI router prefix means the contract endpoint is `/api/ws` only if websocket is declared under router. The frontend contract in the brief specifies `/ws`; therefore use the root websocket endpoint added by `main.py` if needed.
- POST `/api/whatif`
- GET `/api/pr`
- POST `/api/pr/{id}/analyze`
- POST `/api/pr/{id}/heal`
- GET `/api/brief`

> Note: The fixed contract in the brief says `WS /ws`, while REST endpoints use `/api/...`. This backend keeps the REST routes under `/api` and also exposes a root `/ws` alias in the integration layer.
