@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.19 or newer is required.
  pause
  exit /b 1
)
if not exist node_modules call npm.cmd install
echo.
echo LUMEN - http://127.0.0.1:5173
echo Keep this window open while playing.
call npm.cmd run dev -- --port 5173
pause
