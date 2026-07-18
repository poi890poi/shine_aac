param(
    [string]$SdkDir,
    [switch]$SetupSdk,
    [switch]$SkipBuild,
    [string]$ArtifactRoot = ".artifacts\releases"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

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

$version = Read-VersionProperties
$versionName = $version["versionName"]
$versionCode = $version["versionCode"]

if (-not $versionName -or -not $versionCode) {
    throw "version.properties must define versionName and versionCode."
}

& (Join-Path $PSScriptRoot "verify-android-data-policy.ps1")

if (-not $SkipBuild) {
    $buildArgs = @()
    if ($SdkDir) {
        $buildArgs += "-SdkDir"
        $buildArgs += $SdkDir
    }
    if ($SetupSdk) {
        $buildArgs += "-SetupSdk"
    }
    & .\build-test.bat @buildArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$apkPath = Join-Path $repoRoot "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "Debug APK not found at $apkPath"
}

$releaseRoot = if ([System.IO.Path]::IsPathRooted($ArtifactRoot)) {
    $ArtifactRoot
} else {
    Join-Path $repoRoot $ArtifactRoot
}
$releaseDir = Join-Path $releaseRoot "v$versionName"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$artifactName = "shine-aac-v$versionName-code$versionCode-debug.apk"
$artifactPath = Join-Path $releaseDir $artifactName
Copy-Item -LiteralPath $apkPath -Destination $artifactPath -Force

$hash = Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256
$hashLine = "$($hash.Hash.ToLowerInvariant())  $artifactName"
Set-Content -LiteralPath (Join-Path $releaseDir "SHA256SUMS.txt") -Value $hashLine -Encoding ASCII

$notesPath = Join-Path $releaseDir "RELEASE_NOTES.md"
$releaseNotesSource = Join-Path $repoRoot "docs\releases\v$versionName.md"
if (Test-Path -LiteralPath $releaseNotesSource) {
    Copy-Item -LiteralPath $releaseNotesSource -Destination $notesPath -Force
} elseif (-not (Test-Path -LiteralPath $notesPath)) {
    Set-Content -LiteralPath $notesPath -Encoding UTF8 -Value @"
# SHINE AAC v$versionName

Android version code: $versionCode

## Build

- Debug APK: ``$artifactName``
- SHA-256: ``$($hash.Hash.ToLowerInvariant())``

## Verification

- ``.\build-test.bat``

## Notes

- Debug APK for user testing, not Play Store distribution.
"@
}

Write-Host "Release artifact:"
Write-Host $artifactPath
Write-Host "SHA-256:"
Write-Host $hash.Hash.ToLowerInvariant()
