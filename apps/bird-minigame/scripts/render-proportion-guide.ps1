param(
    [Parameter(Mandatory = $true)]
    [string]$SpeciesId,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$moduleRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$speciesRules = Get-Content -LiteralPath (Join-Path $moduleRoot 'rules\species-proportions.json') -Raw | ConvertFrom-Json
$styleRules = Get-Content -LiteralPath (Join-Path $moduleRoot 'rules\cartoon-style.json') -Raw | ConvertFrom-Json
$bird = $speciesRules.species | Where-Object { $_.id -eq $SpeciesId } | Select-Object -First 1
if (-not $bird) { throw "Unknown species '$SpeciesId'." }

if (-not $OutputPath) {
    $OutputPath = Join-Path $moduleRoot "assets\guides\$SpeciesId-proportion-guide.png"
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
if (-not $resolvedOutput.StartsWith($moduleRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Output path must stay inside apps/bird-minigame.'
}
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$canvas = 1024
$bitmap = New-Object System.Drawing.Bitmap($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::White)

$headScale = [double]$styleRules.sharedExaggeration.headDiameter
$torsoScale = [double]$styleRules.sharedExaggeration.torsoDepth
$torsoLength = 100.0
$torsoDepth = [double]$bird.ratios.torsoDepth * $torsoScale
$headDiameter = [double]$bird.ratios.headDiameter * $headScale
$billLength = [double]$bird.ratios.billLength
$tailLength = [double]$bird.ratios.tailLength
$tailWidth = [double]$bird.ratios.tailWidth
$wingLength = [double]$bird.ratios.wingLength

$logicalWidth = $tailLength + $torsoLength + ($headDiameter * 0.55) + $billLength
$scale = [Math]::Min(4.25, 820.0 / $logicalWidth)
$centerY = 455.0
$tailTipX = 95.0
$tailRootX = $tailTipX + ($tailLength * $scale)
$torsoX = $tailRootX
$torsoY = $centerY - (($torsoDepth * $scale) / 2)
$torsoWidthPx = $torsoLength * $scale
$torsoDepthPx = $torsoDepth * $scale
$headPx = $headDiameter * $scale
$headCenterX = $torsoX + $torsoWidthPx - ($headPx * 0.08)
$headCenterY = $centerY - ($torsoDepthPx * 0.27)
$headX = $headCenterX - ($headPx / 2)
$headY = $headCenterY - ($headPx / 2)
$billPx = $billLength * $scale
$tailHalf = ($tailWidth * $scale) / 2

$outline = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 24, 28, 36), 5)
$axisPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 210, 35, 35), 2)
$axisPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$torsoBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 128, 151, 176))
$headBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 77, 104, 153))
$wingBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 94, 196, 192))
$tailBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 74, 78, 92))
$billBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 126, 78))
$anchorBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 214, 46, 128))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 25, 31, 48))
$font = New-Object System.Drawing.Font('Consolas', 18, [System.Drawing.FontStyle]::Regular)
$titleFont = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)

try {
    [System.Drawing.PointF[]]$tailPoints = @(
        [System.Drawing.PointF]::new([float]$tailRootX, [float]($centerY - $tailHalf)),
        [System.Drawing.PointF]::new([float]$tailTipX, [float]($centerY - ($tailHalf * 0.24))),
        [System.Drawing.PointF]::new([float]$tailTipX, [float]($centerY + ($tailHalf * 0.24))),
        [System.Drawing.PointF]::new([float]$tailRootX, [float]($centerY + $tailHalf))
    )
    $graphics.FillPolygon($tailBrush, $tailPoints)
    $graphics.DrawPolygon($outline, $tailPoints)

    $graphics.FillEllipse($torsoBrush, [float]$torsoX, [float]$torsoY, [float]$torsoWidthPx, [float]$torsoDepthPx)
    $graphics.DrawEllipse($outline, [float]$torsoX, [float]$torsoY, [float]$torsoWidthPx, [float]$torsoDepthPx)

    $wingWidth = [Math]::Min($torsoWidthPx * 0.82, $wingLength * $scale * 0.72)
    $wingHeight = $torsoDepthPx * 0.62
    $wingX = $torsoX + ($torsoWidthPx * 0.08)
    $wingY = $centerY - ($wingHeight * 0.52)
    $graphics.FillEllipse($wingBrush, [float]$wingX, [float]$wingY, [float]$wingWidth, [float]$wingHeight)
    $graphics.DrawEllipse($outline, [float]$wingX, [float]$wingY, [float]$wingWidth, [float]$wingHeight)

    $graphics.FillEllipse($headBrush, [float]$headX, [float]$headY, [float]$headPx, [float]$headPx)
    $graphics.DrawEllipse($outline, [float]$headX, [float]$headY, [float]$headPx, [float]$headPx)

    $billBaseX = $headCenterX + ($headPx * 0.44)
    $billHalfHeight = $headPx * 0.11
    [System.Drawing.PointF[]]$billPoints = @(
        [System.Drawing.PointF]::new([float]$billBaseX, [float]($headCenterY - $billHalfHeight)),
        [System.Drawing.PointF]::new([float]($billBaseX + $billPx), [float]$headCenterY),
        [System.Drawing.PointF]::new([float]$billBaseX, [float]($headCenterY + $billHalfHeight))
    )
    $graphics.FillPolygon($billBrush, $billPoints)
    $graphics.DrawPolygon($outline, $billPoints)

    $wingRootX = $torsoX + ($torsoWidthPx * 0.31)
    $wingRootY = $centerY - ($torsoDepthPx * 0.22)
    $graphics.FillEllipse($anchorBrush, [float]($wingRootX - 8), [float]($wingRootY - 8), 16, 16)
    $graphics.DrawLine($axisPen, [float]$tailTipX, [float]$centerY, [float]($billBaseX + $billPx), [float]$centerY)

    $legY = $centerY + ($torsoDepthPx * 0.46)
    $legPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 105, 73, 64), 5)
    try {
        $graphics.DrawLine($legPen, [float]($torsoX + $torsoWidthPx * 0.58), [float]$legY, [float]($torsoX + $torsoWidthPx * 0.57), [float]($legY + 70))
        $graphics.DrawLine($legPen, [float]($torsoX + $torsoWidthPx * 0.72), [float]$legY, [float]($torsoX + $torsoWidthPx * 0.73), [float]($legY + 70))
    } finally { $legPen.Dispose() }

    # Keep the geometry guide ASCII-only so Windows PowerShell 5.1 cannot
    # corrupt labels when the repository is checked out with a different
    # console/code-page configuration. Localized names remain in the rules.
    $graphics.DrawString("$($bird.scientific)  [$($bird.id)]", $titleFont, $textBrush, 60, 40)
    $graphics.DrawString("torso=100  depth=$($bird.ratios.torsoDepth)  head=$($bird.ratios.headDiameter)  bill=$billLength  wing=$wingLength  tail=$tailLength", $font, $textBrush, 60, 850)
    $graphics.DrawString('Geometry scaffold: preserve silhouette and component ratios.', $font, $textBrush, 60, 892)
    $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $outline.Dispose()
    $axisPen.Dispose()
    $torsoBrush.Dispose()
    $headBrush.Dispose()
    $wingBrush.Dispose()
    $tailBrush.Dispose()
    $billBrush.Dispose()
    $anchorBrush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $titleFont.Dispose()
}

Write-Output $resolvedOutput
