param(
    [Parameter(Position = 0)]
    [ValidateSet('close', 'topmost-off', 'topmost-on')]
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

if ($windows.Count -eq 0) {
    Write-Host 'No SHINE AAC optical-rig window is open.'
    exit 0
}

foreach ($window in $windows) {
    switch ($Command) {
        'close' {
            # WM_CLOSE lets the active test unwind and restore device/Windows state.
            $ok = [ShineOpticalWindow]::PostMessage(
                $window.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
        }
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
