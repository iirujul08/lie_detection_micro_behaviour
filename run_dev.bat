@echo off
echo ===============================================================
echo   Starting TruthLens AI Full-Stack Platform
echo ===============================================================
echo.
echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "TruthLens FastAPI Backend" cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting React + Vite Frontend on http://localhost:5173 ...
cd frontend
cmd /c npm run dev

pause
