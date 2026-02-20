@echo off
chcp 65001 >nul
title 关闭股票交易系统

echo ========================================
echo   正在关闭股票交易系统...
echo ========================================
echo.

:: 关闭 Electron 进程
taskkill /F /IM electron.exe >nul 2>&1

:: 关闭 Node 进程（开发模式）
taskkill /F /IM node.exe >nul 2>&1

echo 已关闭！
echo.
pause
