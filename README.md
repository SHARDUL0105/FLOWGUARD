# FLOWGUARD
Predictive reliability platform: detect, understand, predict, simulate and fix cascading failures
before they ship. Team CodeX - CURIOUSPARC 2026.

> Don't wait for your system to fail. Predict it. Simulate it. Stop it.

## Quickstart
```
cp .env.example .env
./start.sh            # backend :8000 + frontend :3000
```
Backend only: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
Frontend only: `cd frontend && npm install && npm run dev`
Test: `cd backend && python -m pytest -q`

## Ownership (edit only your folders)
| Person | Folders |
|---|---|
| Shardul | frontend/, backend/app/ai/prompts/, docs/demo-script.md |
| Abhiraj | backend/app/{main,api,schemas,state}.py, backend/app/sim/, fixtures/, scripts/, start.sh |
| Sneha | backend/app/intel/, backend/app/tests/ |
| Vaishnavi | backend/app/pr/, backend/app/ai/*.py |

Source of truth: `docs/FLOWGUARD_AI_Master_Brief.md` (API contract = Section 10).
Branches: `feat/<area>`, small PRs, `main` must always run. Feature freeze 4 Oct 4 pm.
