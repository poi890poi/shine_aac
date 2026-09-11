# Obtain an acknowledged device window before invoking this rig-specific runner.
param(
    [Parameter(Mandatory=$true)][ValidateSet('RFCR91GWXLX','R9JT201YLJF')][string]$Serial,
    [ValidateRange(1,3600)][int]$Seconds=1800,
    [ValidatePattern('^[a-z0-9-]+$')][string]$Phase='sustained',
    [ValidateSet('first','cpu','gpu','prepared')][string]$StartAt='first',
    [ValidateRange(180,3600)][int]$MaximumCooldownSeconds=900
)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/with-android-device-lease.ps1"
$env:PYTHONUTF8='1'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    Invoke-AndroidDeviceLease -Serials @($Serial) -Action {
        $label=if ($Serial -eq 'R9JT201YLJF') {'tablet'} else {'phone'}
        $conditions=if ($label -eq 'phone') {@('cpu','gpu','prepared')} else {@('gpu','cpu','prepared')}
        if ($StartAt -ne 'first') { $conditions=$conditions[([array]::IndexOf($conditions,$StartAt))..($conditions.Count-1)] }
        $adb='E:/Android/Sdk/platform-tools/adb.exe'
        $baseline=if ($label -eq 'phone') {292} else {290}
        $evidenceRoot='.tmp/face-sustained-research'
        New-Item -ItemType Directory -Force $evidenceRoot | Out-Null
        $cooldownLog=Join-Path $evidenceRoot "$label-$Phase-cooldown.jsonl"
        try {
            foreach ($condition in $conditions) {
                if ($Seconds -ge 1800) {
                    & $adb -s $Serial shell am force-stop org.shineaac.app.preview | Out-Null
                    & $adb -s $Serial shell input keyevent 223 | Out-Null
                    $start=Get-Date
                    do {
                        Start-Sleep -Seconds 30
                        $raw=& $adb -s $Serial shell dumpsys battery
                        if ($LASTEXITCODE -ne 0) {throw 'Battery read failed'}
                        $match=[regex]::Match(($raw -join "`n"),'(?m)^\s+temperature:\s*(\d+)')
                        if (-not $match.Success) {throw 'Battery temperature unavailable'}
                        $temp=[int]$match.Groups[1].Value
                        $elapsed=((Get-Date)-$start).TotalSeconds
                        @{condition=$condition;utc=[DateTime]::UtcNow.ToString('o');elapsedSeconds=$elapsed;temperatureTenthsC=$temp;minimumTenthsC=$baseline-10;maximumTenthsC=$baseline+10} |
                            ConvertTo-Json -Compress | Add-Content -LiteralPath $cooldownLog -Encoding UTF8
                        if ($elapsed -gt $MaximumCooldownSeconds) {throw 'Comparable battery temperature not restored before cooldown timeout'}
                    } while ($elapsed -lt 180 -or [math]::Abs($temp-$baseline) -gt 10)
                }
                $delegate=if ($condition -eq 'cpu') {'CPU'} else {'GPU'}
                $mode=if ($condition -eq 'prepared') {'prepared'} else {'serial'}
                & 'C:/Program Files/Python37/python.exe' scripts/face-overlap-benchmark.py --serial $Serial --candidate prepared --single-mode $mode --primary-delegate $delegate --duration-seconds $Seconds --period-ms 66 --frame-width 320 --frames .tmp/face-overlap-research/timed-public-66 --app-apk .tmp/face-acceleration-research/shine-face-default.apk --test-apk .tmp/face-sustained-research/sustained-test.apk --output "$evidenceRoot/$label-$Phase-$condition"
                if ($LASTEXITCODE -ne 0) {throw "$label $Phase $condition failed; cleanup evidence retained"}
            }
        } finally {
            & $adb -s $Serial shell am force-stop org.shineaac.app.preview | Out-Null
            & $adb -s $Serial shell input keyevent 223 | Out-Null
            Start-Sleep -Seconds 2
            $display=(& $adb -s $Serial shell dumpsys display) -join "`n"
            $power=(& $adb -s $Serial shell dumpsys power) -join "`n"
            $states=@([regex]::Matches($display,'mScreenState=(\w+)') | ForEach-Object {$_.Groups[1].Value})
            $wake=@([regex]::Matches($power,'mWakefulness=(\w+)') | ForEach-Object {$_.Groups[1].Value})
            @{display=$states;wakefulness=$wake} | ConvertTo-Json | Set-Content -LiteralPath "$evidenceRoot/$label-$Phase-driver-cleanup.json" -Encoding UTF8
            if (-not $states.Count -or @($states | Where-Object {$_ -notin @('OFF','DOZE_SUSPEND')}).Count -or -not $wake.Count -or $wake[0] -notin @('Asleep','Dozing')) {throw 'Driver display sleep not verified'}
        }
    }
} finally { Pop-Location }
