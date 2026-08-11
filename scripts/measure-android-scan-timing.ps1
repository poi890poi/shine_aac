param(
    [Parameter(Mandatory = $true)]
    [string]$ApkPath,
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [int]$IntervalMs = 300,
    [int]$Samples = 100,
    [string]$SdkDir = "E:\Android\Sdk"
)

$ErrorActionPreference = "Stop"
$packageName = "org.shineaac.app"
$componentName = "$packageName/.MainActivity"
$adb = Join-Path $SdkDir "platform-tools\adb.exe"

if (-not (Test-Path -LiteralPath $adb)) {
    throw "adb was not found at $adb"
}

$resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
$artifactDir = Join-Path (Split-Path -Parent $PSScriptRoot) "e2e-artifacts\android-scan-timing"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$prefsPath = Join-Path $artifactDir "shine_aac_config.xml"

function Invoke-Adb {
    $arguments = @($args)
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $script:adb @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "adb failed: $($arguments -join ' ')`n$($output -join "`n")"
    }
    return $output
}

function Get-E2EEvents {
    $lines = Invoke-Adb logcat -v epoch -d -s ShineAacE2E:I "*:S"
    $events = [System.Collections.Generic.List[object]]::new()

    foreach ($line in $lines) {
        if ($line -notmatch '^\s*(?<time>\d+(?:\.\d+)?)\s+.*?SHINE_AAC_E2E_STATE\s+(?<json>\{.*\})\s*$') {
            continue
        }

        try {
            $timestamp = [double]::Parse(
                $Matches.time,
                [System.Globalization.CultureInfo]::InvariantCulture
            )
            $state = $Matches.json | ConvertFrom-Json
            $events.Add([pscustomobject]@{
                Timestamp = $timestamp
                Stage = [string]$state.stage
                RowIndex = [int]$state.rowIndex
                CellIndex = [int]$state.cellIndex
            })
        } catch {
            Write-Warning "Ignored malformed E2E log line: $line"
        }
    }

    return $events
}

function Wait-ForStage {
    param([string[]]$Stages, [int]$TimeoutSeconds = 20)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $events = @(Get-E2EEvents)
        if ($events | Where-Object { $_.Stage -in $Stages } | Select-Object -First 1) {
            return
        }
        Start-Sleep -Milliseconds 250
    }
    throw "Timed out waiting for Android scan stage: $($Stages -join ', ')"
}

function Get-TransitionResult {
    param(
        [object[]]$Events,
        [ValidateSet("row", "column")][string]$Kind
    )

    $filtered = if ($Kind -eq "row") {
        @($Events | Where-Object { $_.Stage -eq "Rows" })
    } else {
        @($Events | Where-Object { $_.Stage -in @("FirstCell", "Cells") })
    }

    $distinct = [System.Collections.Generic.List[object]]::new()
    $lastSignature = $null
    foreach ($event in $filtered) {
        $signature = if ($Kind -eq "row") {
            "row:$($event.RowIndex)"
        } else {
            "cell:$($event.RowIndex):$($event.CellIndex)"
        }
        if ($signature -eq $lastSignature) {
            continue
        }
        $distinct.Add($event)
        $lastSignature = $signature
    }

    if ($distinct.Count -lt ($Samples + 1)) {
        throw "$Label $Kind scan produced only $($distinct.Count - 1) intervals; expected $Samples"
    }

    # The log is cleared during an arbitrary active interval. Discard the first
    # observed highlight, then measure complete highlight-to-highlight intervals.
    $selected = @($distinct | Select-Object -Skip 1 -First ($Samples + 1))
    $intervals = for ($index = 1; $index -lt $selected.Count; $index += 1) {
        ($selected[$index].Timestamp - $selected[$index - 1].Timestamp) * 1000.0
    }
    $sorted = @($intervals | Sort-Object)
    $actualTotalMs = ($selected[-1].Timestamp - $selected[0].Timestamp) * 1000.0
    $expectedTotalMs = $Samples * $IntervalMs
    $p95Index = [Math]::Min($sorted.Count - 1, [Math]::Ceiling($sorted.Count * 0.95) - 1)

    return [ordered]@{
        label = $Label
        kind = $Kind
        samples = $Samples
        expectedIntervalMs = $IntervalMs
        actualMeanIntervalMs = [Math]::Round($actualTotalMs / $Samples, 3)
        excessPerSwitchMs = [Math]::Round(($actualTotalMs - $expectedTotalMs) / $Samples, 3)
        expectedTotalMs = $expectedTotalMs
        actualTotalMs = [Math]::Round($actualTotalMs, 3)
        totalExcessMs = [Math]::Round($actualTotalMs - $expectedTotalMs, 3)
        minIntervalMs = [Math]::Round($sorted[0], 3)
        medianIntervalMs = [Math]::Round($sorted[[Math]::Floor($sorted.Count / 2)], 3)
        p95IntervalMs = [Math]::Round($sorted[$p95Index], 3)
        maxIntervalMs = [Math]::Round($sorted[-1], 3)
    }
}

function Get-ActivationResult {
    param(
        [ValidateSet("row", "column")][string]$Kind,
        [string[]]$ExpectedStages
    )

    $lines = Invoke-Adb logcat -v epoch -d -s ShineAacE2E:I "*:S"
    $inputTimestamp = $null
    $renderTimestamp = $null
    $renderStage = ""
    foreach ($line in $lines) {
        if ($null -eq $inputTimestamp -and
            $line -match '^\s*(?<time>\d+(?:\.\d+)?)\s+.*?SHINE_AAC_E2E_INPUT\s+') {
            $inputTimestamp = [double]::Parse(
                $Matches.time,
                [System.Globalization.CultureInfo]::InvariantCulture
            )
            continue
        }
        if ($null -eq $inputTimestamp -or
            $line -notmatch '^\s*(?<time>\d+(?:\.\d+)?)\s+.*?SHINE_AAC_E2E_STATE\s+(?<json>\{.*\})\s*$') {
            continue
        }
        $state = $Matches.json | ConvertFrom-Json
        if ([string]$state.stage -notin $ExpectedStages) {
            continue
        }
        $renderTimestamp = [double]::Parse(
            $Matches.time,
            [System.Globalization.CultureInfo]::InvariantCulture
        )
        $renderStage = [string]$state.stage
        break
    }

    if ($null -eq $inputTimestamp -or $null -eq $renderTimestamp) {
        throw "Could not find the $Kind input/render activation boundary in Android logs"
    }

    return [ordered]@{
        label = $Label
        kind = "$Kind-activation"
        inputToRenderedStateMs = [Math]::Round(($renderTimestamp - $inputTimestamp) * 1000.0, 3)
        renderedStage = $renderStage
    }
}

$prefsXml = @"
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="4" />
    <int name="configVersion" value="24" />
    <string name="profileId">en-US</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="rowScanVoice" value="false" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="false" />
    <boolean name="restartScanFromTop" value="true" />
    <string name="switchInputProfile">hardware-buttons</string>
    <boolean name="hardwareButtons" value="true" />
    <boolean name="cameraSwitch" value="false" />
    <float name="scanIntervalMs" value="$IntervalMs.0" />
    <float name="transitionPauseMs" value="0.0" />
    <float name="firstCellPauseMs" value="$IntervalMs.0" />
    <float name="inputLatencyCompensationMs" value="0.0" />
</map>
"@
[System.IO.File]::WriteAllText($prefsPath, $prefsXml, [System.Text.UTF8Encoding]::new($false))

Write-Host "Installing $Label from $resolvedApk"
Invoke-Adb install -r -d $resolvedApk | Out-Null
Invoke-Adb shell pm clear $packageName | Out-Null
Invoke-Adb push $prefsPath /data/local/tmp/shine_aac_config.xml | Out-Null
Invoke-Adb shell "run-as $packageName sh -c 'mkdir -p shared_prefs; cp /data/local/tmp/shine_aac_config.xml shared_prefs/shine_aac_config.xml'" | Out-Null
Invoke-Adb logcat -c | Out-Null
Invoke-Adb shell am start -W -n $componentName | Out-Null
Wait-ForStage -Stages @("Rows")

$expectedCaptureSeconds = (($Samples + 4) * $IntervalMs) / 1000.0
# Leave enough headroom for the regression itself without polling logcat during
# the measured run (polling would add measurement load to the WebView process).
$captureSeconds = [Math]::Ceiling($expectedCaptureSeconds * 1.5) + 2

Invoke-Adb logcat -c | Out-Null
Start-Sleep -Seconds $captureSeconds
$rowResult = Get-TransitionResult -Events @(Get-E2EEvents) -Kind row

Invoke-Adb logcat -c | Out-Null
Invoke-Adb shell input keyevent KEYCODE_VOLUME_UP | Out-Null
Wait-ForStage -Stages @("FirstCell", "Cells")
$rowActivationResult = Get-ActivationResult -Kind row -ExpectedStages @("FirstCell", "Cells")
Invoke-Adb logcat -c | Out-Null
Start-Sleep -Seconds $captureSeconds
$columnResult = Get-TransitionResult -Events @(Get-E2EEvents) -Kind column

Invoke-Adb logcat -c | Out-Null
Invoke-Adb shell input keyevent KEYCODE_VOLUME_UP | Out-Null
Wait-ForStage -Stages @("Rows")
$columnActivationResult = Get-ActivationResult -Kind column -ExpectedStages @("Rows")

$result = [ordered]@{
    label = $Label
    apk = $resolvedApk
    intervalMs = $IntervalMs
    samplesPerStage = $Samples
    measuredAt = (Get-Date).ToString("o")
    row = $rowResult
    column = $columnResult
    rowActivation = $rowActivationResult
    columnActivation = $columnActivationResult
}

$safeLabel = $Label -replace '[^A-Za-z0-9_.-]', '-'
$resultPath = Join-Path $artifactDir "$safeLabel.json"
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
$result | ConvertTo-Json -Depth 5
Write-Host "Result: $resultPath"
