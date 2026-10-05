# FLOWGUARD
Predictive reliability platform: detect, understand, predict, simulate and fix cascading failures
before they ship. Team CodeX - CURIOUSPARC 2026.

> Don't wait for your system to fail. Predict it. Simulate it. Stop it.

## Quickstart
```
cp .env.example .env     # optional: add LLM_* keys; without them the brief uses the template fallback
./start.sh               # backend :8000 + frontend :3000
```
Backend only (from the project root):
```
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && cd ..
python -m uvicorn backend.app.main:app --reload --port 8000
```
Frontend only: `cd frontend && npm install && npm run dev`
Tests: `python -m pytest backend -q`   |   Re-record replay fixtures: `python scripts/record_fixtures.py`

API docs: http://localhost:8000/docs  |  Health: http://localhost:8000/api/health

## Ownership
| Person | Folders |
|---|---|
| Shardul | frontend/, backend/app/ai/prompts/, docs/demo-script.md |
| Abhiraj | backend/app/{main,api,schemas,state}.py, backend/app/sim/, fixtures/, scripts/, start.sh |
| Sneha | backend/app/intel/, backend/app/tests/ |
| Vaishnavi | backend/app/pr/ (scanner, heal, gate, prs), backend/app/ai/ (brief, guardrails, llm, pr_comment) |

Source of truth: `docs/FLOWGUARD_AI_Master_Brief.md` (API contract = Section 10).

## Reference values (verified)
- baseline p95 ~468 ms, error 0; resilience score 84
- db_latency x3 ~628 ms (err ~0.004); service_down ~369 ms (err 0); traffic_spike x2 ~2018 ms (err ~0.028)
- PR 12 score 32 (regression); Verified Auto-Fix gate accepts, healed score 84

## API
`GET /api/topology` · `GET /api/health` · `POST /api/chaos` · `POST /api/reset` · `GET|POST /api/demo/mode` ·
`POST /api/whatif` · `GET /api/pr` · `POST /api/pr/{id}/analyze` · `POST /api/pr/{id}/heal` ·
`GET /api/brief` (SSE; `?scenario=` or `?pr=`) · `WS /ws`

REST routes live under `/api`; the WebSocket is at the root `/ws` per the contract.

## Backend layout
- `sim/` — modular port of `reference_sim.py` (topology, config, faults, engine)
- `intel/` — Sneha's intelligence modules (+ `intel/runtime/` used by the live loop)
- `pr/` — PR scanner, Auto-Fix healer, acceptance gate, demo PRs
- `ai/` — Incident Commander brief (LLM → template → fixture fallback), number guardrails, PR comment renderer

## Frontend routes
`/` landing · `/projects` · `/projects/connect` · `/command-center` (Live/Replay toggle, radar, cascade, brief, what-if) ·
`/simulations` · `/alerts` · `/pull-requests` · `/pull-requests/[id]` (score delta, findings, comment, Verified Auto-Fix)

Every network call falls back to `frontend/public/fixtures/` (written by `python scripts/record_fixtures.py`),
so the whole demo runs with the backend off.

## Multi-tenancy (shared collections)
Every stored document carries `tenant_id` and `project_id`. Every read filters on `tenant_id` in one place (`backend/app/db.py`),
and tenant ids are validated against the `tenants` collection. Prototype: the id is sent as the `X-Tenant-ID` header from an
organization switcher. Production: it must come from the signed login token. Seeded tenants: demo, acme, beta.
