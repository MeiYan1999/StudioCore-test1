@echo off
chcp 65001 >nul
echo ===================================================================
echo     StudioCore Drive — Cài đặt Menu Chuột Phải Windows Explorer
echo ===================================================================
echo.

:: 1. Copy app to %USERPROFILE%\.studiocore-drive\app
set APP_DIR=%USERPROFILE%\.studiocore-drive\app
echo [1/4] Đang sao chép ứng dụng vào: %APP_DIR%
mkdir "%APP_DIR%" 2>nul
xcopy /E /Y /I "%~dp0..\*" "%APP_DIR%\" >nul

:: 2. Check Node.js
echo [2/4] Đang kiểm tra Node.js...
set NODE_OK=0
where node >nul 2>&1 && set NODE_OK=1
if %NODE_OK% EQU 0 if exist "%ProgramFiles%\nodejs\node.exe" set NODE_OK=1
if %NODE_OK% EQU 0 if exist "%LocalAppData%\Programs\nodejs\node.exe" set NODE_OK=1

if %NODE_OK% EQU 0 (
    echo [Cảnh báo] Chưa tìm thấy Node.js trên máy!
    echo Vui lòng cài đặt Node.js từ https://nodejs.org để StudioCore Drive hoạt động.
) else (
    echo [OK] Đã phát hiện Node.js trên máy tính.
)

:: 3. Register Context Menu via PowerShell (Unicode native & exact paths)
echo [3/4] Đang đăng ký menu chuột phải vào Windows Explorer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%\windows\register.ps1" -AppDir "%APP_DIR%"
if %ERRORLEVEL% NEQ 0 (
    echo [Dự phòng] Đang import qua Registry Editor...
    reg import "%APP_DIR%\windows\register-context-menu.reg"
)

:: 4. Thông báo hoàn tất
echo [4/4] Hoàn tất thiết lập!
echo.
echo ===================================================================
echo   CÀI ĐẶT THÀNH CÔNG!
echo.
echo   Cách dùng:
echo   1. Chuột phải vào bất kỳ thư mục ảnh hoặc video
echo   2. Chọn "StudioCore Drive > Tạo link Album (chọn ảnh duyệt)"
echo   3. Hệ thống sẽ tự tạo link, mở web xem thử và copy link vào Clipboard!
echo ===================================================================
echo.

:: Hiện dialog xác nhận
if exist "%APP_DIR%\windows\dialog.vbs" (
    wscript.exe "%APP_DIR%\windows\dialog.vbs" "StudioCore Drive — Cài đặt thành công" "Cài đặt StudioCore Drive thành công!\n\nBây giờ bạn có thể chuột phải vào bất kỳ thư mục ảnh hoặc video trong máy tính để tạo link gửi khách trong 3 giây." "info"
)

pause
