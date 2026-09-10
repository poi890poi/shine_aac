# Shared with MinIME: hold these advisory locks through device cleanup.
function Invoke-AndroidDeviceLease {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string[]]$Serials,
        [Parameter(Mandatory=$true)][scriptblock]$Action
    )
    $ordered = @($Serials | Sort-Object -Unique)
    if (-not $ordered.Count) { throw 'At least one Android serial is required.' }
    foreach ($serial in $ordered) {
        if ($serial -notmatch '^[A-Za-z0-9._:-]+$') { throw "Invalid Android serial: $serial" }
    }
    $held = New-Object System.Collections.Generic.List[System.Threading.Mutex]
    try {
        foreach ($serial in $ordered) {
            $mutex = New-Object System.Threading.Mutex($false, ('Local\Codex.Android.' + $serial))
            $acquired = $false
            try {
                try { $acquired = $mutex.WaitOne(0) }
                catch [System.Threading.AbandonedMutexException] { $acquired = $true }
                if (-not $acquired) { throw "Android device $serial is reserved by another task; no device commands were run." }
                $held.Add($mutex)
            } finally {
                if (-not $acquired) { $mutex.Dispose() }
            }
        }
        & $Action
    } finally {
        for ($i = $held.Count - 1; $i -ge 0; $i--) {
            try { $held[$i].ReleaseMutex() } finally { $held[$i].Dispose() }
        }
    }
}
