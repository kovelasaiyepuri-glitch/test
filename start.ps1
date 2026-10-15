# PowerShell Launcher for Gemini Nexus Fullstack Chatbot
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:Path = "C:\Program Files\nodejs;" + $env:Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting Gemini Nexus Fullstack Chatbot" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan

# Start server
Start-Process "http://localhost:5000"
node backend/server.js
