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
    Write-Step "Building signed release APK and Play AAB"
    & .\gradlew.bat assembleRelease bundleRelease "-PshineAacKeystoreProperties=$($resolvedKeystoreProperties.Path)"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$aabPath = Join-Path $repoRoot "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path -LiteralPath $aabPath)) {
    throw "Release AAB was not found at $aabPath"
}
$apkPath = Join-Path $repoRoot "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "Release APK was not found at $apkPath"
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
$apkArtifactName = "shine-aac-v$versionName-code$versionCode-release.apk"
$apkArtifactPath = Join-Path $releaseDir $apkArtifactName
Copy-Item -LiteralPath $apkPath -Destination $apkArtifactPath -Force

$hash = Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256
$hashLine = "$($hash.Hash.ToLowerInvariant())  $artifactName"
Set-Content -LiteralPath (Join-Path $releaseDir "PLAY_AAB_SHA256SUMS.txt") -Value $hashLine -Encoding ASCII
$apkHash = Get-FileHash -LiteralPath $apkArtifactPath -Algorithm SHA256
$apkHashLine = "$($apkHash.Hash.ToLowerInvariant())  $apkArtifactName"
Set-Content -LiteralPath (Join-Path $releaseDir "RELEASE_APK_SHA256SUMS.txt") -Value $apkHashLine -Encoding ASCII

$releaseNotesSource = Join-Path $repoRoot "docs\releases\v$versionName.md"
if (Test-Path -LiteralPath $releaseNotesSource) {
    Copy-Item -LiteralPath $releaseNotesSource -Destination (Join-Path $releaseDir "RELEASE_NOTES.md") -Force
}

Write-Step "Signed release artifacts created"
Write-Host $apkArtifactPath
Write-Host "SHA-256: $($apkHash.Hash.ToLowerInvariant())"
Write-Host $artifactPath
Write-Host "SHA-256: $($hash.Hash.ToLowerInvariant())"
