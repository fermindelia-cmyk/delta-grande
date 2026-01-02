@echo off
setlocal enabledelayedexpansion
color 0A

rem Configure paths relative to the USB root
set ROOT=%~dp0
set PORT=4173
set APP_DIR=%ROOT%app
set SERVER_JS=%ROOT%usb-server.cjs
set NODE_EXE=%ROOT%portable\node\node.exe
set CHROME_EXE_PRIMARY=%ROOT%portable\chromium\GoogleChromePortable\GoogleChromePortable.exe
set CHROME_EXE_FALLBACK=%ROOT%portable\chromium\chrome.exe
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

rem Start server in a new minimized window
echo Launching server...
start "Delta Grande Server" /MIN "%NODE_EXE%" "%SERVER_JS%" --dir "%APP_DIR%" --port %PORT%

rem Wait for server to be ready
call :wait_for_server
call :matrix_intro

set CHROME_EXE=
if exist "%CHROME_EXE_PRIMARY%" set CHROME_EXE=%CHROME_EXE_PRIMARY%
if not defined CHROME_EXE if exist "%CHROME_EXE_FALLBACK%" set CHROME_EXE=%CHROME_EXE_FALLBACK%

if defined CHROME_EXE (
  echo Invocando Chromium portatil: %CHROME_EXE%
  start "" "%CHROME_EXE%" --user-data-dir="%PROFILE_DIR%" --app=http://localhost:%PORT%
) else (
  echo No se encontro Chromium en:
  echo   %CHROME_EXE_PRIMARY%
  echo   %CHROME_EXE_FALLBACK%
  echo El delta se abrira en tu navegador por defecto.
  start "" http://localhost:%PORT%
)

echo.
echo ========================================================
echo  EL SERVIDOR ESTA CORRIENDO EN OTRA VENTANA (MINIMIZADA)
echo  CIERRA ESA VENTANA PARA DETENER EL SERVIDOR
echo ========================================================
echo.
pause
exit /b 0

:wait_for_server
set MAX_ATTEMPTS=10
set STATUS=
set /a ATTEMPT=0
echo Esperando portal en http://localhost:%PORT%
:poll_loop
set /a ATTEMPT+=1
for /f "usebackq tokens=1" %%s in (`powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:%PORT%' -Method Head -TimeoutSec 2).StatusCode } catch { if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { '' } }"`) do set STATUS=%%s
if "%STATUS%"=="200" goto :eof
echo   intento %ATTEMPT%/%MAX_ATTEMPTS% ...
if %ATTEMPT% GEQ %MAX_ATTEMPTS% (
  echo No se pudo abrir el portal en http://localhost:%PORT%.
  echo Revisa que el puerto no este ocupado o que la carpeta app exista.
  pause
  exit /b 1
)
ping 127.0.0.1 -n 2 >nul
goto poll_loop

:matrix_intro
set FRAME_DELAY=1
for %%F in (frame1 frame2 frame3 frame4) do (
  call :%%F
  ping 127.0.0.1 -n %FRAME_DELAY% >nul
)
cls
echo 010101 PORTAL DELTA LISTO 010101
echo.
echo        /\\\\\\\\\ MATRIX \\\\\\\\
echo       /  D+  4173:ABIERTO  \
echo      /   SERVER: RUNNING      \
echo      \   ESPERA \ ENTRA \ CIERRA /
echo       \//////////////////////////
echo.
echo 011001 BAJA CROMA, SUBE PULSO 100110
goto :eof

:frame1
cls
echo 101001001001 AWAKE 100101010001
echo.
echo        /\\\\\\\\\\\\\\\\\\\
echo       /  D+  _PORTAL_   \\
echo      /   LATIDOS: 4173  \\
echo      \   SERVER: STARTING  /
echo       \///////////////////
echo.
echo 110010001111 SEEDING SIGNALS
goto :eof

:frame2
cls
echo 001101010010 CHANNEL OPEN 1110001
echo.
echo        /\\\\\\\\\\\\\\\\\\\
echo       /  D+  DATA FLOW   \\
echo      /   NAV: CHROMIUM   \\
echo      \   USER = KEY      /
echo       \///////////////////
echo.
echo 010101111000 PULSE: STAY FOCUSED
goto :eof

:frame3
cls
echo 11101100  DELTA MATRIX  00011110
echo.
echo        /\\\\\\\\\\\\\\\\\\\
echo       /  D+  VECTOR     \\
echo      /   /\\   /\\   /\\ \\
echo      \   \\//   \\//   \\// /
echo       \///////////////////
echo.
echo 100100101010 LOCKING TARGET: localhost:%PORT%
goto :eof

:frame4
cls
echo 000111000111 FINALIZE LINK 111000111000
echo.
echo        /\\\\\\\\\\\\\\\\\\\
echo       /  D+  PORTAL      \\
echo      /   entra y escucha \\
echo      \   cierra y duerme /
echo       \///////////////////
echo.
echo 111000111000 ready >>nul
goto :eof
