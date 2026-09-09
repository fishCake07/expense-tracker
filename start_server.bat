@echo off
title Expense Tracker Server
echo ===================================================
echo Starting Expense Tracker Production Backend Server
echo ===================================================
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python server\server.py
    goto end
)
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    py server\server.py
    goto end
)
echo Python was not found in PATH!
echo Please install Python 3.8+ from python.org and check "Add Python to PATH".
echo.
pause
:end
