param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][int]$MaxSize
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = $null
$bitmap = $null
$graphics = $null
try {
  $source = [System.Drawing.Image]::FromFile($InputPath)
  $ratio = [Math]::Min(1.0, $MaxSize / [double][Math]::Max($source.Width, $source.Height))
  $width = [Math]::Max(1, [int][Math]::Round($source.Width * $ratio))
  $height = [Math]::Max(1, [int][Math]::Round($source.Height * $ratio))
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source, 0, 0, $width, $height)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
} finally {
  if ($graphics) { $graphics.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($source) { $source.Dispose() }
}
