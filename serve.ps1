$ErrorActionPreference = 'Stop'
$rootFolder = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:4173/')
try {
  $listener.Start()
  Write-Host ''
  Write-Host 'Тихий Берег запущен: http://localhost:4173' -ForegroundColor Green
  Write-Host 'Чтобы остановить сервер, закройте это окно.' -ForegroundColor DarkGray
  Start-Process 'http://localhost:4173/'
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
      $targetPath = [System.IO.Path]::GetFullPath((Join-Path $rootFolder $relativePath))
      $allowedPrefix = $rootFolder.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
      if (-not $targetPath.StartsWith($allowedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $context.Response.StatusCode = 403
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
      } elseif (Test-Path -LiteralPath $targetPath -PathType Leaf) {
        $extension = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
        $contentType = switch ($extension) {
          '.html' { 'text/html; charset=utf-8' }
          '.js' { 'text/javascript; charset=utf-8' }
          '.css' { 'text/css; charset=utf-8' }
          '.json' { 'application/json; charset=utf-8' }
          default { 'application/octet-stream' }
        }
        $context.Response.StatusCode = 200
        $context.Response.ContentType = $contentType
        $bytes = [System.IO.File]::ReadAllBytes($targetPath)
      } else {
        $context.Response.StatusCode = 404
        $context.Response.ContentType = 'text/plain; charset=utf-8'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      }
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      try { $context.Response.StatusCode = 500 } catch {}
    } finally {
      $context.Response.Close()
    }
  }
} catch {
  Write-Host ('Не удалось запустить сервер: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Закройте другое окно игры, если порт уже занят.'
  Read-Host 'Нажмите Enter для выхода'
} finally {
  $listener.Close()
}
