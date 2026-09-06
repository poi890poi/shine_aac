param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$moduleRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$speciesRules = Get-Content -LiteralPath (Join-Path $moduleRoot 'rules\species-proportions.json') -Raw | ConvertFrom-Json
$featherRules = Get-Content -LiteralPath (Join-Path $moduleRoot 'rules\feather-dynamics.json') -Raw | ConvertFrom-Json

if (-not $OutputPath) {
    $OutputPath = Join-Path $moduleRoot 'assets\guides\tail-curvature-atlas.png'
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
if (-not $resolvedOutput.StartsWith($moduleRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Output path must stay inside apps/bird-minigame.'
}
New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedOutput) -Force | Out-Null

$canvas = 1600
$cell = 400
$bitmap = New-Object System.Drawing.Bitmap($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::White)

$curvePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 36, 57, 96), 8)
$curvePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$curvePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$secondaryPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 85, 115, 164), 3)
$secondaryPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$secondaryPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$axisPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 210, 35, 35), 2)
$axisPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 128, 151, 176))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 25, 31, 48))
$font = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Bold)
$smallFont = New-Object System.Drawing.Font('Consolas', 10, [System.Drawing.FontStyle]::Regular)

try {
    for ($index = 0; $index -lt $speciesRules.species.Count; $index++) {
        $bird = $speciesRules.species[$index]
        $curve = $featherRules.species.($bird.id)
        if (-not $curve) { throw "Missing feather dynamics for $($bird.id)." }

        $column = $index % 4
        $row = [Math]::Floor($index / 4)
        $left = $column * $cell
        $top = $row * $cell
        $rootX = $left + 330.0
        $rootY = $top + 185.0
        $length = 70.0 + (170.0 * ([double]$bird.ratios.tailLength / 230.0))
        $drop = $length * [double]$curve.tipDropRatio
        $bendStart = $length * [double]$curve.bendStartRatio
        $tipAngle = [double]$curve.tipTangentDegrees * [Math]::PI / 180.0
        $tipControlLength = $length * 0.28

        $p0 = [System.Drawing.PointF]::new([float]$rootX, [float]$rootY)
        $p1 = [System.Drawing.PointF]::new([float]($rootX - $bendStart), [float]$rootY)
        $p3 = [System.Drawing.PointF]::new([float]($rootX - $length), [float]($rootY + $drop))
        $p2 = [System.Drawing.PointF]::new(
            [float]($p3.X + ($tipControlLength * [Math]::Cos($tipAngle))),
            [float]($p3.Y - ($tipControlLength * [Math]::Sin($tipAngle)))
        )

        $graphics.DrawString($bird.id, $font, $textBrush, [float]($left + 26), [float]($top + 28))
        $graphics.DrawString(
            "arc=$($bird.ratios.tailLength)  bend=$($curve.bendStartRatio)  drop=$($curve.tipDropRatio)  tip=$($curve.tipTangentDegrees)deg",
            $smallFont,
            $textBrush,
            [float]($left + 26),
            [float]($top + 62)
        )
        $graphics.DrawLine($axisPen, [float]($rootX - $length), [float]$rootY, [float]($rootX + 35), [float]$rootY)
        $graphics.FillEllipse($bodyBrush, [float]($rootX - 5), [float]($rootY - 35), 70, 70)
        $graphics.DrawBezier($curvePen, $p0, $p1, $p2, $p3)

        $separation = 5.0 + ((1.0 - [double]$curve.bundleCoherence) * 35.0)
        foreach ($offset in @(-1.0, 1.0)) {
            $q0 = [System.Drawing.PointF]::new($p0.X, [float]($p0.Y + ($offset * 4)))
            $q1 = [System.Drawing.PointF]::new($p1.X, [float]($p1.Y + ($offset * 4)))
            $q2 = [System.Drawing.PointF]::new($p2.X, [float]($p2.Y + ($offset * $separation * 0.55)))
            $q3 = [System.Drawing.PointF]::new($p3.X, [float]($p3.Y + ($offset * $separation)))
            $graphics.DrawBezier($secondaryPen, $q0, $q1, $q2, $q3)
        }
    }
    $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $curvePen.Dispose()
    $secondaryPen.Dispose()
    $axisPen.Dispose()
    $bodyBrush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $smallFont.Dispose()
}

Write-Output $resolvedOutput
