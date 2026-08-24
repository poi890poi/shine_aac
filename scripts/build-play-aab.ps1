param(
    [string]$SdkDir,
    [string]$KeystoreProperties = "E:\Android\keys\saytome-upload.properties",
    [switch]$SkipBuild,
    [string]$ArtifactRoot = ".artifacts\releases"
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
    return $Path.Replace("\", "\\").Replace(":", "\:")
}

function Read-VersionProperties {
    $path = Join-Path $repoRoot "version.properties"
    if (-not (Test-Path -LiteralPath $path)) {
        throw "version.properties not found."
    }

    $properties = @{}
    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }
        $key, $value = $line.Split("=", 2)
        $properties[$key.Trim()] = $value.Trim()
    }
    return $properties
}

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
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

if (-not $SkipBuild) {
    Write-Step "Building signed Google Play AAB"
    & .\gradlew.bat bundleRelease "-PshineAacKeystoreProperties=$($resolvedKeystoreProperties.Path)"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$aabPath = Join-Path $repoRoot "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path -LiteralPath $aabPath)) {
    throw "Release AAB was not found at $aabPath"
}
$version = Read-VersionProperties
$versionName = $version["versionName"]
$versionCode = $version["versionCode"]
if (-not $versionName -or -not $versionCode) {
    throw "version.properties must define versionName and versionCode."
}

$releaseRoot = if ([System.IO.Path]::IsPathRooted($ArtifactRoot)) {
    $ArtifactRoot
} else {
    Join-Path $repoRoot $ArtifactRoot
}
$releaseDir = Join-Path $releaseRoot "v$versionName"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$artifactName = "shine-aac-v$versionName-code$versionCode-release.aab"
$artifactPath = Join-Path $releaseDir $artifactName
Copy-Item -LiteralPath $aabPath -Destination $artifactPath -Force
$hash = Get-Sha256Hex -Path $artifactPath
$hashLine = "$hash  $artifactName"
Set-Content -LiteralPath (Join-Path $releaseDir "PLAY_AAB_SHA256SUMS.txt") -Value $hashLine -Encoding ASCII

$releaseNotesSource = Join-Path $repoRoot "docs\releases\v$versionName.md"
if (Test-Path -LiteralPath $releaseNotesSource) {
    Copy-Item -LiteralPath $releaseNotesSource -Destination (Join-Path $releaseDir "RELEASE_NOTES.md") -Force
}

Write-Step "Signed Google Play artifact created"
Write-Host $artifactPath
Write-Host "SHA-256: $hash"
