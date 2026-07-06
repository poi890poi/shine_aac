param(
    [string]$ApkPath = "app\build\outputs\apk\debug\app-debug.apk",
    [string]$SdkDir,
    [string]$AvdHome,
    [string]$AvdName = "ShineAacApi34",
    [switch]$SetupEmulator,
    [switch]$NoBuild,
    [switch]$ColdBoot
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

function Write-Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Find-AndroidSdk {
    param([string]$ExplicitSdkDir)

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

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not $candidate) {
            continue
        }

        if ((Test-Path -LiteralPath $candidate) -and
            (Test-Path -LiteralPath (Join-Path $candidate "platform-tools"))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Require-Tool($Path, $Message, [switch]$CleanExit) {
    if (-not (Test-Path -LiteralPath $Path)) {
        if ($CleanExit) {
            Write-Host $Message
            exit 1
        }

        throw $Message
    }
}

function Ensure-Directory($Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Set-IniValue($Path, $Key, $Value) {
    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = Get-Content -LiteralPath $Path
    }

    $escapedKey = [regex]::Escape($Key)
    $replacement = "$Key=$Value"
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -match "^\s*$escapedKey\s*=") {
            $found = $true
            $replacement
        } else {
            $line
        }
    }

    if (-not $found) {
        $updated += $replacement
    }

    Set-Content -LiteralPath $Path -Value $updated -Encoding ASCII
}

function Ensure-AvdMetadata($AvdName, $AvdPath, $AvdHome) {
    $iniPath = Join-Path $AvdHome "$AvdName.ini"
    $configPath = Join-Path $AvdPath "config.ini"

    Set-Content -LiteralPath $iniPath -Value @(
        "avd.ini.encoding=UTF-8",
        "path=$AvdPath",
        "path.rel=avd\$AvdName.avd",
        "target=android-34"
    ) -Encoding ASCII

    if (Test-Path -LiteralPath $configPath) {
        Set-IniValue -Path $configPath -Key "avd.id" -Value $AvdName
        Set-IniValue -Path $configPath -Key "avd.name" -Value $AvdName
        Set-IniValue -Path $configPath -Key "disk.dataPartition.path" -Value ""
    }
}

function Wait-ForBoot($AdbPath) {
    Write-Step "Waiting for emulator to boot"
    & $AdbPath wait-for-device

    for ($i = 0; $i -lt 180; $i++) {
        $booted = (& $AdbPath shell getprop sys.boot_completed 2>$null).Trim()
        if ($booted -eq "1") {
            & $AdbPath shell input keyevent 82 | Out-Null
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "Timed out waiting for the emulator to boot."
}

if (-not $NoBuild) {
    Write-Step "Building debug APK"
    & .\build-test.bat
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$sdkPath = Find-AndroidSdk -ExplicitSdkDir $SdkDir
if (-not $sdkPath) {
    Write-Host @"
Android SDK was not found.

Run this first:
  .\build-test.bat -SetupSdk

Then retry:
  .\run-apk.bat -SetupEmulator
"@
    exit 1
}

$sdkManager = Join-Path $sdkPath "cmdline-tools\latest\bin\sdkmanager.bat"
$avdManager = Join-Path $sdkPath "cmdline-tools\latest\bin\avdmanager.bat"
$adb = Join-Path $sdkPath "platform-tools\adb.exe"
$emulator = Join-Path $sdkPath "emulator\emulator.exe"
$systemImage = "system-images;android-34;google_apis;x86_64"

if (-not $AvdHome) {
    $AvdHome = Join-Path (Split-Path -Parent $sdkPath) "Avd"
}

$resolvedAvdHome = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($AvdHome)
Ensure-Directory $resolvedAvdHome
$env:ANDROID_AVD_HOME = $resolvedAvdHome

Require-Tool -Path $sdkManager -Message "sdkmanager.bat was not found. Run .\build-test.bat -SetupSdk first." -CleanExit
Require-Tool -Path $adb -Message "adb.exe was not found. Run .\build-test.bat -SetupSdk first." -CleanExit

if ($SetupEmulator) {
    Write-Step "Installing emulator packages"
    & $sdkManager --sdk_root=$sdkPath "emulator" $systemImage
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Require-Tool -Path $avdManager -Message "avdmanager.bat was not found. Run .\build-test.bat -SetupSdk first." -CleanExit
Require-Tool -Path $emulator -Message @"
emulator.exe was not found.

Install emulator packages and create the test device with:
  .\run-apk.bat -SetupEmulator
"@ -CleanExit

$avdPath = Join-Path $resolvedAvdHome "$AvdName.avd"
$existingAvds = & $emulator -list-avds
if ($existingAvds -notcontains $AvdName) {
    if ((Test-Path -LiteralPath $avdPath) -and (Test-Path -LiteralPath (Join-Path $avdPath "config.ini"))) {
        Write-Step "Repairing Android Virtual Device metadata for $AvdName"
        Ensure-AvdMetadata -AvdName $AvdName -AvdPath $avdPath -AvdHome $resolvedAvdHome
    } elseif (-not $SetupEmulator) {
        Write-Host @"
No Android Virtual Device named $AvdName exists.

Create it and run the app with:
  .\run-apk.bat -SetupEmulator
"@
        exit 1
    }

    Write-Step "Creating Android Virtual Device $AvdName"
    "no" | & $avdManager create avd --force --name $AvdName --package $systemImage --device "pixel_6" --path $avdPath
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
    Ensure-AvdMetadata -AvdName $AvdName -AvdPath $avdPath -AvdHome $resolvedAvdHome
}

$resolvedApkPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ApkPath)
if (-not (Test-Path -LiteralPath $resolvedApkPath)) {
    throw "APK was not found at $resolvedApkPath"
}

$devices = & $adb devices
$hasRunningDevice = $devices | Where-Object { $_ -match "\sdevice$" }

if (-not $hasRunningDevice) {
    Write-Step "Starting emulator $AvdName"
    $emulatorArgs = @(
        "-avd", $AvdName,
        "-no-boot-anim",
        "-gpu", "swiftshader_indirect"
    )
    if ($ColdBoot) {
        $emulatorArgs += "-no-snapshot-load"
    }

    Start-Process -FilePath $emulator -ArgumentList $emulatorArgs -WindowStyle Hidden
}

Wait-ForBoot -AdbPath $adb

Write-Step "Installing APK"
& $adb install -r $resolvedApkPath
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Launching SayToMe AAC"
& $adb shell monkey -p org.shineaac.app -c android.intent.category.LAUNCHER 1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Done"
