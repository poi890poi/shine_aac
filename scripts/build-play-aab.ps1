param(
    [string]$SdkDir,
    [string]$KeystoreProperties = "E:\Android\keys\saytome-upload.properties"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Convert-ToLocalPropertiesPath {
    param([string]$Path)
    return $Path.Replace("\", "\\")
}

if (-not (Test-Path -LiteralPath $KeystoreProperties)) {
    throw "Keystore properties file was not found: $KeystoreProperties"
}

if ($SdkDir) {
    $resolvedSdkDir = Resolve-Path -LiteralPath $SdkDir
    Set-Content -LiteralPath (Join-Path $repoRoot "local.properties") `
        -Value "sdk.dir=$(Convert-ToLocalPropertiesPath -Path $resolvedSdkDir.Path)" `
        -Encoding ASCII
}

$resolvedKeystoreProperties = Resolve-Path -LiteralPath $KeystoreProperties

& (Join-Path $PSScriptRoot "verify-android-data-policy.ps1")

Write-Step "Building signed Play release AAB"
& .\gradlew.bat bundleRelease "-PshineAacKeystoreProperties=$($resolvedKeystoreProperties.Path)"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$aabPath = Join-Path $repoRoot "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path -LiteralPath $aabPath)) {
    throw "Release AAB was not found at $aabPath"
}

$hash = Get-FileHash -LiteralPath $aabPath -Algorithm SHA256

Write-Step "Signed Play AAB created"
Write-Host $aabPath
Write-Host "SHA-256: $($hash.Hash.ToLowerInvariant())"
