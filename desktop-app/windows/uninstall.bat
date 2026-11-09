@echo off
chcp 65001 >nul
echo ===================================================================
echo     StudioCore Drive — Gỡ bỏ Menu Chuột Phải Windows
echo ===================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0unregister.ps1"

echo.
echo ===================================================================
echo   ĐÃ GỠ BỎ THÀNH CÔNG!
echo ===================================================================
pause
