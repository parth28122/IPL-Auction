@echo off
title IPL Auction Arena - Backend Server
cd /d "%~dp0backend"
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt
echo Starting FastAPI Backend Server on http://localhost:8000 ...
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
