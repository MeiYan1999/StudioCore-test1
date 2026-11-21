@echo off
setlocal
set "APP=%LOCALAPPDATA%\StudioCore Drive\app"
node "%APP%\cli.js" uninstall
if errorlevel 1 (
  echo Khong go duoc tich hop. Hay cai Node.js va thu lai.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APP%\windows\shortcuts.ps1" -AppPath "%APP%" -Remove
echo Da go menu, shortcut va tu khoi dong. Du lieu ca nhan duoc giu lai.
echo Ban co the xoa thu muc: %APP%
pause
endlocal
