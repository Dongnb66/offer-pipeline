@echo off
title Offer Pipeline Server
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8321"
  node "server.js"
) else (
  start "" "http://127.0.0.1:8321"
  "C:\Program Files\nodejs\node.exe" "server.js"
)
pause
