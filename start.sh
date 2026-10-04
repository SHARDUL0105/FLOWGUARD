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

python "$ROOT/scripts/record_fixtures.py"

python -m uvicorn backend.app.main:app \
    --host 0.0.0.0 \
    --port 8000 &

BACKEND_PID=$!

cleanup() {
    kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT

if [ -d "$ROOT/frontend" ] && [ -f "$ROOT/frontend/package.json" ]; then
    cd "$ROOT/frontend"
    npm run dev
else
    wait "$BACKEND_PID"
fi