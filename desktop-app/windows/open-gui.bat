@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

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
        wscript.exe "%DIALOG_VBS%" "StudioCore Drive — Thiếu Node.js" "Không tìm thấy Node.js trên máy tính của bạn!\n\nVui lòng tải và cài đặt Node.js từ https://nodejs.org." "warning"
    )
    start https://nodejs.org
    exit /b 1
)

%NODE_EXE% "%CLI_PATH%" gui
