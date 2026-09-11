# Obtain an acknowledged device window before invoking this rig-specific runner.
param([Parameter(Mandatory=$true)][ValidateSet('RFCR91GWXLX','R9JT201YLJF')][string]$Serial)
$ErrorActionPreference='Stop'
Set-ExecutionPolicy -Scope Process Bypass -Force
. "$PSScriptRoot/with-android-device-lease.ps1"
$env:PYTHONUTF8='1'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
Invoke-AndroidDeviceLease -Serials @($Serial) -Action {
    $label=if ($Serial -eq 'R9JT201YLJF') {'tablet'} else {'phone'}
    $states=@('true','false','false','true')
    try { for ($index=0; $index -lt $states.Count; $index++) {
        $state=$states[$index]
        & 'C:/Program Files/Python37/python.exe' scripts/face-overlap-benchmark.py --serial $Serial --candidate prepared --single-mode serial --primary-delegate GPU --duration-seconds 1 --foreground-activity $state --period-ms 66 --frame-width 320 --frames .tmp/face-overlap-research/timed-public-66 --app-apk .tmp/face-acceleration-research/shine-face-default.apk --test-apk .tmp/face-sustained-research/foreground-test.apk --output ".tmp/face-sustained-research/$label-foreground-$index-$state"
        if ($LASTEXITCODE -ne 0) {throw "$label foreground $index failed; cleanup evidence retained"}
    } } finally {
        $adb='E:/Android/Sdk/platform-tools/adb.exe'
        & $adb -s $Serial shell am force-stop org.shineaac.app.preview | Out-Null
        & $adb -s $Serial shell input keyevent 223 | Out-Null
        Start-Sleep -Seconds 2
        $display=(& $adb -s $Serial shell dumpsys display) -join "`n"
        $power=(& $adb -s $Serial shell dumpsys power) -join "`n"
        $screenStates=@([regex]::Matches($display,'mScreenState=(\w+)') | ForEach-Object {$_.Groups[1].Value})
        $wake=@([regex]::Matches($power,'mWakefulness=(\w+)') | ForEach-Object {$_.Groups[1].Value})
        @{display=$screenStates;wakefulness=$wake} | ConvertTo-Json | Set-Content -LiteralPath ".tmp/face-sustained-research/$label-foreground-driver-cleanup.json" -Encoding UTF8
        if (-not $screenStates.Count -or @($screenStates | Where-Object {$_ -notin @('OFF','DOZE_SUSPEND')}).Count -or -not $wake.Count -or $wake[0] -notin @('Asleep','Dozing')) {throw 'Foreground-control display sleep not verified'}
    }
}
} finally { Pop-Location }
