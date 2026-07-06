param(
    [string]$SourcePath = "store-assets\source\saytome-mascot-source.jpg"
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

function Resize-Bitmap($Bitmap, [int]$Width, [int]$Height) {
    $result = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($result)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Bitmap, 0, 0, $Width, $Height)
    $graphics.Dispose()
    return $result
}

function Save-Png($Bitmap, $Path) {
    New-Directory (Split-Path -Parent $Path)
    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-Color($Hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-TextFromCodepoints([int[]]$Codepoints) {
    return [string]::Concat([char[]]$Codepoints)
}

function Draw-FeatureGraphic($Icon, $Path) {
    $width = 1024
    $height = 500
    $paper = New-Color "#F6F4EE"
    $activeTeal = New-Color "#1F6F78"
    $deepTeal = New-Color "#123F45"
    $ink = New-Color "#172027"
    $activationOrange = New-Color "#F08C00"

    $canvas = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear($paper)

    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($activeTeal)), 0, 0, 355, $height)
    $graphics.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(42, $activationOrange))), 725, 58, 170, 170)
    $graphics.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(62, $activeTeal))), 855, 305, 135, 135)

    $graphics.DrawImage($Icon, 28, 100, 300, 300)

    $titleFont = New-Object System.Drawing.Font("Microsoft JhengHei UI", 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $englishFont = New-Object System.Drawing.Font("Segoe UI", 38, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = New-Object System.Drawing.Font("Microsoft JhengHei UI", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $smallFont = New-Object System.Drawing.Font("Microsoft JhengHei UI", 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $titleBrush = New-Object System.Drawing.SolidBrush($deepTeal)
    $inkBrush = New-Object System.Drawing.SolidBrush($ink)
    $tealBrush = New-Object System.Drawing.SolidBrush($activeTeal)
    $zhTitle = New-TextFromCodepoints @(0x6211, 0x60F3, 0x8AAA)
    $zhSubtitle = New-TextFromCodepoints @(0x65E9, 0x671F, 0x958B, 0x767C, 0x4E2D, 0x7684, 0x8F14, 0x52A9, 0x6E9D, 0x901A, 0x5DE5, 0x5177)
    $zhFeatures = New-TextFromCodepoints @(0x55AE, 0x4E00, 0x958B, 0x95DC, 0x6383, 0x63CF, 0x20, 0x00B7, 0x20, 0x53F0, 0x7063, 0x4E2D, 0x6587, 0x8F38, 0x5165, 0x20, 0x00B7, 0x20, 0x8A9E, 0x97F3, 0x8F38, 0x51FA)

    $graphics.DrawString($zhTitle, $titleFont, $titleBrush, 410, 102)
    $graphics.DrawString("SayToMe AAC", $englishFont, $inkBrush, 414, 185)
    $graphics.DrawString($zhSubtitle, $subtitleFont, $inkBrush, 414, 260)
    $graphics.DrawString($zhFeatures, $smallFont, $tealBrush, 416, 316)

    $graphics.Dispose()
    Save-Png $canvas $Path
    $canvas.Dispose()
}

$resolvedSource = Resolve-Path -LiteralPath $SourcePath
$loaded = [System.Drawing.Image]::FromFile($resolvedSource.Path)
$source = New-Object System.Drawing.Bitmap($loaded)
$loaded.Dispose()

$storeIcon512 = Resize-Bitmap $source 512 512
Save-Png $storeIcon512 "store-assets\app-icon\saytome-aac-icon-512.png"

$storeIcon1024 = Resize-Bitmap $source 1024 1024
Save-Png $storeIcon1024 "store-assets\app-icon\saytome-aac-icon-1024.png"

$densities = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $densities.GetEnumerator()) {
    $resized = Resize-Bitmap $source $entry.Value $entry.Value
    Save-Png $resized (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher.png")
    Save-Png $resized (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher_round.png")
    $resized.Dispose()
}

Draw-FeatureGraphic $storeIcon512 "store-assets\feature-graphic\saytome-aac-feature-graphic.png"

$storeIcon512.Dispose()
$storeIcon1024.Dispose()
$source.Dispose()

Write-Host "Generated store assets and launcher icons from the original source image."
