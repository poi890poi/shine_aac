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

function Find-ApkSigner {
    param([string]$RequestedSdkDir)

    $sdkCandidates = @()
    if ($RequestedSdkDir) { $sdkCandidates += $RequestedSdkDir }
    if ($env:SHINE_AAC_SDK_ROOT) { $sdkCandidates += $env:SHINE_AAC_SDK_ROOT }
    if ($env:ANDROID_SDK_ROOT) { $sdkCandidates += $env:ANDROID_SDK_ROOT }
    if ($env:ANDROID_HOME) { $sdkCandidates += $env:ANDROID_HOME }

    foreach ($sdkCandidate in $sdkCandidates) {
        if (-not (Test-Path -LiteralPath $sdkCandidate)) { continue }
        $buildTools = Join-Path $sdkCandidate "build-tools"
        if (-not (Test-Path -LiteralPath $buildTools)) { continue }
        $signer = Get-ChildItem -LiteralPath $buildTools -Directory |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "apksigner.bat" } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
        if ($signer) { return $signer }
    }
    throw "apksigner.bat was not found. Pass -SdkDir or set SHINE_AAC_SDK_ROOT."
}

function Assert-DirectDebugCertificate {
    param(
        [Parameter(Mandatory = $true)][string]$ApkPath,
        [Parameter(Mandatory = $true)][string]$ApkSigner
    )

    $pinPath = Join-Path $repoRoot "config\direct-debug-cert.sha256"
    $expected = (Get-Content -LiteralPath $pinPath -Raw).Trim().ToLowerInvariant()
    $certificateOutput = (& $ApkSigner verify --print-certs $ApkPath 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed:`n$certificateOutput" }
    $match = [regex]::Match($certificateOutput, "Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]{64})")
    if (-not $match.Success) { throw "Could not read the APK signing certificate digest.`n$certificateOutput" }
    $actual = $match.Groups[1].Value.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "Direct-install debug certificate mismatch. Expected $expected but built $actual. Do not publish an APK that cannot update the existing installation."
    }
    return $actual
}

function Get-ApkAbi {
    param([Parameter(Mandatory = $true)][string]$Name)
    foreach ($abi in @("arm64-v8a", "armeabi-v7a", "x86_64", "x86")) {
        if ($Name.EndsWith("-$abi-debug.apk")) { return $abi }
    }
    throw "Cannot identify ABI from debug APK name '$Name'."
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

$debugOutput = Join-Path $repoRoot "app\build\outputs\apk\debug"
$apkFiles = @(
    Get-ChildItem -LiteralPath $debugOutput -File -Filter "*.apk" -ErrorAction SilentlyContinue |
        Sort-Object Name
)
if ($apkFiles.Count -eq 0) {
    throw "No ABI-specific debug APKs found under $debugOutput"
}
$apkSigner = Find-ApkSigner -RequestedSdkDir $SdkDir
$debugCertificate = $null

$releaseRoot = if ([System.IO.Path]::IsPathRooted($ArtifactRoot)) {
    $ArtifactRoot
} else {
    Join-Path $repoRoot $ArtifactRoot
}
$releaseDir = Join-Path $releaseRoot "v$versionName"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$artifactPaths = @()
$hashLines = @()
foreach ($apkFile in $apkFiles) {
    $abi = Get-ApkAbi -Name $apkFile.Name
    $certificate = Assert-DirectDebugCertificate -ApkPath $apkFile.FullName -ApkSigner $apkSigner
    if (-not $debugCertificate) { $debugCertificate = $certificate }
    $artifactName = "shine-aac-v$versionName-code$versionCode-debug-$abi.apk"
    $artifactPath = Join-Path $releaseDir $artifactName
    Copy-Item -LiteralPath $apkFile.FullName -Destination $artifactPath -Force
    $artifactPaths += $artifactPath
    $hashLines += "$(Get-Sha256Hex -Path $artifactPath)  $artifactName"
}
Set-Content -LiteralPath (Join-Path $releaseDir "SHA256SUMS.txt") -Value $hashLines -Encoding ASCII

$notesPath = Join-Path $releaseDir "RELEASE_NOTES.md"
$releaseNotesSource = Join-Path $repoRoot "docs\releases\v$versionName.md"
if (Test-Path -LiteralPath $releaseNotesSource) {
    Copy-Item -LiteralPath $releaseNotesSource -Destination $notesPath -Force
} elseif (-not (Test-Path -LiteralPath $notesPath)) {
    Set-Content -LiteralPath $notesPath -Encoding UTF8 -Value @"
# SHINE AAC v$versionName

Android version code: $versionCode

## Build

- ABI-specific debug APKs: ``$($artifactPaths.Count)``
- SHA-256 manifest: ``SHA256SUMS.txt``

## Verification

- ``.\build-test.bat``

## Notes

- Debug APK for user testing, not Play Store distribution.
"@
}

$zipName = "shine-aac-v$versionName-code$versionCode-debug.zip"
$zipPath = Join-Path $releaseDir $zipName
$zipInputs = @($artifactPaths) + @((Join-Path $releaseDir "SHA256SUMS.txt"), $notesPath)
Compress-Archive -LiteralPath $zipInputs `
    -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host "Release artifacts:"
$artifactPaths | ForEach-Object { Write-Host $_ }
Write-Host "SHA-256 manifest:"
Write-Host (Join-Path $releaseDir "SHA256SUMS.txt")
Write-Host "Signing certificate SHA-256:"
Write-Host $debugCertificate
Write-Host "Release ZIP:"
Write-Host $zipPath
