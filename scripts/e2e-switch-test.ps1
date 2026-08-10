param(
    [string]$SdkDir,
    [switch]$NoBuild,
    [switch]$ColdBoot,
    [switch]$SkipDemo,
    [switch]$SkipZhTw
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
    <int name="configVersion" value="24" />
    <string name="profileId">en-US</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="rowScanVoice" value="false" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="true" />
    <boolean name="restartScanFromTop" value="true" />
    <boolean name="hardwareButtons" value="true" />
    <boolean name="holdAfterSuggestionChange" value="false" />
    <float name="scanIntervalMs" value="$scanIntervalMs.0" />
    <float name="transitionPauseMs" value="$transitionPauseMs.0" />
    <float name="firstCellPauseMs" value="$firstCellPauseMs.0" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
"@

    Invoke-AdbQuiet push $prefsPath "/data/local/tmp/shine_aac_config.xml"
    Invoke-AdbQuiet shell "run-as org.shineaac.app sh -c 'mkdir -p shared_prefs; cp /data/local/tmp/shine_aac_config.xml shared_prefs/shine_aac_config.xml'"
}

function Write-ZhTwTestPreferences {
    $prefsPath = Join-Path $artifactDir "shine_aac_config_zhtw.xml"
    Set-Content -LiteralPath $prefsPath -Encoding UTF8 -Value @"
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="4" />
    <int name="configVersion" value="24" />
    <string name="profileId">zh-TW</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="rowScanVoice" value="false" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="false" />
    <boolean name="restartScanFromTop" value="true" />
    <boolean name="hardwareButtons" value="true" />
    <boolean name="holdAfterSuggestionChange" value="false" />
    <float name="scanIntervalMs" value="$scanIntervalMs.0" />
    <float name="transitionPauseMs" value="$transitionPauseMs.0" />
    <float name="firstCellPauseMs" value="$firstCellPauseMs.0" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
"@

    Invoke-AdbQuiet push $prefsPath "/data/local/tmp/shine_aac_config.xml"
    Invoke-AdbQuiet shell "run-as org.shineaac.app sh -c 'mkdir -p shared_prefs; cp /data/local/tmp/shine_aac_config.xml shared_prefs/shine_aac_config.xml'"
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

function Dismiss-SystemAnrDialogIfPresent {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $windowState = (& $script:adb shell dumpsys window) -join "`n"
        if ($LASTEXITCODE -ne 0) {
            return $false
        }
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($windowState -notmatch 'mCurrentFocus=.*Application Not Responding: (com\.google\.android\.apps\.nexuslauncher|system|android)') {
        return $false
    }

    Invoke-AdbQuiet shell input keyevent KEYCODE_DPAD_DOWN
    Invoke-AdbQuiet shell input keyevent KEYCODE_ENTER
    Write-Host "dismissed emulator system ANR dialog with Wait"
    Start-Sleep -Milliseconds 750
    return $true
}

function Wait-E2EReady([int]$TimeoutMs = 30000) {
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-E2ELog) -join "`n"
        if ($logText -match 'SHINE_AAC_E2E_STATE' -and
            $logText -match '"stage":"Rows"' -and
            $logText -match '"WANT"') {
            return
        }
        if ((Get-Date) -ge $nextSystemDialogCheck) {
            $null = Dismiss-SystemAnrDialogIfPresent
            $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
        }
        Start-Sleep -Milliseconds 500
    }

    throw "Timed out waiting for WebView render state."
}

function Wait-RenderState([string]$Description, [string[]]$Patterns, [int]$TimeoutMs = 30000) {
    Invoke-AdbQuiet logcat -c
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
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
        if ((Get-Date) -ge $nextSystemDialogCheck) {
            $null = Dismiss-SystemAnrDialogIfPresent
            $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
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
    $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-E2ELog) -join "`n"
        if ($logText.Contains($needle)) {
            return
        }
        if ((Get-Date) -ge $nextSystemDialogCheck) {
            $null = Dismiss-SystemAnrDialogIfPresent
            $nextSystemDialogCheck = (Get-Date).AddSeconds(4)
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

function Get-ScreenSize {
    $sizeText = (& $script:adb shell wm size) -join "`n"
    if ($sizeText -match "Override size:\s*(\d+)x(\d+)") {
        return @([int]$Matches[1], [int]$Matches[2])
    }
    if ($sizeText -match "Physical size:\s*(\d+)x(\d+)") {
        return @([int]$Matches[1], [int]$Matches[2])
    }

    throw "Could not determine emulator screen size from: $sizeText"
}

function LongPress-ConfigButton {
    $null = Dismiss-SystemAnrDialogIfPresent
    $size = Get-ScreenSize
    $x = [int]($size[0] * 0.82)
    $y = [int]($size[1] * 0.17)
    Invoke-AdbQuiet shell input swipe $x $y $x $y 2200
    Write-Host "long press $x $y Config button"
}

function Tap-ConfigButton {
    $null = Dismiss-SystemAnrDialogIfPresent
    $size = Get-ScreenSize
    $x = [int]($size[0] * 0.82)
    $y = [int]($size[1] * 0.17)
    Invoke-AdbQuiet shell input tap $x $y
    Write-Host "tap $x $y Config button"
}

function Invoke-SystemBack {
    $size = Get-ScreenSize
    $navigationMode = ((& $script:adb shell settings get secure navigation_mode) -join "").Trim()
    if ($navigationMode -eq "2") {
        $y = [int]($size[1] * 0.5)
        $endX = [int]($size[0] * 0.5)
        Invoke-AdbQuiet shell input swipe 1 $y $endX $y 300
        Write-Host "left-edge Android back swipe"
        return
    }

    Invoke-AdbQuiet shell input keyevent KEYCODE_BACK
    Write-Host "Android back key (navigation mode $navigationMode)"
}

function Assert-ShineForeground {
    $windowState = (& $script:adb shell dumpsys window) -join "`n"
    if ($windowState -notmatch 'mCurrentFocus=.*org\.shineaac\.app/org\.shineaac\.app\.MainActivity') {
        throw "SHINE AAC left the foreground after internal-page back navigation."
    }
}

function Get-LatestE2EState {
    $lines = @(Get-E2ELog)
    for ($index = $lines.Count - 1; $index -ge 0; $index--) {
        if ($lines[$index] -match 'SHINE_AAC_E2E_STATE (\{.*\})\s*$') {
            return ($Matches[1] | ConvertFrom-Json)
        }
    }

    throw "No rendered SHINE_AAC_E2E_STATE was available."
}

function Select-RenderedLabel([string]$ExpectedLabel) {
    $null = Dismiss-SystemAnrDialogIfPresent
    $state = Get-LatestE2EState
    $targetRow = -1
    $targetCell = -1
    for ($rowIndex = 0; $rowIndex -lt $state.rows.Count; $rowIndex++) {
        for ($cellIndex = 0; $cellIndex -lt $state.rows[$rowIndex].Count; $cellIndex++) {
            if ([string]$state.rows[$rowIndex][$cellIndex] -ceq $ExpectedLabel) {
                $targetRow = $rowIndex
                $targetCell = $cellIndex
                break
            }
        }
        if ($targetRow -ge 0) { break }
    }
    if ($targetRow -lt 0) {
        throw "Rendered board does not contain '$ExpectedLabel'."
    }

    Wait-RenderState "row $targetRow for $ExpectedLabel" @('"stage":"Rows"', ('"rowIndex":' + $targetRow))
    Switch-Activate "row $targetRow for $ExpectedLabel"

    if ($targetCell -eq 0) {
        $null = Dismiss-SystemAnrDialogIfPresent
        Wait-RenderState "cell 0 ($ExpectedLabel)" @(('"rowIndex":' + $targetRow), '"cellIndex":0')
        Start-Sleep -Milliseconds 300
    } else {
        $null = Dismiss-SystemAnrDialogIfPresent
        Wait-RenderState "cell $targetCell ($ExpectedLabel)" @('"stage":"Cells"', ('"rowIndex":' + $targetRow), ('"cellIndex":' + $targetCell))
        Start-Sleep -Milliseconds 300
    }
    Switch-Activate "cell $targetCell ($ExpectedLabel)"
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
Invoke-AdbQuiet shell pm clear org.shineaac.app
Invoke-AdbQuiet logcat -c
Write-TestPreferences
Invoke-AdbQuiet shell am start -W -n org.shineaac.app/.MainActivity
Wait-E2EReady
Start-Sleep -Milliseconds 300

Write-Step "Verifying Android back returns from Configuration to the communication board"
Tap-ConfigButton
Start-Sleep -Milliseconds 500
Invoke-AdbQuiet logcat -c
Invoke-SystemBack
Wait-RenderState "communication board after Android back" @('"stage":"Rows"', '"WANT"')
Assert-ShineForeground

if (-not $SkipDemo) {
    Write-Step "Verifying packaged Config long-press Demo activation"
    Invoke-AdbQuiet logcat -c
    LongPress-ConfigButton
    Wait-LoggedMessage "I need help " 30000

    Write-Step "Resetting app data after Demo E2E"
    Invoke-AdbQuiet shell pm clear org.shineaac.app
    Invoke-AdbQuiet logcat -c
    Write-TestPreferences
    Invoke-AdbQuiet shell am start -W -n org.shineaac.app/.MainActivity
    Wait-E2EReady
    Start-Sleep -Milliseconds 300
}

Write-Step "Entering complete phrase with Android hardware-button input"
Select-RenderedLabel "I"
Select-RenderedLabel "WANT"
Select-RenderedLabel "WATER"

Start-Sleep -Milliseconds 800
Wait-LoggedMessage "I want water "

Write-Step "Verifying native draft persistence and process recreation"
$draftXml = (& $script:adb shell "run-as org.shineaac.app cat shared_prefs/shine_aac_session_draft.xml") -join "`n"
if (-not $draftXml.Contains("I want water")) {
    throw "Native session draft does not contain the composed message."
}
Invoke-AdbQuiet logcat -c
Invoke-AdbQuiet shell am force-stop org.shineaac.app
Invoke-AdbQuiet shell am start -W -n org.shineaac.app/.MainActivity
Wait-LoggedMessage "I want water " 30000

$screenshotDevicePath = "/sdcard/shine-hardware-button-final.png"
$screenshotHostPath = Join-Path $artifactDir "hardware-button-final.png"
Invoke-AdbQuiet shell screencap -p $screenshotDevicePath
Invoke-AdbQuiet pull $screenshotDevicePath $screenshotHostPath

if (-not $SkipZhTw) {
    Write-Step "Verifying zh-TW first-layer render state in packaged APK"
    Invoke-AdbQuiet logcat -c
    Write-ZhTwTestPreferences
    Invoke-AdbQuiet shell am force-stop org.shineaac.app
    Invoke-AdbQuiet shell am start -W -n org.shineaac.app/.MainActivity
    $zhuyinBo = -join ([char]0x3105)
    $zhuyinYi = -join ([char]0x3127)
    $zhuyinYu = -join ([char]0x3129)
    $zhTwMore = -join ([char]0x66F4, [char]0x591A)
    Wait-RenderState "zh-TW direct Zhuyin board and More action" @($zhuyinBo, $zhuyinYi, $zhuyinYu, $zhTwMore)
}

Write-Host ""
$passDetail = if ($SkipZhTw) {
    "Android hardware-button input entered 'I want water ', saved it to native storage, and restored it after process recreation."
} else {
    "Android hardware-button input entered 'I want water ', restored it after process recreation, and verified the zh-TW direct Zhuyin render state."
}
Write-Host "E2E PASS: $passDetail" -ForegroundColor Green
Write-Host "Artifacts: $artifactDir"
