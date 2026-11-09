@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Target folder or file passed from Windows Explorer
set TARGET_PATH=%~1
set SHARE_TYPE=%~2
if "%SHARE_TYPE%"=="" set SHARE_TYPE=album

:: Resolve Application paths
set SCRIPT_DIR=%~dp0
set APP_DIR=%SCRIPT_DIR%..
set CLI_PATH=%APP_DIR%\cli.js
set DIALOG_VBS=%SCRIPT_DIR%dialog.vbs

if not exist "%CLI_PATH%" (
    set CLI_PATH=%USERPROFILE%\.studiocore-drive\app\cli.js
    set DIALOG_VBS=%USERPROFILE%\.studiocore-drive\app\windows\dialog.vbs
)

:: Locate node.exe
set NODE_EXE=
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set NODE_EXE=node
) else if exist "%ProgramFiles%\nodejs\node.exe" (
    set NODE_EXE="%ProgramFiles%\nodejs\node.exe"
) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set NODE_EXE="%ProgramFiles(x86)%\nodejs\node.exe"
) else if exist "%LocalAppData%\Programs\nodejs\node.exe" (
    set NODE_EXE="%LocalAppData%\Programs\nodejs\node.exe"
) else if exist "%APPDATA%\npm\node.exe" (
    set NODE_EXE="%APPDATA%\npm\node.exe"
)

if "%NODE_EXE%"=="" (
    if exist "%DIALOG_VBS%" (
        wscript.exe "%DIALOG_VBS%" "StudioCore Drive — Thiếu Node.js" "Không tìm thấy Node.js trên máy tính của bạn!\n\nStudioCore Drive cần Node.js để chạy.\nVui lòng tải và cài đặt Node.js từ https://nodejs.org." "warning"
    )
    start https://nodejs.org
    exit /b 1
)

:: Execute CLI share command
%NODE_EXE% "%CLI_PATH%" share --path "%TARGET_PATH%" --type "%SHARE_TYPE%"
