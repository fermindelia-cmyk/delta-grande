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

:: Crear script de PowerShell temporal para el servidor HTTP
set "PS_SCRIPT=%TEMP%\delta_server_%PORT%.ps1"

> "%PS_SCRIPT%" echo $http = [System.Net.HttpListener]::new()
>> "%PS_SCRIPT%" echo $http.Prefixes.Add("http://127.0.0.1:%PORT%/")
>> "%PS_SCRIPT%" echo $http.Start()
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo if ($http.IsListening) {
>> "%PS_SCRIPT%" echo     Write-Host "Servidor HTTP iniciado en http://127.0.0.1:%PORT%" -ForegroundColor Green
>> "%PS_SCRIPT%" echo     Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo while ($http.IsListening) {
>> "%PS_SCRIPT%" echo     try {
>> "%PS_SCRIPT%" echo         $context = $http.GetContext()
>> "%PS_SCRIPT%" echo         $request = $context.Request
>> "%PS_SCRIPT%" echo         $response = $context.Response
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo         $path = $request.Url.LocalPath
>> "%PS_SCRIPT%" echo         if ($path -eq "/") { $path = "/index.html" }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo         $filePath = Join-Path $PWD ($path.TrimStart('/') -replace '/', '\')
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo         if (Test-Path $filePath -PathType Leaf) {
>> "%PS_SCRIPT%" echo             $content = [System.IO.File]::ReadAllBytes($filePath)
>> "%PS_SCRIPT%" echo             $response.ContentLength64 = $content.Length
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo             $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
>> "%PS_SCRIPT%" echo             switch ($ext) {
>> "%PS_SCRIPT%" echo                 ".html" { $response.ContentType = "text/html; charset=utf-8" }
>> "%PS_SCRIPT%" echo                 ".js"   { $response.ContentType = "text/javascript; charset=utf-8" }
>> "%PS_SCRIPT%" echo                 ".json" { $response.ContentType = "application/json; charset=utf-8" }
>> "%PS_SCRIPT%" echo                 ".css"  { $response.ContentType = "text/css; charset=utf-8" }
>> "%PS_SCRIPT%" echo                 ".png"  { $response.ContentType = "image/png" }
>> "%PS_SCRIPT%" echo                 ".jpg"  { $response.ContentType = "image/jpeg" }
>> "%PS_SCRIPT%" echo                 ".jpeg" { $response.ContentType = "image/jpeg" }
>> "%PS_SCRIPT%" echo                 ".gif"  { $response.ContentType = "image/gif" }
>> "%PS_SCRIPT%" echo                 ".svg"  { $response.ContentType = "image/svg+xml" }
>> "%PS_SCRIPT%" echo                 ".webp" { $response.ContentType = "image/webp" }
>> "%PS_SCRIPT%" echo                 ".mp4"  { $response.ContentType = "video/mp4" }
>> "%PS_SCRIPT%" echo                 ".webm" { $response.ContentType = "video/webm" }
>> "%PS_SCRIPT%" echo                 ".wav"  { $response.ContentType = "audio/wav" }
>> "%PS_SCRIPT%" echo                 ".mp3"  { $response.ContentType = "audio/mpeg" }
>> "%PS_SCRIPT%" echo                 ".ogg"  { $response.ContentType = "audio/ogg" }
>> "%PS_SCRIPT%" echo                 ".woff" { $response.ContentType = "font/woff" }
>> "%PS_SCRIPT%" echo                 ".woff2" { $response.ContentType = "font/woff2" }
>> "%PS_SCRIPT%" echo                 ".ttf"  { $response.ContentType = "font/ttf" }
>> "%PS_SCRIPT%" echo                 default { $response.ContentType = "application/octet-stream" }
>> "%PS_SCRIPT%" echo             }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo             $response.StatusCode = 200
>> "%PS_SCRIPT%" echo             $response.OutputStream.Write($content, 0, $content.Length)
>> "%PS_SCRIPT%" echo         } else {
>> "%PS_SCRIPT%" echo             $response.StatusCode = 404
>> "%PS_SCRIPT%" echo             $responseString = "404 - Archivo no encontrado: $path"
>> "%PS_SCRIPT%" echo             $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseString)
>> "%PS_SCRIPT%" echo             $response.ContentLength64 = $buffer.Length
>> "%PS_SCRIPT%" echo             $response.OutputStream.Write($buffer, 0, $buffer.Length)
>> "%PS_SCRIPT%" echo         }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo         $response.OutputStream.Close()
>> "%PS_SCRIPT%" echo     } catch {
>> "%PS_SCRIPT%" echo         Write-Host "Error: $_" -ForegroundColor Red
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo $http.Stop()

:: Abrir navegador después de 2 segundos con el puerto correcto
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/game/index.html#simulador"

:: Iniciar servidor PowerShell (sin mostrar errores detallados)
powershell -ExecutionPolicy Bypass -NoLogo -File "%PS_SCRIPT%" 2>nul

:: Capturar error
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El servidor PowerShell falló con código: %errorlevel%
    echo.
    pause
)

:: Limpiar script temporal
del "%PS_SCRIPT%" 2>nul

echo.
echo Servidor detenido.
pause
endlocal
