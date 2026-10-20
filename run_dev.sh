#!/usr/bin/env bash
# TruthLens Full-Stack Development Launcher

echo "==============================================================="
echo "  Starting TruthLens AI Full-Stack Platform"
echo "==============================================================="
echo ""

# Activate virtual environment if present
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Shutting down TruthLens processes..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[1/2] Starting FastAPI Backend on http://localhost:8000 ..."
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload &

echo "[2/2] Starting React + Vite Frontend on http://localhost:5173 ..."
cd frontend && npm run dev &

wait
