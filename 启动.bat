@echo off
chcp 65001 >nul
title 股票交易复盘系统

cd /d "%~dp0"

set MODE=%1
if "%MODE%"=="" set MODE=prod

echo ========================================
echo   股票交易复盘系统 - 启动中...
echo ========================================
echo.

if "%MODE%"=="dev" (
    echo [模式] 开发模式
    echo [1/2] 启动开发服务器...
    start "Vite" cmd /c "npm run dev"
    timeout /t 5 /nobreak >nul
    echo [2/2] 启动 Electron...
    start "" npx electron .
    echo.
    echo 已启动开发模式！
    echo - Vite 开发服务器: http://localhost:5173
    echo - Electron 窗口应该很快出现
) else (
    echo [模式] 生产模式

    REM 始终检查构建状态，确保代码无错误
    echo [1/3] 检查构建状态...
    if not exist "dist\renderer\index.html" (
        echo     发现未构建，开始构建...
    ) else (
        echo     已发现构建产物，验证是否需要重新构建...
    )

    echo [2/3] 正在构建应用...
    call npm run build 2>&1
    if errorlevel 1 (
        echo.
        echo ========================================
        echo   构建失败！请修复错误后再试
        echo ========================================
        echo.
        echo 常见问题:
        echo   - 检查代码是否有语法错误
        echo   - 检查是否有未解决的导入
        echo   - 查看上方错误信息定位问题
        echo.
        pause >nul
        exit /b 1
    )
    echo     构建成功！

    echo [3/3] 正在启动应用...
    echo.
    start "" npx electron .

    echo 已启动！窗口应该很快出现。
)

echo.
echo 使用说明:
echo   启动.bat        - 生产模式（自动检查构建）
echo   启动.bat dev    - 开发模式（热更新）
echo   关闭.bat        - 关闭应用
echo.
echo 按任意键退出此窗口...
pause >nul
