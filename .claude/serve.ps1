param([int]$Port = 0, [string]$Root = "$PSScriptRoot\..")

# Port precedence: -Port flag, then $env:PORT (how the preview harness assigns a
# free port so two sessions can serve the repo at once), then the old default.
if (-not $Port) {
  if ($env:PORT) { $Port = [int]$env:PORT } else { $Port = 8765 }
}

$Root = (Resolve-Path $Root).Path
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $Root on $prefix"

$mime = @{
  '.html'='text/html; charset=utf-8'
  '.css'='text/css; charset=utf-8'
  '.js'='application/javascript; charset=utf-8'
  '.json'='application/json; charset=utf-8'
  '.png'='image/png'
  '.jpg'='image/jpeg'
  '.svg'='image/svg+xml'
  '.ico'='image/x-icon'
  '.md'='text/markdown; charset=utf-8'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $rel = $ctx.Request.Url.LocalPath.TrimStart('/')
      if (-not $rel) { $rel = 'index.html' }
      $path = Join-Path $Root $rel
      Write-Host "$($ctx.Request.HttpMethod) $rel -> $path"
      if (Test-Path -LiteralPath $path -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($path)
        $ctx.Response.ContentType = $ct
        $ctx.Response.Headers.Add('Cache-Control','no-store')
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
        $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try { $ctx.Response.StatusCode = 500 } catch {}
      Write-Host "Error: $_"
    } finally {
      $ctx.Response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
