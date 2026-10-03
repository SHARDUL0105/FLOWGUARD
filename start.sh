#!/usr/bin/env bash
# Owner: Abhiraj. Starts backend (8000) and frontend (3000).
set -e
cd "$(dirname "$0")"
(cd backend && uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev) &
wait
