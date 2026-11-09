@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Đang khởi chạy giao diện StudioCore Drive...
node cli.js gui
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Lỗi] Không tìm thấy Node.js trên máy tính của bạn.
    echo Vui lòng cài đặt Node.js từ https://nodejs.org để chạy ứng dụng.
    pause
)
