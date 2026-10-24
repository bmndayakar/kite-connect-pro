@echo off
title Kite Connect Frontend (Vite + React)
echo Starting React Vite Frontend on http://localhost:5173 ...

:: Use installed nodejs
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0frontend"
call npm run dev
pause

