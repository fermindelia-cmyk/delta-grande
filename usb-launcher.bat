@echo off
setlocal enabledelayedexpansion

rem Configure paths relative to the USB root
set ROOT=%~dp0
set PORT=4173
set APP_DIR=%ROOT%app
set SERVER_JS=%ROOT%usb-server.js
set NODE_EXE=%ROOT%portable\node\node.exe
set CHROME_EXE=%ROOT%portable\chromium\GoogleChromePortable\GoogleChromePortable.exe
set PROFILE_DIR=%ROOT%chromium-profile

if not exist "%APP_DIR%" (
  echo Missing app folder: %APP_DIR%
  echo Copy your built dist/ into "app" on the USB.
  pause
  exit /b 1
)

if not exist "%NODE_EXE%" (
  echo Missing Node runtime at %NODE_EXE%
  echo Place the portable Node ZIP contents in portable\node\
  pause
  exit /b 1
)

if not exist "%SERVER_JS%" (
  echo Missing server script: %SERVER_JS%
  pause
  exit /b 1
)

rem Start server in the background and capture its PID (with safe quoting for spaces)
for /f "usebackq tokens=1" %%p in (`powershell -NoProfile -Command "$p = Start-Process -FilePath \"\"\"%NODE_EXE%\"\"\" -ArgumentList @(\"\"\"%SERVER_JS%\"\"\", '--dir', \"\"\"%APP_DIR%\"\"\", '--port', '%PORT%') -PassThru; $p.Id"`) do set SERVERPID=%%p

if "%SERVERPID%"=="" (
  echo Failed to start server. Check paths and try again.
  pause
  exit /b 1
)

echo Server running on http://localhost:%PORT% (PID %SERVERPID%)

rem Small delay to let the server start
ping 127.0.0.1 -n 2 >nul

if exist "%CHROME_EXE%" (
  start "" "%CHROME_EXE%" --user-data-dir="%PROFILE_DIR%" --app=http://localhost:%PORT%
) else (
  echo Portable Chromium not found at %CHROME_EXE%
  echo Opening in default browser instead.
  start "" http://localhost:%PORT%
)

echo Close the browser to stop the server.
:waitloop
ping 127.0.0.1 -n 3 >nul
tasklist /FI "PID eq %SERVERPID%" | findstr %SERVERPID% >nul
if %ERRORLEVEL%==0 goto waitloop

echo Server stopped.
endlocal
