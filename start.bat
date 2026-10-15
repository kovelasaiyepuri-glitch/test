@echo off
title Gemini Nexus Chatbot - Fullstack Runner
echo ========================================================
echo  Starting Gemini Nexus Fullstack Chatbot
echo ========================================================

REM Add Node.js to PATH if not already present
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Checking Node.js installation...
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Starting backend server on http://localhost:5000...
echo Opening browser in 3 seconds...

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5000"

node backend/server.js
pause
