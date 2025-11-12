@echo off
setlocal enabledelayedexpansion

:: Obtener el directorio donde está el .bat
cd /d "%~dp0"

echo =====================================
echo   DELTA+ Simulador - Iniciando...
echo =====================================
echo.

:: Intentar puertos desde 5500 hasta 5510
set "PORT=5500"
set "FOUND_PORT=0"

for /L %%p in (5500,1,5510) do (
    if !FOUND_PORT! equ 0 (
        netstat -ano | find "127.0.0.1:%%p" >nul 2>&1
        if errorlevel 1 (
            set "PORT=%%p"
            set "FOUND_PORT=1"
        )
    )
)

echo [OK] Usando puerto: %PORT%
echo.
echo Iniciando servidor en http://127.0.0.1:%PORT%
echo Presiona Ctrl+C para detener el servidor
echo.

:: Ruta esperada del Python portable (Windows embeddable o similar)
set "PYTHON_DIR=%~dp0tools\python"
set "PYTHON_EXE=%PYTHON_DIR%\python.exe"

if exist "%PYTHON_EXE%" goto HAVE_PYTHON

echo [ERROR] No se encontro python.exe en:
echo         %PYTHON_EXE%
echo.
echo Revisa que hayas copiado TODOS los archivos del paquete "Windows embeddable"
echo desde python.org directamente dentro de tools\python\ (sin carpetas intermedias).
echo El contenido esperado incluye archivos como python.exe, python3xx.dll y python3xx.zip.
echo.
echo Contenido actual de tools\python\ :
dir "%PYTHON_DIR%"
echo.
pause
endlocal
goto :eof

:HAVE_PYTHON

:: Asegurar que Python encuentre su stdlib (útil para paquetes embebidos)
set "PYTHONHOME=%PYTHON_DIR%"
set "PYTHONPATH="

:: Abrir navegador después de 2 segundos con el puerto correcto
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/game/index.html#simulador"

echo =====================================
echo   Servidor Python embebido en marcha
echo   (Ctrl+C para detener)
echo =====================================
echo.
echo Lanzando: %PYTHON_EXE% -m http.server %PORT% --bind 127.0.0.1
echo.

pushd "%~dp0"
"%PYTHON_EXE%" -m http.server %PORT% --bind 127.0.0.1
set "SERVER_CODE=%errorlevel%"
popd

echo.
echo Servidor detenido. Codigo de salida: %SERVER_CODE%
echo.
pause
endlocal
