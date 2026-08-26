param(
    [Parameter(Position = 0)]
    [ValidateSet('close', 'force-close', 'topmost-off', 'topmost-on')]
    [string]$Command = 'close'
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class ShineOpticalWindow {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetWindowPos(
        IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr OpenEvent(uint desiredAccess, bool inheritHandle, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetEvent(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr handle);
}
'@

$titles = @('SHINE AAC Optical Rig', 'SHINE AAC Optical Rig - Idle')
$windows = @()
foreach ($title in $titles) {
    $handle = [ShineOpticalWindow]::FindWindow($null, $title)
    if ($handle -ne [IntPtr]::Zero) {
        $windows += [PSCustomObject]@{ Title = $title; Handle = $handle }
    }
}

$registryPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.tmp\optical-rig-presenter.json'
$registeredProcess = $null
if (Test-Path -LiteralPath $registryPath) {
    try {
        $registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
        $candidate = Get-Process -Id ([int]$registry.pid) -ErrorAction Stop
        $sameExecutable = (
            [System.IO.Path]::GetFullPath($candidate.Path) -ieq
            [System.IO.Path]::GetFullPath([string]$registry.executable)
        )
        $registeredAt = [DateTimeOffset]::FromUnixTimeMilliseconds(
            [int64]([double]$registry.registered_at * 1000)
        ).LocalDateTime
        $plausibleStart = $candidate.StartTime -le $registeredAt -and
            $candidate.StartTime -ge $registeredAt.AddMinutes(-5)
        if ($sameExecutable -and $plausibleStart) {
            $registeredProcess = $candidate
        }
    } catch {
        $registeredProcess = $null
    }
}

if ($Command -eq 'force-close') {
    if (-not $registeredProcess) {
        throw 'No verified optical-rig presenter PID is registered.'
    }
    Stop-Process -Id $registeredProcess.Id -Force
    Write-Host "Force-closed registered optical-rig PID $($registeredProcess.Id)."
    exit 0
}

$idleSignaled = $false
if ($windows.Count -eq 0) {
    if ($Command -eq 'close') {
        $idleStop = [ShineOpticalWindow]::OpenEvent(
            0x0002, $false, 'Local\ShineAacOpticalIdleStop')
        if ($idleStop -ne [IntPtr]::Zero) {
            $null = [ShineOpticalWindow]::SetEvent($idleStop)
            $null = [ShineOpticalWindow]::CloseHandle($idleStop)
            Write-Host 'close sent to the verified optical-rig idle presenter.'
            $idleSignaled = $true
        }
    }
    if ($Command -eq 'close' -and $registeredProcess) {
        Stop-Process -Id $registeredProcess.Id -Force
        Write-Host (
            "The OpenCV title was hidden; force-closed verified optical-rig PID " +
            "$($registeredProcess.Id)."
        )
        exit 0
    }
    if ($idleSignaled) {
        exit 0
    }
    if ($registeredProcess) {
        throw "The rig PID is verified but Windows exposes no window handle; use 'force-close'."
    }
    Write-Host 'No SHINE AAC optical-rig window or verified presenter PID is open.'
    exit 0
}

foreach ($window in $windows) {
    switch ($Command) {
        'close' {
            # WM_CLOSE lets the active test unwind and restore device/Windows state.
            $ok = [ShineOpticalWindow]::PostMessage(
                $window.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
        }
        'force-close' { throw 'force-close must be handled through the PID registry.' }
        'topmost-off' {
            $ok = [ShineOpticalWindow]::SetWindowPos(
                $window.Handle, [IntPtr](-2), 0, 0, 0, 0, 0x0013)
        }
        'topmost-on' {
            $ok = [ShineOpticalWindow]::SetWindowPos(
                $window.Handle, [IntPtr](-1), 0, 0, 0, 0, 0x0013)
        }
    }
    if (-not $ok) {
        throw "Windows rejected '$Command' for '$($window.Title)'."
    }
    Write-Host "$Command sent to '$($window.Title)'."
}
