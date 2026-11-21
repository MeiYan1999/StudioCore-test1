@echo off
setlocal
where node.exe >nul 2>&1
if errorlevel 1 (
  echo StudioCore Drive can Node.js 18+. Vui long cai tu https://nodejs.org
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<18)process.exit(1)"
if errorlevel 1 (
  echo StudioCore Drive can Node.js 18+. Vui long cap nhat tai https://nodejs.org
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
set "APP=%LOCALAPPDATA%\StudioCore Drive\app"
for %%I in ("%~dp0..") do set "SOURCE=%%~fI"
if /I not "%SOURCE%"=="%APP%" (
  robocopy "%SOURCE%" "%APP%" /E /XD node_modules .git /XF *.log
  if errorlevel 8 exit /b 1
)
node "%APP%\cli.js" install-context
if errorlevel 1 exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APP%\windows\shortcuts.ps1" -AppPath "%APP%"
if errorlevel 1 exit /b 1
set "NODE_BIN="
for /f "delims=" %%N in ('where node.exe') do if not defined NODE_BIN set "NODE_BIN=%%N"
wscript.exe "%APP%\windows\hidden.vbs" "%NODE_BIN%" "%APP%\cli.js" gui
endlocal
