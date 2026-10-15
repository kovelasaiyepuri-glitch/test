@echo off
title Supabase Database Migration
set "PATH=C:\Program Files\nodejs;%PATH%"
echo ========================================================
echo  Running Supabase Migration for Gemini Chatbot
echo ========================================================
node backend/scripts/migrate.js
pause
