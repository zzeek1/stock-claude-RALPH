@echo off
setlocal

set "GIT_BASH=C:\Program Files\Git\bin\bash.exe"
set "RALPH_HOME=%USERPROFILE%\.ralph"
set "PROJECT_DIR=D:\code\stock-claude-RALPH"

:: 取消设置 CLAUDECODE 环境变量，避免嵌套调用
set CLAUDECODE=

title Ralph Loop - 运行时请查看日志目录
cd /d %PROJECT_DIR%
"%GIT_BASH%" --login -i "%RALPH_HOME%\ralph_loop.sh" --live %*

pause
