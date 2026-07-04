param(
    [string]$SdkDir,
    [switch]$NoBuild,
    [switch]$ColdBoot
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

$artifactDir = Join-Path $repoRoot "e2e-artifacts"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$scanIntervalMs = 1500
$transitionPauseMs = 0
$firstCellPauseMs = 1500
$activationKeyCode = 24

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

    $candidates += "E:\Android\Sdk"

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not $candidate) {
            continue
        }

        if ((Test-Path -LiteralPath $candidate) -and
            (Test-Path -LiteralPath (Join-Path $candidate "platform-tools\adb.exe"))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Invoke-AdbQuiet {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $script:adb @args *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "adb failed: $($args -join ' ')"
        }
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Write-TestPreferences {
    $prefsPath = Join-Path $artifactDir "shine_aac_config.xml"
    Set-Content -LiteralPath $prefsPath -Encoding UTF8 -Value @"
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="4" />
    <int name="configVersion" value="10" />
    <boolean name="e2eEnabled" value="true" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="false" />
    <boolean name="restartScanFromTop" value="true" />
    <boolean name="hardwareButtons" value="true" />
    <float name="scanIntervalMs" value="$scanIntervalMs.0" />
    <float name="transitionPauseMs" value="$transitionPauseMs.0" />
    <float name="firstCellPauseMs" value="$firstCellPauseMs.0" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
"@

    Invoke-AdbQuiet push $prefsPath "/data/local/tmp/shine_aac_config.xml"
    Invoke-AdbQuiet shell "run-as com.example.shineaac sh -c 'mkdir -p shared_prefs; cp /data/local/tmp/shine_aac_config.xml shared_prefs/shine_aac_config.xml'"
}

function Write-ZhTwTestPreferences {
    $prefsPath = Join-Path $artifactDir "shine_aac_config_zhtw.xml"
    Set-Content -LiteralPath $prefsPath -Encoding UTF8 -Value @"
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="4" />
    <int name="configVersion" value="10" />
    <string name="profileId">zh-TW</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="false" />
    <boolean name="restartScanFromTop" value="true" />
    <boolean name="hardwareButtons" value="true" />
    <float name="scanIntervalMs" value="$scanIntervalMs.0" />
    <float name="transitionPauseMs" value="$transitionPauseMs.0" />
    <float name="firstCellPauseMs" value="$firstCellPauseMs.0" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
"@

    Invoke-AdbQuiet push $prefsPath "/data/local/tmp/shine_aac_config.xml"
    Invoke-AdbQuiet shell "run-as com.example.shineaac sh -c 'mkdir -p shared_prefs; cp /data/local/tmp/shine_aac_config.xml shared_prefs/shine_aac_config.xml'"
}

function Get-E2ELog {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        return (& $script:adb logcat -d -s ShineAacE2E:I "*:S")
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Wait-E2EReady([int]$TimeoutMs = 30000) {
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-E2ELog) -join "`n"
        if ($logText -match 'SHINE_AAC_E2E_STATE' -and
            $logText -match '"stage":"Rows"' -and
            $logText -match '"WANT"') {
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "Timed out waiting for WebView render state."
}

function Wait-RenderState([string]$Description, [string[]]$Patterns, [int]$TimeoutMs = 30000) {
    Invoke-AdbQuiet logcat -c
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-E2ELog) -join "`n"
        $matched = $true
        foreach ($pattern in $Patterns) {
            if (-not $logText.Contains($pattern)) {
                $matched = $false
                break
            }
        }
        if ($matched) {
            return
        }
        Start-Sleep -Milliseconds 50
    }

    Write-Host "Recent ShineAacE2E log:"
    Get-E2ELog | Select-Object -Last 20
    throw "Timed out waiting for render state: $Description."
}

function Wait-LoggedMessage([string]$ExpectedMessage, [int]$TimeoutMs = 10000) {
    $needle = '"message":"' + ($ExpectedMessage -replace '\\', '\\' -replace '"', '\"') + '"'
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-E2ELog) -join "`n"
        if ($logText.Contains($needle)) {
            return
        }
        Start-Sleep -Milliseconds 300
    }

    Write-Host "Recent ShineAacE2E log:"
    Get-E2ELog | Select-Object -Last 20
    throw "Timed out waiting for message '$ExpectedMessage'."
}

function Switch-Activate([string]$Label) {
    Invoke-AdbQuiet shell input keyevent $activationKeyCode
    Write-Host "keyevent $activationKeyCode $Label"
}

function Select-SuggestionCell([int]$CellIndex, [string]$ExpectedLabel) {
    Wait-RenderState "suggestion row for $ExpectedLabel" @('"stage":"Rows"', '"rowIndex":0')
    Switch-Activate "suggestion row for $ExpectedLabel"

    if ($CellIndex -eq 0) {
        Wait-RenderState "suggestion cell 0 ($ExpectedLabel)" @('"rowIndex":0', '"cellIndex":0')
        Start-Sleep -Milliseconds 300
    } else {
        Wait-RenderState "suggestion cell $CellIndex ($ExpectedLabel)" @('"stage":"Cells"', '"rowIndex":0', ('"cellIndex":' + $CellIndex))
        Start-Sleep -Milliseconds 300
    }
    Switch-Activate "suggestion cell $CellIndex ($ExpectedLabel)"
    Start-Sleep -Milliseconds 350
}

if (-not $NoBuild) {
    Write-Step "Building and unit-testing debug APK"
    $buildArgs = @()
    if ($SdkDir) {
        $buildArgs += @("-SdkDir", $SdkDir)
    }
    & .\build-test.bat @buildArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$sdkPath = Find-AndroidSdk -ExplicitSdkDir $SdkDir
if (-not $sdkPath) {
    throw "Android SDK was not found. Retry with -SdkDir E:\Android\Sdk or run .\build-test.bat -SetupSdk."
}

$script:adb = Join-Path $sdkPath "platform-tools\adb.exe"

Write-Step "Installing and launching real APK on emulator"
$runArgs = @("-NoBuild")
if ($SdkDir) {
    $runArgs += @("-SdkDir", $SdkDir)
}
if ($ColdBoot) {
    $runArgs += "-ColdBoot"
}
& .\run-apk.bat @runArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Resetting app data for deterministic hardware-button E2E"
Invoke-AdbQuiet shell pm clear com.example.shineaac
Invoke-AdbQuiet logcat -c
Write-TestPreferences
Invoke-AdbQuiet shell am start -W -n com.example.shineaac/.MainActivity
Wait-E2EReady
Start-Sleep -Milliseconds 300

Write-Step "Entering complete phrase with Android hardware-button input"
Select-SuggestionCell 0 "I"
Select-SuggestionCell 1 "WANT"
Select-SuggestionCell 2 "WATER"

Start-Sleep -Milliseconds 800
Wait-LoggedMessage "I want water "

$screenshotDevicePath = "/sdcard/shine-hardware-button-final.png"
$screenshotHostPath = Join-Path $artifactDir "hardware-button-final.png"
Invoke-AdbQuiet shell screencap -p $screenshotDevicePath
Invoke-AdbQuiet pull $screenshotDevicePath $screenshotHostPath

Write-Step "Verifying zh-TW first-layer render state in packaged APK"
Invoke-AdbQuiet logcat -c
Write-ZhTwTestPreferences
Invoke-AdbQuiet shell am force-stop com.example.shineaac
Invoke-AdbQuiet shell am start -W -n com.example.shineaac/.MainActivity
$zhuyinBo = -join ([char]0x3105)
$zhuyinYi = -join ([char]0x3127)
$zhuyinYu = -join ([char]0x3129)
Wait-RenderState "zh-TW direct Zhuyin board and MORE" @($zhuyinBo, $zhuyinYi, $zhuyinYu, "MORE")

Write-Host ""
Write-Host "E2E PASS: Android hardware-button input entered 'I want water ' and zh-TW direct Zhuyin render state was verified." -ForegroundColor Green
Write-Host "Artifacts: $artifactDir"
