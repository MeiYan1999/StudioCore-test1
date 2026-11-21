param([Parameter(Mandatory=$true)][string]$AppPath, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$locations = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
foreach ($location in $locations) {
  $file = Join-Path $location 'StudioCore Drive.lnk'
  if ($Remove) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue; continue }
  $shortcut = $shell.CreateShortcut($file)
  $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
  $node = (Get-Command node.exe).Source
  $shortcut.Arguments = '"' + (Join-Path $AppPath 'windows\hidden.vbs') + '" "' + $node + '" "' + (Join-Path $AppPath 'cli.js') + '" gui'
  $shortcut.WorkingDirectory = $AppPath
  $shortcut.Description = 'StudioCore Drive'
  $shortcut.Save()
}
