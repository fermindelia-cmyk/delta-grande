@echo off
setlocal enabledelayedexpansion

:: Verificar si tenemos permisos de administrador (necesarios para compartir en la red)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo =====================================
    echo   Se requieren permisos de administrador
    echo =====================================
    echo.
    echo Aparecera una ventana solicitando confirmacion. Aceptala para continuar.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    timeout /t 3 >nul
    exit /b
)

:: Obtener el directorio donde está el .bat
cd /d "%~dp0"

echo =====================================
echo   DELTA+ Rio - Iniciando...
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

:: Detectar IP local para compartir en la red
set "LAN_IP="
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^169\\.254' -and $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceOperationalStatus -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do (
    if not "%%i"=="" set "LAN_IP=%%i"
)

if not defined LAN_IP set "LAN_IP=127.0.0.1"

echo Iniciando servidor en:
echo   - Local:    http://127.0.0.1:%PORT%
if /I not "%LAN_IP%"=="127.0.0.1" (
    echo   - Red:      http://%LAN_IP%:%PORT%
    echo.
    echo Comparte la URL de red con otros dispositivos conectados a la misma red.
)
echo Presiona Ctrl+C para detener el servidor
echo.

:: Crear script de PowerShell temporal para el servidor HTTP
set "PS_SCRIPT=%TEMP%\delta_server_%PORT%.ps1"

> "%PS_SCRIPT%" echo $runningAsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
>> "%PS_SCRIPT%" echo $http = [System.Net.HttpListener]::new()
>> "%PS_SCRIPT%" echo $prefixes = @("http://127.0.0.1:%PORT%/")
>> "%PS_SCRIPT%" echo $lanIp = "%LAN_IP%"
>> "%PS_SCRIPT%" echo if ($lanIp -and $lanIp -ne "127.0.0.1") { $prefixes += "http://$lanIp:%PORT%/" }
>> "%PS_SCRIPT%" echo $prefixes += "http://+:%PORT%/"
>> "%PS_SCRIPT%" echo foreach ($prefix in $prefixes) {
>> "%PS_SCRIPT%" echo     try {
>> "%PS_SCRIPT%" echo         $http.Prefixes.Add($prefix)
>> "%PS_SCRIPT%" echo     } catch {
>> "%PS_SCRIPT%" echo         Write-Host "Aviso: no se pudo registrar $prefix (`$($_.Exception.Message))" -ForegroundColor Yellow
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo if ($runningAsAdmin) {
>> "%PS_SCRIPT%" echo     try {
>> "%PS_SCRIPT%" echo         $ruleName = "Delta+ Rio (%PORT%)"
>> "%PS_SCRIPT%" echo         if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
>> "%PS_SCRIPT%" echo             New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Profile Private -Action Allow -Protocol TCP -LocalPort %PORT% | Out-Null
>> "%PS_SCRIPT%" echo             Write-Host "Regla de firewall creada: $ruleName" -ForegroundColor Green
>> "%PS_SCRIPT%" echo         }
>> "%PS_SCRIPT%" echo     } catch {
>> "%PS_SCRIPT%" echo         Write-Host "Aviso: no se pudo crear la regla de firewall (`$($_.Exception.Message))" -ForegroundColor Yellow
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo } else {
>> "%PS_SCRIPT%" echo     Write-Host "Si otros dispositivos no pueden conectarse, ejecuta este script como administrador una vez para abrir el puerto en el firewall." -ForegroundColor Yellow
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo try {
>> "%PS_SCRIPT%" echo     $http.Start()
>> "%PS_SCRIPT%" echo } catch {
>> "%PS_SCRIPT%" echo     if ($_.Exception -is [System.Net.HttpListenerException] -and $_.Exception.NativeErrorCode -eq 5) {
>> "%PS_SCRIPT%" echo         Write-Host "Acceso denegado al iniciar el servidor en puertos de red." -ForegroundColor Red
>> "%PS_SCRIPT%" echo         Write-Host "Ejecuta el archivo como administrador o reserva el prefijo con:" -ForegroundColor Yellow
>> "%PS_SCRIPT%" echo         Write-Host "  netsh http add urlacl url=http://+:%PORT%/ user=Todos" -ForegroundColor Cyan
>> "%PS_SCRIPT%" echo         Write-Host "  New-NetFirewallRule -DisplayName 'Delta+ Rio (%PORT%)' -Direction Inbound -Profile Private -Protocol TCP -LocalPort %PORT% -Action Allow" -ForegroundColor Cyan
>> "%PS_SCRIPT%" echo         exit 1
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo     throw
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo.
>> "%PS_SCRIPT%" echo if ($http.IsListening) {
>> "%PS_SCRIPT%" echo     Write-Host "Servidor HTTP iniciado en http://127.0.0.1:%PORT%" -ForegroundColor Green
>> "%PS_SCRIPT%" echo     if ($lanIp -and $lanIp -ne "127.0.0.1") { Write-Host "Disponible en la red local: http://$lanIp:%PORT%" -ForegroundColor Green }
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
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/game/index.html#rio"

:: Iniciar servidor PowerShell
powershell -ExecutionPolicy Bypass -NoLogo -File "%PS_SCRIPT%"

:: Capturar error
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El servidor PowerShell falló con código: %errorlevel%
    echo.
    echo Para depurar, revisa el archivo temporal: %PS_SCRIPT%
    pause
)

:: Limpiar script temporal
del "%PS_SCRIPT%" 2>nul

echo.
echo Servidor detenido.
pause
endlocal
