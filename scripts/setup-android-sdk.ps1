param(
    [string]$SdkDir = "$env:LOCALAPPDATA\Android\Sdk",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$commandLineToolsUrl = "https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip"
$packages = @(
    "platform-tools",
    "platforms;android-34",
    "build-tools;34.0.0"
)

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Convert-ToLocalPropertiesPath {
    param([string]$Path)
    return $Path.Replace("\", "\\")
}

function Ensure-Directory($Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Remove-SafeDirectory($Path, $AllowedRoot) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    $resolvedRoot = (Resolve-Path -LiteralPath $AllowedRoot).Path
    if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to delete outside $resolvedRoot`: $resolvedPath"
    }

    Remove-Item -LiteralPath $resolvedPath -Recurse -Force
}

function Copy-DirectoryContents($Source, $Destination) {
    Ensure-Directory $Destination
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

function Find-ExistingCommandLineTools {
    param([string]$TargetSdkPath)

    $candidateRoots = @()

    if ($env:ANDROID_HOME) {
        $candidateRoots += $env:ANDROID_HOME
    }

    if ($env:ANDROID_SDK_ROOT) {
        $candidateRoots += $env:ANDROID_SDK_ROOT
    }

    if ($env:LOCALAPPDATA) {
        $candidateRoots += (Join-Path $env:LOCALAPPDATA "Android\Sdk")
    }

    $candidateRoots += @(
        "C:\Android\Sdk",
        "C:\AndroidSDK",
        "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
    )

    foreach ($candidateRoot in $candidateRoots | Select-Object -Unique) {
        if (-not $candidateRoot) {
            continue
        }

        $candidatePath = Join-Path $candidateRoot "cmdline-tools\latest"
        if ((Test-Path -LiteralPath (Join-Path $candidatePath "bin\sdkmanager.bat")) -and
            ($candidatePath -ne $latestToolsDir)) {
            return (Resolve-Path -LiteralPath $candidatePath).Path
        }
    }

    return $null
}

$sdkPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($SdkDir)
$latestToolsDir = Join-Path $sdkPath "cmdline-tools\latest"
$sdkManager = Join-Path $latestToolsDir "bin\sdkmanager.bat"

Write-Step "Preparing Android SDK at $sdkPath"
Ensure-Directory $sdkPath

if ((Test-Path -LiteralPath $sdkManager) -and (-not $Force)) {
    Write-Step "Command-line tools already installed"
} else {
    $existingToolsDir = Find-ExistingCommandLineTools -TargetSdkPath $sdkPath
    $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) "shine-aac-android-sdk"
    $zipPath = Join-Path $downloadRoot "commandlinetools-win.zip"
    $extractRoot = Join-Path $downloadRoot "extract"

    if ($existingToolsDir) {
        Write-Step "Reusing command-line tools from $existingToolsDir"
        $sourceToolsDir = $existingToolsDir
    } else {
        Ensure-Directory $downloadRoot
        Remove-SafeDirectory -Path $extractRoot -AllowedRoot $downloadRoot
        Ensure-Directory $extractRoot

        Write-Step "Downloading Android command-line tools"
        Invoke-WebRequest -Uri $commandLineToolsUrl -OutFile $zipPath

        Write-Step "Extracting command-line tools"
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

        $sourceToolsDir = Get-ChildItem -Path $extractRoot -Recurse -Filter "sdkmanager.bat" |
            Select-Object -First 1 |
            ForEach-Object { Split-Path -Parent (Split-Path -Parent $_.FullName) }

        if (-not $sourceToolsDir) {
            throw "Downloaded command-line tools did not contain sdkmanager.bat."
        }
    }

    $cmdlineRoot = Join-Path $sdkPath "cmdline-tools"
    Ensure-Directory $cmdlineRoot
    Remove-SafeDirectory -Path $latestToolsDir -AllowedRoot $sdkPath
    Ensure-Directory $latestToolsDir

    Get-ChildItem -LiteralPath $sourceToolsDir -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $latestToolsDir -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath $sdkManager)) {
    throw "sdkmanager.bat was not found at $sdkManager"
}

Write-Step "Accepting Android SDK licenses"
$licenseInput = ("y`n" * 100)
$licenseInput | & $sdkManager --sdk_root=$sdkPath --licenses
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Installing required SDK packages"
& $sdkManager --sdk_root=$sdkPath @packages
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Writing local.properties"
$localPropertiesPath = Join-Path $repoRoot "local.properties"
$localPropertiesValue = "sdk.dir=$(Convert-ToLocalPropertiesPath -Path $sdkPath)"
Set-Content -LiteralPath $localPropertiesPath -Value $localPropertiesValue -Encoding ASCII

Write-Step "Done"
Write-Host "Android SDK is ready at $sdkPath"
Write-Host "Next: .\build-test.bat"
