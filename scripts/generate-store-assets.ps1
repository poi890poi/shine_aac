param(
    [string]$SourcePath = "store-assets\source\saytome-mascot-source.jpg",
    [switch]$GenerateFeatureGraphic
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

function New-TransparentBitmap([int]$Width, [int]$Height) {
    $result = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($result)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.Dispose()
    return $result
}

function Remove-EdgeMatte($Bitmap) {
    $width = $Bitmap.Width
    $height = $Bitmap.Height
    $result = New-Object System.Drawing.Bitmap($Bitmap)
    $visited = New-Object 'bool[,]' $width, $height
    $queue = New-Object 'System.Collections.Generic.Queue[System.Drawing.Point]'

    function Test-MattePixel($Pixel) {
        if ($Pixel.A -eq 0) {
            return $true
        }

        return ($Pixel.R -le 18 -and $Pixel.G -le 18 -and $Pixel.B -le 18)
    }

    function Add-Point([int]$X, [int]$Y) {
        if ($X -lt 0 -or $Y -lt 0 -or $X -ge $width -or $Y -ge $height -or $visited[$X, $Y]) {
            return
        }

        $visited[$X, $Y] = $true
        if (Test-MattePixel $result.GetPixel($X, $Y)) {
            $queue.Enqueue((New-Object System.Drawing.Point($X, $Y)))
        }
    }

    for ($x = 0; $x -lt $width; $x++) {
        Add-Point $x 0
        Add-Point $x ($height - 1)
    }
    for ($y = 0; $y -lt $height; $y++) {
        Add-Point 0 $y
        Add-Point ($width - 1) $y
    }

    while ($queue.Count -gt 0) {
        $point = $queue.Dequeue()
        $pixel = $result.GetPixel($point.X, $point.Y)
        $result.SetPixel($point.X, $point.Y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
        Add-Point ($point.X + 1) $point.Y
        Add-Point ($point.X - 1) $point.Y
        Add-Point $point.X ($point.Y + 1)
        Add-Point $point.X ($point.Y - 1)
    }

    return $result
}

function New-RoundLauncherBitmap($Icon, [int]$Size) {
    $canvas = New-TransparentBitmap $Size $Size
    $resized = Resize-Bitmap $Icon $Size $Size
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $Size, $Size)
    $graphics.SetClip($path)
    $backgroundPixel = $Icon.GetPixel([int]($Icon.Width / 2), [int]($Icon.Height / 2))
    $backgroundBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $backgroundPixel.R, $backgroundPixel.G, $backgroundPixel.B))
    $graphics.FillEllipse($backgroundBrush, 0, 0, $Size, $Size)
    $graphics.DrawImage($resized, 0, 0, $Size, $Size)
    $graphics.Dispose()
    $backgroundBrush.Dispose()
    $path.Dispose()
    $resized.Dispose()
    return $canvas
}

function New-LegacyLauncherBitmap($Icon, [int]$Size) {
    $canvas = New-TransparentBitmap $Size $Size
    $imageSize = [int][Math]::Round($Size * 0.875)
    $offset = [int][Math]::Floor(($Size - $imageSize) / 2)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Icon, $offset, $offset, $imageSize, $imageSize)
    $graphics.Dispose()
    return $canvas
}

function New-AdaptiveForegroundBitmap($Icon, [int]$CanvasSize) {
    $canvas = New-TransparentBitmap $CanvasSize $CanvasSize
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Icon, 0, 0, $CanvasSize, $CanvasSize)
    $graphics.Dispose()
    return $canvas
}

function New-MonochromeLauncherBitmap($Icon, [int]$CanvasSize) {
    $canvas = New-TransparentBitmap $CanvasSize $CanvasSize
    $source = Resize-Bitmap $Icon $CanvasSize $CanvasSize

    for ($y = 0; $y -lt $CanvasSize; $y++) {
        for ($x = 0; $x -lt $CanvasSize; $x++) {
            $pixel = $source.GetPixel($x, $y)
            if ($pixel.A -eq 0) {
                continue
            }

            $luma = [int](($pixel.R * 0.299) + ($pixel.G * 0.587) + ($pixel.B * 0.114))
            if ($luma -gt 128) {
                $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
            }
        }
    }

    $source.Dispose()
    return $canvas
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
$launcherSource = Remove-EdgeMatte $storeIcon1024

$densities = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $densities.GetEnumerator()) {
    $legacy = New-LegacyLauncherBitmap $launcherSource $entry.Value
    $round = New-RoundLauncherBitmap $launcherSource $entry.Value
    $foregroundSize = [int]($entry.Value * 2.25)
    $foreground = New-AdaptiveForegroundBitmap $launcherSource $foregroundSize
    $monochrome = New-MonochromeLauncherBitmap $launcherSource $foregroundSize

    Save-Png $legacy (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher.png")
    Save-Png $round (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher_round.png")
    Save-Png $foreground (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher_foreground.png")
    Save-Png $monochrome (Join-Path "app\src\main\res\$($entry.Key)" "ic_launcher_monochrome.png")

    $legacy.Dispose()
    $round.Dispose()
    $foreground.Dispose()
    $monochrome.Dispose()
}

if ($GenerateFeatureGraphic) {
    Draw-FeatureGraphic $storeIcon512 "store-assets\feature-graphic\saytome-aac-feature-graphic.png"
}

$storeIcon512.Dispose()
$storeIcon1024.Dispose()
$launcherSource.Dispose()
$source.Dispose()

Write-Host "Generated store assets and launcher icons from the original source image."
