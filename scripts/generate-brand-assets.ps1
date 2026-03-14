param(
    [string]$SourceImage = (Join-Path $PSScriptRoot '..\image.png')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$publicDir = Join-Path $projectRoot 'public'
$androidResDir = Join-Path $projectRoot 'android\app\src\main\res'

$brandDark = [System.Drawing.Color]::FromArgb(0x17, 0x30, 0x4C)
$brandTeal = [System.Drawing.Color]::FromArgb(0x2D, 0x5F, 0x6F)
$brandGold = [System.Drawing.Color]::FromArgb(0xD7, 0xA3, 0x3D)
$brandWhite = [System.Drawing.Color]::FromArgb(0xF8, 0xFB, 0xFF)

function New-Bitmap {
    param(
        [int]$Width,
        [int]$Height
    )

    return New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function New-ColorizedMask {
    param(
        [string]$ImagePath,
        [System.Drawing.Color]$Tint
    )

    $source = [System.Drawing.Bitmap]::new($ImagePath)
    try {
        $mask = New-Bitmap -Width $source.Width -Height $source.Height
        $minX = $source.Width
        $minY = $source.Height
        $maxX = -1
        $maxY = -1

        for ($y = 0; $y -lt $source.Height; $y++) {
            for ($x = 0; $x -lt $source.Width; $x++) {
                $pixel = $source.GetPixel($x, $y)
                $intensity = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))

                if ($intensity -lt 10) {
                    $mask.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                    continue
                }

                $alpha = [Math]::Min(255, [int]([Math]::Pow($intensity / 255.0, 0.92) * 255))
                $mask.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $Tint.R, $Tint.G, $Tint.B))

                if ($alpha -gt 20) {
                    if ($x -lt $minX) { $minX = $x }
                    if ($y -lt $minY) { $minY = $y }
                    if ($x -gt $maxX) { $maxX = $x }
                    if ($y -gt $maxY) { $maxY = $y }
                }
            }
        }

        if ($maxX -lt 0 -or $maxY -lt 0) {
            throw 'The source image does not contain a visible mark.'
        }

        $padding = 4
        $cropRect = [System.Drawing.Rectangle]::new(
            [Math]::Max(0, $minX - $padding),
            [Math]::Max(0, $minY - $padding),
            [Math]::Min($source.Width - [Math]::Max(0, $minX - $padding), ($maxX - $minX) + (2 * $padding) + 1),
            [Math]::Min($source.Height - [Math]::Max(0, $minY - $padding), ($maxY - $minY) + (2 * $padding) + 1)
        )

        $cropped = New-Bitmap -Width $cropRect.Width -Height $cropRect.Height
        $graphics = [System.Drawing.Graphics]::FromImage($cropped)
        try {
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.DrawImage($mask, [System.Drawing.Rectangle]::new(0, 0, $cropRect.Width, $cropRect.Height), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
        }
        finally {
            $graphics.Dispose()
            $mask.Dispose()
        }

        return $cropped
    }
    finally {
        $source.Dispose()
    }
}

function Set-GraphicsQuality {
    param([System.Drawing.Graphics]$Graphics)

    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
}

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Save-TransparentLogo {
    param(
        [System.Drawing.Bitmap]$Mask,
        [int]$Size,
        [string]$Destination
    )

    $canvas = New-Bitmap -Width $Size -Height $Size
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
        Set-GraphicsQuality -Graphics $graphics
        $graphics.Clear([System.Drawing.Color]::Transparent)

        $targetWidth = [int]($Size * 0.8)
        $scale = [Math]::Min($targetWidth / $Mask.Width, ($Size * 0.8) / $Mask.Height)
        $drawWidth = [int]($Mask.Width * $scale)
        $drawHeight = [int]($Mask.Height * $scale)
        $drawX = [int](($Size - $drawWidth) / 2)
        $drawY = [int](($Size - $drawHeight) / 2)

        $graphics.DrawImage($Mask, [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight))
        $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
    }
}

function Save-Icon {
    param(
        [System.Drawing.Bitmap]$Mask,
        [int]$Size,
        [string]$Destination,
        [switch]$Round
    )

    $canvas = New-Bitmap -Width $Size -Height $Size
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
        Set-GraphicsQuality -Graphics $graphics
        $graphics.Clear([System.Drawing.Color]::Transparent)

        if ($Round) {
            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $path.AddEllipse(0, 0, $Size, $Size)
        } else {
            $path = New-RoundedRectPath -X 0 -Y 0 -Width $Size -Height $Size -Radius ($Size * 0.24)
        }

        try {
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
                ([System.Drawing.PointF]::new(0, 0)),
                ([System.Drawing.PointF]::new($Size, $Size)),
                $brandDark,
                $brandTeal
            )
            $graphics.FillPath($brush, $path)
            $brush.Dispose()

            $glowRect = [System.Drawing.RectangleF]::new($Size * 0.44, $Size * 0.14, $Size * 0.34, $Size * 0.34)
            $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(54, $brandGold.R, $brandGold.G, $brandGold.B))
            $graphics.FillEllipse($glowBrush, $glowRect)
            $glowBrush.Dispose()

            $glowInnerRect = [System.Drawing.RectangleF]::new($Size * 0.5, $Size * 0.2, $Size * 0.18, $Size * 0.18)
            $glowInnerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(88, $brandGold.R, $brandGold.G, $brandGold.B))
            $graphics.FillEllipse($glowInnerBrush, $glowInnerRect)
            $glowInnerBrush.Dispose()

            $targetWidth = [int]($Size * 0.58)
            $scale = [Math]::Min($targetWidth / $Mask.Width, ($Size * 0.58) / $Mask.Height)
            $drawWidth = [int]($Mask.Width * $scale)
            $drawHeight = [int]($Mask.Height * $scale)
            $drawX = [int](($Size - $drawWidth) / 2)
            $drawY = [int](($Size - $drawHeight) / 2)

            $graphics.DrawImage($Mask, [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight))
            $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $path.Dispose()
        }
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
    }
}

function Save-ForegroundMark {
    param(
        [System.Drawing.Bitmap]$Mask,
        [int]$Size,
        [string]$Destination
    )

    $canvas = New-Bitmap -Width $Size -Height $Size
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
        Set-GraphicsQuality -Graphics $graphics
        $graphics.Clear([System.Drawing.Color]::Transparent)

        $targetWidth = [int]($Size * 0.62)
        $scale = [Math]::Min($targetWidth / $Mask.Width, ($Size * 0.62) / $Mask.Height)
        $drawWidth = [int]($Mask.Width * $scale)
        $drawHeight = [int]($Mask.Height * $scale)
        $drawX = [int](($Size - $drawWidth) / 2)
        $drawY = [int](($Size - $drawHeight) / 2)

        $graphics.DrawImage($Mask, [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight))
        $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
    }
}

$sourcePath = (Resolve-Path $SourceImage).Path
$logoMask = New-ColorizedMask -ImagePath $sourcePath -Tint $brandDark
$whiteMask = New-ColorizedMask -ImagePath $sourcePath -Tint $brandWhite

try {
    Save-TransparentLogo -Mask $logoMask -Size 1024 -Destination (Join-Path $publicDir 'logo.png')

    foreach ($size in 48, 72, 96, 144, 192, 512, 1024) {
        Save-Icon -Mask $whiteMask -Size $size -Destination (Join-Path $publicDir ("icon-{0}.png" -f $size))
    }

    $androidSizes = @{
        'mipmap-mdpi' = 48
        'mipmap-hdpi' = 72
        'mipmap-xhdpi' = 96
        'mipmap-xxhdpi' = 144
        'mipmap-xxxhdpi' = 192
    }

    foreach ($entry in $androidSizes.GetEnumerator()) {
        $dir = Join-Path $androidResDir $entry.Key
        $size = [int]$entry.Value
        Save-Icon -Mask $whiteMask -Size $size -Destination (Join-Path $dir 'ic_launcher.png')
        Save-Icon -Mask $whiteMask -Size $size -Destination (Join-Path $dir 'ic_launcher_round.png') -Round
        Save-ForegroundMark -Mask $whiteMask -Size $size -Destination (Join-Path $dir 'ic_launcher_foreground.png')
    }

    Write-Output 'Brand assets generated successfully.'
}
finally {
    $logoMask.Dispose()
    $whiteMask.Dispose()
}