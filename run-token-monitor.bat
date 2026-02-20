@echo off
setlocal

title Token Monitor
powershell -ExecutionPolicy Bypass -File "%~dp0token-monitor.ps1"

pause
