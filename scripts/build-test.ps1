param(
    [switch]$Clean,
    [switch]$SkipUnitTests,
    [switch]$SkipAssemble,
    [switch]$NoDaemon,
    [switch]$Install,
    [switch]$SetupSdk,
    [switch]$DeepSearch,
    [string]$SdkDir
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Find-AndroidSdk {
    param(
        [string]$ExplicitSdkDir,
        [switch]$SearchDrives
    )

    $candidates = @()
    $localProperties = Join-Path $repoRoot "local.properties"

    if ($ExplicitSdkDir) {
        $candidates += $ExplicitSdkDir
    }

    if (Test-Path -LiteralPath $localProperties) {
        $sdkLine = Get-Content -LiteralPath $localProperties |
            Where-Object { $_ -match "^\s*sdk\.dir\s*=" } |
            Select-Object -First 1

        if ($sdkLine) {
            $candidates += (($sdkLine -replace "^\s*sdk\.dir\s*=", "").Trim() -replace "\\\\", "\")
        }
    }

    if ($env:ANDROID_HOME) {
        $candidates += $env:ANDROID_HOME
    }

    if ($env:ANDROID_SDK_ROOT) {
        $candidates += $env:ANDROID_SDK_ROOT
    }

    if ($env:LOCALAPPDATA) {
        $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")
    }

    $candidates += @(
        "C:\Android\Sdk",
        "C:\AndroidSDK",
        "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
    )

    if ($SearchDrives) {
        Write-Step "Searching fixed drives for an Android SDK"
        $driveRoots = Get-PSDrive -PSProvider FileSystem |
            Where-Object { $_.DisplayRoot -eq $null -and $_.Root -match "^[A-Z]:\\" } |
            Select-Object -ExpandProperty Root

        foreach ($driveRoot in $driveRoots) {
            $candidates += Get-ChildItem -LiteralPath $driveRoot -Directory -Recurse -Filter Sdk -ErrorAction SilentlyContinue |
                Where-Object {
                    (Test-Path -LiteralPath (Join-Path $_.FullName "platforms")) -and
                    (Test-Path -LiteralPath (Join-Path $_.FullName "build-tools"))
                } |
                Select-Object -ExpandProperty FullName
        }
    }

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not $candidate) {
            continue
        }

        if ((Test-Path -LiteralPath $candidate) -and
            (Test-Path -LiteralPath (Join-Path $candidate "platforms")) -and
            (Test-Path -LiteralPath (Join-Path $candidate "build-tools"))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Convert-ToLocalPropertiesPath {
    param([string]$Path)
    return $Path.Replace("\", "\\").Replace(":", "\:")
}

function Get-DebugApks {
    $debugOutput = Join-Path $repoRoot "app\build\outputs\apk\debug"
    if (-not (Test-Path -LiteralPath $debugOutput)) {
        return @()
    }
    return @(Get-ChildItem -LiteralPath $debugOutput -File -Filter "*.apk" |
        Sort-Object Name)
}

function Select-DeviceApk {
    param(
        [Parameter(Mandatory = $true)]$Apks,
        [Parameter(Mandatory = $true)][string]$DeviceAbi
    )
    $suffix = "-$DeviceAbi-debug.apk"
    return $Apks | Where-Object { $_.Name.EndsWith($suffix) } | Select-Object -First 1
}

$sdkPath = Find-AndroidSdk -ExplicitSdkDir $SdkDir -SearchDrives:$DeepSearch

if ((-not $sdkPath) -and $SetupSdk) {
    Write-Step "Android SDK was not found; installing command-line SDK"
    $setupScript = Join-Path $PSScriptRoot "setup-android-sdk.ps1"
    $setupArgs = @()
    if ($SdkDir) {
        $setupArgs += "-SdkDir"
        $setupArgs += $SdkDir
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setupScript @setupArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $sdkPath = Find-AndroidSdk -ExplicitSdkDir $SdkDir
}

if (-not $sdkPath) {
    Write-Host @"
Android SDK was not found.

Install the minimal command-line SDK, then build:
  .\setup-sdk.bat
  .\build-test.bat

Or install and build in one command:
  .\build-test.bat -SetupSdk

If the SDK is in a non-standard folder, use:
  .\build-test.bat -SdkDir C:\Users\$env:USERNAME\AppData\Local\Android\Sdk

To search all fixed drives, use:
  .\build-test.bat -DeepSearch

The SDK must contain both platforms and build-tools directories.
"@
    exit 1
}

Write-Step "Using Android SDK at $sdkPath"
$localPropertiesPath = Join-Path $repoRoot "local.properties"
$localPropertiesValue = "sdk.dir=$(Convert-ToLocalPropertiesPath -Path $sdkPath)"
Set-Content -LiteralPath $localPropertiesPath -Value $localPropertiesValue -Encoding ASCII

$gradleArgs = @()

if ($NoDaemon) {
    # Capturing a daemon-backed Gradle process from another script can leave
    # the output pipe open on Windows after the build itself has completed.
    $gradleArgs += "--no-daemon"
}

if ($Clean) {
    $gradleArgs += "clean"
}

if (-not $SkipUnitTests) {
    $gradleArgs += "testDebugUnitTest"
}

if (-not $SkipAssemble) {
    $gradleArgs += "assembleDebug"
}

if ($gradleArgs.Count -eq 0) {
    throw "Nothing to run. Remove one of the Skip switches."
}

Write-Step "Running Gradle: $($gradleArgs -join ' ')"
& .\gradlew.bat @gradleArgs

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$debugApks = @(Get-DebugApks)

if (-not $SkipAssemble) {
    if ($debugApks.Count -eq 0) {
        throw "Gradle completed without producing a debug APK."
    }
    Write-Step "Debug APKs created"
    $debugApks | ForEach-Object { Write-Host $_.FullName }
}

if ($Install) {
    $adbPath = Join-Path $sdkPath "platform-tools\adb.exe"
    if (-not (Test-Path -LiteralPath $adbPath)) {
        throw "Cannot install: adb.exe was not found under $sdkPath\platform-tools."
    }

    if ($debugApks.Count -eq 0) {
        throw "Cannot install: no debug APK exists. Run without -SkipAssemble."
    }

    $deviceAbi = ((& $adbPath shell getprop ro.product.cpu.abi) | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $deviceAbi) {
        throw "Cannot install: unable to read the connected device ABI."
    }
    $apk = Select-DeviceApk -Apks $debugApks -DeviceAbi $deviceAbi
    if (-not $apk) {
        throw "Cannot install: no debug APK matches connected device ABI '$deviceAbi'."
    }

    Write-Step "Installing $($apk.Name) on $deviceAbi device"
    & $adbPath install -r $apk.FullName

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Write-Step "Done"
