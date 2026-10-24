@echo off
title Kite Connect Launcher
echo ========================================================
echo   Launching Zerodha Kite Connect Pro Hub
echo   - Backend:  http://127.0.0.1:8000
echo   - Frontend: http://localhost:5173
echo ========================================================

start "Kite Backend (FastAPI)" cmd /c "%~dp0run_backend.bat"
timeout /t 2 /nobreak >nul
start "Kite Frontend (Vite)" cmd /c "%~dp0run_frontend.bat"

echo.
echo Both servers are launching in background windows.
echo Opening http://localhost:5173 in your default browser...
start http://localhost:5173

