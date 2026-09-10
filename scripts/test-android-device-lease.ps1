$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/with-android-device-lease.ps1"
$testDir = Join-Path $PSScriptRoot '../.tmp/device-lease-test'
New-Item -ItemType Directory -Force $testDir | Out-Null
$id = [guid]::NewGuid().ToString('N')
$serial = "lease-test-$id"
$probe = Join-Path $testDir "$id.ps1"
$marker = Join-Path $testDir "$id.marker"
@'
param($Helper, $Serial, $Marker)
$ErrorActionPreference = 'Stop'
. $Helper
try {
    Invoke-AndroidDeviceLease -Serials $Serial -Action { Set-Content -LiteralPath $Marker -Value 'entered' }
    exit 0
} catch {
    if ($_.Exception.Message -like '*reserved by another task*') { exit 23 }
    throw
}
'@ | Set-Content -LiteralPath $probe
$helper = Join-Path $PSScriptRoot 'with-android-device-lease.ps1'
Invoke-AndroidDeviceLease -Serials $serial -Action {
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probe $helper $serial $marker
    if ($LASTEXITCODE -ne 23 -or (Test-Path -LiteralPath $marker)) { throw 'Concurrent process entered a reserved device action.' }
    Invoke-AndroidDeviceLease -Serials $serial -Action { 'Nested same-thread lease passed.' }
}
try {
    Invoke-AndroidDeviceLease -Serials $serial -Action { throw 'intentional action failure' }
    throw 'Expected action failure.'
} catch {
    if ($_.Exception.Message -ne 'intentional action failure') { throw }
}
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probe $helper $serial $marker
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $marker)) { throw 'Lease was not released after failure.' }
Remove-Item -LiteralPath $probe,$marker
'PASS: cross-process exclusion, nested ownership, and release after failure. No ADB used.'
