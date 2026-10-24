@echo off
title Kite Connect Backend (FastAPI)
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...

:: Use installed python
set "PATH=C:\Users\dayam\AppData\Local\Python\pythoncore-3.15-64;C:\Users\dayam\AppData\Local\Python\pythoncore-3.15-64\Scripts;%PATH%"

cd /d "%~dp0backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause

