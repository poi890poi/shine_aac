param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

Write-Host "Starting SHINE AAC web app at http://127.0.0.1:$Port/apps/web/"
node .\apps\web\server.mjs --port $Port
