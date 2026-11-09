@echo off
chcp 65001 >nul
echo ===================================================================
echo     StudioCore Drive — Cài đặt Menu Chuột Phải Windows Explorer
echo ===================================================================
echo.

:: Sao chép mã nguồn vào thư mục AppData
set APP_DIR=%USERPROFILE%\.studiocore-drive\app
echo [1/3] Đang sao chép ứng dụng vào: %APP_DIR%
mkdir "%APP_DIR%" 2>nul
xcopy /E /Y /I "%~dp0..\*" "%APP_DIR%\" >nul

:: Đăng ký Registry
echo [2/3] Đang đăng ký menu chuột phải vào Windows Registry...
reg import "%~dp0register-context-menu.reg"

echo [3/3] Hoàn tất!
echo.
echo ===================================================================
echo   CÀI ĐẶT THÀNH CÔNG!
echo   Bây giờ bạn có thể chuột phải vào bất kỳ thư mục ảnh hoặc video
echo   để tạo link gửi khách trong 3 giây.
echo ===================================================================
pause
