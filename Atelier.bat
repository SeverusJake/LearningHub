@echo off
REM ─── Atelier — one-click launcher for the LearningHub dashboard ───
title Atelier - LearningHub Dashboard
cd /d "%~dp0dashboard"

REM First run: install dependencies if they're missing.
if not exist "node_modules" (
  echo.
  echo   First run - installing dependencies. This happens once...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. Is Node.js installed?  https://nodejs.org
    echo.
    pause
    exit /b 1
  )
)

REM Open the browser a moment after the dev server starts.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5173"

echo.
echo   Starting Atelier at http://localhost:5173
echo   Leave this window open. Press Ctrl+C here to stop.
echo.
call npm run dev

pause
