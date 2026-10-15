# PowerShell Script to run Supabase Database Migration
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:Path = "C:\Program Files\nodejs;" + $env:Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Running Supabase Database Migration" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan

node backend/scripts/migrate.js
