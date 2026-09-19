# =========================================================
# Servidor estático mínimo para Windows — no requiere instalar nada.
# Uso (desde la carpeta web\):
#   powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Detener: Ctrl + C
# =========================================================
param([int]$Port = 8080)

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "No se pudo abrir el puerto $Port. Prueba con otro, por ejemplo:" -ForegroundColor Red
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8090" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  Centro de Control - Market" -ForegroundColor Cyan
Write-Host "  Sirviendo: $root"
Write-Host "  Abre: http://localhost:$Port/" -ForegroundColor Green
Write-Host "  (Ctrl + C para detener)"
Write-Host ""

Start-Process "http://localhost:$Port/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".mjs"  = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".woff2" = "font/woff2"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $urlPath = $context.Request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        $relative = $urlPath.TrimStart("/") -replace "/", "\"
        $file = Join-Path $root $relative

        # Evita salir de la carpeta servida
        $fullRoot = [System.IO.Path]::GetFullPath($root)
        $fullFile = [System.IO.Path]::GetFullPath($file)

        if ($fullFile.StartsWith($fullRoot) -and (Test-Path $fullFile -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($fullFile).ToLower()
            $contentType = $mime[$ext]
            if (-not $contentType) { $contentType = "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($fullFile)
            $context.Response.ContentType = $contentType
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200  $urlPath" -ForegroundColor DarkGray
        } else {
            $context.Response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - no encontrado: $urlPath")
            $context.Response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404  $urlPath" -ForegroundColor DarkYellow
        }
        $context.Response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`nServidor detenido." -ForegroundColor Cyan
}
