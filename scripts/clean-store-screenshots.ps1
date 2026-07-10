param(
    [string]$InputDir = "store-assets\screenshots\source",
    [string]$OutputDir = "store-assets\screenshots\phone",
    [int]$TopCrop = 73,
    [int]$BottomCrop = 33
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

Add-Type -AssemblyName System.Drawing

function New-Directory($Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Save-CroppedScreenshot($SourcePath, $DestinationPath, [int]$Top, [int]$Bottom) {
    $loaded = [System.Drawing.Image]::FromFile($SourcePath)
    try {
        $source = New-Object System.Drawing.Bitmap($loaded)
    } finally {
        $loaded.Dispose()
    }

    try {
        $height = $source.Height - $Top - $Bottom
        if ($height -le 0) {
            throw "Invalid crop for $SourcePath. Source height: $($source.Height), top: $Top, bottom: $Bottom."
        }

        $crop = New-Object System.Drawing.Rectangle(0, $Top, $source.Width, $height)
        $result = $source.Clone($crop, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            New-Directory (Split-Path -Parent $DestinationPath)
            $result.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $result.Dispose()
        }
    } finally {
        $source.Dispose()
    }
}

$resolvedInput = Resolve-Path -LiteralPath $InputDir
New-Directory $OutputDir

$screenshots = @(
    @{ Source = "2-Photo-2.jpg"; Output = "01-row-scanning.png" },
    @{ Source = "3-Photo-3.jpg"; Output = "02-symbol-scanning-suggestions.png" },
    @{ Source = "4-Photo-4.jpg"; Output = "03-configuration-basic.png" },
    @{ Source = "5-Photo-5.jpg"; Output = "04-configuration-input-options.png" }
)

foreach ($screenshot in $screenshots) {
    $sourcePath = Join-Path $resolvedInput.Path $screenshot.Source
    $destinationPath = Join-Path $OutputDir $screenshot.Output
    Save-CroppedScreenshot $sourcePath $destinationPath $TopCrop $BottomCrop
    Write-Host "Generated $destinationPath"
}
