#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Prefer the Linux venv outside the Windows-mounted project.
if [ -d "$HOME/flowguard-venv" ]; then
    VENV="$HOME/flowguard-venv"
else
    VENV="$ROOT/backend/.venv"

    if [ ! -d "$VENV" ]; then
        python3 -m venv "$VENV"
    fi
fi

source "$VENV/bin/activate"

python -m pip install -q -r "$ROOT/backend/requirements.txt"

cd "$ROOT"

# Project root must be on Python's import path because the project
# imports modules using backend.app....
export PYTHONPATH="$ROOT"

# Pre-generate fixtures if needed
if [ ! -f "$ROOT/fixtures/topology.json" ]; then
    echo "[*] Pre-generating simulation fixtures..."
    python "$ROOT/scripts/record_fixtures.py"
fi

# PIDs array for cleanup
PIDS=()

cleanup() {
    echo "[*] Stopping all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    # Stop docker compose
    docker-compose -f "$ROOT/docker-compose.audit.yml" down 2>/dev/null || true
    echo "[+] FLOWGUARD stopped cleanly."
}

trap cleanup EXIT

# 1. Start Backend on port 8000
echo "[*] Starting Backend on http://localhost:8000 (Swagger: http://localhost:8000/docs)"
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

sleep 2

# 2. Start Frontend on port 3000 (App)
echo "[*] Starting Frontend on http://localhost:3000"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_3000_PID=$!
PIDS+=($FRONTEND_3000_PID)

sleep 3

# 3. Start Frontend on port 4000 (Admin) - uses dedicated dev:admin script
echo "[*] Starting Frontend (Admin) on http://localhost:4000"
npm run dev:admin &
FRONTEND_4000_PID=$!
PIDS+=($FRONTEND_4000_PID)

sleep 1

# 4. Start Docker Compose for Audit Log (Redis + Audit-Log + API + Frontend)
echo "[*] Starting Docker Audit Stack (Redis, Audit-Log, API, Frontend)..."
cd "$ROOT"
docker-compose -f docker-compose.audit.yml up --build &
DOCKER_PID=$!
PIDS+=($DOCKER_PID)

echo ""
echo "=================================================="
echo "  FLOWGUARD RUNNING"
echo "=================================================="
echo "  Backend API:      http://localhost:8000"
echo "  Swagger Docs:     http://localhost:8000/docs"
echo "  Frontend (App):   http://localhost:3000"
echo "  Frontend (Admin): http://localhost:4000"
echo "  Audit Log:        http://localhost:8080"
echo "  Redis:            localhost:6379"
echo "=================================================="
echo "  Press Ctrl+C to stop all services"

# Wait for all processes
wait