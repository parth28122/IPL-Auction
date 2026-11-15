@echo off
title IPL Auction Arena - Next.js Frontend
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing node modules...
    call npm install
)
echo Starting Next.js Frontend on http://localhost:3000 ...
call npm run dev
pause
